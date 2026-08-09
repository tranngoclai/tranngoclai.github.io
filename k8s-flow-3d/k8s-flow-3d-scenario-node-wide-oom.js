/* Node-wide Linux OOM — assembly only. */
(function() {
const KIT = window.SCENE_KIT;
const M = window.OOM_KILLER_MODEL;
const run = M.simulateNodeWide(M.DEFAULT_NODE_WIDE_CONFIG);
KIT.scenario({
  id: 'node-wide-linux-oom',
  name: 'Node-wide Linux OOM',
  tag: 'GLOBAL OOM',
  pipeline: [KIT.stage('⚙', 'Protect'), KIT.stage('▣', 'Exhaust', 'danger'), KIT.stage('↕', 'Rank', 'warn'), KIT.stage('✕', 'Kill', 'danger'), KIT.stage('↻', 'Recover', 'ok')],
  world: window.createNodeWideOomWorld(run),
  steps: window.createNodeWideOomSteps(run)
});
})();
