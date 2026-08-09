/* BUILD CACHE — assembly. Model chạy một lần; world + 5 arc steps dùng
   chung một `run`. Đây là scenario duy nhất trong deck KHÔNG đọc
   `ECOM_CACHE_LEVELS` cho phần chi phí — chỉ hai node cuối (cdn-edge,
   browser-cache) mượn TTL để hiển thị, đúng vai trò "điểm handoff". */
(function() {
const KIT = window.SCENE_KIT, M = window.BUILD_CACHE_MODEL;
const run = M.simulate(M.DEFAULT_CONFIG);

KIT.scenario({
  id: 'build-cache',
  name: 'Build cache', tag: 'BUILD',
  pipeline: [
    KIT.stage('▶', 'Trigger'), KIT.stage('⬇', 'Install'), KIT.stage('⚙', 'Compile'),
    KIT.stage('▣', 'Image'), KIT.stage('↑', 'Publish'), KIT.stage('✕', 'Purge')
  ],
  focusLabels: true,
  world: window.createBuildCacheWorld(run),
  steps: window.createBuildCacheSteps(run)
});
})();
