/* COLD CACHE — assembly. Model chạy một lần; world + 4 arc steps dùng chung
   một `run`. Không có short-circuit trong scenario này — đó chính là điểm
   khác biệt với read path. */
(function() {
const KIT = window.SCENE_KIT, M = window.COLD_CACHE_MODEL;
const run = M.simulate(M.DEFAULT_CONFIG);

KIT.scenario({
  id: 'cold-cache',
  name: 'Cold cache', tag: 'COLD',
  pipeline: [
    KIT.stage('⚡', 'Deploy'), KIT.stage('▽', 'Cold walk'), KIT.stage('⛁', 'Disk'),
    KIT.stage('↺', 'Fill'), KIT.stage('✓', 'Warm')
  ],
  focusLabels: true,
  world: window.createColdCacheWorld(run),
  steps: window.createColdCacheSteps(run)
});
})();
