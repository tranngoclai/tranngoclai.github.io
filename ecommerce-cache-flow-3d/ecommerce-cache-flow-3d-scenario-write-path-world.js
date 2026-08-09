/* ══════════════════════════════════════════════
   WRITE PATH — PERSISTENT WORLD LAYOUT

   Dùng lại đúng các cột X của read path (Luật 1 trong layout law) — người
   xem đã học "cột nào là level nào" ở kịch bản read path, write path không
   đặt lại toạ độ. Giá trị mới KHÔNG phải một hộp riêng — nó là chuỗi arrow
   nối các box thật, đi NGƯỢC: db → os / orm → (app) → redis / lb / cdn.
   Bước db→os đi RA XA client (X.db=14 →
   X.os=22) trước khi nhảy ngược lại orm (X.orm=6) — đúng thực tế: OS page
   cache nằm sát DB engine/disk về mặt hệ thống, còn ORM cache là một layer
   app-level tách biệt, không nằm giữa hai cái đó về mặt vị trí.

   `wal` và `buffer-pool` là hai hộp riêng trong băng store cạnh db-engine —
   khác với read path (đã gộp chung vào một node `db-engine` vì không step
   nào nhắc riêng chúng), write path CẦN tách ra vì cascade §6 nói rõ DB ghi
   vào buffer pool VÀ WAL cùng lúc, đây là bước đầu tiên minh hoạ "tự động,
   không cần lệnh app".

   `client-a`/`client-b` là hai TRÌNH DUYỆT thật (thực thể), ẩn (hidden:true)
   tới khi step race hiện ra — đứng ở cột client, KHÔNG di chuyển. Request
   HTTP tự nó không phải một thực thể nên không có box riêng — nó chỉ là
   arrow (KIT.link) chạy giữa client-a/b và db-engine/app-worker-a/b/redis,
   y hệt cách read path vẽ request bằng arrow thay vì box.

   `app-worker-a`/`app-worker-b` là hai PROCESS thật đang chạy song song, mỗi
   cái giữ giá vừa đọc trong biến của riêng nó và không biết cái kia tồn tại.
   Phải là hai hộp riêng chứ không phải một `origin-app` dùng chung: race §5
   sinh ra CHÍNH VÌ hai worker độc lập, và chỉ khi tách hộp thì cảnh "hai
   worker cùng SET một key Redis" mới vẽ đúng là lost update. Gộp lại thành
   một hộp sẽ thành ra app tự ghi đè chính nó — sai bản chất. `origin-app` ở
   z=0 vẫn giữ nguyên cho PATCH của admin và toàn bộ cascade: 3 request đồng
   thời thì đúng là 3 worker, gộp admin chung với A/B là ngụ ý sai rằng chúng
   chia sẻ state. Hai worker `hidden:true`, chỉ `show` trong race arc để hai
   arc còn lại không bị nhiễu. */
