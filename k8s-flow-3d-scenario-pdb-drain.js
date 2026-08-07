window.SCENARIOS = window.SCENARIOS || [];
window.SCENARIOS.push({
  name: 'PDB & kubectl drain',
  tag: 'PDB',
  steps: [
  {
    title: 'PDB bảo vệ khi kubectl drain / Eviction API',
    desc: '<code>kubectl drain</code> và Eviction API <span class="ok">tôn trọng PDB</span>. Nếu <code>minAvailable: 2</code> và chỉ còn 2 Pod, eviction bị từ chối cho đến khi Pod mới sẵn sàng. Đây là công cụ cho <span class="hi">planned maintenance</span>.',
    build(a) {
      a.box('kubectl drain', -8, 0, 0, 3, 3, 2.5, '#0a1428', '#1a3a6a', 0);
      a.box('PDB  minAvailable=2', 0, 0, 0, 5, 1.2, 2, '#0a1828', '#1a3a60', 1);
      a.box('Node-1', 7, 0, 0, 5, 5, 3.5, '#0d1923', '#1e3050', 2);
      a.box('pod-1', 5.8, 0.5, 0, 1.4, 1.4, 1.2, '#0a3020', '#1a6040', 3);
      a.box('pod-2', 7.2, 0.5, 0, 1.4, 1.4, 1.2, '#0a3020', '#1a6040', 4);
      a.arrow(-6.5, 0, 0, -2.5, 0, 0, '#3a7fff', false, 5);
      a.arrow(2.5, 0, 0,  4.5, 0, 0, '#18a855', false, 6);
      a.txt('Blocked if < minAvailable', -3.5, 1.5, 0, '#18a855', 7);
      a.hero(1);
      a.cam([0, 3, 0]);
    }
  },
  {
    title: 'PDB KHÔNG bảo vệ khi Node-pressure eviction',
    desc: 'Khi Node thực sự thiếu RAM/disk, kubelet evict trực tiếp — <span class="danger">PDB bị bỏ qua hoàn toàn</span>. DB, ingress, DNS đều có thể bị evict dù có PDB. PDB chỉ bảo vệ voluntary disruption, không phải emergency.',
    build(a) {
      a.box('Node-1\n(Memory Pressure)', 0, 0, 0, 7, 6, 4, '#1a0f05', '#3a2010', 0);
      a.box('pod-1  EVICTED\n(PDB ignored)', -1.5, 0.5, 0, 1.8, 1.8, 1.4, '#2a0808', '#6a1818', 1);
      a.box('pod-2', 1.5, 0.5, 0, 1.8, 1.8, 1.4, '#0a3020', '#1a6040', 2);
      a.txt('PDB does not protect here', 0, -2, 0, '#c43030', 3);
      a.hero(1);
      a.cam([0, 4, 0]);
    }
  },
  {
    title: 'Tóm tắt — cơ chế nào tôn trọng PDB?',
    desc: '<span class="ok">kubectl drain / Eviction API</span> — PDB được tôn trọng. <span class="warn">Scheduler preemption</span> — best effort. <span class="danger">Node-pressure eviction / OOM killer / Liveness probe fail / Container OOM</span> — PDB không có tác dụng.',
    build(a) {
      a.box('drain / API\n(Respected)', -9, 0, 0, 3.5, 3, 2.5, '#0a2010', '#1a5030', 0);
      a.box('Preemption\n(Best effort)', -4, 0, 0, 3.5, 3, 2.5, '#1a1200', '#4a3500', 1);
      a.box('Node pressure\n(Ignored)', 1, 0, 0, 3.5, 3, 2.5, '#2a0808', '#6a1818', 2);
      a.box('OOM / probe\n(Ignored)', 6, 0, 0, 3.5, 3, 2.5, '#2a0808', '#6a1818', 3);
      a.txt('PDB works', -9, -2, 0, '#18a855', 4);
      a.txt('partial', -4, -2, 0, '#c08000', 5);
      a.txt('no effect', 1, -2, 0, '#c43030', 6);
      a.txt('no effect', 6, -2, 0, '#c43030', 7);
      a.hero(0);
      a.cam([-1.5, 3, 0]);
    }
  },
  ]
});
