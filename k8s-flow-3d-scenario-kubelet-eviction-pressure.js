/* ══════════════════════════════════════════════
   KUBELET EVICTION — OBSERVE, EVALUATE, RECLAIM (steps ①–③)

   The real interaction order, one phase per hop, before any Pod is touched:

     ①.1 kernel cgroup  → the only true source of the number
     ①.2 cAdvisor/CRI   → Summary API aggregates it
     ①.3 eviction manager polls the summary every 10s
     ②.1 threshold comparison, hard vs soft grace
     ②.2 eviction-minimum-reclaim raises the bar above the threshold
     ③.1 node-level reclaim is attempted FIRST — and for memory there is none
     ③.2 only now do Pods become candidates

   Steps ③→④ is the hop most explanations skip entirely, which is why so many
   people believe kubelet jumps straight from "threshold crossed" to "kill a
   Pod".
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const fmtMi = window.KUBELET_EVICTION_MODEL.fmtMi;

function podLook(pod) {
  return KIT.mark('live', '', {
    label: pod.name + '\nP' + pod.priority + ' · r' + fmtMi(pod.requestMi) + '/u' + fmtMi(pod.usageMi),
    hover: pod.name + ': usage ' + fmtMi(pod.usageMi) + ', request ' + fmtMi(pod.requestMi) + ', Priority ' + pod.priority
  });
}

window.createKubeletEvictionObserveSteps = function(config, run, reclaim) {
  const m = run.measured;
  const threshold = run.threshold;
  const tone = threshold.crossed ? 'danger' : 'ok';
  const deficitMi = Math.max(0, run.targetMi - threshold.availableMi);

  return [

/* ── STEP ①: nơi con số thật sự đến từ ── */
{
  title: 'Con số kubelet hành động dựa trên — nó không đọc free -m',
  pipelineStep: 0,
  focus: ['cgroups', 'cadvisor', 'kubelet'],
  cam: [1.5, 0, -2.0], dist: 34,
  phases: [
    {
      title: 'Kernel cgroup — working_set, không phải "used"',
      desc: KIT.desc(
        'Sự thật bắt đầu ở <b>kernel</b>: cgroup memory controller của Node báo <code>usage</code> và <code>inactive_file</code>.',
        'Kubernetes không đo gì cả ở bước này. <code>working_set = usage − inactive_file</code> = ' + fmtMi(m.workingSetMi + m.inactiveFileMi) + ' − ' + fmtMi(m.inactiveFileMi) + ' = <b>' + fmtMi(m.workingSetMi) + '</b>. Phần page cache còn <i>reclaimable</i> bị trừ ra, vì kernel có thể lấy lại nó bất cứ lúc nào.',
        '<b>Đây là lý do số của bạn không khớp.</b> Nếu bạn ssh vào Node rồi nhìn <code>free -m</code> hay <code>top</code>, bạn đang xem một đại lượng <span class="danger">khác</span> với thứ eviction manager so sánh. Muốn thấy đúng con số kubelet dùng: <code>kubectl get --raw /api/v1/nodes/&lt;node&gt;/proxy/stats/summary</code>.'),
      focus: ['cgroups'], labels: ['cgroups'],
      cam: [-2.0, 0, -2.4], dist: 26,
      set: {
        cgroups: KIT.pulse('warn', 'working_set = ' + fmtMi(m.workingSetMi), {at: 0.9, dy: 2.1}),
        'pod-a': podLook(config.pods[0]),
        'pod-b': podLook(config.pods[1]),
        'pod-c': podLook(config.pods[2])
      },
      scoreMode: true,
      scoreTitle: 'cgroup memory · Worker A',
      scores: [
        KIT.gauge('capacity', m.capacityMi, m.capacityMi, 'Mi'),
        KIT.gauge('working set', m.workingSetMi, m.capacityMi, 'Mi', {tone: 'warn'}),
        KIT.gauge('inactive', m.inactiveFileMi, m.capacityMi, 'Mi', {tone: 'ok'})
      ],
      scene(a) {
        KIT.note(a, 'working_set = usage − inactive_file', [-3.3, -3.4, 0.4], 'warn', 0.4);
      }
    },
    {
      title: 'cAdvisor + CRI → Summary API',
      desc: KIT.desc(
        'Số của kernel được <b>stats pipeline</b> gom lại: cAdvisor cho cgroup gốc, CRI stats cho từng container.',
        'Kết quả là một <code>Summary</code> duy nhất chứa cả node-level lẫn per-Pod working set. Đây mới là thứ eviction manager đọc — nó <b>không</b> tự gọi syscall xuống kernel.',
        '<b>Component này thường bị bỏ khỏi sơ đồ, và đó là sai lầm chẩn đoán.</b> Nếu stats pipeline chậm hoặc kẹt, eviction manager làm việc trên <span class="warn">số cũ</span>: Node có thể đã hết RAM thật mà kubelet vẫn thấy “ổn”, hoặc ngược lại evict oan dựa trên mẫu lỗi thời.'),
      focus: ['cgroups', 'cadvisor'], labels: ['cgroups', 'cadvisor'],
      cam: [-1.0, 0, -2.4], dist: 28,
      set: {
        cadvisor: KIT.pulse('info', 'summary aggregated', {at: 1.2, dy: 2.1})
      },
      scene(a) {
        KIT.link(a, 'cgroups', 'cadvisor', 'warn', {at: 0.3});
      }
    },
    {
      title: 'Eviction manager poll mỗi 10s — và memcg notification khi gấp',
      desc: KIT.desc(
        '<b>eviction manager</b> bên trong kubelet poll Summary API mỗi <code>' + config.monitoringPeriodSeconds + 's</code> và tính <code>memory.available = capacity − working_set</code>.',
        fmtMi(m.capacityMi) + ' − ' + fmtMi(m.workingSetMi) + ' = <b>' + fmtMi(threshold.availableMi) + '</b>. Song song, kubelet đăng ký <b>memcg notification</b> với kernel để được đánh thức ngay khi mức memory chạm ngưỡng, thay vì phải đợi hết chu kỳ poll.',
        '<b>Chu kỳ ' + config.monitoringPeriodSeconds + 's là một khoảng mù thật sự.</b> Một Pod cấp phát bộ nhớ dựng đứng có thể làm kernel OOM killer ra tay <span class="danger">trước khi</span> kubelet kịp poll lần kế. Khi đó bạn thấy <code>OOMKilled</code> chứ không phải <code>Evicted</code> — hai cơ chế khác nhau, và cái nào thắng chỉ là chuyện tốc độ.'),
      focus: ['cadvisor', 'kubelet'], labels: ['cadvisor', 'kubelet', 'cgroups'],
      cam: [2.5, 0, -2.4], dist: 30,
      set: {
        kubelet: KIT.pulse(tone, 'memory.available = ' + fmtMi(threshold.availableMi), {at: 1.2, dy: 2.5})
      },
      scoreMode: true,
      scoreTitle: 'memory.available · dẫn xuất',
      scores: [
        KIT.gauge('capacity', m.capacityMi, m.capacityMi, 'Mi'),
        KIT.gauge('working set', m.workingSetMi, m.capacityMi, 'Mi', {tone: 'warn'}),
        KIT.gauge('available', threshold.availableMi, m.capacityMi, 'Mi', {tone: tone})
      ],
      scene(a) {
        KIT.link(a, 'cadvisor', 'kubelet', 'info', {at: 0.3});
        KIT.note(a, 'poll ' + config.monitoringPeriodSeconds + 's + memcg notification', [4.5, -3.4, 0.4], 'info', 0.8);
      }
    }
  ]
},

