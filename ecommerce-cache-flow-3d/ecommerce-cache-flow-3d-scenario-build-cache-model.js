/* ══════════════════════════════════════════════
   BUILD CACHE — MODEL

   Level 9 KHÔNG nằm trên đường request — không đọc `ECOM_CACHE_LEVELS`
   (đơn vị/ý nghĩa khác hẳn: đây là giây build, không phải ms phục vụ
   request), chỉ mượn `LV.finite`/`LV.nonNegative` làm validator dùng chung.

   Ba sub-cache, ba chiến lược key khác hẳn nhau:
   - install: key = hash TOÀN BỘ lockfile — đổi 1 dòng là mất sạch, tất cả
     hoặc không gì cả.
   - compile: key = hash TỪNG module — chỉ module đổi mới rebuild, phần còn
     lại tái sử dụng (partial reuse).
   - docker: key = hash CỘNG DỒN theo layer — layer nào đổi, MỌI layer sau
     nó rebuild theo, dù nội dung layer sau không đổi (prefix invalidation).

   Số giây ở đây là minh hoạ, không phải benchmark CI thật — nêu rõ trong
   world/steps khi hiển thị, không chỉ ở đây. */
(function() {
const LV = window.ECOM_CACHE_LEVELS;

const DEFAULT_CONFIG = Object.freeze({
  lockfileChanged: false,
  modulesTotal: 120,
  modulesChanged: 8,
  dockerLayersTotal: 6,
  dockerChangedIndex: 4,
  installColdSec: 42, installWarmSec: 2,
  compileColdSecPerModule: 0.35, compileWarmSecPerModule: 0.02,
  dockerColdSecPerLayer: 18, dockerWarmSecPerLayer: 1
});

function validateConfig(c) {
  if (typeof c.lockfileChanged !== 'boolean') throw new TypeError('lockfileChanged must be a boolean');
  LV.nonNegative('modulesTotal', c.modulesTotal);
  LV.nonNegative('modulesChanged', c.modulesChanged);
  if (!Number.isInteger(c.modulesTotal) || !Number.isInteger(c.modulesChanged)) throw new TypeError('modulesTotal/modulesChanged must be integers');
  if (c.modulesChanged > c.modulesTotal) throw new RangeError('modulesChanged cannot exceed modulesTotal');
  LV.nonNegative('dockerLayersTotal', c.dockerLayersTotal);
  LV.nonNegative('dockerChangedIndex', c.dockerChangedIndex);
  if (!Number.isInteger(c.dockerLayersTotal) || !Number.isInteger(c.dockerChangedIndex)) throw new TypeError('dockerLayersTotal/dockerChangedIndex must be integers');
  if (c.dockerChangedIndex >= c.dockerLayersTotal) throw new RangeError('dockerChangedIndex must be < dockerLayersTotal');
  ['installColdSec', 'installWarmSec', 'compileColdSecPerModule', 'compileWarmSecPerModule', 'dockerColdSecPerLayer', 'dockerWarmSecPerLayer'].forEach(function(k) {
    LV.nonNegative(k, c[k]);
  });
}

/* Prefix invalidation: mọi layer TỪ changedIndex trở đi rebuild, bất kể nội
   dung của chúng có đổi hay không — đây là điểm khác biệt cốt lõi với
   compile arc (per-module, không theo prefix). */
function dockerLayers(changedIndex, totalLayers) {
  const total = totalLayers === undefined ? DEFAULT_CONFIG.dockerLayersTotal : totalLayers;
  LV.nonNegative('changedIndex', changedIndex);
  LV.nonNegative('totalLayers', total);
  if (!Number.isInteger(changedIndex) || !Number.isInteger(total)) throw new TypeError('changedIndex/totalLayers must be integers');
  if (changedIndex >= total) throw new RangeError('changedIndex must be < totalLayers');
  const reused = [], rebuilt = [];
  for (let i = 0; i < total; i++) (i < changedIndex ? reused : rebuilt).push(i);
  return Object.freeze({reused: Object.freeze(reused), rebuilt: Object.freeze(rebuilt)});
}

/* Hash ngắn, xác định, chỉ để tên bundle cũ/mới khác nhau khi có module đổi
   — không phải một thuật toán hash thật, chỉ minh hoạ nguyên lý content
   hash trong tên file. */
function shortHash(seed) {
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h.toString(16).slice(0, 6).padStart(6, '0');
}

function simulate(config) {
  const c = config || DEFAULT_CONFIG;
  validateConfig(c);

  const installHit = !c.lockfileChanged;
  const installSec = installHit ? c.installWarmSec : c.installColdSec;
  const install = Object.freeze({
    key: 'lockfile:' + (c.lockfileChanged ? 'changed' : 'unchanged'),
    hit: installHit, sec: installSec, coldSec: c.installColdSec,
    savedSec: c.installColdSec - installSec
  });

  const modulesReused = c.modulesTotal - c.modulesChanged;
  const compileColdSec = c.modulesTotal * c.compileColdSecPerModule;
  const compileSec = modulesReused * c.compileWarmSecPerModule + c.modulesChanged * c.compileColdSecPerModule;
  const compile = Object.freeze({
    key: 'per-module content hash',
    modulesTotal: c.modulesTotal, modulesChanged: c.modulesChanged, modulesReused: modulesReused,
    hit: c.modulesChanged === 0, sec: compileSec, coldSec: compileColdSec,
    savedSec: compileColdSec - compileSec
  });

  const layers = dockerLayers(c.dockerChangedIndex, c.dockerLayersTotal);
  const dockerColdSec = c.dockerLayersTotal * c.dockerColdSecPerLayer;
  const dockerSec = layers.reused.length * c.dockerWarmSecPerLayer + layers.rebuilt.length * c.dockerColdSecPerLayer;
  const docker = Object.freeze({
    key: 'layer chain (prefix hash)',
    layersTotal: c.dockerLayersTotal, changedIndex: c.dockerChangedIndex,
    reused: layers.reused, rebuilt: layers.rebuilt,
    hit: layers.rebuilt.length === 0, sec: dockerSec, coldSec: dockerColdSec,
    savedSec: dockerColdSec - dockerSec
  });

  const totalSec = install.sec + compile.sec + docker.sec;
  const coldTotalSec = install.coldSec + compile.coldSec + docker.coldSec;
  const savedSec = coldTotalSec - totalSec;

  const bundleNameOld = 'main.' + shortHash('bundle:' + c.modulesTotal) + '.js';
  const bundleNameNew = compile.hit ? bundleNameOld : 'main.' + shortHash('bundle:' + c.modulesTotal + ':' + c.modulesChanged) + '.js';

  return Object.freeze({
    install: install, compile: compile, docker: docker,
    totalSec: totalSec, coldTotalSec: coldTotalSec,
    savedSec: savedSec, savedPct: coldTotalSec === 0 ? 0 : savedSec / coldTotalSec,
    bundleNameOld: bundleNameOld, bundleNameNew: bundleNameNew,
    bundleChanged: bundleNameOld !== bundleNameNew
  });
}

window.BUILD_CACHE_MODEL = {
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  simulate: simulate,
  dockerLayers: dockerLayers
};
})();
