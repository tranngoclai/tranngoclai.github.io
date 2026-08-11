/* ══════════════════════════════════════════════
   EVOLUTION — ASSEMBLY

   Deck chỉ có MỘT scenario: cả 24 phase (hiện đã hiện thực Stage 0) sống
   trong cùng một persistent world, vì bài học là "một hệ thống lớn dần", chứ
   không phải "vài hệ thống khác nhau".

   Model chạy một lần; world và steps dùng chung đúng một `run` — không có
   cách nào cho label và HUD lệch nhau.

   `pipeline` ở đây là trục thời gian THẬT của deck (thứ tự 9 stage), không
   phải capability rail. Bốn capability (media/interaction/financial/fleet)
   tiến hóa độc lập nên chúng nằm trong `architecture` của model, không được
   ép vào một dải tuần tự.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;
const M = window.LIVESTREAM_EVOLUTION_MODEL;
const run = M.simulate(M.DEFAULT_CONFIG);

KIT.scenario({
  id: 'evolution',
  name: 'Live Room Under Pressure',
  tag: 'STAGE 0',
  pipeline: [
    KIT.stage('▶', 'Live'), KIT.stage('▤', 'Adaptive'), KIT.stage('⊟', 'Isolate'),
    KIT.stage('⊞', 'Scale'), KIT.stage('◍', 'Global'), KIT.stage('◈', 'Shield'),
    KIT.stage('✶', 'Interact'), KIT.stage('⛁', 'Money'), KIT.stage('⌗', 'Fleet')
  ],
  focusLabels: true,
  world: window.createEvolutionWorld(run),
  steps: window.createEvolutionMediaSteps(run)
});
})();