/* ── STEP ②: so ngưỡng, rồi nâng mục tiêu ── */
{
  title: 'So với threshold — và mục tiêu cao hơn threshold',
  pipelineStep: 1,
  focus: ['kubelet'],
  cam: [3.0, 0, -1.5], dist: 30,
  phases: [
    {
      title: threshold.kind === 'hard' ? 'Hard threshold — không có observation grace' : 'Soft threshold — phải quan sát đủ lâu',
      desc: KIT.desc(
        'eviction manager so <code>' + fmtMi(threshold.availableMi) + '</code> với threshold đã cấu hình <code>' + threshold.kind + ': memory.available&lt;' + fmtMi(threshold.thresholdMi) + '</code>.',
        threshold.kind === 'hard'
          ? 'Đã cắt ngưỡng. <b>Hard threshold hành động ngay ở synchronization cycle này</b> — không có <code>eviction-soft-grace-period</code> để chờ, và Pod bị dừng với grace <code>0s</code>.'
          : 'Đã cắt ngưỡng và quan sát được <b>' + threshold.observedForSeconds + '/' + threshold.gracePeriodSeconds + 's</b>. Soft threshold chỉ hành động khi tín hiệu <i>duy trì</i> đủ lâu, và khi đó vẫn honor Pod grace period (bị cap bởi <code>evictionMaxPodGracePeriod</code>).',
        '<b>Hai chiếc đồng hồ hay bị nhầm làm một:</b> <code>eviction-soft-grace-period</code> là <i>“tín hiệu phải xấu bao lâu trước khi tôi ra tay”</i>; <code>terminationGracePeriodSeconds</code> là <i>“Pod có bao lâu để thoát sạch sau khi tôi đã ra tay”</i>. Hard eviction bỏ qua cả hai.'),
      focus: ['kubelet'], labels: ['kubelet'],
      cam: [4.5, 0, -2.4], dist: 24,
      set: {
        kubelet: KIT.pulse(tone, threshold.crossed ? 'threshold crossed' : 'within threshold', {at: 0.9, dy: 2.5}),
        node: KIT.mark(threshold.triggered ? 'warn' : 'ok', threshold.triggered ? 'under memory pressure' : 'no pressure', {
          label: 'Worker A\n' + (threshold.triggered ? 'Memory pressure' : 'Ready'), at: 1.2, dy: 3.0
        })
      },
      scoreMode: true,
      scoreTitle: 'available vs threshold',
      scores: [
        KIT.gauge('available', threshold.availableMi, m.capacityMi, 'Mi', {tone: tone}),
        KIT.gauge('threshold', threshold.thresholdMi, m.capacityMi, 'Mi', {tone: 'warn'})
      ],
      scene(a) {
        KIT.note(a, fmtMi(threshold.availableMi) + (threshold.crossed ? ' < ' : ' ≥ ') + fmtMi(threshold.thresholdMi), [4.5, -3.4, 0.4], tone, 0.5);
      }
    },
    {
      title: 'eviction-minimum-reclaim — mục tiêu nằm TRÊN threshold',
      desc: KIT.desc(
        'Kubelet không dọn vừa đủ để chạm lại threshold. Nó cộng thêm <code>--eviction-minimum-reclaim=' + fmtMi(run.minimumReclaimMi) + '</code>.',
        'Mục tiêu thực: <code>' + fmtMi(threshold.thresholdMi) + ' + ' + fmtMi(run.minimumReclaimMi) + ' = <b>' + fmtMi(run.targetMi) + '</b></code>. Đang có ' + fmtMi(threshold.availableMi) + ', nên phải giải phóng ít nhất <b>' + fmtMi(deficitMi) + '</b>.',
        '<b>Không có minimum-reclaim thì Node rơi vào vòng lặp evict.</b> Dọn vừa đủ chạm ngưỡng nghĩa là chỉ cần một lần cấp phát nhỏ là lại vượt ngưỡng, lại evict, mãi mãi. Con số này mua lấy khoảng đệm để Node <i>ổn định</i> chứ không chỉ <i>hết đỏ</i>.'),
      focus: ['kubelet'], labels: ['kubelet'],
      cam: [4.5, 0, -2.0], dist: 26,
      set: {
        kubelet: KIT.pulse('warn', 'must reclaim ≥ ' + fmtMi(deficitMi), {at: 0.9, dy: 2.5})
      },
      scoreMode: true,
      scoreTitle: 'mục tiêu reclaim',
      scores: [
        KIT.gauge('available', threshold.availableMi, m.capacityMi, 'Mi', {tone: 'danger'}),
        KIT.gauge('threshold', threshold.thresholdMi, m.capacityMi, 'Mi', {tone: 'warn'}),
        KIT.gauge('target', run.targetMi, m.capacityMi, 'Mi', {tone: 'ok'})
      ],
      scene(a) {
        KIT.note(a, 'target = threshold + minimum-reclaim', [4.5, -3.4, 0.4], 'ok', 0.5);
      }
    }
  ]
},