(function() {
const KIT = window.SCENE_KIT;
const L = window.ECOM_CACHE_LAYOUT;
const LV = window.ECOM_CACHE_LEVELS;
const X = L.X, Z = L.Z, Y = L.Y, S = L.SIZE;

const ENTRY_Y = 2.7;
const storeLanes = L.spread(Z.store, 2, 2.6); // [wal, buffer-pool] quanh X.db
const appStoreLanes = L.spread(Z.store, 2, 2.6); // [redis, pubsub] quanh X.app

window.WRITE_PATH_POS = {
  db:      [X.db, Y.ground + ENTRY_Y, Z.spine],
  os:      [X.os, Y.ground + ENTRY_Y, Z.spine],
  orm:     [X.orm, Y.ground + ENTRY_Y, Z.spine],
  redis:   [X.app, Y.ground + ENTRY_Y, Z.store],
  lb:      [X.lb, Y.ground + ENTRY_Y, Z.spine],
  cdn:     [X.cdn, Y.ground + ENTRY_Y, Z.spine],
  browser: [X.browser, Y.ground + ENTRY_Y, Z.spine]
};

/* Hai làn race, dùng CHUNG cho cặp client và cặp app worker: client-a và
   app-worker-a cùng z nên arrow request chạy thẳng một làn ngang, không cắt
   qua làn của B. Pitch 8 đủ để hộp `core` (sâu 3.2) không chạm hộp
   `origin-app` đứng giữa ở z=0. */
const raceLanes = L.spread(Z.spine, 2, 8);
const clientLanes = raceLanes; // [client-a, client-b] quanh X.client

window.createWritePathWorld = function(run) { return function(raw) {
  const w = KIT.world(raw);
  const lbLv = LV.byKey('lb'), cdnLv = LV.byKey('cdn'), redisLv = LV.byKey('redis'), ormLv = LV.byKey('orm');

  w.node('admin-console', {label: 'Admin Console\nsửa giá ' + run.productId, pos: [X.app, Y.ground, Z.resolve], size: S.actor, tone: 'system', order: 0, hover: 'Nơi lệnh UPDATE giá bắt đầu'});

  w.node('db-engine', {label: 'DB Engine\nUPDATE products', pos: [X.db, Y.ground, Z.spine], size: S.engine, tone: 'engine', order: 1, hover: 'Nơi lệnh UPDATE thật sự ghi'});
  w.node('wal', {label: 'WAL\nwrite-ahead log', pos: [X.db, Y.ground, storeLanes[0]], size: S.store, tone: 'store', order: 1, hover: 'Transaction log — DB engine tự ghi, không qua app'});
  w.node('buffer-pool', {label: 'Buffer Pool\nin-memory page', pos: [X.db, Y.ground, storeLanes[1]], size: S.store, tone: 'store', order: 1, hover: 'Bản copy trong RAM của page vừa sửa'});

  w.node('os-cache', {label: 'OS Page Cache\nkernel', pos: [X.os, Y.ground, Z.spine], size: S.engine, tone: 'engine', order: 2, hover: 'Dirty page — kernel tự flush xuống đĩa'});

  w.node('orm-cache', {label: 'ORM Cache\nTTL ' + LV.fmtTtl(ormLv.ttlSec), pos: [X.orm, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 3, hover: 'Auto-invalidate qua signal post_save/post_delete'});

  w.node('origin-app', {label: 'Origin App\nShopHub SSR', pos: [X.app, Y.ground, Z.spine], size: S.core, tone: 'core', order: 4, hover: 'App code phát lệnh DEL Redis + purge LB/CDN'});
  w.node('redis', {label: 'Redis\nproduct:' + run.productId.replace('PID-', '') + ' · TTL ' + LV.fmtTtl(redisLv.ttlSec), pos: [X.app, Y.ground, appStoreLanes[0]], size: S.gate, tone: 'gate', order: 4, hover: 'App cache — DEL hoặc chờ TTL'});
  w.node('pubsub', {label: 'Pub/Sub\nproduct:invalidate', pos: [X.app, Y.ground, appStoreLanes[1]], size: S.queue, tone: 'queue', order: 4, hover: 'Kênh báo các instance khác tự xoá key nội bộ'});

  w.node('lb-proxy', {label: 'LB / Reverse Proxy\nTTL ' + LV.fmtTtl(lbLv.ttlSec), pos: [X.lb, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 5, hover: 'Purge theo cache tag'});
  w.node('cdn-edge', {label: 'CDN Edge\nTTL ' + LV.fmtTtl(cdnLv.ttlSec), pos: [X.cdn, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 6, hover: 'Purge theo URL/tag qua purge API'});
  w.node('browser-cache', {label: 'Browser Cache\ngiá no-store', pos: [X.browser, Y.ground, Z.spine], size: S.gate, tone: 'gate', order: 7, hover: 'Không có purge — chỉ hết hạn theo TTL/ETag'});
  w.node('client', {label: 'Trình duyệt khách\n' + run.productId, pos: [X.client, Y.ground, Z.spine], size: S.actor, tone: 'subject', order: 7, hover: 'Người dùng cuối cùng thấy giá nào'});

  w.node('client-a', {label: 'Trình duyệt A', pos: [X.client, Y.ground, clientLanes[0]], size: S.actor, tone: 'subject', order: 8, hidden: true, hover: 'Client A — gửi request đọc giá ngay trước lúc admin sửa'});
  w.node('client-b', {label: 'Trình duyệt B', pos: [X.client, Y.ground, clientLanes[1]], size: S.actor, tone: 'peer', order: 8, hidden: true, hover: 'Client B — gửi request đọc giá ngay sau lúc admin sửa'});

  w.node('app-worker-a', {label: 'App worker A\nphục vụ request A', pos: [X.app, Y.ground, raceLanes[0]], size: S.core, tone: 'core', order: 8, hidden: true, hover: 'Process phục vụ request A — giữ giá vừa đọc trong biến của riêng nó, không biết worker B tồn tại'});
  w.node('app-worker-b', {label: 'App worker B\nphục vụ request B', pos: [X.app, Y.ground, raceLanes[1]], size: S.core, tone: 'core', order: 8, hidden: true, hover: 'Process phục vụ request B — chạy song song và độc lập với worker A'});

  w.region('DB', (X.db + X.os) / 2, 0, 8);
  w.region('APP', X.app, 0, 8);
  w.region('EDGE', (X.lb + X.browser) / 2, 0, 8);
  w.cam([6, 0, 0], 62);
}; };
})();
