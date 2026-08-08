/* One persistent world. A Pod is the Kubernetes owner; its Linux process is
   the thing the kernel can actually kill. */
(function() {
const KIT = window.SCENE_KIT;
const M = window.OOM_KILLER_MODEL;
window.OOM_KILLER_POS = {
  apiserver: [-14, 0, -5], kubelet: [-6, 0, -5], runtime: [2, 0, -5],
  allocator: [10, 0, -5], oom: [10, 0, 1], reaper: [10, 0, 7],
  cgroup: [2, 0, 1], burstable: [-6, 0, 1], besteffort: [-6, 0, 7], guaranteed: [2, 0, 7],
  burstableProc: [-6, 2.4, 1], bestEffortProc: [-6, 2.4, 7], guaranteedProc: [2, 2.4, 7]
};
window.createOomKillerWorld = function(R) { return function(raw) {
  const w = KIT.world(raw), p = window.OOM_KILLER_POS;
  w.node('node', {label: 'Worker A\n' + M.fmtMi(R.nodeCapacityMi) + ' capacity', pos: [-1, -1.6, 1], size: [28, .6, 17], tone: 'surface', order: 0, hover: 'Linux Node: global OOM is a kernel decision on this host'});
  w.node('apiserver', {label: 'API Server', pos: p.apiserver, size: [4.2, 3.8, 2.8], tone: 'core', order: 1, hover: 'Stores Pod spec and later containerStatuses'});
  w.node('kubelet', {label: 'kubelet', pos: p.kubelet, size: [4.2, 3.8, 2.8], tone: 'engine', order: 1, hover: 'Derives container oom_score_adj and reconciles restartPolicy'});
  w.node('runtime', {label: 'container runtime\nCRI', pos: p.runtime, size: [4.5, 3.8, 2.8], tone: 'system', order: 1, hover: 'Creates and observes the container process through CRI'});
  w.node('allocator', {label: 'kernel page\nallocator', pos: p.allocator, size: [4.5, 3.8, 2.8], tone: 'engine', order: 1, hover: 'Allocation fails only after reclaim cannot make progress'});
  w.node('oom', {label: 'kernel OOM\nkiller', pos: p.oom, size: [4.5, 3.8, 2.8], tone: 'engine', order: 1, hover: 'Selects a Linux task; it never kills a Kubernetes Pod object'});
  w.node('reaper', {label: 'OOM reaper', pos: p.reaper, size: [4.2, 3.5, 2.8], tone: 'engine', order: 2, hover: 'Kernel helper that reclaims the selected task address space'});
  w.node('burstable', {label: 'Burstable Pod\nr128Mi / l1Gi', pos: p.burstable, size: [4.5, 1.3, 2.8], tone: 'subject', order: 2, hover: 'Container has a 1Gi cgroup memory limit'});
  w.node('best-effort', {label: 'BestEffort Pod\nno requests or limits', pos: p.besteffort, size: [4.8, 1.3, 2.8], tone: 'peer', order: 2, hover: 'Global-OOM candidate with kubelet-set oom_score_adj 1000'});
  w.node('guaranteed', {label: 'Guaranteed Pod\nr = l = 1Gi', pos: p.guaranteed, size: [4.8, 1.3, 2.8], tone: 'live', order: 2, hover: 'Global-OOM candidate with kubelet-set oom_score_adj -997'});
  w.node('cgroup', {label: 'container cgroup v2\nmemory.max = ' + M.fmtMi(R.limitMi), pos: p.cgroup, size: [4.8, 3.2, 2.8], tone: 'gate', order: 3, hover: 'Linux memory controller enforcing this container limit'});
  w.node('burstable-process', {label: 'app process\noom_score_adj ' + R.burstableAdj, pos: p.burstableProc, size: [3.6, 1.2, 2.1], tone: 'subject', order: 4, hover: 'A Linux process in the Burstable container'});
  w.node('best-effort-process', {label: 'worker process\noom_score_adj 1000', pos: p.bestEffortProc, size: [3.8, 1.2, 2.1], tone: 'peer', order: 4, hover: 'A Linux process, not the Pod object, is selected'});
  w.node('guaranteed-process', {label: 'api process\noom_score_adj -997', pos: p.guaranteedProc, size: [3.8, 1.2, 2.1], tone: 'live', order: 4, hover: 'Kubelet protects this QoS class most strongly'});
  w.region('KUBERNETES CONTROL', -10, -5, 8);
  w.region('LINUX KERNEL', 10, 1, 8);
  w.region('PODS + CONTAINER PROCESSES', -2, 5, 8);
  w.cam([-1, 0, 1], 45);
}; };
})();
