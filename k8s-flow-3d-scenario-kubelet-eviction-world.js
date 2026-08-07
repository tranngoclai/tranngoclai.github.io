/* ══════════════════════════════════════════════
   KUBELET EVICTION — ONE PERSISTENT, TRUTHFUL WORLD

   Every real thing is declared once. Measurements, status, ranking and
   Events are state on these components, never duplicate 3D boxes.

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

window.KUBELET_EVICTION_POS = {
  nodelife: [-13.0, 0, -11.0],
  apiserver: [-13.0, 0, -4.6],
  controller: [-13.0, 0, 1.4],
  scheduler: [-13.0, 0, 7.0],
  podgc: [-13.0, 0, 12.6],
  cgroups: [-3.3, -0.4, -3.0],
  cadvisor: [0.6, -0.4, -3.0],
  kubelet: [4.5, -0.4, -3.0],
  runtime: [8.4, -0.4, -3.0],
  pods: {
    'pod-a': [-3.3, -0.4, 1.6],
    'pod-b': [0.6, -0.4, 1.6],
    'pod-c': [4.5, -0.4, 1.6],
    'pod-static': [8.4, -0.4, 1.6]
  },
  evicted: [12.6, 2.2, -7.6],
  replacementQueue: [-8.2, 1.0, 7.0],
  workerB: [17.8, -1.5, 1.4],
  workerBPod: [17.8, -0.4, 1.4]
};

window.KUBELET_EVICTION_WORLD = function(raw) {
  const w = KIT.world(raw);
  const p = window.KUBELET_EVICTION_POS;

  /* ── Control plane ── */
  w.node('nodelife', {
    label: 'node lifecycle\ncontroller', pos: p.nodelife, size: [4.5, 3.8, 3.0],
    tone: 'system', order: 1,
    hover: 'Đọc NodeCondition rồi gắn taint memory-pressure; kubelet không tự gắn taint'
  });
  w.node('apiserver', {
    label: 'API Server', pos: p.apiserver, size: [4.5, 4.8, 3.2],
    tone: 'core', order: 0,
    hover: 'Nhận Pod status, Event và NodeCondition; là điểm phối hợp của controllers'
  });
  w.node('controller', {
    label: 'ReplicaSet\ncontroller', pos: p.controller, size: [4.5, 4.1, 3.0],
    tone: 'system', order: 1,
    hover: 'Tạo đúng một Pod thay thế với UID mới khi actual replicas giảm'
  });
  w.node('scheduler', {
    label: 'kube-scheduler', pos: p.scheduler, size: [4.5, 4.1, 3.0],
    tone: 'system', order: 2,
    hover: 'Chọn Node cho Pod thay thế; không chọn victim node-pressure'
  });
  w.node('podgc', {
    label: 'pod garbage\ncollector', pos: p.podgc, size: [4.5, 3.6, 3.0],
    tone: 'system', order: 2,
    hover: 'Dọn Pod object đã terminated khi vượt ngưỡng; vì sao Evicted Pod tồn đọng'
  });

  /* ── Worker A: the pressure domain ── */
  w.node('node', {
    label: 'Worker A\nReady', pos: [2.5, -1.5, -0.2], size: [15.5, 0.6, 10.5],
    tone: 'surface', order: 2,
    hover: 'Một Node duy nhất chứa stats pipeline, kubelet, runtime và bốn Pod'
  });
  w.node('cgroups', {
    label: 'kernel\ncgroup memory', pos: p.cgroups, size: [3.4, 1.5, 2.2],
    tone: 'engine', order: 3,
    hover: 'Nguồn sự thật: working_set, inactive_file. Kernel, không phải Kubernetes'
  });
  w.node('cadvisor', {
    label: 'cAdvisor + CRI\nSummary API', pos: p.cadvisor, size: [3.4, 1.5, 2.2],
    tone: 'engine', order: 3,
    hover: 'Stats pipeline gom số của kernel thành summary mà eviction manager đọc'
  });
  w.node('kubelet', {
    label: 'kubelet\neviction manager', pos: p.kubelet, size: [3.7, 1.9, 2.4],
    tone: 'engine', order: 3,
    hover: 'Đánh giá threshold, thử reclaim node-level, rank Pod, rồi yêu cầu runtime dừng victim'
  });
  w.node('runtime', {
    label: 'container runtime\n+ image GC', pos: p.runtime, size: [3.4, 1.5, 2.2],
    tone: 'system', order: 3,
    hover: 'Thực thi kill containers và garbage collection; không tự chọn victim'
  });

  w.node('pod-a', {
    label: 'Pod A\nP100 · r4/u3Gi', pos: p.pods['pod-a'], size: [3.2, 1.5, 2.3],
    tone: 'live', order: 4,
    hover: 'Candidate A: usage 3Gi dưới request 4Gi, Priority 100'
  });
  w.node('pod-b', {
    label: 'Pod B\nP200 · r1/u2Gi', pos: p.pods['pod-b'], size: [3.2, 1.5, 2.3],
    tone: 'live', order: 4,
    hover: 'Candidate B: usage 2Gi vượt request 1Gi, Priority 200'
  });
  w.node('pod-c', {
    label: 'Pod C\nP10k · r1/u3Gi', pos: p.pods['pod-c'], size: [3.2, 1.5, 2.3],
    tone: 'live', order: 4,
    hover: 'Candidate C: usage 3Gi vượt request 1Gi, Priority 10000'
  });
  w.node('pod-static', {
    label: 'kube-proxy\nstatic · critical', pos: p.pods['pod-static'], size: [3.2, 1.5, 2.3],
    tone: 'peer', order: 4,
    hover: 'Static/critical Pod: kubelet loại khỏi danh sách victim trước khi rank'
  });

  /* ── Worker B: where a replacement can actually land ── */
  w.node('worker-b', {
    label: 'Worker B\nReady · no taint', pos: p.workerB, size: [7.5, 0.6, 8.0],
    tone: 'surface', order: 4,
    hover: 'Đích khả dụng cho replacement: không bị taint và còn memory trống'
  });
  w.node('replacement', {
    label: 'Replacement\nnew UID · Pending', pos: p.replacementQueue,
    size: [3.2, 1.4, 2.2], tone: 'subject', order: 5, hidden: true,
    hover: 'Một Pod object mới; không phải Pod victim sống lại'
  });

  w.region('CONTROL PLANE', -13.0, 0, 8);
  w.region('WORKER A · NODE-PRESSURE DOMAIN', 2.5, 0, 8);
  w.region('WORKER B', 17.8, 1.4, 8);
  w.cam([1.5, 0, 0], 52);
};
})();
