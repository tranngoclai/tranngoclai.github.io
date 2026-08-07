/* ══════════════════════════════════════════════
   PREEMPTION — PERSISTENT WORLD LAYOUT
   Same model as the Scheduler Pipeline world: every component is built once,
   at a fixed place, and stays there for all 6 steps. Steps only reveal,
   recolour, focus, move and animate flows.

   Layout (top view):
        z+  ┌ ActiveQ ───────────────── Worker A  (batch · log-agent · payments)
        0   ┼ scheduler · API Server ── Worker B  (toàn Pod priority cao)
        z-  └ etcd ──────────────────── Worker C  (GPU · taint NoSchedule)

   ONE THING = ONE COMPONENT. Hai quy tắc giữ cho thế giới không bị nhân bản:

     1 · Trạng thái của một Node nằm **trên chính Node đó** (màu + badge ngắn),
         không có "chip verdict" đứng riêng bên cạnh. Người xem đọc kết quả
         Filter ngay tại nơi Pod sẽ chạy.
         Label chỉ mang **tên + cấu hình** — `Worker A` / `11/12Gi`, `batch-job`
         / `P=50 · 1Gi` — và chỉ đổi khi con số cấu hình thật sự đổi (Worker A
         còn `7/12Gi` sau khi victim tắt). Mọi diễn giải dài thuộc về panel
         `desc`, không viết lên hộp 3D.
         Mọi component đều khai `labelPos` để caption **dán vào mặt trước**,
         canh giữa cả hai chiều — `[x tâm, y tâm, z tâm + nửa chiều sâu + 0.1]`
         — thay vì mặc định của `addBox` là lơ lửng phía trên nóc. Nhờ vậy tên
         và cấu hình đọc như chữ in trên chính hộp đó. Engine giữ `labelOff`
         lúc dựng nên caption vẫn bám theo khi component đổi `pos`.
     2 · Một Pod chỉ có **một** hộp trong suốt cả kịch bản. Pod `checkout`
         không được vẽ lại ở etcd, ở queue và trên Node — nó là cùng một hộp
         **di chuyển** qua ba nơi đó (xem `pos` trong `set`). Hai victim cũng
         vậy: chúng bay ngược về ActiveQ ở bước ⑥ thay vì được vẽ mới.

   Worker A is the only node where removing lower-priority Pods would make the
   incoming Pod fit — B and C exist so the viewer sees *why* preemption is
   node-specific, not a cluster-wide sweep.
══════════════════════════════════════════════ */

/* Ba chỗ đứng của Pod checkout trên hành trình của nó, và ba khe trong ActiveQ.
   Steps tham chiếu các hằng số này qua `set: {..., pos: PREEMPT_POS.x}` nên
   toạ độ chỉ tồn tại đúng một lần trong toàn bộ kịch bản. */
window.PREEMPT_POS = {
  etcdShelf: [-18, 3.6, -8],     // Pod object vừa được ghi xuống etcd
  queue0:    [-11.5, 1.4, 7.0],  // đầu ActiveQ
  queue1:    [-11.5, -0.1, 7.0],
  queue2:    [-11.5, -1.6, 7.0],
  nodeA:     [6, -0.6, 6.4]      // hàng trước của Worker A, sau khi bind
};

