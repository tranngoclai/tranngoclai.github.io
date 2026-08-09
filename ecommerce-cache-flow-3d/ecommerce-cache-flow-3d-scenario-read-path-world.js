/* ══════════════════════════════════════════════
   READ PATH — PERSISTENT WORLD LAYOUT

   `client` đứng ở tone `subject` vì nó là điểm request bắt đầu. Request
   GET /products/4521 tự nó KHÔNG phải một hộp — nó là chuỗi arrow
   (KIT.link/KIT.beat) nối client → browser-cache → cdn-edge → … → disk,
   mỗi arrow vẽ từ box thật sự vừa xử lý xong sang box kế tiếp. Box chỉ
   dành cho DATA/component thật (cache, DB, disk); request/traffic là
   action nên luôn là arrow, không bao giờ là node riêng.

   Mọi checkpoint hit/miss thật sự trên đường đọc (browser-cache, cdn-edge,
   lb-proxy, redis, orm-cache) dùng chung SIZE.gate — Luật 3 của layout law:
   kích thước giống nhau ở mọi level là chính bài học "level nào trả lời"
   chỉ đọc được qua màu/badge, không qua độ lớn hộp.

   `redis` đứng ở cột X.app (không có cột riêng) nhưng lùi vào băng store —
   đúng ghi chú trong ecommerce-cache-flow-3d-layout.js: Redis "đứng sau
   lưng" origin app trên trục X.

   db-engine và os-cache dùng tone `engine` theo bảng TONE trong plan.md —
   chúng là bộ máy tự quản (buffer pool, kernel page cache), không phải
   checkpoint có key/TTL do app cấu hình như các `gate` khác. */
(function() {
const KIT = window.SCENE_KIT;
const L = window.ECOM_CACHE_LAYOUT;
const LV = window.ECOM_CACHE_LEVELS;
const X = L.X, Z = L.Z, Y = L.Y, S = L.SIZE;

window.createReadPathWorld = function(run) { return function(raw) {
  const w = KIT.world(raw);
  const browserLv = LV.byKey('browser'), cdnLv = LV.byKey('cdn'), lbLv = LV.byKey('lb');
  const redisLv = LV.byKey('redis'), ormLv = LV.byKey('orm');

  w.node('client', {label: 'Trình duyệt khách\n' + run.productId, pos: [X.client, Y.ground, Z.spine], size: S.actor, tone: 'subject', order: 0, hover: 'Nơi request GET /products/' + run.productId.replace('PID-', '') + ' bắt đầu'});

  w.node('dns-resolver', {label: 'DNS Resolver\nTTL ' + LV.fmtTtl(LV.byKey('dns').ttlSec), pos: [X.browser, Y.ground, Z.resolve], size: S.engine, tone: 'system', order: 1, hover: 'Phân giải tên miền trước khi request tồn tại — không nằm trên đường đi dữ liệu'});

  w.node('browser-cache', {label: 'Browser Cache\nbundle immutable · giá no-store', pos: [X.browser, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 1, hover: 'Cache-Control/ETag do response header quyết định'});
  w.node('cdn-edge', {label: 'CDN Edge\nTTL ' + LV.fmtTtl(cdnLv.ttlSec), pos: [X.cdn, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 2, hover: 'Edge config + purge API'});
  w.node('lb-proxy', {label: 'LB / Reverse Proxy\nTTL ' + LV.fmtTtl(lbLv.ttlSec), pos: [X.lb, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 2, hover: 'Proxy config, cache tag'});

  w.node('origin-app', {label: 'Origin App\nShopHub SSR', pos: [X.app, Y.ground, Z.spine], size: S.core, tone: 'core', order: 3, hover: 'Process render trang sản phẩm khi mọi cache phía trước đều miss'});
  w.node('redis', {label: 'Redis\nproduct:' + run.productId.replace('PID-', '') + ' · TTL ' + LV.fmtTtl(redisLv.ttlSec), pos: [X.app, Y.ground, Z.store], size: S.gate, tone: 'gate', order: 3, hover: 'App cache — key/value do code app quản lý'});

  w.node('orm-cache', {label: 'ORM Cache\nTTL ' + LV.fmtTtl(ormLv.ttlSec), pos: [X.orm, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 4, hover: 'Auto-invalidate qua signal save()/delete() của ORM'});
  w.node('db-engine', {label: 'DB Engine\nbuffer pool', pos: [X.db, Y.ground, Z.spine], size: S.engine, tone: 'engine', order: 4, hover: 'DB tự quản buffer pool theo WAL — không cần app can thiệp'});
  w.node('os-cache', {label: 'OS Page Cache\nkernel', pos: [X.os, Y.ground, Z.spine], size: S.engine, tone: 'engine', order: 4, hover: 'Kernel tự evict khi memory pressure'});
  w.node('disk', {label: 'Disk\nnguồn thật', pos: [X.disk, Y.ground, Z.spine], size: S.store, tone: 'store', order: 5, hover: 'Nơi mọi cache phía trước cuối cùng đọc lại nếu miss hết'});

  w.region('EDGE', (X.browser + X.lb) / 2, 0, 8);
  w.region('ORIGIN', (X.app + X.disk) / 2, 0, 8);
  w.cam([-6, 0, 0], 62);
}; };
})();
