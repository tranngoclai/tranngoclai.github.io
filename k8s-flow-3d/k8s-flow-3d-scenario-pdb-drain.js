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
  pipelineIntro: {
    title: 'Drain một Node mà không hạ dịch vụ — PDB là cái phanh',
    desc: '',
    nodes: ['kubectl', 'apiserver', 'pdb', 'disruption-controller',
            'worker-a', 'worker-b', 'worker-c',
            'pod-api-0', 'pod-api-1', 'pod-api-2'],
    bubbles: [
      {key: 'kubectl',  text: 'kubectl drain', at: 0.5, dur: 0.6, tone: 'info'},
      {key: 'apiserver', text: 'API Server',   at: 1.3, dur: 0.6, tone: 'core'},
      {key: 'pdb',      text: 'PodDisruptionBudget', at: 2.1, dur: 0.6, tone: 'gate'},
      {key: 'disruption-controller', text: 'disruption controller', at: 2.9, dur: 0.6, tone: 'accent'},
      {key: 'worker-a', text: 'Worker A',    at: 3.7, dur: 0.6, tone: 'warn'},
      {key: 'worker-c', text: 'Worker C',    at: 4.5, dur: 0.6, tone: 'ok'}
    ],
    overviewAfter: 0.9
  },
  world: window.createPdbDrainWorld(run),
  steps: window.createPdbDrainSteps(run)
});
})();
