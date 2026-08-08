/* ══════════════════════════════════════════════
   PREEMPTION — SCENARIO ASSEMBLY

   Cùng kiến trúc với Scheduler Pipeline: cluster sống trong
   k8s-flow-3d-scenario-preemption-world.js và không bao giờ bị dựng lại.
   6 bước được viết trong hai file, cắt đúng chỗ câu chuyện chuyển từ
   "vì sao phải preempt" sang "preempt thì chuyện gì xảy ra":

     …-preemption-filter.js  ①–③  queue → Filter trượt sạch → PostFilter chọn victim
     …-preemption-evict.js   ④–⑥  nominate → xoá victim → bind → hệ quả

   `KIT.scenario()` bật sẵn `focusLabels` và `showPipeline` — xem
   flow3d-kit-panel-and-hud.js để biết vì sao đó là mặc định.

   Preemption không phải một cơ chế riêng — nó là extension point PostFilter
   nằm ngay giữa Filter và Bind của đúng scheduling cycle mà Scheduler
   Pipeline đã kể. Nhưng thanh pipeline của Scheduler Pipeline không có chỗ
   nào cho PostFilter lẫn cho việc xoá victim — cả ba bước ②③④ sẽ cùng đứng
   yên ở "Filter/Score". Nên kịch bản này khai **thanh riêng** của nó: 6 chặng
   đúng với vòng đời một Pod bị/được preempt.

   Hai chặng mang `tone` vì chúng không cùng bản chất với phần còn lại:
   PostFilter là một quyết định (warn), Evict là một hành động phá huỷ
   (danger) — thanh pipeline nên nói ra điều đó thay vì tô xanh như mọi bước.

   `pipelineStep` được đặt **theo từng phase**, không phải theo step: vòng
   retry ở bước ⑤ thực sự quay ngược về Filter, và Pod bị đuổi thực sự rơi
   ngược về Queue ở bước ⑥. Thanh pipeline chạy lùi ở đúng những chỗ đó là
   chủ ý — đó chính là vòng lặp mà kịch bản muốn người xem thấy.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;

KIT.scenario({
  name: 'Preemption',
  tag: 'PREEMPTION',
  pipeline: [
    KIT.stage('📬', 'Queue'),
    KIT.stage('🔍', 'Filter'),
    KIT.stage('⚖️', 'PostFilter', 'warn'),
    KIT.stage('💀', 'Evict', 'danger'),
    KIT.stage('🔗', 'Bind'),
    KIT.stage('🟢', 'Running')
  ],
  world: window.PREEMPTION_WORLD,
  steps: window.PREEMPT_STEPS_FILTER.concat(window.PREEMPT_STEPS_EVICT)
});
})();
