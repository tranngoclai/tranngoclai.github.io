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

   Thanh pipeline là 8 chặng của đúng vòng đời một Pod. Nó phải được khai ở
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
    // CRI là chặng nặng nhất và dài nhất của cả vòng đời (pull image, sandbox,
    // container). Gộp nó vào `kubelet` là để người xem mất la bàn đúng đoạn dài
    // nhất — HUD đứng im ở kubelet suốt cả step ⑧.
    KIT.stage('📦', 'CRI'),
    KIT.stage('🟢', 'Running')
  ],
  pipelineIntro: {
    title: '4 Node đang chờ — Pod sắp đến',
    desc: '',
    nodes: ['client', 'apiserver', 'etcd', 'scheduler', 'node-a', 'kubelet', 'pod'],
    // The cast, introduced one at a time in the order the flow will visit it.
    // startPipelineIntro spotlights each `key` at its `at` (rest of the world
    // dims, camera never moves), so the spacing here is the pacing of the whole
    // opening — keep `dur` under the gap or two badges end up on screen at once.
    // After the last one it lifts the dim for a full-architecture closing beat.
    bubbles: [
      {key: 'client', text: 'Client', at: 0.5, dur: 0.6, tone: 'info'},
      {key: 'apiserver', text: 'API Server', at: 1.3, dur: 0.6, tone: 'core'},
      {key: 'etcd', text: 'etcd', at: 2.1, dur: 0.6, tone: 'warn'},
      {key: 'scheduler', text: 'Scheduler', at: 2.9, dur: 0.6, tone: 'accent'},
      {key: 'kubelet', text: 'kubelet', at: 3.7, dur: 0.6, tone: 'ok'},
      {key: 'pod', text: 'Pod', at: 4.5, dur: 0.6, tone: 'accent'}
    ]
  },
  /* Không còn `componentIntro`. Explain beats đã là kênh giải thích duy nhất:
     mỗi nhịp tự kéo camera tới chủ thể và tự đặt bubble, nên một hệ giới thiệu
     thứ hai chạy song song chỉ tạo hai lời nói chồng nhau trên cùng component
     (và phần lớn entry không bao giờ được trigger). Component phụ nào cần được
     đặt tên thì nhịp đầu tiên nói về nó làm việc đó. */
  world: window.SCHEDULER_WORLD,
  steps: window.SCHED_STEPS_CONTROL_PLANE.concat(window.SCHED_STEPS_NODE)
});
})();
