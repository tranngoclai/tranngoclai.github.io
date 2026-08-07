/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — PERSISTENT WORLD LAYOUT
   Every component of the cluster is built once, at a fixed place, and stays
   there for all 9 steps. Steps only reveal, recolour, focus and animate flows.

   Layout (top view):
        z+  ┌ scheduler · ActiveQ ────────────── Worker A (kubelet · CRI · Pod)
        0   ┼ client → authn → admission → API Server ─ Worker D
        z-  └ etcd · controller-manager ──────── Worker B / Worker C
══════════════════════════════════════════════ */
window.SCHEDULER_WORLD = function(w) {
  /* ── Control plane spine (z = 0) ── */
  w.node('client', {
    label: 'Client\n(kubectl)', pos: [-24, 0, 0], size: [3, 3, 2.5],
    col: '#0d1520', edge: '#1e3a6a', order: 0,
    hover: 'kubectl / CI-CD gửi request tới API Server'
  });
  w.node('authn', {
    label: 'Authn · Authr', pos: [-19, 0, 0], size: [3.2, 2, 2.4],
    col: '#0a2040', edge: '#1a4a80', order: 1,
    hover: 'Xác thực token/cert rồi kiểm tra RBAC'
  });
  w.node('admission', {
    label: 'Admission\nWebhooks', pos: [-14.6, 0, 0], size: [3.2, 2.4, 2.4],
    col: '#0a2040', edge: '#1a4a80', order: 2,
    hover: 'Mutating rồi Validating webhooks'
  });
  w.node('apiserver', {
    label: 'API Server', pos: [-9, 0, 0], size: [5, 6.5, 4],
    col: '#0a1830', edge: '#2a5a9a', order: 3,
    hover: 'Cửa ngõ duy nhất vào etcd — mọi component đều đi qua đây'
  });

  /* ── Storage & controllers (behind, z = -8) ── */
  w.node('etcd', {
    label: 'etcd', pos: [-9, 0, -8], size: [4.5, 5.5, 3],
    col: '#1a1200', edge: '#5a4000', order: 4,
    hover: 'Nguồn sự thật duy nhất của cluster state'
  });
  w.node('pod-object', {
    label: 'Pod object', pos: [-9, 3.9, -8], size: [2.8, 1.4, 2.2],
    col: '#2a1a00', edge: '#6a5010', order: 5, hidden: true,
    hover: 'Pod object được persist trong etcd'
  });
  w.node('ctrlmgr', {
    label: 'Controller\nManager', pos: [-2.5, 0, -8], size: [3.4, 3, 2.4],
    col: '#0a1a2a', edge: '#1a3a5a', order: 5,
    hover: 'ReplicaSet controller WATCH số replicas thực tế'
  });

  /* ── Scheduler & queue (front, z = +8) ── */
  w.node('scheduler', {
    label: 'kube-scheduler', pos: [-9, 0, 8], size: [5, 5, 3.5],
    col: '#0a1428', edge: '#1a3a6a', order: 4,
    hover: 'Filter → Score → Bind, chỉ nói chuyện với API Server'
  });
  w.node('queue', {
    label: 'ActiveQ', pos: [-4.6, -0.6, 8], size: [3, 3.6, 2.4],
    col: '#101a38', edge: '#2a4a90', order: 6, hidden: true,
    hover: 'Priority queue — Pod priority cao được pop trước'
  });
  w.node('q-pod-hi', {
    label: 'Pod  P=500 ★', pos: [-4.6, 0.4, 8], size: [2.4, 0.7, 1.7],
    col: '#1e1a40', edge: '#5a3acc', order: 7, hidden: true
  });
  w.node('q-pod-lo', {
    label: 'Pod  P=200', pos: [-4.6, -0.5, 8], size: [2.4, 0.7, 1.7],
    col: '#151030', edge: '#3a2a70', order: 7, hidden: true,
    hover: 'Pod  P=200 — chờ tới lượt'
  });

  /* ── Worker A: the node that wins, carrying the full runtime ── */
  w.node('node-a', {
    label: 'Worker A  (Node)', pos: [10, -1.6, 8], size: [13, 0.5, 7],
    labelPos: [10, -1.3, 12.4],
    col: '#0d1520', edge: '#1e3050', order: 6,
    hover: 'Node được chọn — kubelet ở đây sẽ chạy Pod'
  });
  w.node('kubelet', {
    label: 'kubelet', pos: [5.5, -0.6, 9.4], size: [2.8, 1.4, 2],
    col: '#0a2040', edge: '#1a4a80', order: 7,
    hover: 'WATCH riêng lên API Server theo spec.nodeName'
  });
  w.node('containerd', {
    label: 'containerd\n(CRI)', pos: [10, -0.6, 9.4], size: [3, 1.4, 2],
    col: '#1a1000', edge: '#5a3800', order: 8,
    hover: 'Container runtime: pull image, tạo sandbox, start container'
  });
  w.node('sandbox', {
    label: 'Pod sandbox', pos: [14.4, -0.55, 9.4], size: [3, 1.6, 2.2],
    col: '#0a2a10', edge: '#1a6030', order: 9, hidden: true,
    hover: 'pause container giữ network namespace cho Pod'
  });
  w.node('container', {
    label: 'Container', pos: [14.4, -0.7, 6.2], size: [2.6, 1.2, 2],
    col: '#0d3520', edge: '#22dd66', order: 10, hidden: true
  });
  w.node('kubeproxy', {
    label: 'kube-proxy', pos: [5.5, -0.7, 6.2], size: [2.8, 1.2, 2],
    col: '#0a1a30', edge: '#1a3560', order: 8,
    hover: 'WATCH Endpoints → cập nhật iptables/ipvs'
  });

  /* ── Candidate nodes ── */
  w.node('node-d', {
    label: 'Worker D', pos: [7.5, -1.6, 1], size: [8, 0.5, 4.5], labelPos: [1.9, -1.3, 1],
    col: '#0d1520', edge: '#1e3050', order: 7
  });
  w.node('node-b', {
    label: 'Worker B', pos: [7.5, -1.6, -5], size: [8, 0.5, 4.5], labelPos: [1.9, -1.3, -5],
    col: '#0d1520', edge: '#1e3050', order: 8
  });
  w.node('node-c', {
    label: 'Worker C', pos: [7.5, -1.6, -11], size: [8, 0.5, 4.5], labelPos: [1.9, -1.3, -11],
    col: '#0d1520', edge: '#1e3050', order: 9
  });
  w.node('chip-a', {
    label: '✓ Pass', pos: [5, -0.85, 10.8], size: [3.4, 1, 1.8],
    col: '#0a2010', edge: '#1a7040', order: 10, hidden: true
  });
  w.node('chip-d', {
    label: '✓ Pass', pos: [7.5, -0.85, 1], size: [3.4, 1, 1.8],
    col: '#0a2010', edge: '#1a7040', order: 10, hidden: true
  });
  w.node('chip-b', {
    label: '✗ Taint NoSchedule', pos: [7.5, -0.85, -5], size: [4.6, 1, 1.8],
    col: '#2a0808', edge: '#6a1818', order: 11, hidden: true
  });
  w.node('chip-c', {
    label: '✗ Insufficient RAM', pos: [7.5, -0.85, -11], size: [4.6, 1, 1.8],
    col: '#2a0808', edge: '#6a1818', order: 11, hidden: true
  });

  /* ── Region captions ── */
  w.txt('CONTROL PLANE', -16, 8, 0, 'rgba(106,138,176,.5)', 12);
  w.txt('WORKER NODES', 10, 8, 0, 'rgba(106,138,176,.5)', 12);

  w.cam([-6, 1, 2], 34);
};
