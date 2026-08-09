/* ══════════════════════════════════════════════
   COLD CACHE — MODEL

   Không có công thức riêng: cold cache CHỈ LÀ mọi level cùng lấy nhánh miss
   một lúc, đúng arithmetic đã có ở READ_PATH_MODEL — deck này chỉ đổi
   config, không viết lại phép tính. `warmMs`/`coldMs` gọi thẳng
   `RP.simulate`/`RP.deepRun` với `RP.DEFAULT_CONFIG`, nên số hiển thị ở đây
   luôn khớp byte-identical với phase read-path.

   Mỗi level cold vì MỘT trong hai nguyên nhân khác nhau — không gộp chung
   "mất cache" cho cả 8 level:
     - deploy: bundle hash mới / config mới làm key cũ không còn khớp
       (browser, cdn, lb — cache tag/URL gắn với version build; orm —
       process mới = state ORM in-memory mới tinh)
     - db restart: bộ nhớ trong bị xoá sạch (redis, db buffer pool, os page
       cache — đều sống trong RAM của tiến trình/container vừa khởi động lại)
   `dns` không thuộc nhóm nào — TTL DNS không liên quan gì tới deploy hay
   restart, nó vẫn ấm xuyên suốt scenario này. */
(function() {
if (!window.READ_PATH_MODEL) throw new Error('cold-cache model yêu cầu READ_PATH_MODEL đã được load trước (xem band comment trong HTML)');
const LV = window.ECOM_CACHE_LEVELS;
const RP = window.READ_PATH_MODEL;

const COLD_ORDER = RP.REQUEST_PATH_ORDER; // ['dns','browser','cdn','lb','redis','orm','db','os']
COLD_ORDER.forEach(function(key) { LV.byKey(key); }); // throws loud nếu key nào không tồn tại

const COLD_REASON = {
  dns: null, browser: 'deploy', cdn: 'deploy', lb: 'deploy',
  redis: 'db restart', orm: 'deploy', db: 'db restart', os: 'db restart'
};

const REASON_LABEL = {
  deploy: 'Deploy — bundle hash/config mới làm key cũ không còn khớp',
  'db restart': 'DB/container restart — bộ nhớ trong (buffer pool, page cache) bị xoá sạch'
};

const WARMUP_ORDER = ['redis', 'lb', 'cdn'];

const DEFAULT_CONFIG = Object.freeze({productId: RP.DEFAULT_CONFIG.productId});

function validateConfig(c) {
  if (typeof c.productId !== 'string' || !c.productId) throw new TypeError('productId must be a non-empty string');
}

function simulate(config) {
  const c = config || DEFAULT_CONFIG;
  validateConfig(c);

  const warm = RP.simulate(RP.DEFAULT_CONFIG);
  const cold = RP.deepRun(RP.DEFAULT_CONFIG);

  const levels = COLD_ORDER.map(function(key) {
    const lv = LV.byKey(key);
    const reason = COLD_REASON[key];
    return Object.freeze({
      n: lv.n, key: key, name: lv.name,
      cold: reason !== null,
      coldReason: reason,
      coldReasonLabel: reason ? REASON_LABEL[reason] : 'còn ấm — TTL của nó không liên quan tới deploy/restart'
    });
  });

  const warmMs = warm.cumulativeMs;
  const coldMs = cold.cumulativeMs;

  return Object.freeze({
    productId: c.productId,
    levels: Object.freeze(levels),
    trail: cold.trail,
    warmMs: warmMs, coldMs: coldMs,
    penaltyMs: coldMs - warmMs,
    penaltyX: warmMs === 0 ? 0 : coldMs / warmMs
  });
}

/* Request 1 miss hết, đọc thẳng đĩa; response đi ngược lại tự "cache-aside"
   ghi lại redis/orm/db/os trên đường về — nên từ request 2 trở đi, origin
   side đã ấm. Request 2 vì vậy được Redis trả lời; response của NÓ lại
   populate LB, nên request 3 được LB trả lời; rồi tới CDN ở request 4 trở
   đi. Browser (per-user, không chia sẻ) không nằm trong chuỗi warm-up này. */
function warmup(requestIndex) {
  LV.nonNegative('requestIndex', requestIndex);
  if (!Number.isInteger(requestIndex) || requestIndex < 1) throw new RangeError('requestIndex must be a positive integer');
  if (requestIndex === 1) return RP.deepRun(RP.DEFAULT_CONFIG);
  const idx = Math.min(requestIndex - 2, WARMUP_ORDER.length - 1);
  const hitLevel = LV.byKey(WARMUP_ORDER[idx]).n;
  return RP.simulate(Object.assign({}, RP.DEFAULT_CONFIG, {hitLevel: hitLevel}));
}

window.COLD_CACHE_MODEL = {
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  COLD_ORDER: COLD_ORDER,
  WARMUP_ORDER: WARMUP_ORDER,
  simulate: simulate,
  warmup: warmup
};
})();
