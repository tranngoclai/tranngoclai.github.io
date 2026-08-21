/* MANUAL SCALE — assembly. The model is run once; world and phases share it.

   Pipeline là các bước CƠ CHẾ, không phải mốc thời gian, vì kịch bản đi lên
   rồi đi xuống. Chương 2 cố tình quay lại `Scale` rồi `Reconcile` một lần nữa,
   nhưng rẽ sang `Select` thay vì `Bind` — chính chỗ rẽ đó là bài học ("cùng
   một lệnh, ngược dấu, nhánh khác hẳn"). Một pipeline chạy thẳng một chiều sẽ
   mắc kẹt ở stage cuối suốt hai chương cuối. */
(function() {
const KIT = window.SCENE_KIT, M = window.MANUAL_SCALE_MODEL;
const run = M.simulate(M.DEFAULT_CONFIG);

KIT.scenario({
  id: 'manual-scale',
  name: 'Manual scale (kubectl scale)', tag: 'SCALE',
  pipeline: [
    KIT.stage('✎', 'Scale', 'ok'),        // PATCH scale subresource   (ch.1 + ch.2)
    KIT.stage('⇄', 'Propagate'),          // Deployment ctrl → RS spec (ch.1 + ch.2)
    KIT.stage('⧉', 'Reconcile'),          // RS ctrl so desired với actual
    KIT.stage('⇢', 'Bind', 'ok'),         // scheduler + kubelet       (ch.1)
    KIT.stage('⌦', 'Select', 'danger')    // xếp hạng + DELETE         (ch.2 + ch.3)
  ],
  world: window.createManualScaleWorld(run),
  steps: window.createManualScaleUpSteps(run)
    .concat(window.createManualScaleDownSteps(run))
});
})();
