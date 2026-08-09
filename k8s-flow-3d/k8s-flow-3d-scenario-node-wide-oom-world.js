/* Node-wide Linux OOM — persistent host world with three QoS examples. */
(function() {
const KIT = window.SCENE_KIT;
const L = window.K8S_LAYOUT;
const S = L.SIZE;
const M = window.OOM_KILLER_MODEL;
const A = L.lanes([S.nodeDeep[2]])[0];
const KERNEL_COL = L.cols(L.X.node, 3);
const AGENT_COL = L.cols(L.X.node, 2);
const POD_COL = L.cols(L.X.node, 3);
const KERNEL_Z = L.row.deepKernel(A);
const AGENT_Z = L.row.deepAgent(A);
const POD_Z = L.row.deepPod(A);

window.createNodeWideOomWorld = function(R) { return function(raw) {
  const w = KIT.world(raw);
  const byKey = {};
  const podsByKey = {};
  R.candidates.forEach(function(candidate) { byKey[candidate.key] = candidate; });
  R.pods.forEach(function(pod) { podsByKey[pod.key] = pod; });
  const be = podsByKey['best-effort'];
  const bu = podsByKey.burstable;
  const gu = podsByKey.guaranteed;
  const buResources = bu.containers[0].resources;
  const guResources = gu.containers[0].resources;

  w.node('apiserver', {label: 'API Server', pos: [L.X.core, L.Y.ground, L.Z.spine], size: S.core, tone: 'core', order: 0, hover: 'Stores the observed container termination status'});
  w.node('node', {label: 'Worker A · ' + M.fmtMi(R.node.memoryCapacityMi) + '\npost-reclaim available ' + M.fmtMi(R.initialSnapshot.availableAfterReclaimMi), pos: [L.X.node, L.Y.slab, A], size: S.nodeDeep, tone: 'surface', order: 1, hover: 'Initial accounted snapshot: candidate footprints + non-candidate memory ' + M.fmtMi(R.initialSnapshot.nonCandidateMemoryMi) + ' + available ' + M.fmtMi(R.initialSnapshot.availableAfterReclaimMi) + ' = node capacity'});

  w.node('allocator', {label: 'pending allocation\napp main +' + M.fmtMi(R.event.allocationMi) + ' · reclaim failed', pos: [KERNEL_COL[0], L.on(S.kernel[1]), KERNEL_Z], size: S.kernel, tone: 'engine', order: 2, hover: 'The allocation event and failed-reclaim premise exist before the action; aggregate Mi alone does not decide global OOM'});
  w.node('oom', {label: 'global OOM\nkiller', pos: [KERNEL_COL[1], L.on(S.kernel[1]), KERNEL_Z], size: S.kernel, tone: 'engine', order: 2, hover: 'Ranks killable Linux tasks in the allowed allocation domain'});
  w.node('reaper', {label: 'OOM reaper', pos: [KERNEL_COL[2], L.on(S.kernel[1]), KERNEL_Z], size: S.kernel, tone: 'engine', order: 2, hover: 'Reclaims the victim address space'});

  w.node('kubelet', {label: 'kubelet\nderives QoS + oom_score_adj', pos: [AGENT_COL[0], L.on(S.agent[1]), AGENT_Z], size: S.agent, tone: 'engine', order: 3, hover: 'Derives each QoS class from the complete Pod resource matrix, then configures process adjustment'});
  w.node('runtime', {label: 'container runtime\nCRI', pos: [AGENT_COL[1], L.on(S.agent[1]), AGENT_Z], size: S.agent, tone: 'system', order: 3, hover: 'Applies process settings and reports the termination'});

  w.node('best-effort', {label: be.qosClass + ' · restartPolicy ' + be.restartPolicy + '\ncpu/mem requests + limits: none', pos: [POD_COL[0], L.on(S.pod[1]), POD_Z], size: S.pod, tone: 'peer', order: 4, hover: 'All four CPU/memory request/limit fields are explicitly none; derived oom_score_adj 1000'});
  w.node('burstable', {label: bu.qosClass + ' · restartPolicy ' + bu.restartPolicy + '\nmem r' + M.fmtMi(buResources.requests.memoryMi) + '/l' + M.fmtMi(buResources.limits.memoryMi) + ' · cpu none', pos: [POD_COL[1], L.on(S.pod[1]), POD_Z], size: S.pod, tone: 'subject', order: 4, hover: 'Complete initial resource spec; QoS and adjustment are derived rather than authored'});
  w.node('guaranteed', {label: gu.qosClass + ' · restartPolicy ' + gu.restartPolicy + '\ncpu r' + M.fmtCpu(guResources.requests.cpuMilli) + '/l' + M.fmtCpu(guResources.limits.cpuMilli) + ' · mem r' + M.fmtMi(guResources.requests.memoryMi) + '/l' + M.fmtMi(guResources.limits.memoryMi), pos: [POD_COL[2], L.on(S.pod[1]), POD_Z], size: S.pod, tone: 'live', order: 4, hover: 'Every container has equal, explicit CPU and memory requests/limits; derived oom_score_adj -997'});

  w.node('best-effort-process', {label: 'worker PID 1 · main\n' + M.fmtMi(byKey['best-effort-process'].usageMi) + ' · adj ' + byKey['best-effort-process'].oomScoreAdj, pos: [POD_COL[0], L.onTopOf(S.pod[1], S.proc[1]), POD_Z], size: S.proc, tone: 'peer', order: 5, hover: 'Killable container-init process; adjustment is finite, not infinite'});
  w.node('burstable-process', {label: 'app PID 1 · main\n' + M.fmtMi(byKey['burstable-process'].usageMi) + ' · adj ' + byKey['burstable-process'].oomScoreAdj + ' · next +' + M.fmtMi(R.event.allocationMi), pos: [POD_COL[1], L.onTopOf(S.pod[1], S.proc[1]), POD_Z], size: S.proc, tone: 'subject', order: 5, hover: 'This predeclared process owns the failed node allocation event and has the highest finite teaching projection'});
  w.node('guaranteed-process', {label: 'api PID 1 · main\n' + M.fmtMi(byKey['guaranteed-process'].usageMi) + ' · adj ' + byKey['guaranteed-process'].oomScoreAdj, pos: [POD_COL[2], L.onTopOf(S.pod[1], S.proc[1]), POD_Z], size: S.proc, tone: 'live', order: 5, hover: 'Strongly protected, but not absolutely immune'});

  w.region('CONTROL PLANE', L.X.core, 0, 8);
  w.region('WORKER NODES', L.X.node, 0, 8);
  w.cam([2, 0, 0], 42);
}; };
})();
