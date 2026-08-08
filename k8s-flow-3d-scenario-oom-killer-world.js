/* ══════════════════════════════════════════════
   OOM KILLER — ONE PERSISTENT WORLD

   A Pod is the Kubernetes owner; its Linux process is the thing the kernel can
   actually kill. Cả hai đều là component thật, không phải hình minh hoạ.

   Bố cục theo luật dùng chung ở k8s-flow-3d-layout.js. Điểm sửa lớn nhất so
   với bản trước: tấm Worker A từng rộng tới mức **API Server đứng trên lưng
   Node** — đọc ra một điều sai. Giờ API Server ở đúng cột control plane như
   mọi kịch bản khác, và tấm Node chỉ chứa những thứ thật sự nằm trên host đó.

   Worker A là Node được mổ xẻ (`SIZE.nodeDeep`) nên nó có đủ ba hàng, xếp từ
   xa về gần người xem đúng theo thứ tự của luật 4:

     hàng KERNEL  container cgroup · page allocator · OOM killer · OOM reaper
     hàng AGENT   kubelet · container runtime (CRI)
     hàng POD     Burstable · BestEffort · Guaranteed
                  — và process của mỗi Pod nằm ngay TRÊN chính Pod đó

   Ba hàng đó cũng chính là ba tầng của câu chuyện: kernel quyết định, agent
   quan sát, Pod chịu hậu quả. Kích thước phân biệt tầng: hộp kernel cao hơn
   hộp agent, process dẹt hơn Pod mà nó ngồi lên.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const L = window.K8S_LAYOUT;
const S = L.SIZE;
const M = window.OOM_KILLER_MODEL;

/* Một Node duy nhất, canh giữa. */
const A = L.lanes([S.nodeDeep[2]])[0];

const COL = L.cols(L.X.node, 4);
const KERNEL_Z = L.row.deepKernel(A);
const AGENT_Z  = L.row.deepAgent(A);
const POD_Z    = L.row.deepPod(A);

const KERNEL_Y = L.on(S.kernel[1]);
const AGENT_Y  = L.on(S.agent[1]);
const POD_Y    = L.on(S.pod[1]);
const PROC_Y   = L.onTopOf(S.pod[1], S.proc[1]);   // process ngồi trên chính Pod của nó

window.OOM_KILLER_POS = {
  apiserver: [L.X.core, L.Y.ground, L.Z.spine],

  /* hàng kernel */
  cgroup:    [COL[0], KERNEL_Y, KERNEL_Z],
  allocator: [COL[1], KERNEL_Y, KERNEL_Z],
  oom:       [COL[2], KERNEL_Y, KERNEL_Z],
  reaper:    [COL[3], KERNEL_Y, KERNEL_Z],

  /* hàng agent */
  kubelet:   [COL[1], AGENT_Y, AGENT_Z],
  runtime:   [COL[2], AGENT_Y, AGENT_Z],

  /* hàng Pod, và process nằm ngay trên Pod tương ứng */
  burstable:      [COL[0], POD_Y, POD_Z],
  besteffort:     [COL[1], POD_Y, POD_Z],
  guaranteed:     [COL[2], POD_Y, POD_Z],
  burstableProc:  [COL[0], PROC_Y, POD_Z],
  bestEffortProc: [COL[1], PROC_Y, POD_Z],
  guaranteedProc: [COL[2], PROC_Y, POD_Z]
};

window.createOomKillerWorld = function(R) { return function(raw) {
  const w = KIT.world(raw), p = window.OOM_KILLER_POS;

  /* ── Control plane ── */
  w.node('apiserver', {label: 'API Server', pos: p.apiserver, size: S.core, tone: 'core', order: 0, hover: 'Stores Pod spec and later containerStatuses'});

  /* ── Worker A: Linux host được mổ xẻ ── */
  w.node('node', {label: 'Worker A\n' + M.fmtMi(R.nodeCapacityMi) + ' capacity', pos: [L.X.node, L.Y.slab, A], size: S.nodeDeep, tone: 'surface', order: 1, hover: 'Linux Node: global OOM is a kernel decision on this host'});

  /* hàng kernel — bốn subsystem của Linux, không phải component Kubernetes */
  w.node('cgroup', {label: 'container cgroup v2\nmemory.max = ' + M.fmtMi(R.limitMi), pos: p.cgroup, size: S.kernel, tone: 'gate', order: 2, hover: 'Linux memory controller enforcing this container limit'});
  w.node('allocator', {label: 'kernel page\nallocator', pos: p.allocator, size: S.kernel, tone: 'engine', order: 2, hover: 'Allocation fails only after reclaim cannot make progress'});
  w.node('oom', {label: 'kernel OOM\nkiller', pos: p.oom, size: S.kernel, tone: 'engine', order: 2, hover: 'Selects a Linux task; it never kills a Kubernetes Pod object'});
  w.node('reaper', {label: 'OOM reaper', pos: p.reaper, size: S.kernel, tone: 'engine', order: 2, hover: 'Kernel helper that reclaims the selected task address space'});

  /* hàng agent — hai thứ của Kubernetes chạy trên Node */
  w.node('kubelet', {label: 'kubelet', pos: p.kubelet, size: S.agent, tone: 'engine', order: 3, hover: 'Derives container oom_score_adj and reconciles restartPolicy'});
  w.node('runtime', {label: 'container runtime\nCRI', pos: p.runtime, size: S.agent, tone: 'system', order: 3, hover: 'Creates and observes the container process through CRI'});

  /* hàng Pod — ba QoS class, cùng SIZE.pod như mọi Pod trong deck */
  w.node('burstable', {label: 'Burstable Pod\nr128Mi / l1Gi', pos: p.burstable, size: S.pod, tone: 'subject', order: 4, hover: 'Container has a 1Gi cgroup memory limit'});
  w.node('best-effort', {label: 'BestEffort Pod\nno requests or limits', pos: p.besteffort, size: S.pod, tone: 'peer', order: 4, hover: 'Global-OOM candidate with kubelet-set oom_score_adj 1000'});
  w.node('guaranteed', {label: 'Guaranteed Pod\nr = l = 1Gi', pos: p.guaranteed, size: S.pod, tone: 'live', order: 4, hover: 'Global-OOM candidate with kubelet-set oom_score_adj -997'});

  /* process ngồi TRÊN Pod của nó — thứ kernel thật sự kill nằm bên trong thứ
     Kubernetes sở hữu, và hình khối nói ra quan hệ đó */
  w.node('burstable-process', {label: 'app process\noom_score_adj ' + R.burstableAdj, pos: p.burstableProc, size: S.proc, tone: 'subject', order: 5, hover: 'A Linux process in the Burstable container'});
  w.node('best-effort-process', {label: 'worker process\noom_score_adj 1000', pos: p.bestEffortProc, size: S.proc, tone: 'peer', order: 5, hover: 'A Linux process, not the Pod object, is selected'});
  w.node('guaranteed-process', {label: 'api process\noom_score_adj -997', pos: p.guaranteedProc, size: S.proc, tone: 'live', order: 5, hover: 'Kubelet protects this QoS class most strongly'});

  w.region('CONTROL PLANE', L.X.core, 0, 8);
  w.region('WORKER NODES', L.X.node, 0, 8);
  w.cam([2, 0, 0], 42);
}; };
})();
