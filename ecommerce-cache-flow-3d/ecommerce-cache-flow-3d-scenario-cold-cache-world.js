/* ══════════════════════════════════════════════
   COLD CACHE — PERSISTENT WORLD LAYOUT

   Cùng cột X với read path (Luật 1). Khác biệt duy nhất: MỌI hộp cache khởi
   động ở tone `danger`/nhãn "(empty)" — vì đây là khoảnh khắc ngay sau
   deploy/restart, chưa có request nào chạy qua để làm ấm lại. `dns-resolver`
   là ngoại lệ — nó không cache dữ liệu sản phẩm nên tone `system`, không
   `danger`, xuyên suốt scenario. `disk` là `store` duy nhất ấm sẵn ngay từ
   đầu — sự thật luôn nằm ở đó, đó là lý do walk luôn kết thúc được.
   `deploy-event` đứng ở băng resolve, là tác nhân kích hoạt toàn bộ. */
(function() {
const KIT = window.SCENE_KIT;
const L = window.ECOM_CACHE_LAYOUT;
const LV = window.ECOM_CACHE_LEVELS;
const X = L.X, Z = L.Z, Y = L.Y, S = L.SIZE;

window.createColdCacheWorld = function(run) { return function(raw) {
  const w = KIT.world(raw);

  w.node('deploy-event', {label: 'Deploy / Restart\nvừa xong', pos: [X.app, Y.ground, Z.resolve], size: S.actor, tone: 'system', order: 0, hover: 'Trigger duy nhất của toàn bộ scenario', shape: 'client'});

  w.node('client', {label: 'Trình duyệt khách\n' + run.productId, pos: [X.client, Y.ground, Z.spine], size: S.actor, tone: 'subject', order: 0, hover: 'Request đầu tiên sau deploy/restart', shape: 'client'});

  w.node('dns-resolver', {label: 'DNS Resolver\nvẫn ấm', pos: [X.browser, Y.ground, Z.resolve], size: S.engine, tone: 'system', order: 1, hover: 'TTL DNS không liên quan gì tới deploy/restart', shape: 'hex'});

  w.node('browser-cache', {label: 'Browser Cache\n(empty)', pos: [X.browser, Y.ground, Z.spine], size: S.gate, tone: 'danger', order: 1, hover: 'Bundle hash mới — key cũ không còn khớp', shape: 'hex'});
  w.node('cdn-edge', {label: 'CDN Edge\n(empty)', pos: [X.cdn, Y.ground, Z.spine], size: S.gate, tone: 'danger', order: 2, hover: 'URL asset đổi theo bundle hash mới', shape: 'hex'});
  w.node('lb-proxy', {label: 'LB / Reverse Proxy\n(empty)', pos: [X.lb, Y.ground, Z.spine], size: S.gate, tone: 'danger', order: 2, hover: 'Cache tag gắn với version build cũ', shape: 'hex'});

  w.node('origin-app', {label: 'Origin App\nShopHub SSR', pos: [X.app, Y.ground, Z.spine], size: S.core, tone: 'core', order: 3, hover: 'Process mới tinh sau deploy'});
  w.node('redis', {label: 'Redis\n(empty)', pos: [X.app, Y.ground, Z.store], size: S.gate, tone: 'danger', order: 3, hover: 'RAM bị xoá sạch khi container restart', shape: 'redis'});

  w.node('orm-cache', {label: 'ORM Cache\n(empty)', pos: [X.orm, Y.ground, Z.spine], size: S.gate, tone: 'danger', order: 4, hover: 'Process mới = in-memory state mới tinh', shape: 'hex'});
  w.node('db-engine', {label: 'DB Engine\nbuffer pool empty', pos: [X.db, Y.ground, Z.spine], size: S.engine, tone: 'danger', order: 4, hover: 'DB vừa restart — buffer pool trống', shape: 'cylinder'});
  w.node('os-cache', {label: 'OS Page Cache\n(empty)', pos: [X.os, Y.ground, Z.spine], size: S.engine, tone: 'danger', order: 4, hover: 'Kernel restart — page cache trống', shape: 'grid'});
  w.node('disk', {label: 'Disk\nnguồn thật — luôn ấm', pos: [X.disk, Y.ground, Z.spine], size: S.store, tone: 'store', order: 5, hover: 'store duy nhất còn ấm ngay từ đầu', shape: 'cylinder'});

  w.region('EDGE', (X.browser + X.lb) / 2, 0, 8);
  w.region('ORIGIN', (X.app + X.disk) / 2, 0, 8);
  w.cam([-6, 0, 0], 62);
}; };
})();
