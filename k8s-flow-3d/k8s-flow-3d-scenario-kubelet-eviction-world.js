/* ══════════════════════════════════════════════
   KUBELET EVICTION — ONE PERSISTENT, TRUTHFUL WORLD

   Every real thing is declared once. Measurements, status, ranking and
   Events are state on these components, never duplicate 3D boxes.

   Bố cục tuân theo luật dùng chung ở k8s-flow-3d-layout.js: cột X là giai đoạn
   của luồng, băng Z là nhóm vai trò, kích thước tra từ `SIZE`. Riêng kịch bản
   này Worker A là Node **được mổ xẻ** nên nó dùng `SIZE.nodeDeep` — sâu hơn để
   chứa đủ ba hàng: kernel · agent · Pod. Worker B là Node bình thường
   (`SIZE.node`), và mọi Pod ở cả hai Node đều cùng `SIZE.pod`.

   Cột control plane xếp theo băng vai trò, từ gần người xem về xa:

     z+  kube-scheduler                (băng đặt chỗ)
         ReplicaSet controller         (băng sinh workload)
     z−  node lifecycle controller     (băng lifecycle)
         pod garbage collector         (băng dọn dẹp)

   The component census follows the real actor list of node-pressure eviction.
   Four of these are the ones people forget exist, and each one is a whole
   class of misdiagnosis when it is missing from the mental model:

     cadvisor    the stats pipeline. kubelet acts on working-set from here,
                 not on what `free -m` prints.
     imagegc     node-level reclaim, attempted BEFORE any Pod is touched.
     nodelife    node lifecycle controller — turns the condition into a taint.
                 kubelet never writes the taint itself.
     podgc       why evicted Pod objects pile up long after the containers die.

   A static/critical Pod is also on the Node, because "kubelet ranked every
   Pod" is false and the excluded box is what makes that visible.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const L = window.K8S_LAYOUT;
const S = L.SIZE;

/* Hai làn Node: Worker A sâu hơn vì nó mở ra ba hàng, Worker B là Node thường.
   `L.lanes` nhận độ sâu thật của từng tấm nên hai tấm không đè nhau. */
const LANE = L.lanes([S.nodeDeep[2], S.node[2]]);
const A = LANE[0], B = LANE[1];

const COL = L.cols(L.X.node, 4);
const AGENT_Y = L.on(S.agent[1]);
const KERNEL_Y = L.on(S.kernel[1]);
const POD_Y = L.on(S.pod[1]);

window.KUBELET_EVICTION_POS = {
  /* Cột control plane — mỗi controller ở đúng băng vai trò của nó. */
  scheduler:  [L.X.control, L.Y.ground, L.Z.sched],
  controller: [L.X.control, L.Y.ground, L.Z.workload],
  apiserver:  [L.X.core,    L.Y.ground, L.Z.spine],
  nodelife:   [L.X.control, L.Y.ground, L.Z.lifecycle],
  podgc:      [L.X.control, L.Y.ground, L.Z.gc],

  /* Worker A · hàng kernel (xa nhất) và hàng agent (giữa). */
  cgroups:  [COL[0], KERNEL_Y, L.row.deepKernel(A)],
  cadvisor: [COL[1], AGENT_Y,  L.row.deepAgent(A)],
  kubelet:  [COL[2], AGENT_Y,  L.row.deepAgent(A)],
  runtime:  [COL[3], AGENT_Y,  L.row.deepAgent(A)],

  /* Worker A · hàng Pod (gần người xem nhất). */
  pods: {
    'pod-a':      [COL[0], POD_Y, L.row.deepPod(A)],
    'pod-b':      [COL[1], POD_Y, L.row.deepPod(A)],
    'pod-c':      [COL[2], POD_Y, L.row.deepPod(A)],
    'pod-static': [COL[3], POD_Y, L.row.deepPod(A)]
  },

  /* Pod bị evict rời khỏi Node — nó bay ra khỏi mép phải tấm Worker A, nên
     "không còn nằm trên Node nữa" là điều mắt thấy chứ không phải điều phải
     đọc. Pod thay thế thì nằm ở cột queue, chỗ mọi Pod Pending đứng chờ. */
  evicted: [L.X.node + 11.5, 1.6, L.row.deepPod(A)],
  replacementQueue: [L.X.queue, L.Y.queue, L.Z.sched],

  workerB:    [L.X.node, L.Y.slab, B],
  workerBPod: [COL[0], POD_Y, L.row.pod(B)]
};

