/* ══════════════════════════════════════════════
   WRITE PATH — STEPS · CASCADE (7 level invalidation, db → browser)

   Admin's PATCH → db-engine đã được kể trong step mở đầu của race arc
   (write-path-traps.js) vì đó là điểm A/admin/B giao nhau theo thời gian
   thật — cascade ở đây bắt đầu THẲNG từ db-engine đã có giá mới, không kể
   lại request admin lần nữa. Đi generic qua run.cascade (đã đúng thứ tự
   db→os→orm→redis→lb→cdn→browser). Level nào `needsExplicitCall:false` (db/os/orm) tự động, mark
   tone 'ok' ngay không kèm badge "gọi lệnh gì" — vì đúng là không có lệnh
   nào cả. Level nào `needsExplicitCall:true` (redis/lb/cdn) mark tone 'ok'
   kèm badge tên lệnh thật (DEL, purge...). Riêng `browser` — level không có
   cách nào purge — mark tone 'warn', KHÔNG BAO GIỜ 'ok', theo đúng success
   criteria của phase-02: browser luôn là hộp "còn treo" cuối scenario. */
(function() {
const KIT = window.SCENE_KIT;
const LV = window.ECOM_CACHE_LEVELS;

function cascadeByKey(run) {
  const map = {};
  run.cascade.forEach(function(e) { map[e.key] = e; });
  return map;
}

function dbPhase(entry) {
  return {
    title: entry.name + ' — tự đồng bộ',
    pipelineStep: 1,
    focus: ['db-engine', 'wal', 'buffer-pool'],
    phases: [{
      title: 'DB engine ghi buffer pool + WAL cùng lúc',
      desc: KIT.desc(
        '<b>' + entry.mechanism + '</b>',
        ['<code>needsExplicitCall</code>: false', '<code>staleWindowSec</code>: ' + entry.staleWindowSec],
        'DB engine, buffer pool và WAL luôn nhất quán với nhau ngay khi transaction commit — không có khoảng hở nào để race ở tầng này.'
      ),
      focus: ['db-engine', 'wal', 'buffer-pool'],
      set: {
        'db-engine': KIT.pulse('ok', 'COMMIT', {at: 0.2}),
        wal: KIT.mark('ok', 'WAL bền vững ✓', {at: 1.05}),
        'buffer-pool': KIT.mark('ok', 'giá mới ✓', {at: 1.05})
      },
      scene: function(a) {
        KIT.link(a, 'db-engine', 'wal', 'ok', {at: 0.3, dur: 0.65, lift: 1.2, label: 'append WAL'});
        KIT.link(a, 'db-engine', 'buffer-pool', 'ok', {at: 0.3, dur: 0.65, lift: 2.2, label: 'update page'});
      }
    }]
  };
}

function osPhase(entry) {
  return {
    title: entry.name + ' — dirty page tự flush',
    pipelineStep: 2,
    focus: ['db-engine', 'os-cache'],
    phases: [{
      title: 'Kernel đánh dấu page dirty',
      desc: KIT.desc(
        '<b>' + entry.mechanism + '</b>',
        ['<code>needsExplicitCall</code>: false', '<code>staleWindowSec</code>: ' + entry.staleWindowSec],
        'App và cả DB engine không cần biết OS page cache tồn tại — kernel tự flush khi rảnh hoặc khi memory pressure.'
      ),
      focus: ['db-engine', 'os-cache'],
      set: {'os-cache': KIT.mark('ok', 'dirty → flush ✓', {at: 1.1})},
      scene: function(a) { KIT.link(a, 'db-engine', 'os-cache', 'accent', {label: 'dirty page'}); }
    }]
  };
}

function ormPhase(entry) {
  return {
    title: entry.name + ' — signal tự bắn',
    pipelineStep: 3,
    focus: ['db-engine', 'orm-cache'],
    phases: [{
      title: 'cacheops signal post_save tự invalidate',
      desc: KIT.desc(
        '<b>' + entry.mechanism + '</b>',
        ['<code>needsExplicitCall</code>: false', '<code>staleWindowSec</code>: ' + entry.staleWindowSec],
        'Điều kiện DUY NHẤT: update phải đi qua ORM. §7 chỉ ra bẫy khi điều kiện này bị phá — xem step "ORM-bypass" phía sau.'
      ),
      focus: ['db-engine', 'orm-cache'],
      set: {'orm-cache': KIT.mark('ok', 'entry bị xoá ✓', {at: 1.1})},
      scene: function(a) { KIT.link(a, 'db-engine', 'orm-cache', 'accent', {label: 'post_save signal'}); }
    }]
  };
}

function redisPhase(entry) {
  return {
    title: entry.name + ' — cần lệnh rõ ràng',
    pipelineStep: 4,
    focus: ['orm-cache', 'origin-app', 'redis', 'pubsub'],
    phases: [{
      title: 'App gọi DEL + publish Pub/Sub',
      desc: KIT.desc(
        '<b>' + entry.mechanism + '</b>',
        ['<code>needsExplicitCall</code>: true', '<code>staleWindowSec</code>: ' + entry.staleWindowSec + ' (nếu lệnh trễ, TTL là giới hạn trên)'],
        'Đây là level đầu tiên trong cascade CẦN app code chủ động gọi — quên gọi thì §7 xảy ra (xem step bypass).'
      ),
      focus: ['orm-cache', 'origin-app', 'redis', 'pubsub'],
      set: {
        'origin-app': KIT.pulse('accent', 'gọi lệnh', {at: 0.65}),
        redis: KIT.mark('ok', 'key bị xoá ✓', {at: 1.2}),
        pubsub: KIT.pulse('ok', 'publish ✓', {at: 1.2})
      },
      scene: function(a) {
        KIT.link(a, 'orm-cache', 'origin-app', 'accent', {at: 0.2, dur: 0.45, label: 'post_save'});
        KIT.link(a, 'origin-app', 'redis', 'ok', {label: 'DEL product key', at: 0.7, dur: 0.45});
        KIT.link(a, 'origin-app', 'pubsub', 'ok', {label: 'publish invalidation', at: 0.7, dur: 0.45});
      }
    }]
  };
}

function lbPhase(entry) {
  return {
    title: entry.name + ' — purge theo tag',
    pipelineStep: 5,
    focus: ['origin-app', 'lb-proxy'],
    phases: [{
      title: 'LB purge cache tag',
      desc: KIT.desc(
        '<b>' + entry.mechanism + '</b>',
        ['<code>needsExplicitCall</code>: true', '<code>staleWindowSec</code>: ' + entry.staleWindowSec],
        'Nếu app quên gọi purge LB, TTL ' + LV.fmtTtl(LV.byKey('lb').ttlSec) + ' vẫn cứu — ngắn hơn nhiều so với CDN/browser.'
      ),
      focus: ['origin-app', 'lb-proxy'],
      set: {'lb-proxy': KIT.mark('ok', 'entry bị xoá ✓', {at: 1.1})},
      scene: function(a) { KIT.link(a, 'origin-app', 'lb-proxy', 'ok', {label: 'purge'}); }
    }]
  };
}

function cdnPhase(entry) {
  return {
    title: entry.name + ' — purge qua API',
    pipelineStep: 6,
    focus: ['origin-app', 'cdn-edge'],
    phases: [{
      title: 'CDN purge URL/tag',
      desc: KIT.desc(
        '<b>' + entry.mechanism + '</b>',
        ['<code>needsExplicitCall</code>: true', '<code>staleWindowSec</code>: ' + entry.staleWindowSec],
        'Purge CDN thường có độ trễ lan truyền vài giây qua nhiều edge node — không tức thời 100% dù đã gọi.'
      ),
      focus: ['origin-app', 'cdn-edge'],
      set: {'cdn-edge': KIT.mark('ok', 'entry bị xoá ✓', {at: 1.1})},
      scene: function(a) { KIT.link(a, 'origin-app', 'cdn-edge', 'ok', {label: 'purge'}); }
    }]
  };
}

function browserPhase(entry, run) {
  return {
    title: entry.name + ' — không purge được',
    pipelineStep: 6,
    focus: ['browser-cache', 'client'],
    phases: [{
      title: 'Browser cache chỉ chờ hết TTL',
      desc: KIT.desc(
        '<b>' + entry.mechanism + '</b>',
        ['<code>needsExplicitCall</code>: false (không tồn tại lệnh nào)', '<code>staleWindowSec</code>: ' + entry.staleWindowSec],
        'Đây là lý do <code>/api/price</code> luôn set <code>no-store</code> ở phase read path — nếu nó có TTL, ' + LV.fmtTtl(entry.staleWindowSec) + ' là khoảng thời gian user thấy giá sai mà KHÔNG CÁCH NÀO admin can thiệp được.',
        '<b>Không có arrow nào chạm browser-cache ở đây</b> — chính sự vắng mặt đó là bài học: không lệnh purge nào tồn tại cho level này.'
      ),
      focus: ['browser-cache', 'client'],
      set: {
        'browser-cache': KIT.mark('warn', 'giữ giá cũ · TTL', {at: 0.45}),
        client: KIT.mark('danger', 'vẫn thấy ' + run.oldPrice, {at: 1.25})
      },
      scene: function(a) {
        KIT.link(a, 'browser-cache', 'client', 'danger', {at: 0.5, dur: 0.65, label: 'response cũ'});
      },
      scoreMode: true,
      scoreTitle: 'Write path · cascade xong',
      scores: [
        KIT.gauge('total stale window', run.totalStaleWindowSec, run.totalStaleWindowSec, ' s', {tone: 'warn'}),
        KIT.score('level không purge được', 100, {txt: entry.name, tone: 'warn'}),
        KIT.score('levels tự động', 3)
      ]
    }]
  };
}

window.createWritePathCascadeSteps = function(run) {
  const byKey = cascadeByKey(run);
  return [
    dbPhase(byKey.db),
    osPhase(byKey.os),
    ormPhase(byKey.orm),
    redisPhase(byKey.redis),
    lbPhase(byKey.lb),
    cdnPhase(byKey.cdn),
    browserPhase(byKey.browser, run)
  ];
};
})();
