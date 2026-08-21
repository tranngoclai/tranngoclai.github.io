/* ══════════════════════════════════════════════
   KUBELET EVICTION — ASSEMBLY

   The pipeline strip is the real interaction sequence of node-pressure
   eviction, in order. Two stages are the ones usually missing from diagrams:

     Reclaim  kubelet tries node-level reclaim BEFORE any Pod is a candidate
     Signal   the condition kubelet writes and the taint a *different*
              controller derives from it

   Everything downstream of the model is computed once here, so the panel copy
   and the 3D states can never disagree about a number.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const MODEL = window.KUBELET_EVICTION_MODEL;
const POLICY = window.KUBELET_EVICTION_POLICY;

const D = MODEL.DEFAULT_CONFIG;
const config = {
  stats: Object.assign({}, D.stats),
  signal: Object.assign({}, D.signal),
  minimumReclaimMi: D.minimumReclaimMi,
  monitoringPeriodSeconds: D.monitoringPeriodSeconds,
  pressureTransitionSeconds: D.pressureTransitionSeconds,
  workerBFreeMi: D.workerBFreeMi,
  pods: D.pods.map(function(pod) { return Object.assign({}, pod); })
};

const run = MODEL.simulate(config);
const reclaim = POLICY.evaluateNodeLevelReclaim(run.threshold.signal);
const condition = POLICY.evaluateNodeCondition({
  triggered: run.threshold.triggered,
  pressureTransitionSeconds: config.pressureTransitionSeconds
});
const placement = POLICY.evaluateReplacementPlacement({
  victim: run.victim,
  workerBFreeMi: config.workerBFreeMi,
  sourceNodeTainted: condition.taintApplied
});
const gc = POLICY.evaluatePodGarbageCollection({});

KIT.scenario({
  id: 'kubelet-eviction',
  name: 'Kubelet Eviction',
  tag: 'EVICTION',
  pipelineIntro: {
    title: 'Worker A sắp hết RAM — ai quyết định Pod nào chết?',
    desc: '',
    nodes: ['cgroups', 'cadvisor', 'kubelet', 'runtime', 'node', 'nodelife', 'podgc'],
    bubbles: [
      {key: 'cgroups',  text: 'kernel cgroup',    at: 0.5, dur: 0.6, tone: 'warn'},
      {key: 'cadvisor', text: 'stats pipeline',   at: 1.3, dur: 0.6, tone: 'info'},
      {key: 'kubelet',  text: 'eviction manager', at: 2.1, dur: 0.6, tone: 'danger'},
      {key: 'runtime',  text: 'CRI + image GC',   at: 2.9, dur: 0.6, tone: 'system'},
      {key: 'nodelife', text: 'node lifecycle',   at: 3.7, dur: 0.6, tone: 'accent'},
      {key: 'podgc',    text: 'pod GC',           at: 4.5, dur: 0.6, tone: 'mute'}
    ],
    overviewAfter: 0.9
  },
  pipeline: [
    KIT.stage('📊', 'Observe'),
    KIT.stage('⚖️', 'Evaluate', 'warn'),
    KIT.stage('♻️', 'Reclaim', 'warn'),
    KIT.stage('🔢', 'Rank', 'warn'),
    KIT.stage('⏹', 'Evict', 'danger'),
    KIT.stage('🚩', 'Signal', 'danger'),
    KIT.stage('＋', 'Reconcile'),
    KIT.stage('⎈', 'Schedule')
  ],
  world: window.KUBELET_EVICTION_WORLD,
  steps: window.createKubeletEvictionObserveSteps(config, run, reclaim)
    .concat(window.createKubeletEvictionRankingSteps(config, run))
    .concat(window.createKubeletEvictionConsequenceSteps(config, run, condition, placement, gc))
});
})();
