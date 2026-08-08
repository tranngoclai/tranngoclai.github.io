/* ══════════════════════════════════════════════
   PDB + DRAIN — PERSISTENT WORLD LAYOUT

   Components are Kubernetes actors/objects, not explanatory stand-ins. Pods
   move or change state; they are never cloned.

   Bố cục theo luật dùng chung ở k8s-flow-3d-layout.js, nên `kubectl` đứng ở
   đúng cột actor mà `Client (kubectl)` của kịch bản Scheduler đứng, và ba
   controller xếp theo băng vai trò:

     z+  kube-scheduler            (băng đặt chỗ)
         ReplicaSet controller     (băng sinh workload)
     z−  disruption controller     (băng canh policy)
         PDB                       (băng nền — nó là object được lưu, không
                                    phải một process đang chạy)

   Ba Worker cùng `SIZE.node`: chúng là ba ứng viên ngang hàng, chỉ khác nhau ở
   `spec.unschedulable`. Worker A và Worker C mở ra hàng agent (kubelet + CRI)
   vì kịch bản có nói tới việc hai kubelet đó làm gì; Worker B không, nên hàng
   agent của nó để trống thay vì bịa ra hộp.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const L = window.K8S_LAYOUT;
const S = L.SIZE;

/* Ba làn Node cùng độ sâu, canh giữa quanh z = 0. */
const LANE = L.lanes([S.node[2], S.node[2], S.node[2]]);
const A = LANE[0], B = LANE[1], C = LANE[2];

const COL = L.cols(L.X.node, 4);
const AGENT_Y = L.on(S.agent[1]);
const POD_Y = L.on(S.pod[1]);

window.PDB_DRAIN_POS = {
  /* Hàng Pod của từng Worker. api-0 và api-1 cùng nằm trên Worker A — chính là
     lý do drain phải đợi: hai Pod của cùng một PDB trên cùng một Node. */
  api0: [COL[0], POD_Y, L.row.pod(A)],
  api1: [COL[1], POD_Y, L.row.pod(A)],
  api2: [COL[0], POD_Y, L.row.pod(B)],

  /* Pod thay thế: Pending thì đứng ở cột queue cùng chỗ mọi Pod Pending khác
     trong deck; khi được bind mới đáp xuống hàng Pod của Worker C. */
  replacementPending: [L.X.queue, L.Y.queue, L.Z.sched],
  replacementRunning: [COL[0], POD_Y, L.row.pod(C)]
};

window.createPdbDrainWorld = function(run) { return function(raw) {
  const w = KIT.world(raw), p = window.PDB_DRAIN_POS;

  /* ── Đường đi request (băng z = 0) ── */
  w.node('kubectl', {label: 'kubectl\ndrain', pos: [L.X.actor, L.Y.ground, L.Z.spine], size: S.actor, tone: 'subject', order: 0, hover: 'Client that cordons then calls the Eviction subresource'});
  w.node('apiserver', {label: 'API Server', pos: [L.X.core, L.Y.ground, L.Z.spine], size: S.core, tone: 'core', order: 1, hover: 'Accepts Eviction requests and writes Pod/Node objects'});

  /* ── PDB: một policy object được lưu, nên nó ở băng nền ngay sau API Server,
     đúng chỗ etcd đứng trong các kịch bản khác ── */
  w.node('pdb', {label: 'PDB\nminAvailable ' + run.minAvailable, pos: [L.X.core, L.Y.ground, L.Z.store], size: S.gate, tone: 'gate', order: 2, hover: 'policy/v1 PodDisruptionBudget selected by the Deployment Pod labels'});

  /* ── Cột control: ba controller, mỗi cái ở băng vai trò của nó ── */
  w.node('scheduler', {label: 'kube-scheduler', pos: [L.X.control, L.Y.ground, L.Z.sched], size: S.scheduler, tone: 'system', order: 2, hover: 'Binds the replacement only to a schedulable worker'});
  w.node('replicaset-controller', {label: 'ReplicaSet controller\nkube-controller-manager', pos: [L.X.control, L.Y.ground, L.Z.workload], size: S.controller, tone: 'system', order: 2, hover: 'Creates a replacement Pod after its managed Pod starts terminating'});
  w.node('disruption-controller', {label: 'disruption controller\nkube-controller-manager', pos: [L.X.control, L.Y.ground, L.Z.policy], size: S.controller, tone: 'system', order: 2, hover: 'Maintains PDB status such as currentHealthy and disruptionsAllowed'});

  /* ── Ba Worker ngang hàng ── */
  w.node('worker-a', {label: 'Worker A\nschedulable', pos: [L.X.node, L.Y.slab, A], size: S.node, tone: 'surface', order: 3, hover: 'Drain target; cordon changes spec.unschedulable before evictions'});
  w.node('worker-b', {label: 'Worker B\nschedulable', pos: [L.X.node, L.Y.slab, B], size: S.node, tone: 'surface', order: 3, hover: 'A remaining healthy replica node'});
  w.node('worker-c', {label: 'Worker C\nschedulable', pos: [L.X.node, L.Y.slab, C], size: S.node, tone: 'surface', order: 3, hover: 'A remaining node where the replacement can be bound'});

  /* hàng agent của A và C — hai kubelet mà kịch bản thật sự nhắc tới */
  w.node('kubelet-a', {label: 'kubelet A', pos: [COL[2], AGENT_Y, L.row.agent(A)], size: S.agent, tone: 'engine', order: 5, hover: 'Observes the terminating Pod and asks CRI to stop its containers'});
  w.node('runtime-a', {label: 'CRI runtime A', pos: [COL[3], AGENT_Y, L.row.agent(A)], size: S.agent, tone: 'engine', order: 5, hover: 'Stops the terminating Pod containers gracefully'});
  w.node('kubelet-c', {label: 'kubelet C', pos: [COL[2], AGENT_Y, L.row.agent(C)], size: S.agent, tone: 'engine', order: 5, hover: 'Starts the bound replacement Pod through CRI'});
  w.node('runtime-c', {label: 'CRI runtime C', pos: [COL[3], AGENT_Y, L.row.agent(C)], size: S.agent, tone: 'engine', order: 5, hover: 'Creates the replacement containers'});

  /* hàng Pod — cả bốn Pod cùng SIZE.pod */
  w.node('pod-api-0', {label: run.target.name + '\nReady', pos: p.api0, size: S.pod, tone: 'live', order: 4, hover: 'Deployment Pod selected by this PDB; on the drain target'});
  w.node('pod-api-1', {label: 'api-1\nReady', pos: p.api1, size: S.pod, tone: 'live', order: 4, hover: 'Selected by the same PDB; its eviction is initially refused'});
  w.node('pod-api-2', {label: 'api-2\nReady', pos: p.api2, size: S.pod, tone: 'live', order: 4, hover: 'Selected by the same PDB; remains available'});
  w.node('pod-api-3', {label: run.replacement.name + '\nPending', pos: p.replacementPending, size: S.pod, tone: 'peer', order: 4, hidden: true, hover: 'New Pod object with a new UID, created by the ReplicaSet controller'});

  w.region('CONTROL PLANE', L.X.core, 0, 10);
  w.region('WORKER NODES', L.X.node, 0, 10);
  w.cam([-5, 0, 0], 54);
}; };
})();
