/* PDB + DRAIN — assembly. The model is run once; world and phases share it. */
(function() {
const KIT = window.SCENE_KIT, M = window.PDB_DRAIN_MODEL;
const run = M.simulate(M.DEFAULT_CONFIG);
KIT.scenario({
  id: 'pdb-drain',
  name: 'PDB & kubectl drain', tag: 'PDB',
  pipeline: [
    KIT.stage('◫', 'Budget', 'ok'), KIT.stage('⊘', 'Cordon', 'warn'),
    KIT.stage('⇢', 'Evict', 'warn'), KIT.stage('↻', 'Replace'),
    KIT.stage('⏳', 'Wait', 'danger')
  ],
  world: window.createPdbDrainWorld(run),
  steps: window.createPdbDrainSteps(run)
});
})();
