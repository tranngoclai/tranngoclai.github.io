/* ══════════════════════════════════════════════
   PREEMPTION — PERSISTENT WORLD LAYOUT

   Dựng bằng SCENE_KIT (flow3d-kit-world-builder.js): mỗi component khai
   **vai trò** của nó (`tone`) chứ không khai màu, và caption tự dán vào mặt
   trước hộp — hai quy tắc đó nằm trong kit nên mọi kịch bản đọc giống nhau.

   Layout (top view):
        z+  ┌ ActiveQ ───────────────── Worker A  (batch · log-agent · payments)
        0   ┼ scheduler · API Server ── Worker B  (toàn Pod priority cao)
        z-  └ etcd ──────────────────── Worker C  (GPU · taint NoSchedule)

   Hai quy tắc của kit thể hiện ở đây:

     1 · Trạng thái của một Node nằm **trên chính Node đó** (tone + badge),
         không có "chip verdict" đứng riêng bên cạnh. Người xem đọc kết quả
         Filter ngay tại nơi Pod sẽ chạy. Label chỉ mang **tên + cấu hình**
         — `Worker A` / `11/12Gi` — và chỉ đổi khi con số cấu hình thật sự
         đổi (Worker A còn `7/12Gi` sau khi victim tắt).
     2 · Một Pod chỉ có **một** hộp trong suốt cả kịch bản. Pod `checkout`
         không được vẽ lại ở etcd, ở queue và trên Node — nó là cùng một hộp
         **di chuyển** qua ba nơi đó (xem `KIT.move` trong các step). Hai
         victim cũng vậy: chúng bay ngược về ActiveQ ở bước ⑥.

   Worker A is the only node where removing lower-priority Pods would make the
   incoming Pod fit — B and C exist so the viewer sees *why* preemption is
   node-specific, not a cluster-wide sweep.
══════════════════════════════════════════════ */

/* Ba chỗ đứng của Pod checkout trên hành trình của nó, và ba khe trong ActiveQ.
   Steps tham chiếu các hằng số này qua `KIT.move(PREEMPT_POS.x)` nên toạ độ
   chỉ tồn tại đúng một lần trong toàn bộ kịch bản. */
