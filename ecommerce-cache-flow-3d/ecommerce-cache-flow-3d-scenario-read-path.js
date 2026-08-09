/* READ PATH — assembly. Model chạy một lần; world và cả hai step-factory
   dùng chung một `run`. Mặc định hitLevel=3 (CDN) — request ấm điển hình,
   ngắn gọn để làm bài học short-circuit rõ nhất. */
(function() {
const KIT = window.SCENE_KIT, M = window.READ_PATH_MODEL;
const run = M.simulate(M.DEFAULT_CONFIG);

KIT.scenario({
  id: 'read-path',
  name: 'Read path', tag: 'READ',
  pipeline: [
    KIT.stage('◎', 'DNS'), KIT.stage('◫', 'Browser'), KIT.stage('▣', 'CDN'),
    KIT.stage('⇢', 'Proxy'), KIT.stage('⌂', 'App'), KIT.stage('⛁', 'Store')
  ],
  focusLabels: true,
  world: window.createReadPathWorld(run),
  steps: window.createReadPathEdgeSteps(run).concat(window.createReadPathOriginSteps(run))
});
})();
