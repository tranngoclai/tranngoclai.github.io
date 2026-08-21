/* Linux OOM Killer — assembly only. Model runs once; world and steps read it. */
(function() {
const KIT = window.SCENE_KIT, M = window.OOM_KILLER_MODEL;
const run = M.simulateContainer(M.DEFAULT_CONTAINER_CONFIG);
KIT.scenario({
  id: 'linux-oom-killer',
  name: 'Container Limit → OOMKilled', tag: 'OOMKILLED',
  pipeline: [KIT.stage('⚙', 'Prepare'), KIT.stage('▣', 'Charge'), KIT.stage('✕', 'Kill', 'danger'), KIT.stage('↗', 'Observe'), KIT.stage('↻', 'Restart', 'ok')],
  pipelineIntro: {
    title: 'Container chạm memory.max — kernel ra tay, không phải Kubernetes',
    desc: '',
    nodes: ['pod', 'process', 'cgroup', 'oom', 'reaper', 'kubelet', 'runtime'],
    bubbles: [
      {key: 'pod', text: 'Burstable Pod', at: 0.5, dur: 0.6, tone: 'accent'},
      {key: 'process', text: 'PID 1 · main', at: 1.3, dur: 0.6, tone: 'accent'},
      {key: 'cgroup', text: 'cgroup v2', at: 2.1, dur: 0.6, tone: 'gate'},
      {key: 'oom', text: 'kernel OOM killer', at: 2.9, dur: 0.6, tone: 'danger'},
      {key: 'reaper', text: 'OOM reaper', at: 3.7, dur: 0.6, tone: 'warn'},
      {key: 'kubelet', text: 'kubelet', at: 4.5, dur: 0.6, tone: 'ok'}
    ],
    overviewAfter: 0.9
  },
  world: window.createOomKillerWorld(run),
  steps: window.createOomKillerSteps(run)
});
})();