/* ── STEP ③: node-level reclaim đi TRƯỚC Pod ── */
{
  title: 'Trước khi đụng tới Pod — kubelet thử dọn tài nguyên node-level',
  pipelineStep: 2,
  focus: ['kubelet', 'runtime'],
  cam: [6.0, 0, -1.5], dist: 30,
  phases: [
    {
      title: 'Hỏi trước: signal này có reclaim function nào không?',
      desc: KIT.desc(
        'Bước bị bỏ quên nhiều nhất: kubelet <b>không</b> nhảy thẳng từ “vượt ngưỡng” sang “giết Pod”. Nó thử <b>node-level reclaim</b> trước.',
        'Với <code>nodefs.available</code>/<code>imagefs.available</code>, reclaim là thật: xoá dead container rồi xoá unused image qua runtime — và nếu dọn đủ, <span class="ok">không Pod nào bị đụng tới</span>. Với <code>' + reclaim.signal + '</code> thì <b>danh sách reclaim function rỗng</b>.',
        '<b>Vì sao rỗng:</b> RAM không có “rác” cho kubelet dọn. Mọi thứ có thể lấy lại thì kernel đã lấy lại rồi — chính vì vậy <code>inactive_file</code> bị trừ khỏi working set ở bước ①. Cái còn lại là bộ nhớ đang thực sự được tiến trình dùng, và chỉ có một cách lấy lại: <b>kết thúc tiến trình</b>.'),
      focus: ['kubelet', 'runtime'], labels: ['kubelet', 'runtime'],
      cam: [6.5, 0, -2.4], dist: 26,
      set: {
        kubelet: KIT.pulse('info', 'try node-level reclaim', {at: 0.4, dy: 2.5}),
        runtime: KIT.pulse(reclaim.attempted ? 'warn' : 'mute', reclaim.attempted ? 'image + container GC' : 'no reclaim for memory', {at: 1.2, dy: 2.1})
      },
      scene(a) {
        KIT.link(a, 'kubelet', 'runtime', reclaim.attempted ? 'warn' : 'mute', {at: 0.4});
        KIT.note(a, 'disk → GC · memory → nothing to GC', [8.4, -3.4, 0.4], 'mute', 0.9);
      }
    },
    {
      title: 'Reclaim không đủ → Pod trở thành ứng viên',
      desc: KIT.desc(
        'Node-level reclaim thu về <code>' + fmtMi(reclaim.reclaimedMi) + '</code>, vẫn thiếu <b>' + fmtMi(deficitMi) + '</b>. Chỉ tới đây Pod mới bước vào danh sách ứng viên.',
        'Đây là ranh giới trách nhiệm: mọi thứ tới giờ là kubelet <i>đo và dọn dẹp</i>. Từ đây trở đi kubelet <i>chấm dứt workload của người khác</i> — và vì vậy nó cần một thứ tự xếp hạng có thể giải thích được.',
        '<b>Thứ tự này quan trọng khi debug.</b> Node báo <code>DiskPressure</code> nhưng không Pod nào bị evict thường <span class="ok">không phải lỗi</span>: image GC đã dọn đủ. Còn <code>MemoryPressure</code> thì gần như luôn dẫn tới eviction, vì nhánh reclaim ở trên không tồn tại.'),
      focus: ['kubelet', 'pod-a', 'pod-b', 'pod-c', 'pod-static'],
      labels: ['kubelet', 'pod-a', 'pod-b', 'pod-c', 'pod-static'],
      cam: [2.5, 0, 0], dist: 34,
      set: {
        kubelet: KIT.pulse('danger', 'Pods are candidates now', {at: 1.2, dy: 2.5})
      },
      scene(a) {
        ['pod-a', 'pod-b', 'pod-c', 'pod-static'].forEach(function(key, i) {
          // Four lines out of one component — `lift` fans them apart so they
          // read as four decisions rather than one thick smear.
          KIT.link(a, 'kubelet', key, 'warn', {at: 0.25 + i * 0.15, lift: i * 0.3});
        });
      }
    }
  ]
}

  ];
};
})();
