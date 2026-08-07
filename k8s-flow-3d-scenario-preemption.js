/* ══════════════════════════════════════════════
   PREEMPTION — SCENARIO ASSEMBLY

   Cùng kiến trúc với Scheduler Pipeline: cluster sống trong
   k8s-flow-3d-scenario-preemption-world.js và không bao giờ bị dựng lại.
   6 bước được viết trong hai file, cắt đúng chỗ câu chuyện chuyển từ
   "vì sao phải preempt" sang "preempt thì chuyện gì xảy ra":

     …-preemption-filter.js  ①–③  queue → Filter trượt sạch → PostFilter chọn victim
     …-preemption-evict.js   ④–⑥  nominate → xoá victim → bind → hệ quả

   `showPipeline` được bật vì Preemption không phải một cơ chế riêng — nó là
   extension point PostFilter nằm ngay giữa Filter và Bind của đúng scheduling
   cycle mà Scheduler Pipeline đã kể. Thanh pipeline giữ cho người xem biết
   mình đang đứng ở đâu trong vòng đời Pod.

   Nhưng thanh pipeline mặc định (Client → … → Running) không có chỗ nào cho
   PostFilter lẫn cho việc xoá victim — cả ba bước ②③④ sẽ cùng đứng yên ở
   "Filter/Score". Nên kịch bản này khai **thanh riêng** của nó bên dưới:
   6 chặng đúng với vòng đời một Pod bị/được preempt.

   Hai chặng mang `tone` vì chúng không cùng bản chất với phần còn lại:
   PostFilter là một quyết định (warn), Evict là một hành động phá huỷ
   (danger) — thanh pipeline nên nói ra điều đó thay vì tô xanh như mọi bước.

   `pipelineStep` được đặt **theo từng phase**, không phải theo step: vòng
   retry ở bước ⑤ thực sự quay ngược về Filter, và Pod bị đuổi thực sự rơi
   ngược về Queue ở bước ⑥. Thanh pipeline chạy lùi ở đúng những chỗ đó là
   chủ ý — đó chính là vòng lặp mà kịch bản muốn người xem thấy.

   Mô hình authoring (phases, set/show/hide, showAt/hideAt, scene, cam) được
   mô tả đầy đủ trong k8s-flow-3d-scenario-scheduler-pipeline.js.
══════════════════════════════════════════════ */
window.SCENARIOS = window.SCENARIOS || [];
window.SCENARIOS.push({
  name: 'Preemption',
  tag: 'PREEMPTION',
  showPipeline: true,
  /* Caption chỉ hiện trên component mà phase đang nói tới.
     Cluster này có 3 Node và 6 Pod, mỗi hộp mang một cặp `tên + cấu hình` —
     bật hết cùng lúc thì khung hình thành một bảng số và người xem phải tự dò
     xem con số nào đang được nhắc. Với cờ này, engine chỉ giữ caption của
     những component trong `labels` (mặc định là `focus`) của phase hiện tại;
     các hộp khác vẫn đứng nguyên chỗ, chỉ im lặng. Xem
     k8s-flow-3d-engine-persistent-world.js → applyNodeFocus(). */
  focusLabels: true,
  pipeline: [
    {icon: '📬', label: 'Queue'},
    {icon: '🔍', label: 'Filter'},
    {icon: '⚖️', label: 'PostFilter', tone: 'warn'},
    {icon: '💀', label: 'Evict', tone: 'danger'},
    {icon: '🔗', label: 'Bind'},
    {icon: '🟢', label: 'Running'}
  ],
  world: window.PREEMPTION_WORLD,
  steps: window.PREEMPT_STEPS_FILTER.concat(window.PREEMPT_STEPS_EVICT)
});
