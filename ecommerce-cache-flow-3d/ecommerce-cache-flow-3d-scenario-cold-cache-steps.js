/* ══════════════════════════════════════════════
   COLD CACHE — STEPS · 4 ARC (trigger → walk → fill-back → verdict)

   Arc A giải thích TẠI SAO từng level cold (deploy vs restart, và dns thì
   không cold). Arc B là cú đọc thật — walk hết cả 8 level, không short-
   circuit ở đâu cả (khác hẳn read path), disk là `crown` duy nhất trong cả
   deck 4 scenario mà nó nhận badge đó. Arc C lấp lại NGƯỢC: request #1 làm
   ấm os → db → orm → redis, request #2 lấp LB, request #3 lấp CDN — browser
   không nằm trong warm-up vì nó per-user, không chia sẻ giữa các request.
   Arc D là HUD so sánh cold/warm bằng đúng số
   `simulate()` trả về, không tính lại. */
(function() {
const KIT = window.SCENE_KIT;
const LV = window.ECOM_CACHE_LEVELS;

const COMPONENT = {dns: 'dns-resolver', browser: 'browser-cache', cdn: 'cdn-edge', lb: 'lb-proxy', redis: 'redis', orm: 'orm-cache', db: 'db-engine', os: 'os-cache'};
const FILL_ORDER = ['os', 'db', 'orm', 'redis', 'lb', 'cdn'];

function levelsByKey(run) {
  const map = {};
  run.levels.forEach(function(l) { map[l.key] = l; });
  return map;
}

function triggerArc(run) {
  const byKey = levelsByKey(run);
  const deployKeys = run.levels.filter(function(l) { return l.coldReason === 'deploy'; }).map(function(l) { return l.key; });
  const restartKeys = run.levels.filter(function(l) { return l.coldReason === 'db restart'; }).map(function(l) { return l.key; });

  return [
    {
      title: 'Deploy vừa xong',
      pipelineStep: 0,
      focus: ['deploy-event'].concat(deployKeys.map(function(k) { return COMPONENT[k]; })),
      phases: [{
        title: 'Bundle hash + config mới làm ' + deployKeys.length + ' level cold',
        desc: KIT.desc(
          '<b>Deploy đổi bundle hash và version config.</b>',
          deployKeys.map(function(k) { return '<code>' + byKey[k].name + '</code>: ' + byKey[k].coldReasonLabel; }),
          'Key cũ vẫn còn trong cache, nhưng không request nào còn hỏi đúng key đó nữa — về mặt hiệu quả, cache trống.'
        ),
        focus: ['deploy-event'].concat(deployKeys.map(function(k) { return COMPONENT[k]; })),
        set: deployKeys.reduce(function(set, k, i) {
          set[COMPONENT[k]] = KIT.mark('danger', 'cold: deploy', {at: 0.9 + i * 0.18});
          return set;
        }, {'deploy-event': KIT.pulse('warn', 'version mới', {at: 0.2})}),
        scene: function(a) {
          deployKeys.forEach(function(k, i) {
            KIT.link(a, 'deploy-event', COMPONENT[k], 'danger', {at: 0.3 + i * 0.18, dur: 0.5, lift: 1 + i * 0.45, label: 'key/version đổi'});
          });
        }
      }]
    },
    {
      title: 'DB/container restart',
      pipelineStep: 0,
      focus: ['deploy-event'].concat(restartKeys.map(function(k) { return COMPONENT[k]; })),
      phases: [{
        title: restartKeys.length + ' level cold vì bộ nhớ trong bị xoá',
        desc: KIT.desc(
          '<b>DB engine và container restart xoá sạch RAM.</b>',
          restartKeys.map(function(k) { return '<code>' + byKey[k].name + '</code>: ' + byKey[k].coldReasonLabel; }),
          'Khác deploy (key lệch), đây là dữ liệu bị XOÁ THẬT — không còn gì để lệch, chỉ còn trống.'
        ),
        focus: ['deploy-event'].concat(restartKeys.map(function(k) { return COMPONENT[k]; })),
        set: restartKeys.reduce(function(set, k, i) {
          set[COMPONENT[k]] = KIT.mark('danger', 'RAM trống', {at: 0.9 + i * 0.18});
          return set;
        }, {'deploy-event': KIT.pulse('danger', 'process restart', {at: 0.2})}),
        scene: function(a) {
          restartKeys.forEach(function(k, i) {
            KIT.link(a, 'deploy-event', COMPONENT[k], 'danger', {at: 0.3 + i * 0.18, dur: 0.5, lift: 1 + i * 0.45, label: 'restart xoá RAM'});
          });
        }
      }]
    },
    {
      title: 'DNS vẫn ấm',
      pipelineStep: 0,
      focus: ['dns-resolver'],
      phases: [{
        title: 'DNS Resolver — level duy nhất sống sót',
        desc: KIT.desc(
          '<b>DNS Resolver không cache dữ liệu sản phẩm</b>, nó cache bản dịch tên miền → IP.',
          'TTL của nó độc lập hoàn toàn với chu kỳ deploy hay restart của app/DB.',
          'Đây là lý do "cold cache toàn hệ thống" vẫn có một ngoại lệ — không phải MỌI level đều rơi vào cùng một nguyên nhân.'
        ),
        focus: ['dns-resolver'],
        set: {'dns-resolver': KIT.pulse('ok', 'TTL còn hạn', {at: 0.45})}
      }]
    }
  ];
}

function walkArc(run) {
  const steps = [];
  var prevComp = 'client';
  run.trail.forEach(function(entry, i) {
    const key = entry.key;
    if (key === 'disk') return; // xử lý riêng bên dưới, cần crown
    const comp = COMPONENT[key];
    const lv = LV.byKey(key);
    const label = 'GET /products/' + run.productId.replace('PID-', '');
    const fromComp = prevComp;
    steps.push({
      title: lv.name + ' — miss',
      pipelineStep: 1,
      focus: [fromComp, comp],
      phases: [{
        title: lv.name + ' miss — forward tiếp, không có gì để trả',
        desc: KIT.desc(
          '<b>' + lv.name + '</b> trống (xem arc trigger phía trên) — miss ngay lập tức, không đọc được gì.',
          'Cumulative latency tới đây: ' + LV.fmtMs(entry.cumulativeMs) + '.',
          key === 'dns'
            ? 'DNS vẫn phải resolve — vẫn tốn thời gian dù không "cold", chỉ là nó chưa bao giờ ấm theo nghĩa dữ liệu sản phẩm.'
            : 'Không có short-circuit ở đây — khác hẳn read path, MỌI level đều miss nên request buộc phải đi hết chiều sâu.'
        ),
        focus: [fromComp, comp],
        set: (function() {
          var s = {};
          s[comp] = key === 'dns'
            ? KIT.pulse('ok', 'resolved ✓', {at: 1.15})
            : KIT.mark('danger', 'MISS · +' + LV.fmtMs(entry.serveMs), {at: 1.15});
          return s;
        })(),
        scene: function(a) { KIT.link(a, fromComp, comp, key === 'dns' ? 'mute' : 'danger', {label: key === 'dns' ? 'DNS lookup' : label + ' · lookup'}); }
      }]
    });
    prevComp = comp;
  });
  return steps;
}

function diskArc(run, prevComp) {
  const diskEntry = run.trail[run.trail.length - 1];
  const label = 'GET /products/' + run.productId.replace('PID-', '');
  return [{
    title: 'Disk — nguồn thật, luôn ấm',
    pipelineStep: 2,
    focus: [prevComp, 'disk'],
    phases: [{
      title: 'Đĩa trả lời — 8 level cache đều miss cùng lúc',
      desc: KIT.desc(
        '<b>Toàn bộ cold path</b>: dns → browser → cdn → lb → redis → orm → db → os đều miss, request đọc thẳng đĩa.',
        'Cumulative latency: ' + LV.fmtMs(diskEntry.cumulativeMs) + ' — so với ' + LV.fmtMs(run.warmMs) + ' lúc ấm (' + run.penaltyX.toFixed(1) + '× chậm hơn).',
        'Đây là scenario DUY NHẤT trong deck mà disk nhận badge crown — mọi scenario khác disk chỉ là fallback lý thuyết, ở đây nó thật sự là nơi duy nhất còn dữ liệu.'
      ),
      focus: [prevComp, 'disk'],
      set: {disk: KIT.mark('crown', 'nguồn thật ✓ · ' + LV.fmtMs(diskEntry.serveMs), {at: 1.15})},
      scene: function(a) { KIT.link(a, prevComp, 'disk', 'danger', {label: label + ' · full miss'}); }
    }]
  }];
}

function fillBackArc(run) {
  const byKey = levelsByKey(run);
  return FILL_ORDER.map(function(key, i) {
    const comp = COMPONENT[key];
    const firstResponse = i < 4;
    const requestNo = key === 'lb' ? 2 : (key === 'cdn' ? 3 : 1);
    const fromComp = i === 0 ? 'disk' : COMPONENT[FILL_ORDER[i - 1]];
    const lv = byKey[key];
    const finalFill = i === FILL_ORDER.length - 1;
    const fillAt = firstResponse ? 1.05 : 1.4;
    const focus = finalFill
      ? ['client', fromComp, comp, 'browser-cache']
      : (firstResponse ? [fromComp, comp] : ['client', fromComp, comp]);
    return {
      title: lv.name + ' ấm lại',
      pipelineStep: 3,
      focus: focus,
      phases: [{
        title: lv.name + ' được request vừa rồi lấp đầy trên đường về',
        desc: KIT.desc(
          '<b>Request #' + requestNo + '</b> làm ấm ' + lv.name + ' theo cơ chế cache-aside.',
          firstResponse
            ? 'Response từ disk đi ngược qua OS → DB → ORM → Redis; bốn cache origin được lấp trong cùng request đầu.'
            : (key === 'lb'
                ? 'Request #2 hit Redis; response SSR của nó mới lấp LB. Vì vậy LB chưa thể cứu chính request vừa tạo entry.'
                : 'Request #3 hit LB; response của nó mới lấp CDN. CDN bắt đầu cứu request #4, không hồi tố request #3.'),
          'Thứ tự nhiều request này là cơ sở cho <code>warmup(requestIndex)</code>; browser per-user và price <code>no-store</code> không tham gia chuỗi warm-up dùng chung.'
        ),
        focus: focus,
        set: (function() {
          var s = {};
          s[comp] = KIT.mark('live', 'cache filled ✓', {at: fillAt});
          if (finalFill) {
            s['browser-cache'] = KIT.pulse('mute', 'price · no-store', {at: 1.95});
            s.client = KIT.pulse('ok', '200 · giá mới ✓', {at: 2.55});
          }
          return s;
        })(),
        scene: function(a) {
          if (!firstResponse) {
            KIT.link(a, 'client', fromComp, 'accent', {at: 0.15, dur: 0.55, lift: 2.0, label: 'request #' + requestNo + ' · HIT'});
          }
          KIT.link(a, fromComp, comp, 'ok', {at: firstResponse ? 0.25 : 0.75, dur: firstResponse ? 0.7 : 0.55, label: 'response · fill cache'});
          if (finalFill) {
            KIT.link(a, comp, 'browser-cache', 'ok', {at: 1.4, dur: 0.45, label: '200 · no-store'});
            KIT.link(a, 'browser-cache', 'client', 'ok', {at: 1.95, dur: 0.5, label: 'request #3 xong'});
          }
        }
      }]
    };
  });
}

function verdictArc(run) {
  return [{
    title: 'Cold vs warm — cái giá thật',
    pipelineStep: 4,
    focus: ['client', 'cdn-edge', 'disk', 'redis'],
    phases: [{
      title: 'Penalty: ' + run.penaltyX.toFixed(1) + '× chậm hơn lúc ấm',
      desc: KIT.desc(
        '<b>Cold request tốn ' + LV.fmtMs(run.coldMs) + ', warm request chỉ ' + LV.fmtMs(run.warmMs) + '.</b>',
        'Chênh lệch ' + LV.fmtMs(run.penaltyMs) + ' là cái giá của một đợt "thundering herd" ngay sau deploy nếu nhiều request cùng tới lúc cache còn trống.',
        'Khuyến nghị vận hành: restart DB ngoài giờ cao điểm, cân nhắc dump/restore buffer pool, và chờ trước một load spike ngắn ngay sau mỗi lần deploy.'
      ),
      focus: ['client', 'cdn-edge', 'disk', 'redis'],
      set: {
        'cdn-edge': KIT.pulse('crown', 'HIT · ' + LV.fmtMs(run.warmMs), {at: 1.05}),
        disk: KIT.pulse('mute', 'không chạy', {at: 1.45}),
        client: KIT.mark('ok', '200 · warm ✓', {at: 1.9})
      },
      scene: function(a) {
        KIT.link(a, 'client', 'cdn-edge', 'accent', {at: 0.25, dur: 0.7, lift: 2.4, label: 'request #4'});
        KIT.link(a, 'cdn-edge', 'client', 'ok', {at: 1.05, dur: 0.7, lift: 3.0, label: 'CDN HIT · ' + LV.fmtMs(run.warmMs)});
      },
      scoreMode: true,
      scoreTitle: 'Cold cache · verdict',
      scores: [
        KIT.gauge('cold', run.coldMs, run.coldMs, ' ms', {tone: 'danger'}),
        KIT.gauge('warm', run.warmMs, run.coldMs, ' ms', {tone: 'ok'}),
        KIT.score('penalty', Math.min(100, Math.round(run.penaltyX * 10)), {txt: run.penaltyX.toFixed(1) + '×', tone: 'warn'})
      ]
    }]
  }];
}

function lastNonDiskComponent(run) {
  var last = 'client';
  run.trail.forEach(function(entry) { if (entry.key !== 'disk') last = COMPONENT[entry.key]; });
  return last;
}

window.createColdCacheSteps = function(run) {
  return triggerArc(run)
    .concat(walkArc(run))
    .concat(diskArc(run, lastNonDiskComponent(run)))
    .concat(fillBackArc(run))
    .concat(verdictArc(run));
};
})();
