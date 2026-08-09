/* ══════════════════════════════════════════════
   READ PATH — STEPS · EDGE (level 1-4: dns, browser, cdn, lb)

   Đi generic qua EDGE_ORDER dựa trên run.trail: level nào có mặt trong
   trail thì được request thật sự chạm tới (hit hoặc miss-forward); level
   nào không có mặt nghĩa là một level TRƯỚC nó đã trả lời rồi — request
   không bao giờ chạm tới, và đó chính là bài học short-circuit (xem Risk
   Assessment trong phase-01: "mỗi level bị bỏ qua phải có phase nói rõ nó
   không chạy", không gộp chung một câu). */
(function() {
const KIT = window.SCENE_KIT;
const LV = window.ECOM_CACHE_LEVELS;

const EDGE_ORDER = ['dns', 'browser', 'cdn', 'lb'];
const COMPONENT = {dns: 'dns-resolver', browser: 'browser-cache', cdn: 'cdn-edge', lb: 'lb-proxy'};
const PIPELINE = {dns: 0, browser: 1, cdn: 2, lb: 3};

function trailByKey(run) {
  const map = {};
  run.trail.forEach(function(e) { map[e.key] = e; });
  return map;
}

function skipPhase(key, stopComp) {
  const comp = COMPONENT[key];
  return {
    title: LV.byKey(key).name + ' không bao giờ chạy',
    pipelineStep: PIPELINE[key],
    focus: [stopComp, comp],
    phases: [{
      title: LV.byKey(key).name + ' bị short-circuit',
      desc: KIT.desc(
        '<b>' + LV.byKey(key).name + '</b> không bao giờ được hỏi tới trong request này.',
        'Một level phía trước đã trả lời rồi, nên chuỗi lookup dừng lại ở đó.',
        'Đây chính là điểm cốt lõi của cascade cache: gần client hơn = rẻ hơn, và khi nó trả lời thì mọi thứ phía sau nó vô hình với request.'
      ),
      focus: [stopComp, comp],
      set: (function() {
        var set = {};
        set[stopComp] = KIT.pulse('ok', 'response dừng ở đây', {at: 0.2});
        set[comp] = KIT.mark('mute', 'không chạy', {at: 0.85});
        return set;
      })()
    }]
  };
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

  var body = [
    '<code>control</code>: ' + lv.control,
    '<code>invalidation</code>: ' + lv.invalidation
  ];
  if (key === 'browser') {
    body = [
      'Ba loại resource khác nhau đi qua đây: bundle JS/CSS hashed → <code>Cache-Control: immutable</code>, ảnh hero → <code>max-age + ETag</code>, còn API giá <code>/api/price</code> → <code>no-store</code>.',
      'Giá luôn phải tươi nên browser <b>không</b> được cache nó — đây là lý do request luôn phải rời khỏi thiết bị dù bundle/ảnh đã có sẵn.'
    ];
  }
  if (key === 'cdn' && hit) {
    body = body.concat(['Ngoài hit-fresh, CDN có thể phục vụ SWR (stale-while-revalidate): trả bản cũ ngay lập tức rồi âm thầm revalidate ở background — vẫn tính là hit với người dùng.']);
  }

  var desc = KIT.desc(
    hit
      ? '<b>Freshness gate:</b> key khớp và entry vẫn nằm trong fresh window của ' + lv.name + '.'
      : '<b>Miss condition:</b> key không tồn tại, đã hết fresh window hoặc policy chủ động bypass cache.',
    body,
    hit
      ? 'Cumulative latency dừng ở ' + LV.fmtMs(entry.cumulativeMs) + ' — mọi level phía sau ' + lv.name + ' không bao giờ chạy.'
      : 'TTL ' + LV.fmtTtl(lv.ttlSec) + ' — số minh hoạ, không phải benchmark thật.'
  );

  var phase = {
    title: hit ? lv.name + ' trả lời — request dừng ở đây' : lv.name + ' miss — forward tiếp',
    desc: desc,
    focus: [prevComp, comp],
    set: beat.set,
    scene: beat.scene
  };
  if (hit) {
    const requestScene = phase.scene;
    phase.set.client = KIT.pulse('ok', 'response nhận ✓', {at: 1.75});
    phase.scene = function(a) {
      requestScene(a);
      KIT.link(a, comp, 'client', 'ok', {at: 1.05, dur: 0.7, lift: 2.4, label: '200 · cache hit'});
    };
    phase.scoreMode = true;
    phase.scoreTitle = 'Read path · served';
    phase.scores = [
      KIT.gauge('cumulative latency', entry.cumulativeMs, run.fullDepthMs, ' ms', {tone: 'ok'}),
      KIT.score('served by', 100, {txt: lv.name}),
      KIT.score('saved vs full miss', Math.round(run.savedPct * 100), {txt: LV.fmtMs(run.savedMs), tone: 'ok'})
    ];
  }
  return {
    title: lv.name + (hit ? ' — hit' : ' — miss'),
    pipelineStep: PIPELINE[key],
    focus: [prevComp, comp],
    phases: [phase]
  };
}

window.createReadPathEdgeSteps = function(run) {
  const byKey = trailByKey(run);
  const steps = [];
  var prevComp = 'client';
  EDGE_ORDER.forEach(function(key) {
    const entry = byKey[key];
    if (entry) {
      steps.push(realPhase(key, entry, run, prevComp));
      prevComp = COMPONENT[key];
    } else {
      steps.push(skipPhase(key, prevComp));
    }
  });
  return steps;
};

window.readPathLastEdgeComponent = function(run) {
  const byKey = trailByKey(run);
  var last = 'client';
  EDGE_ORDER.forEach(function(key) { if (byKey[key]) last = COMPONENT[key]; });
  return last;
};
})();
