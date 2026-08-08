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
  name: 'Kubelet Eviction',
  tag: 'EVICTION',
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
