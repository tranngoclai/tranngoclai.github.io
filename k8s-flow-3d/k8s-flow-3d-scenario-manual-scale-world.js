/* ══════════════════════════════════════════════
   MANUAL SCALE — PERSISTENT WORLD LAYOUT

   Bố cục theo luật dùng chung ở k8s-flow-3d-layout.js. Ba controller xếp theo
   băng vai trò, và ở đây chiều sâu đọc là **khoảng cách tới Pod**:

     z +9   kube-scheduler          (băng đặt chỗ — bind Pod mới)
     z +3   ReplicaSet controller   (băng sinh/huỷ Pod — thứ DUY NHẤT chạm Pod)
     z −1.5 Deployment controller   (băng sở hữu template — không chạm Pod)
     z −9   deploy/api              (băng nền — object được lưu, không phải process)

   `deploy/api` là một hộp riêng vì nó là thứ `kubectl scale` thật sự PATCH.
   Bài học chính của kịch bản — "bạn ghi vào một subresource, không phải vào
   Pod" — chỉ xem được nếu cái object đó có mặt để mũi tên trỏ vào.

   NĂM POD ĐƯỢC KHAI TRƯỚC, KHÔNG SINH GIỮA CHỪNG (Luật 1).
   Chia tối đa 3 Pod mỗi Worker: `L.cols(X.node, 4)` chỉ có 3 khe Pod + 1 khe
   agent nằm gọn trên tấm node rộng 19.0. Nhồi 5 Pod lên một Worker sẽ tràn
   khỏi mép tấm và lệch cột Pod so với mọi kịch bản khác.

   Hai Pod của scale-up (api-3, api-4) `hidden`, hiện ra ở cột queue rồi
   `KIT.move` xuống Worker khi được bind — cùng một hộp, không nhân bản.
   Ba Pod bị scale-down xoá thì `KIT.move` sang chồng `deleted`, giữ nhìn thấy
   suốt chương 2 vì chúng CHÍNH LÀ bằng chứng của thứ tự xoá.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const L = window.K8S_LAYOUT;
const S = L.SIZE;

/* Hai làn Node cùng độ sâu, canh giữa quanh z = 0. */
const LANE = L.lanes([S.node[2], S.node[2]]);
const A = LANE[0], B = LANE[1];

const COL = L.cols(L.X.node, 4);
const AGENT_Y = L.on(S.agent[1]);
const POD_Y = L.on(S.pod[1]);

/* Pod chờ bind: đúng cột queue mà mọi Pod Pending trong deck đứng. */
const PENDING = L.queueSlots(2);

/* Chồng Pod đã bị xoá — đứng ở cột queue, băng workload, ngay trước mặt
   ReplicaSet controller là thứ đã xoá chúng. */
const DELETED = KIT.stack([L.X.queue, L.Y.queue, L.Z.workload], 3, 1.5);

window.MANUAL_SCALE_POS = {
  /* Worker A giữ api-0, api-1 và (sau scale-up) api-4 */
  'api-0': [COL[0], POD_Y, L.row.pod(A)],
  'api-1': [COL[1], POD_Y, L.row.pod(A)],
  'api-4': [COL[2], POD_Y, L.row.pod(A)],
  /* Worker B giữ api-2 và (sau scale-up) api-3 */
  'api-2': [COL[0], POD_Y, L.row.pod(B)],
  'api-3': [COL[1], POD_Y, L.row.pod(B)],

  pending: {'api-3': PENDING[0], 'api-4': PENDING[1]},
  /* thứ tự xoá 1 → 3 từ trên xuống, khớp thứ tự victim của model */
  deleted: DELETED
};

