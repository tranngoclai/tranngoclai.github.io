window.SCENARIOS = window.SCENARIOS || [];
window.SCENARIOS.push({
  name: 'Linux OOM Killer',
  tag: 'OOM',
  steps: [
  {
    title: 'OOM Killer — hoàn toàn tách biệt với kubelet',
    desc: 'Nếu Node OOM trước khi kubelet kịp eviction, kernel Linux tự kill process dựa trên <code>oom_score_adj</code>. <span class="danger">PriorityClass không có tác dụng gì.</span> QoS class là yếu tố quyết định.',
    build(a) {
      a.box('Node-1  (OOM)', 0, 0, 0, 10, 6, 4, '#1a0505', '#3a0a0a', 0);
      a.box('BestEffort\nadj = 1000',  -3.5, 0.5, 0, 2, 2.2, 1.6, '#2a0808', '#8b1a1a', 1);
      a.box('Burstable\nadj = 500',     0,   0.5, 0, 2, 2.2, 1.6, '#2a1800', '#5a3800', 2);
      a.box('Guaranteed\nadj = -997',   3.5, 0.5, 0, 2, 2.2, 1.6, '#0a2a10', '#1a6030', 3);
      a.txt('kernel kills: highest adj first', 0, -1.8, 0, '#c08000', 4);
      a.hero(3);
      a.cam([0, 4, 0]);
    }
  },
  {
    title: 'BestEffort bị kill đầu tiên',
    desc: '<span class="danger">BestEffort: adj=1000</span> — kill đầu tiên. <span class="warn">Burstable: adj=2..999</span> — tính theo req/node RAM. <span class="ok">Guaranteed: adj=-997</span> — bảo vệ nhất. Actual memory usage cũng được tính vào score cuối cùng.',
    build(a) {
      a.box('Node-1  (OOM)', 0, 0, 0, 10, 6, 4, '#1a0505', '#3a0a0a', 0);
      a.box('BestEffort\nKILLED', -3.5, 0.5, 0, 2, 2.2, 1.6, '#0d0505', '#1e0a0a', 1);
      a.box('Burstable\nadj = 500',  0,   0.5, 0, 2, 2.2, 1.6, '#2a1800', '#5a3800', 2);
      a.box('Guaranteed\nadj = -997\nSafe', 3.5, 0.5, 0, 2, 2.2, 1.6, '#0a2a10', '#1a6030', 3);
      a.txt('Killed first', -3.5, -1.8, 0, '#c43030', 4);
      a.txt('Protected', 3.5, -1.8, 0, '#18a855', 5);
      a.hero(3);
      a.cam([0, 4, 0]);
    }
  },
  {
    title: 'Bảo vệ OOM — Guaranteed QoS + headroom',
    desc: 'Pod <span class="warn">Burstable</span> priority cao, request thấp, dùng nhiều RAM vẫn bị kill trước Pod <span class="ok">Guaranteed</span> priority thấp. <span class="hi">Giải pháp: request = limit (Guaranteed), memory limit hợp lý, giữ headroom trên Node.</span>',
    build(a) {
      a.box('Guaranteed\nreq = limit',    -5, 0, 0, 4, 3.5, 2.5, '#0a2a10', '#1a6030', 0);
      a.box('Burstable\nreq << limit',     2, 0, 0, 4, 3.5, 2.5, '#2a1800', '#5a3800', 1);
      a.txt('adj = -997  Protected', -5, -2, 0, '#18a855', 2);
      a.txt('adj = 500   At risk',    2, -2, 0, '#c08000', 3);
      a.hero(0);
      a.cam([-1, 3, 0]);
    }
  },
  ]
});
