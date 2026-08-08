/* ══════════════════════════════════════════════
   KUBERNETES DECK — CHROME

   Toàn bộ phần chữ bao quanh các kịch bản: splash, brand trên topbar, tiêu đề
   sidebar, ngôn ngữ và title của trang. Engine và kit không biết gì về
   Kubernetes, nên mọi chữ mang tính chủ đề đều nằm ở đây.

   Danh sách chip trên splash KHÔNG khai ở đây — flow3d-deck.js render nó từ
   `SCENARIOS[].name`, nên thêm một kịch bản là splash tự cập nhật.
══════════════════════════════════════════════ */

FLOW3D.deck({
  lang: 'vi',
  title: 'Kubernetes – 3D Scenarios',
  brand: '⎈ k8s-sim',
  sidebarTitle: 'Scenarios',
  canvasLabel: 'Mô phỏng 3D Kubernetes; nội dung và kết luận đầy đủ nằm trong bảng giải thích bên trái',
  intro: {
    eyebrow: '⎈ kube-scheduler · 3D Simulator',
    title: 'Kubernetes Scheduling<br>Visualized in 3D',
    sub: 'Khám phá toàn bộ hành trình một Pod được tạo —<br>'
       + 'từ Client → API Server → etcd → Scheduler → kubelet → Container.<br>'
       + 'Cùng các kịch bản Preemption, Eviction, OOM &amp; PDB.',
    cta: 'Bắt đầu →'
  }
});
