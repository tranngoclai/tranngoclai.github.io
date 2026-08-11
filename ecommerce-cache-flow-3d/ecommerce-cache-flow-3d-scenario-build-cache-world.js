/* ══════════════════════════════════════════════
   BUILD CACHE — PERSISTENT WORLD LAYOUT

   Thế giới riêng, KHÔNG phải request path — CI lane nằm hoàn toàn ở toạ độ
   X âm mới (không đụng cột nào của layout law) để không bị hiểu nhầm là
   một phần đường đọc/ghi. Chỉ hai cột bên phải (`X.cdn`, `X.browser`) dùng
   lại đúng toạ độ layout law — đó là điểm HANDOFF thật sự duy nhất giữa
   build-time và runtime, nên nó phải trùng khớp để người xem nhận ra ngay.

   `commit` đứng ở tone `subject` nhưng KHÔNG phải request — phase mở đầu
   phải nói rõ điều này (xem steps.js arc A) để không bị đọc nhầm theo phản
   xạ từ 3 scenario trước.

   `cdn-edge`/`browser-cache` bắt đầu `hidden:true` — chỉ arc E (publish)
   mới hiện ra, đúng Risk Assessment: tránh ngộ nhận request path đang sống
   ở đây từ đầu. */
(function() {
const KIT = window.SCENE_KIT;
const L = window.ECOM_CACHE_LAYOUT;
const LV = window.ECOM_CACHE_LEVELS;
const X = L.X, Z = L.Z, Y = L.Y, S = L.SIZE;

/* Registry nằm phía origin của CDN, nên handoff cuối đọc đúng chiều response
   registry → CDN → browser. Khoảng publish dài cũng tách CI work khỏi runtime. */
const CX = {trigger: -74, lockfile: -66, install: -58, compile: -50, docker: -42, registry: -10};

window.BUILD_CACHE_POS = {
  lockfile: [CX.lockfile, Y.ground + 2.6, Z.spine],
  install:  [CX.install, Y.ground + 2.6, Z.spine],
  compile:  [CX.compile, Y.ground + 2.6, Z.spine],
  docker:   [CX.docker, Y.ground + 2.6, Z.spine],
  registry: [CX.registry, Y.ground + 2.6, Z.spine],
  cdn:      [X.cdn, Y.ground + 2.6, Z.spine],
  browser:  [X.browser, Y.ground + 2.6, Z.spine]
};

window.createBuildCacheWorld = function(run) { return function(raw) {
  const w = KIT.world(raw);
  const cdnLv = LV.byKey('cdn'), browserLv = LV.byKey('browser');

  w.node('ci-trigger', {label: 'Git push\ncommit', pos: [CX.trigger, Y.ground, Z.resolve], size: S.actor, tone: 'system', order: 0, hover: 'Không phải request — commit kích hoạt CI pipeline', shape: 'client'});
  w.node('commit', {label: 'Build đang chạy', pos: [CX.trigger, Y.ground + 2.6, Z.spine], size: S.entry, tone: 'subject', order: 1, hover: 'Đối tượng theo dõi ở scenario này là BUILD, không phải request HTTP', shape: 'seal'});
  w.node('ci-runner', {label: 'CI Runner\n(surface)', pos: [(CX.install + CX.docker) / 2, Y.ground - 0.4, Z.spine], size: S.surface, tone: 'surface', order: 0, hover: 'Nền của toàn bộ pipeline', shape: 'slab'});

  w.node('lockfile-cache', {label: 'Lockfile Cache\nkey = hash(lockfile)', pos: [CX.lockfile, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 1, hover: 'All-or-nothing — đổi 1 dòng là mất sạch', shape: 'hex'});
  w.node('ci-cache-bucket', {label: 'node_modules\nCI bucket', pos: [CX.lockfile, Y.ground, Z.store], size: S.store, tone: 'store', order: 1, hover: 'Nơi node_modules được lưu lại giữa các lần build', shape: 'grid'});

  w.node('bundler', {label: 'Bundler\nper-module hash', pos: [CX.compile, Y.ground, Z.spine], size: S.engine, tone: 'engine', order: 2, hover: 'Compile — key theo TỪNG module'});
  w.node('module-cache', {label: 'Module Cache\npersistent', pos: [CX.compile, Y.ground, Z.store], size: S.store, tone: 'store', order: 2, hover: 'Output compile của từng module, tái sử dụng nếu hash không đổi', shape: 'grid'});

  w.node('docker-builder', {label: 'Docker Builder\nlayer chain', pos: [CX.docker, Y.ground, Z.spine], size: S.engine, tone: 'engine', order: 3, hover: 'Prefix invalidation — 1 layer đổi kéo theo mọi layer sau'});
  w.node('layer-cache', {label: 'Layer Cache\nprefix chain', pos: [CX.docker, Y.ground, Z.store], size: S.store, tone: 'store', order: 3, hover: 'Layer nào rebuild thì mọi layer sau nó cũng rebuild theo', shape: 'tiers'});

  w.node('registry', {label: 'Registry\n' + run.bundleNameNew, pos: [CX.registry, Y.ground, Z.spine], size: S.store, tone: 'store', order: 4, hover: 'Image + bundle vừa publish', shape: 'seal'});

  w.node('cdn-edge', {label: 'CDN Edge\nTTL ' + LV.fmtTtl(cdnLv.ttlSec), pos: [X.cdn, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 5, hidden: true, hover: 'Handoff sang runtime — level 3 của request path', shape: 'hex'});
  w.node('browser-cache', {label: 'Browser Cache\n' + run.bundleNameNew, pos: [X.browser, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 5, hidden: true, hover: 'Handoff sang runtime — level 2 của request path', shape: 'hex'});

  w.region('CI PIPELINE', (CX.trigger + CX.registry) / 2, 0, 8);
  w.region('RUNTIME HANDOFF', (X.cdn + X.browser) / 2, 0, 8);
  w.cam([-42, 0, 0], 96);
}; };
})();
