/* ══════════════════════════════════════════════
   WRITE PATH — MODEL

   Admin sửa giá PID-4521 89.99 → 79.99. Invalidation đi NGƯỢC đường đọc,
   disk → client: db → os (dirty page) → orm (signal) → redis (DEL/Pub-Sub)
   → lb (purge) → cdn (purge) → browser (không purge được, chỉ chờ TTL).
   dns không nằm trong cascade này — DNS không cache dữ liệu giá.

   `staleWindowSec` của db/os/orm là 0: ba level này tự đồng bộ (WAL,
   kernel, ORM signal) nên không có khoảng trễ đáng kể. Với redis/lb/cdn —
   những level CẦN một lệnh invalidate rõ ràng — và browser — level KHÔNG
   invalidate được — con số này là TTL của chính level đó: nếu lệnh purge
   trễ hoặc (với browser) không hề tồn tại, TTL là giới hạn trên thật sự
   user còn thấy giá cũ. `totalStaleWindowSec` lấy MAX chứ không phải tổng,
   vì các level hết hạn song song, không tuần tự — và số lớn nhất luôn rơi
   vào browser, đúng cảnh báo "browser cache giá là nguồn stale nguy hiểm
   nhất" ở doc §11. */

(function() {
const LV = window.ECOM_CACHE_LEVELS;

const CASCADE_ORDER = ['db', 'os', 'orm', 'redis', 'lb', 'cdn', 'browser'];

const MECHANISM = {
  db: 'DB engine tự sửa buffer pool + ghi WAL — đồng bộ theo transaction log, không cần lệnh riêng',
  os: 'Kernel đánh dấu page dirty rồi tự flush — hoàn toàn tự động, ngoài tầm app/DB config',
  orm: 'cacheops auto-invalidate qua signal post_save/post_delete — tự động nếu update đi qua ORM',
  redis: 'App DEL product:4521, hoặc publish Pub/Sub product:4521:invalidate cho các instance khác tự xoá',
  lb: 'Purge theo cache tag product:4521',
  cdn: 'Purge theo URL/tag qua purge API',
  browser: 'Không có purge — chỉ chờ hết TTL hoặc conditional GET revalidate ETag'
};

const NEEDS_CALL = {db: false, os: false, orm: false, redis: true, lb: true, cdn: true, browser: false};

const DEFAULT_CONFIG = Object.freeze({
  productId: 'PID-4521',
  oldPrice: 89.99,
  newPrice: 79.99
});

const DEFAULT_RACE_TIMELINE = Object.freeze({
  aReadAtMs: 0,    // A đọc DB trước khi admin ghi xong — thấy giá cũ
  bReadAtMs: 15,   // B đọc DB sau khi admin ghi xong — thấy giá mới
  writeAtMs: 10,   // admin UPDATE giá hoàn tất
  aWriteAtMs: 40,  // A ghi Redis SAU B — thắng, đặt lại giá cũ vào cache
  bWriteAtMs: 25   // B ghi Redis trước, giá mới bị A ghi đè sau đó
});

const DEFAULT_BYPASS_CONFIG = Object.freeze({viaOrm: false});

function validateConfig(c) {
  LV.finite('oldPrice', c.oldPrice);
  LV.finite('newPrice', c.newPrice);
  if (c.oldPrice <= 0) throw new RangeError('oldPrice must be positive');
  if (c.newPrice <= 0) throw new RangeError('newPrice must be positive');
  if (typeof c.productId !== 'string' || !c.productId) throw new TypeError('productId must be a non-empty string');
}

function simulate(config) {
  const c = config || DEFAULT_CONFIG;
  validateConfig(c);

  const cascade = CASCADE_ORDER.map(function(key) {
    const lv = LV.byKey(key);
    const staleWindowSec = NEEDS_CALL[key] || key === 'browser' ? (lv.ttlSec || 0) : 0;
    return Object.freeze({
      n: lv.n, key: key, name: lv.name,
      mechanism: MECHANISM[key],
      needsExplicitCall: NEEDS_CALL[key],
      staleWindowSec: staleWindowSec
    });
  });

  const totalStaleWindowSec = cascade.reduce(function(m, e) { return Math.max(m, e.staleWindowSec); }, 0);

  return Object.freeze({
    productId: c.productId, oldPrice: c.oldPrice, newPrice: c.newPrice,
    cascade: Object.freeze(cascade),
    totalStaleWindowSec: totalStaleWindowSec
  });
}

/* Giá trị một request đọc được tại thời điểm t phụ thuộc write đã xảy ra
   chưa. Ai GHI VÀO REDIS sau cùng quyết định giá trị final trong cache —
   không phải ai đọc DB sau cùng. Đây chính là race condition ở §5: B đọc
   đúng (sau write) nhưng A ghi cache muộn hơn nên giá trị SAI thắng. */
function raceOutcome(timeline, config) {
  const c = config || DEFAULT_CONFIG;
  ['aReadAtMs', 'bReadAtMs', 'writeAtMs', 'aWriteAtMs', 'bWriteAtMs'].forEach(function(k) {
    LV.nonNegative(k, timeline[k]);
  });
  const aValue = timeline.aReadAtMs < timeline.writeAtMs ? c.oldPrice : c.newPrice;
  const bValue = timeline.bReadAtMs < timeline.writeAtMs ? c.oldPrice : c.newPrice;
  const finalWriter = timeline.aWriteAtMs > timeline.bWriteAtMs ? 'a' : 'b';
  const value = finalWriter === 'a' ? aValue : bValue;
  return Object.freeze({
    finalWriter: finalWriter, aValue: aValue, bValue: bValue,
    value: value, stale: value !== c.newPrice
  });
}

/* Raw SQL né được đúng MỘT cơ chế: signal post_save/post_delete của ORM.
   Các lệnh invalidate khác (Redis DEL, LB/CDN purge) là code app riêng,
   vẫn chạy bình thường — đúng bẫy §7: "DB đúng, buffer pool đúng, ORM cache
   sai" vì ORM cache đứng phía TRÊN DB engine trong đường đọc thật. */
function bypassImpact(bypassConfig) {
  const bc = bypassConfig || DEFAULT_BYPASS_CONFIG;
  if (typeof bc.viaOrm !== 'boolean') throw new TypeError('viaOrm must be a boolean');
  const levels = ['db', 'os', 'orm', 'redis', 'lb', 'cdn', 'browser'].map(function(key) {
    const lv = LV.byKey(key);
    let status;
    if (key === 'browser') status = 'warn'; // không purge được — luôn chỉ chờ TTL, không bao giờ 'ok'
    else if (key === 'orm') status = bc.viaOrm ? 'ok' : 'danger';
    else status = 'ok';
    return Object.freeze({n: lv.n, key: key, name: lv.name, status: status});
  });
  return Object.freeze({viaOrm: bc.viaOrm, levels: Object.freeze(levels)});
}

window.WRITE_PATH_MODEL = {
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  DEFAULT_RACE_TIMELINE: DEFAULT_RACE_TIMELINE,
  DEFAULT_BYPASS_CONFIG: DEFAULT_BYPASS_CONFIG,
  CASCADE_ORDER: CASCADE_ORDER,
  simulate: simulate,
  raceOutcome: raceOutcome,
  bypassImpact: bypassImpact
};
})();
