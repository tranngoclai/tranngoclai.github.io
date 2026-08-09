/* ══════════════════════════════════════════════
   ECOMMERCE CACHE DECK — 9-LEVEL COST TABLE

   Nguồn dữ liệu duy nhất cho ba kịch bản đọc bảng này: read path, cold cache
   (§10 doc — toàn bộ 9 level rơi vào nhánh miss cùng lúc) và write path
   (đọc `ttlSec`/`invalidation` làm baseline cửa sổ stale). Tách ra một file
   thay vì để mỗi model tự chép số, vì ba bản chép sẽ trôi khỏi nhau.

   `serveMs`/`missForwardMs` là số MINH HOẠ — docs/caching-levels-flow.md
   không cho số cụ thể, chỉ cho thứ tự nhanh→chậm theo khoảng cách tới disk.
   Đừng trích các số này ra ngoài deck như dữ liệu benchmark thật.

   Thứ tự mảng theo ĐÚNG numbering của doc (mục 10), KHÔNG theo thứ tự đọc
   thật của request: level 7 (ORM cache) đọc TRƯỚC level 6 (DB engine) trên
   đường request thật — đó chính là cái bẫy ở §7. `n` giữ nguyên số doc đặt
   tên; world file dùng `L.X.orm < L.X.db` để vẽ đúng thứ tự đọc thật. */

(function() {
function finite(name, value) {
  if (!Number.isFinite(value)) throw new TypeError(name + ' must be finite');
}
function nonNegative(name, value) {
  finite(name, value);
  if (value < 0) throw new RangeError(name + ' must not be negative');
}

const LEVELS = Object.freeze([
  Object.freeze({n: 1, key: 'dns', name: 'DNS Resolver', control: 'DNS TTL config',
    invalidation: 'Chờ hết TTL', serveMs: 1, missForwardMs: 20, ttlSec: 300, onRequestPath: true}),
  Object.freeze({n: 2, key: 'browser', name: 'Browser Cache', control: 'Response header (Cache-Control/ETag)',
    invalidation: 'Conditional GET, hoặc filename hash đổi', serveMs: 0.5, missForwardMs: 0, ttlSec: 86400, onRequestPath: true}),
  Object.freeze({n: 3, key: 'cdn', name: 'CDN', control: 'Edge config + purge API',
    invalidation: 'Purge theo URL/tag, hoặc TTL', serveMs: 15, missForwardMs: 40, ttlSec: 60, onRequestPath: true}),
  Object.freeze({n: 4, key: 'lb', name: 'LB / Reverse Proxy', control: 'Proxy config, cache tag',
    invalidation: 'Purge theo tag, TTL ngắn', serveMs: 3, missForwardMs: 25, ttlSec: 30, onRequestPath: true}),
  Object.freeze({n: 5, key: 'redis', name: 'App Cache (Redis)', control: 'Code app',
    invalidation: 'DEL thủ công / Pub-Sub / TTL', serveMs: 2, missForwardMs: 12, ttlSec: 300, onRequestPath: true}),
  Object.freeze({n: 6, key: 'db', name: 'DB Engine (buffer pool)', control: 'DB tự quản',
    invalidation: 'Tự động theo WAL, không cần app can thiệp', serveMs: 1, missForwardMs: 8, ttlSec: null, onRequestPath: true}),
  Object.freeze({n: 7, key: 'orm', name: 'ORM Cache', control: 'ORM library (cacheops...)',
    invalidation: "Auto qua signal save()/delete()", serveMs: 1.5, missForwardMs: 6, ttlSec: 120, onRequestPath: true}),
  Object.freeze({n: 8, key: 'os', name: 'OS Page Cache', control: 'Kernel',
    invalidation: 'Tự động, evict khi memory pressure', serveMs: 0.8, missForwardMs: 8, ttlSec: null, onRequestPath: true}),
  Object.freeze({n: 9, key: 'build', name: 'Build/Compiler Cache', control: 'CI config',
    invalidation: 'Cache key = hash(lockfile/source)', serveMs: null, missForwardMs: null, ttlSec: null, onRequestPath: false})
]);

LEVELS.forEach(function(lv) {
  nonNegative(lv.key + '.n', lv.n);
  if (lv.serveMs !== null) nonNegative(lv.key + '.serveMs', lv.serveMs);
  if (lv.missForwardMs !== null) nonNegative(lv.key + '.missForwardMs', lv.missForwardMs);
  if (lv.ttlSec !== null) nonNegative(lv.key + '.ttlSec', lv.ttlSec);
});

const BY_KEY = {};
LEVELS.forEach(function(lv) { BY_KEY[lv.key] = lv; });
function byKey(key) {
  const lv = BY_KEY[key];
  if (!lv) throw new RangeError('unknown level key: ' + key);
  return lv;
}

function fmtMs(ms) {
  nonNegative('ms', ms);
  return (ms < 10 ? ms.toFixed(1) : Math.round(ms)) + ' ms';
}
function fmtTtl(sec) {
  if (sec === null || sec === undefined) return 'không TTL — tự động đúng';
  nonNegative('ttlSec', sec);
  if (sec >= 3600) return (sec / 3600).toFixed(sec % 3600 ? 1 : 0) + 'h';
  if (sec >= 60) return (sec / 60).toFixed(sec % 60 ? 1 : 0) + 'm';
  return sec + 's';
}
function fmtMoney(value) {
  finite('money', value);
  return '$' + value.toFixed(2);
}
function fmtPct(ratio) {
  finite('ratio', ratio);
  return Math.round(ratio * 100) + '%';
}

window.ECOM_CACHE_LEVELS = {
  LEVELS: LEVELS, byKey: byKey,
  fmtMs: fmtMs, fmtTtl: fmtTtl, fmtMoney: fmtMoney, fmtPct: fmtPct,
  finite: finite, nonNegative: nonNegative
};
})();