(function() {
const KIT = window.SCENE_KIT;
const Q = KIT.stack([-11.5, 1.4, 7.0], 3, 1.5);   // ba khe ActiveQ, từ trên xuống

window.PREEMPT_POS = {
  etcdShelf: [-18, 3.6, -8],   // Pod object vừa được ghi xuống etcd
  queue0: Q[0],
  queue1: Q[1],
  queue2: Q[2],
  nodeA:  [6, -0.6, 6.4]       // hàng trước của Worker A, sau khi bind
};

window.PREEMPTION_WORLD = function(raw) {
  const w = KIT.world(raw);
  const P = window.PREEMPT_POS;

  /* ── Control plane ── */
  w.node('apiserver', {
    label: 'API Server', pos: [-18, 0, 0], size: [4.4, 6, 3.4],
    tone: 'core', order: 0,
    hover: 'Scheduler ghi nominatedNodeName và xoá victim đều qua đây'
  });
  w.node('etcd', {
    label: 'etcd', pos: [-18, 0, -8], size: [4, 5, 2.8],
    tone: 'store', order: 1,
    hover: 'Nguồn sự thật: spec.priority, nominatedNodeName, nodeName'
  });
  w.node('scheduler', {
    label: 'kube-scheduler', pos: [-11.5, 0, 0], size: [5, 5, 3.4],
    tone: 'system', order: 1,
    hover: 'Filter → PostFilter (Preemption) → Bind'
  });

  /* ── ActiveQ ──
     Một tấm nền mỏng dựng phía sau, không phải cái hộp bọc lấy Pod: các Pod
     xếp hàng *trước mặt* nó nên vẫn đọc được. Caption đặt tay lên đỉnh tấm
     nền — mặc định "mặt trước" của kit sẽ nằm ngay sau lưng các Pod. */
  w.node('queue', {
    label: 'ActiveQ', pos: [-11.5, -0.2, 5.5], size: [4.8, 5.6, 0.5],
    caption: [-11.5, 2.2, 5.9],
    tone: 'queue', order: 2, hidden: true,
    hover: 'Priority queue — Pod priority cao được pop trước'
  });

  /* ── Pod checkout: MỘT hộp duy nhất cho cả kịch bản ──
     Nó xuất hiện ở etcd (lúc object được ghi), bay vào ActiveQ, rồi đáp xuống
     Worker A khi bind xong. `subject` là tone dành riêng cho nhân vật chính —
     màu tím giúp mắt luôn tìm thấy nó trong khung hình đông component. */
  w.node('pod-checkout', {
    label: 'checkout\nP=1000 · 4Gi', pos: P.etcdShelf, size: [3.4, 1.3, 2.1],
    tone: 'subject', order: 2, hidden: true,
    hover: 'Pod đang cần chỗ — priority 1000, requests.memory 4Gi'
  });
  w.node('pod-report', {
    label: 'report\nP=200', pos: P.queue1, size: [3.2, 1.1, 1.9],
    tone: 'peer', order: 3, hidden: true,
    hover: 'Pod thường đang chờ tới lượt — priority thấp hơn nên bị chen'
  });

  /* ── Worker A: node duy nhất mà preemption cứu được ── */
  w.node('node-a', {
    label: 'Worker A\n11/12Gi', pos: [6, -1.6, 8], size: [13, 0.5, 6.5],
    tone: 'surface', order: 4,
    hover: 'Còn 1Gi trống — Pod checkout cần 4Gi'
  });
  w.node('pod-a1', {
    label: 'batch-job\nP=50 · 1Gi', pos: [1.6, -0.6, 9.4], size: [3.2, 1.4, 2],
    tone: 'live', order: 5,
    hover: 'Priority thấp nhất — victim đầu tiên bị nhắm tới'
  });
  w.node('pod-a2', {
    label: 'log-agent\nP=150 · 3Gi', pos: [6, -0.6, 9.4], size: [3.2, 1.4, 2],
    tone: 'live', order: 5,
    hover: 'Priority thấp hơn 1000 — victim hợp lệ'
  });
  w.node('pod-a3', {
    label: 'payments\nP=300 · 7Gi', pos: [10.4, -0.6, 9.4], size: [3.2, 1.4, 2],
    tone: 'live', order: 5,
    hover: 'Cũng thấp hơn 1000 — nhưng không cần xoá nếu đã đủ chỗ'
  });

  /* ── Worker B: đầy, nhưng toàn Pod priority CAO hơn ── */
  w.node('node-b', {
    label: 'Worker B\n16/16Gi', pos: [6, -1.6, 0], size: [13, 0.5, 6.5],
    tone: 'surface', order: 5,
    hover: 'Đầy — và mọi Pod ở đây đều priority ≥ 2000'
  });
  w.node('pod-b1', {
    label: 'ingress-ctrl\nP=2000 · 8Gi', pos: [2.6, -0.6, 1.4], size: [3.6, 1.4, 2],
    tone: 'warn', order: 6,
    hover: 'Priority CAO HƠN Pod đang chờ → không thể là victim'
  });
  w.node('pod-b2', {
    label: 'core-dns\nP=2000 · 8Gi', pos: [7.6, -0.6, 1.4], size: [3.6, 1.4, 2],
    tone: 'warn', order: 6,
    hover: 'system-cluster-critical — bất khả xâm phạm'
  });

  /* ── Worker C: còn trống nhưng vướng taint ── */
  w.node('node-c', {
    label: 'Worker C\n6/16Gi · gpu=true:NoSchedule', pos: [6, -1.6, -8], size: [13, 0.5, 6.5],
    tone: 'surface', order: 6,
    hover: 'Còn 10Gi trống — nhưng Pod không có toleration'
  });
  w.node('pod-c1', {
    label: 'gpu-train\nP=100 · 6Gi', pos: [5, -0.6, -6.6], size: [3.6, 1.4, 2],
    tone: 'live', order: 7,
    hover: 'Priority thấp — nhưng xoá nó cũng vô ích, taint vẫn còn'
  });

  /* ── Region captions ── */
  w.region('CONTROL PLANE', -15, 0, 9);
  w.region('WORKER NODES', 6, 0, 9);

  w.cam([-3, 1, 1], 40);
};
})();
