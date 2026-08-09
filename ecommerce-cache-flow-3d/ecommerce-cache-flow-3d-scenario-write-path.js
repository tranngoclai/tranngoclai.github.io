/* WRITE PATH — assembly. Model chạy một lần; world + race-steps +
   cascade-steps + bypass-steps dùng chung một `run`. Race đứng ĐẦU vì
   client A gửi GET đọc giá trước cả khi admin kịp ghi — đúng thứ tự thời
   gian thật (timeline.aReadAtMs < writeAtMs). Step "Admin ghi giá mới"
   trong race arc kể TRỌN VẸN đường đi admin-console→lb→app→orm→db (một
   lần duy nhất) — cascade nối tiếp ngay sau, bắt đầu từ db-engine đã có
   giá mới, không kể lại request admin. Bypass minh hoạ lỗi kinh điển
   ORM-bypass §7 xảy ra NGOÀI cascade chuẩn. */
(function() {
const KIT = window.SCENE_KIT, M = window.WRITE_PATH_MODEL;
const run = M.simulate(M.DEFAULT_CONFIG);

KIT.scenario({
  id: 'write-path',
  name: 'Write path', tag: 'WRITE',
  pipeline: [
    KIT.stage('⛁', 'DB'), KIT.stage('⚙', 'Kernel'), KIT.stage('◈', 'ORM'),
    KIT.stage('⌂', 'App'), KIT.stage('⇢', 'Proxy'), KIT.stage('▣', 'CDN'), KIT.stage('◫', 'Browser')
  ],
  focusLabels: true,
  world: window.createWritePathWorld(run),
  steps: window.createWritePathRaceSteps(run)
    .concat(window.createWritePathCascadeSteps(run))
    .concat(window.createWritePathBypassSteps(run))
});
})();
