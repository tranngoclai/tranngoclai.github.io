/* Linux OOM Killer — assembly only. Model runs once; world and steps read it. */
(function() {
const KIT = window.SCENE_KIT, M = window.OOM_KILLER_MODEL;
const run = M.simulateContainer(M.DEFAULT_CONTAINER_CONFIG);
KIT.scenario({
  id: 'linux-oom-killer',
  name: 'Container Limit → OOMKilled', tag: 'OOMKILLED',
  pipeline: [KIT.stage('⚙', 'Prepare'), KIT.stage('▣', 'Charge'), KIT.stage('✕', 'Kill', 'danger'), KIT.stage('↗', 'Observe'), KIT.stage('↻', 'Restart', 'ok')],
  world: window.createOomKillerWorld(run),
  steps: window.createOomKillerSteps(run)
});
})();
