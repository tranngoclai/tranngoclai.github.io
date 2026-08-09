/* ══════════════════════════════════════════════
   READ PATH — STEPS · ORIGIN (level 5-8: redis, orm, db, os + disk)

   Nếu edge (dns/browser/cdn/lb) đã trả lời thì origin tier không bao giờ
   được chạm tới — gộp lại thành MỘT phase duy nhất thay vì bốn phase skip
   riêng lẻ, vì origin-app còn chưa nhận được request nên không có gì để vẽ
   riêng cho từng level.

   Khi origin tier thật sự chạy: thứ tự đọc là redis → orm → db → os, ĐÚNG
   thứ tự request thật đi (app hỏi Redis rồi ORM trước khi chạm buffer pool
   của DB engine) — khác thứ tự numbering doc §6/§7. Đây là bẫy ở §7 mà
   ecommerce-cache-flow-3d-layout.js đã ghi chú khi đặt X.orm trước X.db. */
(function() {
const KIT = window.SCENE_KIT;
const LV = window.ECOM_CACHE_LEVELS;

const ORIGIN_ORDER = ['redis', 'orm', 'db', 'os'];
const COMPONENT = {redis: 'redis', orm: 'orm-cache', db: 'db-engine', os: 'os-cache'};

function trailByKey(run) {
  const map = {};
  run.trail.forEach(function(e) { map[e.key] = e; });
  return map;
}

function realPhase(key, entry, run, prevComp) {
  const comp = COMPONENT[key];
  const lv = LV.byKey(key);
  const hit = entry.hit;
  const tone = hit ? 'crown' : 'danger';
  const badge = hit ? 'crown ✓ · ' + LV.fmtMs(entry.serveMs) : 'miss · +' + LV.fmtMs(entry.serveMs);

  const beat = KIT.beat(prevComp, comp, hit ? 'ok' : 'danger', {
    mark: [tone, badge], dy: 2.8,
    link: {label: 'GET /products/' + run.productId.replace('PID-', '')},
    hover: hit ? lv.name + ' trả lời request' : lv.name + ' miss, forward tiếp'
  });

  var why = hit
    ? 'Cumulative latency dừng ở ' + LV.fmtMs(entry.cumulativeMs) + ' — mọi level phía sau ' + lv.name + ' không bao giờ chạy.'
    : (key === 'orm'
        ? 'ORM cache đứng TRƯỚC DB engine trên đường đọc thật dù doc đánh số nó là level 7 (sau level 6 DB engine) — bẫy §7: code đi qua ORM trước khi chạm buffer pool.'
        : 'TTL ' + LV.fmtTtl(lv.ttlSec) + ' — số minh hoạ, không phải benchmark thật.');

  var phase = {
    title: hit ? lv.name + ' trả lời — request dừng ở đây' : lv.name + ' miss — forward tiếp',
    desc: KIT.desc(
      hit ? '<b>Freshness gate:</b> key khớp và entry vẫn nằm trong fresh window của ' + lv.name + '.'
          : '<b>Miss condition:</b> key không tồn tại, đã hết fresh window hoặc policy chủ động bypass cache.',
      ['<code>control</code>: ' + lv.control, '<code>invalidation</code>: ' + lv.invalidation],
      why
    ),
    focus: [prevComp, comp],
    set: beat.set,
    scene: beat.scene
  };
  if (hit) {
    const requestScene = phase.scene;
    phase.set.client = KIT.pulse('ok', 'response nhận ✓', {at: 1.75});
    phase.scene = function(a) {
      requestScene(a);
      KIT.link(a, comp, 'client', 'ok', {at: 1.05, dur: 0.7, lift: 2.8, label: '200 · cache hit'});
    };
    phase.scoreMode = true;
    phase.scoreTitle = 'Read path · served';
    phase.scores = [
      KIT.gauge('cumulative latency', entry.cumulativeMs, run.fullDepthMs, ' ms', {tone: 'ok'}),
      KIT.score('served by', 100, {txt: lv.name}),
      KIT.score('saved vs full miss', Math.round(run.savedPct * 100), {txt: LV.fmtMs(run.savedMs), tone: 'ok'})
    ];
  }
  return {title: lv.name + (hit ? ' — hit' : ' — miss'), pipelineStep: 5, focus: [prevComp, comp], phases: [phase]};
}

function diskPhase(entry, run, prevComp) {
  const beat = KIT.beat(prevComp, 'disk', 'ok', {
    mark: ['crown', 'crown ✓ · ' + LV.fmtMs(entry.serveMs)], dy: 2.8,
    link: {label: 'GET /products/' + run.productId.replace('PID-', '')},
    hover: 'Mọi cache đều miss — đọc thẳng từ đĩa'
  });
  return {
    title: 'Disk — nguồn thật, không còn gì để miss nữa',
    pipelineStep: 5,
    focus: [prevComp, 'disk'],
    phases: [{
      title: 'Đĩa trả lời — toàn bộ 8 level cache đều đã miss',
      desc: KIT.desc(
        '<b>Cold path đầy đủ</b>: dns → browser → cdn → lb → redis → orm → db → os đều miss, request phải đọc thẳng từ đĩa.',
        'Đây là chi phí trần — mọi level cache phía trước tồn tại chính là để tránh cú đọc này.',
        'Cumulative latency ' + LV.fmtMs(entry.cumulativeMs) + ' — đúng bằng <code>run.fullDepthMs</code>, không có gì được tiết kiệm.'
      ),
      focus: [prevComp, 'disk'],
      set: beat.set,
      scene: function(a) {
        beat.scene(a);
        KIT.link(a, 'disk', 'client', 'ok', {at: 1.05, dur: 0.85, lift: 3.2, label: '200 · dữ liệu gốc'});
      },
      scoreMode: true,
      scoreTitle: 'Read path · cold',
      scores: [
        KIT.gauge('cumulative latency', entry.cumulativeMs, run.fullDepthMs, ' ms', {tone: 'danger'}),
        KIT.score('served by', 100, {txt: 'Disk'}),
        KIT.score('saved vs full miss', 0, {txt: LV.fmtMs(0), tone: 'danger'})
      ]
    }]
  };
}

window.createReadPathOriginSteps = function(run) {
  const byKey = trailByKey(run);
  const reachedOrigin = ORIGIN_ORDER.some(function(k) { return !!byKey[k]; }) || run.servedBy.key === 'disk';

  if (!reachedOrigin) {
    return [{
      title: 'Origin tier không bao giờ chạy',
      pipelineStep: 4,
      focus: ['origin-app'],
      phases: [{
        title: 'Redis → ORM → DB engine → OS page cache — cả bốn không bao giờ chạy',
        desc: KIT.desc(
          '<b>Origin app còn chưa nhận được request này.</b>',
          'Một level ở edge (browser/CDN/LB) đã trả lời trước rồi, nên request không bao giờ rời khỏi edge để chạm origin.',
          'Đây là short-circuit ở mức mạnh nhất: cả một tầng bốn level bị bỏ qua cùng lúc, không chỉ một level đơn lẻ.'
        ),
        focus: ['origin-app', 'redis', 'orm-cache', 'db-engine', 'os-cache'],
        set: {
          redis: KIT.mark('mute', 'không chạy', {at: 0.35}),
          'orm-cache': KIT.mark('mute', 'không chạy', {at: 0.55}),
          'db-engine': KIT.mark('mute', 'không chạy', {at: 0.75}),
          'os-cache': KIT.mark('mute', 'không chạy', {at: 0.95})
        }
      }]
    }];
  }

  const lastEdgeComp = window.readPathLastEdgeComponent(run);
  const entryBeat = KIT.beat(lastEdgeComp, 'origin-app', 'subject', {
    mark: ['core', 'request nhận'], dy: 2.8,
    link: {label: 'GET /products/' + run.productId.replace('PID-', '')},
    hover: 'Origin app nhận request sau khi mọi cache edge đều miss'
  });
  const steps = [{
    title: 'Origin app nhận request',
    pipelineStep: 4,
    focus: [lastEdgeComp, 'origin-app'],
    phases: [{
      title: 'Request tới được origin app — mọi cache edge đều đã miss',
      desc: KIT.desc(
        '<b>Origin app</b> (ShopHub SSR process) nhận request sau khi browser, CDN, LB đều miss.',
        'Từ đây app tự tay hỏi Redis rồi ORM trước khi chạm DB engine thật.',
        'Đây là điểm mà mọi chi phí edge đã trôi qua — mỗi level tiếp theo hit sẽ cứu một khoảng round-trip lớn hơn round-trip trước.'
      ),
      focus: [lastEdgeComp, 'origin-app'],
      set: entryBeat.set,
      scene: entryBeat.scene
    }]
  }];

  var prevComp = 'origin-app';
  ORIGIN_ORDER.forEach(function(key) {
    const entry = byKey[key];
    if (entry) {
      steps.push(realPhase(key, entry, run, prevComp));
      prevComp = COMPONENT[key];
    }
  });

  if (run.servedBy.key === 'disk') {
    const diskEntry = run.trail[run.trail.length - 1];
    steps.push(diskPhase(diskEntry, run, prevComp));
  }

  return steps;
};
})();