window.createManualScaleWorld = function(run) { return function(raw) {
  const w = KIT.world(raw), P = window.MANUAL_SCALE_POS;

  /* ── Đường đi request (băng z = 0) ── */
  w.node('kubectl', {
    label: 'kubectl\nscale', pos: [L.X.actor, L.Y.ground, L.Z.spine], size: S.actor,
    tone: 'subject', order: 0, shape: 'client',
    hover: 'Client that PATCHes the scale subresource — it never creates or deletes a Pod'
  });
  w.node('apiserver', {
    label: 'API Server', pos: [L.X.core, L.Y.ground, L.Z.spine], size: S.core,
    tone: 'core', order: 1,
    hover: 'Serves the scale subresource and persists every Pod create/delete'
  });

  /* ── Object được lưu: cái mà scale thật sự ghi vào ── */
  w.node('deploy-api', {
    label: 'deploy/api\nspec.replicas ' + run.initial,
    pos: [L.X.core, L.Y.ground, L.Z.store], size: S.gate,
    tone: 'store', order: 2,
    hover: 'The Deployment object. `kubectl scale` PATCHes its scale subresource; ' +
           'this object is the only thing the command writes'
  });

  /* ── Cột control: ba controller, mỗi cái một băng vai trò ── */
  w.node('scheduler', {
    label: 'kube-scheduler', pos: [L.X.control, L.Y.ground, L.Z.sched], size: S.scheduler,
    tone: 'system', order: 2,
    hover: 'Binds the Pods a scale-up created; takes no part in a scale-down'
  });
  w.node('replicaset-controller', {
    label: 'ReplicaSet controller\nkube-controller-manager',
    pos: [L.X.control, L.Y.ground, L.Z.workload], size: S.controller,
    tone: 'system', order: 2,
    hover: 'The only controller here that creates or deletes Pods, and the one ' +
           'that ranks scale-down candidates'
  });
  w.node('deployment-controller', {
    label: 'Deployment controller\nkube-controller-manager',
    pos: [L.X.control, L.Y.ground, L.Z.workloadOwner], size: S.controller,
    tone: 'system', order: 2,
    hover: 'Owns the Pod template and writes the ReplicaSet replica count — ' +
           'it never touches a Pod itself'
  });

  /* ── Hai Worker ngang hàng ── */
  w.node('worker-a', {
    label: 'Worker A', pos: [L.X.node, L.Y.slab, A], size: S.node,
    tone: 'surface', order: 3, shape: 'slab',
    hover: 'Worker Node holding api-0, api-1 and later api-4'
  });
  w.node('worker-b', {
    label: 'Worker B', pos: [L.X.node, L.Y.slab, B], size: S.node,
    tone: 'surface', order: 3, shape: 'slab',
    hover: 'Worker Node holding api-2 and later api-3'
  });

  w.node('kubelet-a', {
    label: 'kubelet A', pos: [COL[3], AGENT_Y, L.row.agent(A)], size: S.agent,
    tone: 'engine', order: 5,
    hover: 'Starts the Pod bound to Worker A and stops the one deleted from it'
  });
  w.node('kubelet-b', {
    label: 'kubelet B', pos: [COL[3], AGENT_Y, L.row.agent(B)], size: S.agent,
    tone: 'engine', order: 5,
    hover: 'Starts the Pod bound to Worker B and stops the ones deleted from it'
  });

  /* ── Hàng Pod — cả năm cùng SIZE.pod, hai cái cuối chờ scale-up ──
     Nhãn chỉ mang tên + cấu hình (Luật 3). Lý do một Pod bị chọn xoá nằm ở
     badge + hover + panel, KHÔNG BAO GIỜ nằm trong label. */
  run.pods.forEach(function(pod) {
    const isNew = pod.wave === 'scaleUp';
    w.node('pod-' + pod.key, {
      label: pod.name + '\n' + (pod.ready ? 'Ready' : 'not Ready'),
      pos: isNew ? P.pending[pod.key] : P[pod.key],
      size: S.pod, tone: pod.ready ? 'live' : 'warn', order: 4,
      hidden: isNew, shape: 'seal',
      hover: 'Pod ' + pod.name + ' · ' + pod.phase + ' on ' + pod.node +
             ' · Ready ' + pod.readySeconds + 's · ' + pod.restarts + ' restarts'
    });
  });

  w.region('CONTROL PLANE', L.X.core, 0, 10);
  w.region('WORKER NODES', L.X.node, 0, 10);
  w.cam([-5, 0, 0], 54);
}; };
})();
