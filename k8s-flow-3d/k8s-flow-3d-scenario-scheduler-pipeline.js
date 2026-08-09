/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — SCENARIO ASSEMBLY

   Cluster sống trong k8s-flow-3d-scenario-scheduler-world.js và không bao giờ
   bị dựng lại. 9 bước được viết trong hai file, cắt đúng chỗ câu chuyện bàn
   giao từ Control Plane xuống Node:

     …-control-plane.js  ①–⑤  request → etcd → queue → filter → score
     …-node.js           ⑥–⑨  bind → kubelet → CRI → running

   ── Mô hình tác giả (chung cho mọi kịch bản dùng SCENE_KIT) ──
   Một step chia thành `phases`. Một phase = một lời giải thích + một hành
   động, nên người xem đọc một nhịp và chỉ nhịp đó chạy.
   flow3d-engine-phase-expander.js flatten phases thành step thường trước khi
   engine load, nên phía dưới không component nào biết phase tồn tại.

   Một phase khai:
     title   – tiêu đề nhịp (title của step vẫn nằm phía trên)
     desc    – lời giải thích, dựng bằng `KIT.desc(lead, body, why)`
     focus   – component được sáng (số còn lại mờ đi nhưng vẫn đứng nguyên)
     labels  – component được phép hiện caption trong nhịp này
     show    – component xuất hiện từ đây trở đi (cộng dồn)
     hide    – component biến mất từ đây trở đi (cộng dồn)
     set     – thay đổi trạng thái, dựng bằng `KIT.mark` / `pulse` / `move`.
               Entry có `at` (giây) sẽ được *chơi*: component chớp, badge bật
               lên, và diện mạo mới commit đúng khoảnh khắc đó.
     showAt  – key → giây; hoãn một lần reveal cho khớp với flow
     hideAt  – key → giây; tương tự cho một lần remove
     scene   – đường bay (`KIT.flow`) và caption (`KIT.note`) của nhịp này
     cam     – tâm camera + khoảng cách

   `focus` / `cam` / `dist` / `pipelineStep` rơi từ step xuống phase khi phase
   không override.

   Quy ước timing: một phase giữ một hành động, nên offset nằm trong khoảng
   0–1.5s và mỗi flow dùng `loop` ngắn — hành động đó lặp lại nhè nhẹ trong lúc
   người xem đọc, thay vì một chuỗi dài mà người xem phải bắt giữa chừng.

   Thanh pipeline là 7 chặng của đúng vòng đời một Pod. Nó phải được khai ở
   đây: engine không tự đoán được kịch bản đang kể cơ chế nào (xem
   flow3d-engine-hud-controller.js).
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;

KIT.scenario({
  id: 'scheduler-pipeline',
  name: 'Scheduler Pipeline',
  tag: 'SCHEDULER',
  pipeline: [
    KIT.stage('📤', 'Client'),
    KIT.stage('💾', 'etcd'),
    KIT.stage('📬', 'Queue'),
    KIT.stage('🔍', 'Filter/Score'),
    KIT.stage('🔗', 'Bind'),
    KIT.stage('⚙️', 'kubelet'),
    KIT.stage('🟢', 'Running')
  ],
  world: window.SCHEDULER_WORLD,
  steps: window.SCHED_STEPS_CONTROL_PLANE.concat(window.SCHED_STEPS_NODE)
});
})();
