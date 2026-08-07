/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — PERSISTENT WORLD LAYOUT

   Dựng bằng SCENE_KIT (flow3d-kit-world-builder.js): mỗi component khai **vai
   trò** (`tone`) chứ không khai màu, caption tự dán vào mặt trước hộp. Cluster
   được dựng đúng một lần và không bao giờ bị tháo — 9 bước chỉ reveal, đổi
   tone, focus, move và chạy flow.

   Layout (top view):
        z+  ┌ scheduler · ActiveQ ────────────── Worker A (kubelet · CRI · Pod)
        0   ┼ client → authn → admission → API Server ─ Worker D
        z-  └ etcd · controller-manager ──────── Worker B / Worker C

   Hai quy tắc của kit áp vào đây (trước đây kịch bản này vi phạm cả hai):

     1 · **Một thứ = một hộp.** Pod object trong etcd và Pod trong ActiveQ là
         *cùng một Pod*, nên giờ chỉ còn **một hộp `pod`** đi suốt hành trình:
         etcd → ActiveQ → Worker A. Trước đây nó là hai hộp (`pod-object` +
         `q-pod-hi`) bật/tắt ở hai nơi, buộc người xem tự nối lại.

     2 · **Verdict nằm trên chính component.** Bốn hộp chip (`✓ Pass`,
         `✗ Taint NoSchedule`…) đứng cạnh Node đã bị xoá: kết quả Filter/Score
         giờ là tone + badge **trên chính Node đó**. Label Node chỉ mang
         **tên + cấu hình** (`Worker B` / `cpu 15/16`) — và chính con số đó là
         thứ giải thích vì sao nó trượt, nên không cần chữ nào thêm.

   Cấu hình CPU của bốn Node được ghi thẳng vào label vì cả bước ④ (Filter) lẫn
   bước ⑤ (Score) đều đọc đúng những con số này: A còn rộng nhất → điểm
   `LeastAllocated` cao nhất; B gần kín → trượt `NodeResourcesFit`; C rộng
   nhưng vướng taint.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;
const Q = KIT.stack([-4.6, 0.4, 8.2], 2, 1.4);   // hai khe ActiveQ, từ trên xuống

/* Ba chỗ đứng của Pod trên hành trình của nó. Steps tham chiếu qua
   `KIT.move(SCHED_POS.x)` nên toạ độ chỉ tồn tại đúng một lần. */
window.SCHED_POS = {
  etcdShelf: [-9, 3.9, -8],    // Pod object vừa được ghi xuống etcd
  queue0: Q[0],
  queue1: Q[1],
  nodeA: [10, -0.65, 6.2]      // hàng trước của Worker A, sau khi kubelet nhận việc
};

