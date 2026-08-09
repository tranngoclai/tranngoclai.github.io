/* ══════════════════════════════════════════════
   ECOMMERCE CACHE DECK — SHARED LAYOUT LAW

   Bốn kịch bản (read path, write path, cold cache, build cache) đi qua gần
   như cùng một chuỗi 9 level cache. Nếu mỗi world tự chọn toạ độ riêng thì
   "Redis" ở kịch bản này sẽ to nhỏ khác "Redis" ở kịch bản kia, và người xem
   phải học lại bố cục mỗi lần đổi tab. File này là **nguồn duy nhất** của
   toạ độ và kích thước.

   ── Luật 1 · TRỤC X = KHOẢNG CÁCH TỪ CLIENT TỚI DISK ──
   Đọc trái sang phải đúng hành trình một request đọc:

     client → browser → cdn → lb → app → orm → db → os → disk

   Cột nào cũng nằm đúng X đó ở MỌI kịch bản — kể cả khi write path đi
   *ngược* chiều (phải→trái), nó vẫn dùng đúng các cột này, không đặt lại.

   ── Luật 2 · TRỤC Z = BĂNG VAI TRÒ ──
     z = +9  resolve/control  DNS resolver, admin console, CI runner, Pub/Sub bus
     z =  0  spine            đường đi dữ liệu của request, trái sang phải
     z = -9  store/backing    Redis keyspace, data file, WAL, dirty-page list,
                               CI cache bucket

   `dns-resolver` đứng ở X của `browser` nhưng trên băng `resolve` — nó là
   một lookup tách biệt trước khi request tồn tại, không phải một mắt xích
   trên đường đi dữ liệu.

   ── Luật 3 · CÙNG VAI TRÒ = CÙNG KÍCH THƯỚC ──
   `SIZE` là bảng tra duy nhất. Mọi hộp `gate` (điểm kiểm tra hit/miss) to
   bằng nhau ở MỌI level — chính sự giống nhau đó là bài học: cái gì trả lời
   request mới là biến số đáng nhìn, không phải hộp nào to hơn hộp nào.
══════════════════════════════════════════════ */

(function() {
const L = {};

/* ── Luật 1 · các cột theo trục X ──
   Khoảng cách giữa các cột không đều nhau tuyệt đối — dồn dày ở đầu "edge"
   (browser/cdn/lb sát nhau, đúng thực tế chúng đứng gần nhau về vai trò)
   và giãn ra ở "origin" (app/orm/db/os/disk) nơi mỗi bước là một hệ thống
   khác hẳn nhau. */
L.X = {
  client:  -34,   // thiết bị người dùng — nơi request bắt đầu
  browser: -27,   // level 2
  cdn:     -19,   // level 3
  lb:      -11,   // level 4
  app:      -2,   // origin app server — không phải một level cache, là nơi
                   // Redis (level 5) và ORM (level 7) đứng sau lưng
  orm:       6,   // level 7 — đứng TRƯỚC db-engine trên trục X dù đọc SAU
                   // Redis, vì đây đúng là bẫy §7: ORM cache nằm phía trên
                   // DB engine trong đường đọc dù object code gọi nó sau.
  db:       14,   // level 6
  os:       22,   // level 8
  disk:     30     // nguồn thật, cuối đường
};

/* ── Luật 2 · các băng vai trò theo trục Z ── */
L.Z = {
  resolve: 9,   // DNS resolver, admin console, CI runner/trigger, Pub/Sub bus
  spine:   0,   // đường đi dữ liệu của request
  store:  -9    // Redis keyspace, data file, WAL, dirty-page list, CI cache bucket
};

L.Y = {
  ground: 0
};

/* ── Luật 3 · bảng tra kích thước duy nhất ──
   Đừng khai size trực tiếp trong world file — luôn đọc từ đây. */
L.SIZE = {
  actor:   [3.8, 4.4, 2.8],   // client device, admin console, CI trigger
  gate:    [3.6, 2.8, 2.6],   // MỌI điểm kiểm tra hit/miss — cùng cỡ ở mọi level
  core:    [4.6, 6.0, 3.2],   // origin app server — trục của deck, giống API Server ở k8s
  store:   [4.2, 5.2, 3.0],   // Redis keyspace, data file, WAL, CI cache bucket
  engine:  [3.6, 3.0, 2.4],   // buffer-pool manager, kernel page cache, disk, bundler, Docker builder
  queue:   [3.6, 2.2, 2.2],   // dirty-page list, purge queue, Pub/Sub channel
  surface: [6.0, 0.6, 4.0],   // tấm nền vô tri: vùng edge, datacenter, CI runner slab
  entry:   [2.0, 1.0, 1.6]    // một object/trang được cache — nhỏ hơn cái gate chứa nó
};

/* `n` ô cách đều nhau quanh tâm — dùng khi vài hộp cùng đứng một cột X
   nhưng cần tách theo Z (ví dụ redis-gate + redis-store + pubsub). */
function spread(center, n, pitch) {
  const out = [], half = (n - 1) * pitch / 2;
  for (let i = 0; i < n; i++) out.push(+(center - half + i * pitch).toFixed(2));
  return out;
}
L.spread = spread;
L.cols = function(cx, n) { return spread(cx, n, 4.4); };

/* Xếp nhiều "làn" theo chiều sâu quanh z=0 — dùng khi một băng vai trò có
   nhiều hộp không đều kích thước (ví dụ store band có Redis-store, WAL,
   buffer-pool cùng lúc). Trả về từ gần người xem (z lớn) về xa. */
L.lanes = function(depths, gap) {
  const g = gap === undefined ? 2.6 : gap;
  let total = 0;
  depths.forEach(function(d) { total += d; });
  total += g * (depths.length - 1);
  let z = total / 2;
  const out = [];
  depths.forEach(function(d) {
    z -= d / 2;
    out.push(+z.toFixed(2));
    z -= d / 2 + g;
  });
  return out;
};

window.ECOM_CACHE_LAYOUT = L;
})();
