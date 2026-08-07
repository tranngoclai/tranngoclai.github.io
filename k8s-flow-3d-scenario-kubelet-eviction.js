window.SCENARIOS = window.SCENARIOS || [];
window.SCENARIOS.push({
  name: 'Kubelet Eviction',
  tag: 'EVICTION',
  steps: [
  {
    title: 'Node memory thấp — comparator thực tế của kubelet',
    desc: 'Khi <code>memory.available</code> vượt threshold, kubelet so sánh Pod theo thứ tự: <span class="danger">1. usage &gt; request?</span> Sau đó <span class="warn">2. Priority thấp hơn?</span> Rồi <span class="warn">3. Vượt request nhiều hơn?</span> — <span class="danger">PDB bị bỏ qua hoàn toàn.</span>',
    build(a) {
      a.box('Node-1\n(Memory Pressure)', 0, 0, 0, 9, 5.5, 4, '#1a0f05', '#3a2010', 0);
      a.box('Pod A  P=100\nreq=4G  use=3G', -3, 0.5, 0, 2, 2, 1.6, '#0a3020', '#1a6040', 1);
      a.box('Pod B  P=200\nreq=1G  use=2G',  0, 0.5, 0, 2, 2, 1.6, '#2a0808', '#6a1818', 2);
      a.box('Pod C  P=10k\nreq=1G  use=3G',  3, 0.5, 0, 2, 2, 1.6, '#2a1800', '#5a3800', 3);
      a.txt('⚠ Low Memory', 0, -2, 0, '#c08000', 4);
      a.hero(0);
      a.cam([0, 4, 0]);
    }
  },
  {
    title: 'Eviction order: B first, then C, then A',
    desc: 'B và C đều <span class="danger">usage &gt; request</span> (bước 1). Trong nhóm đó, <span class="warn">B priority thấp hơn C</span> (bước 2) → B bị evict đầu tiên. Pod A <span class="ok">dưới request</span> dù priority thấp nhất vẫn được bảo vệ hơn.',
    build(a) {
      a.box('Node-1', 0, 0, 0, 9, 5.5, 4, '#1a0f05', '#3a2010', 0);
      a.box('Pod A  SAFE\nunder request',    -3, 0.5, 0, 2, 2, 1.6, '#0a3020', '#1a6040', 1);
      a.box('Pod B  EVICTED\nP=200',    0, 0.5, 0, 2, 2, 1.6, '#0d0505', '#1e0808', 2);
      a.box('Pod C  next\nP=10k',             3, 0.5, 0, 2, 2, 1.6, '#2a1800', '#5a3800', 3);
      a.txt('1st evicted', 0, -1.8, 0, '#c43030', 4);
      a.txt('protected', -3, -1.8, 0, '#18a855', 5);
      a.hero(2);
      a.cam([0, 4, 0]);
    }
  },
  {
    title: 'Lesson — request thấp nguy hiểm hơn priority thấp',
    desc: '<span class="danger">Request quá thấp = Pod rơi vào nhóm "usage &gt; request" = evict candidate.</span> Ngay cả khi PriorityClass cao. Đặt memory request gần P95 working set thực tế để Pod ở trong nhóm được bảo vệ.',
    build(a) {
      a.box('Risky\nrequest << usage', -5, 0, 0, 4, 3.5, 2.5, '#2a0808', '#6a1818', 0);
      a.box('Safe\nrequest ~ usage',   2, 0, 0, 4, 3.5, 2.5, '#0a2010', '#1a5030', 1);
      a.txt('evict candidate', -5, -2, 0, '#c43030', 2);
      a.txt('protected', 2, -2, 0, '#18a855', 3);
      a.hero(1);
      a.cam([-1, 3, 0]);
    }
  },
  ]
});
