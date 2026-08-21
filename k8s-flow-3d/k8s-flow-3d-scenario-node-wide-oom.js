/* Node-wide Linux OOM — assembly only. */
(function() {
const KIT = window.SCENE_KIT;
const M = window.OOM_KILLER_MODEL;
const run = M.simulateNodeWide(M.DEFAULT_NODE_WIDE_CONFIG);
KIT.scenario({
  id: 'node-wide-linux-oom',
  name: 'Node-wide Linux OOM',
  tag: 'GLOBAL OOM',
  pipeline: [KIT.stage('⚙', 'Protect'), KIT.stage('▣', 'Exhaust', 'danger'), KIT.stage('↕', 'Rank', 'warn'), KIT.stage('✕', 'Kill', 'danger'), KIT.stage('↻', 'Recover', 'ok')],
  pipelineIntro: {
    title: 'Worker A hết RAM thật — kernel chọn nạn nhân, QoS chỉ là trọng số',
    desc: '',
    nodes: ['best-effort', 'burstable', 'guaranteed',
            'best-effort-process', 'burstable-process', 'guaranteed-process',
            'allocator', 'oom', 'reaper', 'kubelet', 'runtime'],
    bubbles: [
      {key: 'best-effort', text: 'BestEffort', at: 0.5, dur: 0.6, tone: 'peer'},
      {key: 'burstable',   text: 'Burstable',  at: 1.3, dur: 0.6, tone: 'accent'},
      {key: 'guaranteed',  text: 'Guaranteed', at: 2.1, dur: 0.6, tone: 'ok'},
      {key: 'allocator',   text: 'allocation thất bại', at: 2.9, dur: 0.6, tone: 'warn'},
      {key: 'oom',         text: 'global OOM killer',   at: 3.7, dur: 0.6, tone: 'danger'},
      {key: 'kubelet',     text: 'kubelet',    at: 4.5, dur: 0.6, tone: 'ok'}
    ],
    overviewAfter: 0.9
  },
  world: window.createNodeWideOomWorld(run),
  steps: window.createNodeWideOomSteps(run)
});
})();