window.SCHEDULER_WORLD = function(raw) {
  const w = KIT.world(raw);
  const P = window.SCHED_POS;

  /* ── Control plane spine (z = 0) ── */
  w.node('client', {
    label: 'Client\n(kubectl)', pos: [-24, 0, 0], size: [3, 3, 2.5],
    tone: 'surface', order: 0,
    hover: 'kubectl / CI-CD gửi request tới API Server'
  });
  w.node('authn', {
    label: 'Authn · Authr', pos: [-19, 0, 0], size: [3.2, 2, 2.4],
    tone: 'gate', order: 1,
    hover: 'Xác thực token/cert rồi kiểm tra RBAC'
  });
  w.node('admission', {
    label: 'Admission\nWebhooks', pos: [-14.6, 0, 0], size: [3.2, 2.4, 2.4],
    tone: 'gate', order: 2,
    hover: 'Mutating rồi Validating webhooks'
  });
  w.node('apiserver', {
    label: 'API Server', pos: [-9, 0, 0], size: [5, 6.5, 4],
    tone: 'core', order: 3,
    hover: 'Cửa ngõ duy nhất vào etcd — mọi component đều đi qua đây'
  });

  /* ── Storage & controllers (behind, z = -8) ── */
  w.node('etcd', {
    label: 'etcd', pos: [-9, 0, -8], size: [4.5, 5.5, 3],
    tone: 'store', order: 4,
    hover: 'Nguồn sự thật duy nhất của cluster state'
  });
  w.node('ctrlmgr', {
    label: 'Controller\nManager', pos: [-2.5, 0, -8], size: [3.4, 3, 2.4],
    tone: 'system', order: 5,
    hover: 'ReplicaSet controller WATCH số replicas thực tế'
  });

  /* ── Pod: MỘT hộp duy nhất cho cả 9 bước ──
     Xuất hiện ở etcd lúc object được ghi (②), bay vào ActiveQ (③), rồi đáp
     xuống Worker A khi kubelet nhận việc (⑦). `subject` là tone dành riêng cho
     nhân vật chính — mắt luôn tìm lại được nó giữa khung hình đông component. */
  w.node('pod', {
    label: 'Pod · P=500\nnodeName: ""', pos: P.etcdShelf, size: [2.8, 1.3, 2.1],
    tone: 'subject', order: 5, hidden: true,
    hover: 'Chính Pod đang được schedule — theo nó suốt 9 bước'
  });

  /* ── Scheduler & ActiveQ (front, z = +8) ──
     Queue là một tấm nền mỏng dựng phía sau, không phải hộp bọc lấy Pod: các
     Pod xếp hàng *trước mặt* nó nên vẫn đọc được. Caption đặt tay lên đỉnh tấm
     nền — mặc định "mặt trước" của kit sẽ nằm ngay sau lưng các Pod. */
  w.node('scheduler', {
    label: 'kube-scheduler', pos: [-9, 0, 8], size: [5, 5, 3.5],
    tone: 'system', order: 4,
    hover: 'Filter → Score → Bind, chỉ nói chuyện với API Server'
  });
  w.node('queue', {
    label: 'ActiveQ', pos: [-4.6, -0.2, 7.2], size: [3.4, 4.0, 0.5],
    caption: [-4.6, 1.6, 7.6],
    tone: 'queue', order: 6, hidden: true,
    hover: 'Priority queue — Pod priority cao được pop trước'
  });
  w.node('q-pod-lo', {
    label: 'batch\nP=200', pos: P.queue1, size: [2.6, 1.0, 1.8],
    tone: 'peer', order: 7, hidden: true,
    hover: 'Pod thường đang chờ tới lượt — priority thấp hơn nên bị chen'
  });

  /* ── Worker A: Node thắng, mang đủ runtime ── */
  w.node('node-a', {
    label: 'Worker A\ncpu 4/16', pos: [10, -1.6, 8], size: [13, 0.5, 7],
    tone: 'surface', order: 6,
    hover: 'Node rộng nhất — sẽ pass Filter và thắng Score'
  });
  w.node('kubelet', {
    label: 'kubelet', pos: [5.5, -0.6, 9.4], size: [2.8, 1.4, 2],
    tone: 'gate', order: 7,
    hover: 'WATCH riêng lên API Server theo spec.nodeName'
  });
  w.node('containerd', {
    label: 'containerd\n(CRI)', pos: [10, -0.6, 9.4], size: [3, 1.4, 2],
    tone: 'engine', order: 8,
    hover: 'Container runtime: pull image, tạo sandbox, start container'
  });
  w.node('sandbox', {
    label: 'Pod sandbox', pos: [14.4, -0.55, 9.4], size: [3, 1.6, 2.2],
    tone: 'live', order: 9, hidden: true,
    hover: 'pause container giữ network namespace cho Pod'
  });
  w.node('container', {
    label: 'Container', pos: [14.4, -0.7, 6.2], size: [2.6, 1.2, 2],
    tone: 'live', order: 10, hidden: true,
    hover: 'Tiến trình ứng dụng thật, bị bao bởi namespaces + cgroups'
  });
  w.node('kubeproxy', {
    label: 'kube-proxy', pos: [5.5, -0.7, 6.2], size: [2.8, 1.2, 2],
    tone: 'system', order: 8,
    hover: 'WATCH Endpoints → cập nhật iptables/ipvs'
  });

  /* ── Ba Node ứng viên còn lại ──
     Con số cpu trên label chính là dữ kiện của bước ④ và ⑤ — Node tự nói ra
     vì sao nó pass hay trượt, không cần chip verdict đứng cạnh. */
  w.node('node-d', {
    label: 'Worker D\ncpu 11/16', pos: [7.5, -1.6, 1], size: [8, 0.5, 4.5],
    tone: 'surface', order: 7,
    hover: 'Vẫn đủ chỗ — nhưng chật hơn A nên điểm LeastAllocated thấp hơn'
  });
  w.node('node-b', {
    label: 'Worker B\ncpu 15/16', pos: [7.5, -1.6, -5], size: [8, 0.5, 4.5],
    tone: 'surface', order: 8,
    hover: 'Gần kín CPU — sẽ trượt NodeResourcesFit'
  });
  w.node('node-c', {
    label: 'Worker C\ncpu 2/16 · NoSchedule', pos: [7.5, -1.6, -11], size: [8, 0.5, 4.5],
    tone: 'surface', order: 9,
    hover: 'Rỗng nhất cluster — nhưng mang taint nên Pod không được vào'
  });

  /* ── Region captions ── */
  w.region('CONTROL PLANE', -16, 0);
  w.region('WORKER NODES', 10, 0);

  w.cam([-6, 1, 2], 34);
};
})();
