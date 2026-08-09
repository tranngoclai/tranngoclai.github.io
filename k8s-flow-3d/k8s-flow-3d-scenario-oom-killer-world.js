/* Container-limit OOM — one persistent world, scoped to one cgroup. */
(function() {
const KIT = window.SCENE_KIT;
const L = window.K8S_LAYOUT;
const S = L.SIZE;
const M = window.OOM_KILLER_MODEL;
const A = L.lanes([S.nodeDeep[2]])[0];
const KERNEL_COL = L.cols(L.X.node, 3);
const AGENT_COL = L.cols(L.X.node, 2);
const POD_COL = L.X.node;
const KERNEL_Z = L.row.deepKernel(A);
const AGENT_Z = L.row.deepAgent(A);
const POD_Z = L.row.deepPod(A);

window.createOomKillerWorld = function(R) { return function(raw) {
  const w = KIT.world(raw);
  const pod = R.pod;
  const container = R.container;
  const requestMi = container.resources.requests.memoryMi;
  const limitMi = container.resources.limits.memoryMi;
  w.node('apiserver', {label: 'API Server', pos: [L.X.core, L.Y.ground, L.Z.spine], size: S.core, tone: 'core', order: 0, hover: 'Stores Pod spec and container status'});
  w.node('node', {label: 'Worker A\n' + M.fmtMi(R.node.memoryCapacityMi) + ' capacity · cgroup v2', pos: [L.X.node, L.Y.slab, A], size: S.nodeDeep, tone: 'surface', order: 1, hover: 'Linux host running this Pod; the cgroup version is an initial resource fact'});

  w.node('cgroup', {label: 'container cgroup v2\nmemory.max=' + M.fmtMi(R.cgroup.memoryMaxMi) + ' · memory.oom.group=' + R.cgroup.memoryOomGroup, pos: [KERNEL_COL[0], L.on(S.kernel[1]), KERNEL_Z], size: S.kernel, tone: 'gate', order: 2, hover: 'Initial cgroup state: memory.current=' + M.fmtMi(R.cgroup.memoryCurrentMi) + ', memory.max=' + M.fmtMi(R.cgroup.memoryMaxMi) + ', memory.oom.group=' + R.cgroup.memoryOomGroup});
  w.node('oom', {label: 'kernel OOM\nkiller', pos: [KERNEL_COL[1], L.on(S.kernel[1]), KERNEL_Z], size: S.kernel, tone: 'engine', order: 2, hover: 'Chooses a killable Linux task inside the OOM cgroup'});
  w.node('reaper', {label: 'OOM reaper', pos: [KERNEL_COL[2], L.on(S.kernel[1]), KERNEL_Z], size: S.kernel, tone: 'engine', order: 2, hover: 'Reclaims the selected task address space'});

  w.node('kubelet', {label: 'kubelet\nsingleProcessOOMKill=' + R.resources.kubelet.singleProcessOOMKill, pos: [AGENT_COL[0], L.on(S.agent[1]), AGENT_Z], size: S.agent, tone: 'engine', order: 3, hover: 'Initial kubelet configuration; also reconciles restartPolicy=' + pod.restartPolicy});
  w.node('runtime', {label: 'container runtime\nCRI', pos: [AGENT_COL[1], L.on(S.agent[1]), AGENT_Z], size: S.agent, tone: 'system', order: 3, hover: 'Creates and observes container instances'});

  w.node('pod', {label: pod.qosClass + ' · restartPolicy ' + pod.restartPolicy + '\nmem r' + M.fmtMi(requestMi) + ' / l' + M.fmtMi(limitMi), pos: [POD_COL, L.on(S.pod[1]), POD_Z], size: S.pod, tone: 'subject', order: 4, hover: 'Initial Pod resource spec: CPU request/limit are both explicitly none; memory request=' + M.fmtMi(requestMi) + ', limit=' + M.fmtMi(limitMi) + ', restartPolicy=' + pod.restartPolicy});
  w.node('process', {label: 'PID 1 · main · Running\n' + M.fmtMi(R.cgroup.memoryCurrentMi) + ' → next +' + M.fmtMi(R.event.allocationMi), pos: [POD_COL, L.onTopOf(S.pod[1], S.proc[1]), POD_Z], size: S.proc, tone: 'subject', order: 5, hover: R.process.name + ' is the killable container-init process; the authored allocation event already belongs to it'});

  w.region('CONTROL PLANE', L.X.core, 0, 8);
  w.region('WORKER NODES', L.X.node, 0, 8);
  w.cam([2, 0, 0], 42);
}; };
})();
