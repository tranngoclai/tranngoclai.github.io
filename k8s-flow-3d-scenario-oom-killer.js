/* Linux OOM Killer — assembly only. Model runs once; world and steps read it. */
(function() {
const KIT = window.SCENE_KIT, M = window.OOM_KILLER_MODEL;
const run = M.simulate(M.DEFAULT_CONFIG);
KIT.scenario({
  name: 'Linux OOM Killer', tag: 'OOM',
  pipeline: [KIT.stage('⚙', 'Configure'), KIT.stage('▣', 'Limit OOM', 'danger'), KIT.stage('⚠', 'Global OOM', 'danger'), KIT.stage('↗', 'Status'), KIT.stage('↻', 'Restart', 'ok')],
  world: window.createOomKillerWorld(run),
  steps: window.createOomKillerSteps(run)
});
})();