window.PREEMPTION_WORLD = function(w) {
  const P = window.PREEMPT_POS;

  /* ── Control plane ── */
  w.node('apiserver', {
    label: 'API Server', pos: [-18, 0, 0], size: [4.4, 6, 3.4],
    labelPos: [-18, 0, 1.8],
    col: '#0a1830', edge: '#2a5a9a', order: 0,
    hover: 'Scheduler ghi nominatedNodeName và xoá victim đều qua đây'
  });
  w.node('etcd', {
    label: 'etcd', pos: [-18, 0, -8], size: [4, 5, 2.8],
    labelPos: [-18, 0, -6.5],
    col: '#1a1200', edge: '#5a4000', order: 1,
    hover: 'Nguồn sự thật: spec.priority, nominatedNodeName, nodeName'
  });
  w.node('scheduler', {
    label: 'kube-scheduler', pos: [-11.5, 0, 0], size: [5, 5, 3.4],
    labelPos: [-11.5, 0, 1.8],
    col: '#0a1428', edge: '#1a3a6a', order: 1,
    hover: 'Filter → PostFilter (Preemption) → Bind'
  });

  /* ── ActiveQ ──
     Một tấm nền mỏng dựng phía sau, không phải cái hộp bọc lấy Pod: các Pod
     xếp hàng *trước mặt* nó nên vẫn đọc được, và hàng đợi vẫn là một component
     duy nhất chứ không phải khung viền vẽ thêm. */
  w.node('queue', {
    label: 'ActiveQ', pos: [-11.5, -0.2, 5.5], size: [4.8, 5.6, 0.5],
    labelPos: [-11.5, 2.2, 5.9],
    col: '#101a38', edge: '#2a4a90', order: 2, hidden: true,
    hover: 'Priority queue — Pod priority cao được pop trước'
  });

  /* ── Pod checkout: MỘT hộp duy nhất cho cả kịch bản ──
     Nó xuất hiện ở etcd (lúc object được ghi), bay vào ActiveQ, rồi đáp xuống
     Worker A khi bind xong. Label của nó luôn mang trạng thái hiện tại. */
  w.node('pod-checkout', {
    label: 'checkout\nP=1000 · 4Gi', pos: P.etcdShelf, size: [3.4, 1.3, 2.1],
    labelPos: [-18, 3.6, -6.85],
    col: '#1e1a40', edge: '#5a3acc', order: 2, hidden: true,
    hover: 'Pod đang cần chỗ — priority 1000, requests.memory 4Gi'
  });
  w.node('pod-report', {
    label: 'report\nP=200', pos: P.queue1, size: [3.2, 1.1, 1.9],
    labelPos: [-11.5, -0.1, 8.05],
    col: '#151030', edge: '#3a2a70', order: 3, hidden: true,
    hover: 'Pod thường đang chờ tới lượt — priority thấp hơn nên bị chen'
  });

  /* ── Worker A: node duy nhất mà preemption cứu được ──
     Sàn Node theo đúng quy ước label của cả thế giới này (xem đầu file): caption
     dán vào **mặt trước**, canh giữa cả hai chiều. */
  w.node('node-a', {
    label: 'Worker A\n11/12Gi', pos: [6, -1.6, 8], size: [13, 0.5, 6.5],
    labelPos: [6, -1.6, 11.5],
    col: '#0d1520', edge: '#1e3050', order: 4,
    hover: 'Còn 1Gi trống — Pod checkout cần 4Gi'
  });
  w.node('pod-a1', {
    label: 'batch-job\nP=50 · 1Gi', pos: [1.6, -0.6, 9.4], size: [3.2, 1.4, 2],
    labelPos: [1.6, -0.6, 10.5],
    col: '#0a2418', edge: '#1a6040', order: 5,
    hover: 'Priority thấp nhất — victim đầu tiên bị nhắm tới'
  });
  w.node('pod-a2', {
    label: 'log-agent\nP=150 · 3Gi', pos: [6, -0.6, 9.4], size: [3.2, 1.4, 2],
    labelPos: [6, -0.6, 10.5],
    col: '#0a2418', edge: '#1a6040', order: 5,
    hover: 'Priority thấp hơn 1000 — victim hợp lệ'
  });
  w.node('pod-a3', {
    label: 'payments\nP=300 · 7Gi', pos: [10.4, -0.6, 9.4], size: [3.2, 1.4, 2],
    labelPos: [10.4, -0.6, 10.5],
    col: '#0a2418', edge: '#1a6040', order: 5,
    hover: 'Cũng thấp hơn 1000 — nhưng không cần xoá nếu đã đủ chỗ'
  });

  /* ── Worker B: đầy, nhưng toàn Pod priority CAO hơn ── */
  w.node('node-b', {
    label: 'Worker B\n16/16Gi', pos: [6, -1.6, 0], size: [13, 0.5, 6.5],
    labelPos: [6, -1.6, 3.5],
    col: '#0d1520', edge: '#1e3050', order: 5,
    hover: 'Đầy — và mọi Pod ở đây đều priority ≥ 2000'
  });
  w.node('pod-b1', {
    label: 'ingress-ctrl\nP=2000 · 8Gi', pos: [2.6, -0.6, 1.4], size: [3.6, 1.4, 2],
    labelPos: [2.6, -0.6, 2.5],
    col: '#1a1000', edge: '#7a5000', order: 6,
    hover: 'Priority CAO HƠN Pod đang chờ → không thể là victim'
  });
  w.node('pod-b2', {
    label: 'core-dns\nP=2000 · 8Gi', pos: [7.6, -0.6, 1.4], size: [3.6, 1.4, 2],
    labelPos: [7.6, -0.6, 2.5],
    col: '#1a1000', edge: '#7a5000', order: 6,
    hover: 'system-cluster-critical — bất khả xâm phạm'
  });

  /* ── Worker C: còn trống nhưng vướng taint ── */
  w.node('node-c', {
    label: 'Worker C\n6/16Gi · gpu=true:NoSchedule', pos: [6, -1.6, -8], size: [13, 0.5, 6.5],
    labelPos: [6, -1.6, -4.5],
    col: '#0d1520', edge: '#1e3050', order: 6,
    hover: 'Còn 10Gi trống — nhưng Pod không có toleration'
  });
  w.node('pod-c1', {
    label: 'gpu-train\nP=100 · 6Gi', pos: [5, -0.6, -6.6], size: [3.6, 1.4, 2],
    labelPos: [5, -0.6, -5.5],
    col: '#0a2418', edge: '#1a6040', order: 7,
    hover: 'Priority thấp — nhưng xoá nó cũng vô ích, taint vẫn còn'
  });

  /* ── Region captions ── */
  w.txt('CONTROL PLANE', -15, 8, 0, 'rgba(106,138,176,.5)', 9);
  w.txt('WORKER NODES', 6, 8, 0, 'rgba(106,138,176,.5)', 9);

  w.cam([-3, 1, 1], 40);
};