window.KUBELET_EVICTION_WORLD = function(raw) {
  const w = KIT.world(raw);
  const p = window.KUBELET_EVICTION_POS;

  /* ── Control plane ── */
  w.node('apiserver', {
    label: 'API Server', pos: p.apiserver, size: S.core,
    tone: 'core', order: 0,
    hover: 'Nhận Pod status, Event và NodeCondition; là điểm phối hợp của controllers'
  });
  w.node('scheduler', {
    label: 'kube-scheduler', pos: p.scheduler, size: S.scheduler,
    tone: 'system', order: 2,
    hover: 'Chọn Node cho Pod thay thế; không chọn victim node-pressure'
  });
  w.node('controller', {
    label: 'ReplicaSet\ncontroller', pos: p.controller, size: S.controller,
    tone: 'system', order: 1,
    hover: 'Tạo đúng một Pod thay thế với UID mới khi actual replicas giảm'
  });
  w.node('nodelife', {
    label: 'node lifecycle\ncontroller', pos: p.nodelife, size: S.controller,
    tone: 'system', order: 1,
    hover: 'Đọc NodeCondition rồi gắn taint memory-pressure; kubelet không tự gắn taint'
  });
  w.node('podgc', {
    label: 'pod garbage\ncollector', pos: p.podgc, size: S.controller,
    tone: 'system', order: 2,
    hover: 'Dọn Pod object đã terminated khi vượt ngưỡng; vì sao Evicted Pod tồn đọng'
  });

  /* ── Worker A: the pressure domain — Node duy nhất được mổ xẻ ── */
  w.node('node', {
    label: 'Worker A\nReady', pos: [L.X.node, L.Y.slab, A], size: S.nodeDeep,
    tone: 'surface', order: 2, shape: 'slab',
    hover: 'Một Node duy nhất chứa stats pipeline, kubelet, runtime và bốn Pod'
  });
  w.node('cgroups', {
    label: 'kernel\ncgroup memory', pos: p.cgroups, size: S.kernel,
    tone: 'engine', order: 3, shape: 'hex',
    hover: 'Nguồn sự thật: working_set, inactive_file. Kernel, không phải Kubernetes'
  });
  w.node('cadvisor', {
    label: 'cAdvisor + CRI\nSummary API', pos: p.cadvisor, size: S.agent,
    tone: 'engine', order: 3,
    hover: 'Stats pipeline gom số của kernel thành summary mà eviction manager đọc'
  });
  w.node('kubelet', {
    label: 'kubelet\neviction manager', pos: p.kubelet, size: S.agent,
    tone: 'engine', order: 3,
    hover: 'Đánh giá threshold, thử reclaim node-level, rank Pod, rồi yêu cầu runtime dừng victim'
  });
  w.node('runtime', {
    label: 'container runtime\n+ image GC', pos: p.runtime, size: S.agent,
    tone: 'system', order: 3,
    hover: 'Thực thi kill containers và garbage collection; không tự chọn victim'
  });

  w.node('pod-a', {
    label: 'Pod A\nP100 · r4/u3Gi', pos: p.pods['pod-a'], size: S.pod,
    tone: 'live', order: 4, shape: 'seal',
    hover: 'Candidate A: usage 3Gi dưới request 4Gi, Priority 100'
  });
  w.node('pod-b', {
    label: 'Pod B\nP200 · r1/u2Gi', pos: p.pods['pod-b'], size: S.pod,
    tone: 'live', order: 4, shape: 'seal',
    hover: 'Candidate B: usage 2Gi vượt request 1Gi, Priority 200'
  });
  w.node('pod-c', {
    label: 'Pod C\nP10k · r1/u3Gi', pos: p.pods['pod-c'], size: S.pod,
    tone: 'live', order: 4, shape: 'seal',
    hover: 'Candidate C: usage 3Gi vượt request 1Gi, Priority 10000'
  });
  w.node('pod-static', {
    label: 'kube-proxy\nstatic · critical', pos: p.pods['pod-static'], size: S.pod,
    tone: 'peer', order: 4, shape: 'seal',
    hover: 'Static/critical Pod: kubelet loại khỏi danh sách victim trước khi rank'
  });

  /* ── Worker B: where a replacement can actually land ── */
  w.node('worker-b', {
    label: 'Worker B\nReady · no taint', pos: p.workerB, size: S.node,
    tone: 'surface', order: 4, shape: 'slab',
    hover: 'Đích khả dụng cho replacement: không bị taint và còn memory trống'
  });
  w.node('replacement', {
    label: 'Replacement\nnew UID · Pending', pos: p.replacementQueue,
    size: S.pod, tone: 'subject', order: 5, hidden: true, shape: 'seal',
    hover: 'Một Pod object mới; không phải Pod victim sống lại'
  });

  w.region('CONTROL PLANE', L.X.core, 0, 8);
  w.region('WORKER NODES', L.X.node, 0, 8);
  w.cam([2, 0, -3], 48);
};
})();
