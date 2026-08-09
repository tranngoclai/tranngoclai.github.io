/* ══════════════════════════════════════════════
   READ PATH — MODEL

   Một request GET /products/4521 đi qua đúng 8 level nằm trên đường đọc
   thật (bỏ qua level 9 — build cache, không nằm trên request path):

     dns → browser → cdn → lb → redis → orm → db → os

   Thứ tự này là thứ tự ĐỌC THẬT, khác thứ tự numbering của doc (doc đánh số
   ORM là 7, DB engine là 6, nhưng trên đường đọc thật app hỏi Redis rồi ORM
   TRƯỚC khi chạm DB engine — đúng cái bẫy ở §7 mà ecommerce-cache-flow-3d-
   layout.js đã ghi chú).

   `hitLevel` là số `n` theo numbering của doc (1..8), hoặc chuỗi 'disk' cho
   trường hợp toàn bộ 8 level đều miss — request phải chạm ổ đĩa thật.
   `DISK_SEEK_MS` là số MINH HOẠ cho cú đọc đĩa cuối cùng đó, vì bảng
   ECOM_CACHE_LEVELS không có entry cho "disk" (nó không phải một cache).
══════════════════════════════════════════════ */

(function() {
const LV = window.ECOM_CACHE_LEVELS;

const REQUEST_PATH_ORDER = ['dns', 'browser', 'cdn', 'lb', 'redis', 'orm', 'db', 'os'];
const DISK_SEEK_MS = 6; // minh hoạ — cú đọc đĩa thật sau khi mọi cache đều miss

const DEFAULT_CONFIG = Object.freeze({
  productId: 'PID-4521',
  price: 89.99,
  stock: 120,
  hitLevel: 3 // doc-level 3 = CDN — request ấm, phổ biến nhất
});

function validateConfig(c) {
  LV.finite('price', c.price);
  LV.nonNegative('stock', c.stock);
  if (typeof c.productId !== 'string' || !c.productId) throw new TypeError('productId must be a non-empty string');
  if (c.hitLevel !== 'disk') {
    LV.finite('hitLevel', c.hitLevel);
    if (c.hitLevel < 1 || c.hitLevel > 8) throw new RangeError('hitLevel must be 1..8 or "disk"');
  }
}

/* Đi hết REQUEST_PATH_ORDER, dừng khi gặp level có n === hitLevel. Nếu
   hitLevel là 'disk' thì không level nào khớp — đi hết 8 level rồi cộng
   thêm DISK_SEEK_MS ở cuối. Hàm nội bộ, không export — export duy nhất là
   simulate()/deepRun() để hai lượt chạy luôn đồng bộ cùng logic. */
function walk(hitLevel) {
  const trail = [];
  let cumulativeMs = 0;
  let servedBy = null;

  for (let i = 0; i < REQUEST_PATH_ORDER.length; i++) {
    const lv = LV.byKey(REQUEST_PATH_ORDER[i]);
    const hit = lv.n === hitLevel;
    const stepMs = hit ? lv.serveMs : lv.missForwardMs;
    cumulativeMs += stepMs;
    trail.push(Object.freeze({
      n: lv.n, key: lv.key, name: lv.name, hit: hit,
      serveMs: stepMs, cumulativeMs: cumulativeMs
    }));
    if (hit) { servedBy = lv; break; }
  }

  if (!servedBy) {
    cumulativeMs += DISK_SEEK_MS;
    servedBy = {n: 0, key: 'disk', name: 'Disk (raw read)'};
    trail.push(Object.freeze({
      n: 0, key: 'disk', name: servedBy.name, hit: true,
      serveMs: DISK_SEEK_MS, cumulativeMs: cumulativeMs
    }));
  }

  return {trail: trail, cumulativeMs: cumulativeMs, servedBy: servedBy};
}

function simulate(config) {
  const c = config || DEFAULT_CONFIG;
  validateConfig(c);

  const result = walk(c.hitLevel);
  const deep = walk('disk');
  const savedMs = deep.cumulativeMs - result.cumulativeMs;

  return Object.freeze({
    productId: c.productId, price: c.price, stock: c.stock,
    hitLevel: c.hitLevel,
    trail: Object.freeze(result.trail),
    servedBy: Object.freeze(result.servedBy),
    cumulativeMs: result.cumulativeMs,
    fullDepthMs: deep.cumulativeMs,
    savedMs: savedMs,
    savedPct: deep.cumulativeMs === 0 ? 0 : savedMs / deep.cumulativeMs
  });
}

function deepRun(config) {
  const c = config || DEFAULT_CONFIG;
  return simulate(Object.assign({}, c, {hitLevel: 'disk'}));
}

window.READ_PATH_MODEL = {
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  REQUEST_PATH_ORDER: REQUEST_PATH_ORDER,
  DISK_SEEK_MS: DISK_SEEK_MS,
  simulate: simulate,
  deepRun: deepRun
};
})();
