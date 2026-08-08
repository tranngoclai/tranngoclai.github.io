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
  title: 'Kubelet đọc số liệu ở đâu — và vì sao không phải free -m',
  pipelineStep: 0,
  focus: ['cgroups', 'cadvisor', 'kubelet'],
  phases: [
    {
      title: 'Bối cảnh: Worker A đang cạn dần bộ nhớ khả dụng',
      desc: KIT.desc(
        'Ba Pod trên Worker A đang tăng usage cùng lúc. Node chỉ có <b>' + fmtMi(m.capacityMi) + '</b> để chia, và phần khả dụng co lại từng phút.',
        'Nếu không ai can thiệp, Node cạn hẳn bộ nhớ — kernel OOM killer sẽ tự chọn giết process, không hỏi han Kubernetes. Kubelet muốn hành động <i>trước</i> khi tới mức đó.',
        'Nhưng để hành động đúng lúc, kubelet phải biết chính xác con số nào nói lên "Node còn bao nhiêu" — bước tiếp theo sẽ trả lời.'),
      focus: ['pod-a', 'pod-b', 'pod-c'],
      set: {
        'pod-a': podLook(config.pods[0]),
        'pod-b': podLook(config.pods[1]),
        'pod-c': podLook(config.pods[2])
      }
    },
    {
      title: 'Kernel cgroup — working_set, không phải "used"',
      desc: KIT.desc(
        'Số liệu bắt đầu từ <b>kernel</b>: cgroup memory controller của Node báo <code>usage</code> và <code>inactive_file</code>.',
        'Kubernetes chưa đo gì ở bước này. <code>working_set = usage − inactive_file</code> = ' + fmtMi(m.workingSetMi + m.inactiveFileMi) + ' − ' + fmtMi(m.inactiveFileMi) + ' = <b>' + fmtMi(m.workingSetMi) + '</b>. Page cache còn <i>reclaimable</i> bị trừ ra vì kernel có thể lấy lại bất cứ lúc nào.',
        '<b>Đây là lý do số của bạn không khớp.</b> SSH vào Node xem <code>free -m</code> hay <code>top</code> là bạn đang nhìn một đại lượng <span class="danger">khác</span> với thứ eviction manager so sánh. Muốn xem đúng con số kubelet dùng: <code>kubectl get --raw /api/v1/nodes/&lt;node&gt;/proxy/stats/summary</code>.'),
      focus: ['cgroups'],
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
        KIT.note(a, 'working_set = usage − inactive_file', {of: 'cgroups', band: true}, 'warn', 0.4);
      }
    },
    {
      title: 'cAdvisor và CRI gộp số liệu thành Summary API',
      desc: KIT.desc(
        'Số của kernel đi qua <b>stats pipeline</b>: cAdvisor gom cgroup gốc, CRI stats gom từng container.',
        'Kết quả là một <code>Summary</code> duy nhất, gồm cả node-level lẫn per-Pod working set. Đây mới là thứ eviction manager đọc — nó <b>không</b> tự gọi syscall xuống kernel.',
        '<b>Component này hay bị bỏ khỏi sơ đồ — đó là sai lầm chẩn đoán.</b> Stats pipeline chậm hoặc kẹt khiến eviction manager làm việc trên <span class="warn">số cũ</span>: Node hết RAM thật mà kubelet vẫn thấy “ổn”, hoặc ngược lại evict oan vì mẫu lỗi thời.'),
      focus: ['cgroups', 'cadvisor'],
      set: {
        cadvisor: KIT.pulse('info', 'summary aggregated', {at: 1.2, dy: 2.1})
      },
      scene(a) {
        KIT.link(a, 'cgroups', 'cadvisor', 'warn', {at: 0.3, label: 'aggregate cgroup stats'});
      }
    },
    {
      title: 'Eviction manager kiểm tra mỗi 10s — và có cảnh báo khẩn khi gấp',
      desc: KIT.desc(
        '<b>eviction manager</b> bên trong kubelet poll Summary API mỗi <code>' + config.monitoringPeriodSeconds + 's</code> và tính <code>memory.available = capacity − working_set</code>.',
        fmtMi(m.capacityMi) + ' − ' + fmtMi(m.workingSetMi) + ' = <b>' + fmtMi(threshold.availableMi) + '</b>. Song song, kubelet đăng ký <b>memcg notification</b> với kernel để được đánh thức ngay khi chạm ngưỡng, không cần đợi hết chu kỳ poll.',
        '<b>Chu kỳ ' + config.monitoringPeriodSeconds + 's là khoảng mù thật sự.</b> Một Pod cấp phát bộ nhớ đột ngột có thể khiến kernel OOM killer ra tay <span class="danger">trước khi</span> kubelet kịp poll lần kế — lúc đó bạn thấy <code>OOMKilled</code> chứ không phải <code>Evicted</code>, hai cơ chế khác nhau, ai thắng chỉ là chuyện tốc độ.'),
      focus: ['cadvisor', 'kubelet'], labels: ['cadvisor', 'kubelet', 'cgroups'],
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
        KIT.link(a, 'cadvisor', 'kubelet', 'info', {at: 0.3, label: 'poll Summary API'});
        KIT.note(a, 'poll ' + config.monitoringPeriodSeconds + 's + memcg notification', {of: 'cadvisor', band: true}, 'info', 0.8);
      }
    }
  ]
},

/* ── STEP ②: so ngưỡng, rồi nâng mục tiêu ── */
{
  title: 'So sánh với threshold — rồi đặt mục tiêu cao hơn threshold',
  pipelineStep: 1,
  focus: ['kubelet'],
  phases: [
    {
      title: threshold.kind === 'hard' ? 'Hard threshold — không có observation grace' : 'Soft threshold — phải quan sát đủ lâu',
      desc: KIT.desc(
        'eviction manager so <code>' + fmtMi(threshold.availableMi) + '</code> với threshold đã cấu hình <code>' + threshold.kind + ': memory.available&lt;' + fmtMi(threshold.thresholdMi) + '</code>.',
        threshold.kind === 'hard'
          ? 'Đã cắt ngưỡng: <b>hard threshold hành động ngay trong cycle này</b> — không chờ <code>eviction-soft-grace-period</code>, Pod bị dừng với grace <code>0s</code>.'
          : 'Đã cắt ngưỡng và quan sát được <b>' + threshold.observedForSeconds + '/' + threshold.gracePeriodSeconds + 's</b>. Soft threshold chỉ hành động khi tín hiệu <i>duy trì</i> đủ lâu, và vẫn honor Pod grace period (cap bởi <code>evictionMaxPodGracePeriod</code>).',
        '<b>Hai chiếc đồng hồ hay bị nhầm làm một:</b> <code>eviction-soft-grace-period</code> là <i>“tín hiệu xấu bao lâu thì tôi ra tay”</i>; <code>terminationGracePeriodSeconds</code> là <i>“Pod có bao lâu để thoát sạch sau khi bị ra tay”</i>. Hard eviction bỏ qua cả hai.'),
      focus: ['kubelet'],
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
        KIT.note(a, fmtMi(threshold.availableMi) + (threshold.crossed ? ' < ' : ' ≥ ') + fmtMi(threshold.thresholdMi), {of: 'kubelet', band: true}, tone, 0.5);
      }
    },
    {
      title: 'eviction-minimum-reclaim — mục tiêu nằm TRÊN threshold',
      desc: KIT.desc(
        'Kubelet không dọn vừa đủ chạm lại threshold — nó cộng thêm <code>--eviction-minimum-reclaim=' + fmtMi(run.minimumReclaimMi) + '</code>.',
        'Mục tiêu thực: <code>' + fmtMi(threshold.thresholdMi) + ' + ' + fmtMi(run.minimumReclaimMi) + ' = <b>' + fmtMi(run.targetMi) + '</b></code>. Đang có ' + fmtMi(threshold.availableMi) + ', nên phải giải phóng ít nhất <b>' + fmtMi(deficitMi) + '</b>.',
        '<b>Không có minimum-reclaim, Node rơi vào vòng lặp evict:</b> dọn vừa đủ chạm ngưỡng thì chỉ một lần cấp phát nhỏ lại vượt ngưỡng, lại evict, mãi mãi. Con số này mua khoảng đệm để Node <i>ổn định</i>, không chỉ <i>hết đỏ</i>.'),
      focus: ['kubelet'],
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
        KIT.note(a, 'target = threshold + minimum-reclaim', {of: 'kubelet', band: true}, 'ok', 0.5);
      }
    }
  ]
},

/* ── STEP ③: node-level reclaim đi TRƯỚC Pod ── */
{
  title: 'Trước khi đụng tới Pod — kubelet thử dọn tài nguyên node-level',
  pipelineStep: 2,
  focus: ['kubelet', 'runtime'],
  phases: [
    {
      title: 'Hỏi trước: signal này có reclaim function nào không?',
      desc: KIT.desc(
        'Bước hay bị bỏ quên: kubelet <b>không</b> nhảy thẳng từ “vượt ngưỡng” sang “giết Pod” — nó thử <b>node-level reclaim</b> trước.',
        'Với <code>nodefs.available</code>/<code>imagefs.available</code>, reclaim là thật: xoá dead container rồi unused image qua runtime — dọn đủ thì <span class="ok">không Pod nào bị đụng tới</span>. Với <code>' + reclaim.signal + '</code>, <b>danh sách reclaim function rỗng</b>.',
        '<b>Vì sao rỗng:</b> RAM không có “rác” để dọn — cái gì lấy lại được thì kernel đã lấy rồi, chính vì vậy <code>inactive_file</code> bị trừ khỏi working set ở bước ①. Phần còn lại đang thực sự được tiến trình dùng, chỉ một cách lấy lại: <b>kết thúc tiến trình</b>.'),
      focus: ['kubelet', 'runtime'],
      set: {
        kubelet: KIT.pulse('info', 'try node-level reclaim', {at: 0.4, dy: 2.5}),
        runtime: KIT.pulse(reclaim.attempted ? 'warn' : 'mute', reclaim.attempted ? 'image + container GC' : 'no reclaim for memory', {at: 1.2, dy: 2.1})
      },
      scene(a) {
        KIT.link(a, 'kubelet', 'runtime', reclaim.attempted ? 'warn' : 'mute', {at: 0.4, label: 'request node-level reclaim'});
        KIT.note(a, 'disk → GC · memory → nothing to GC', {of: 'runtime', band: true}, 'mute', 0.9);
      }
    },
    {
      title: 'Reclaim không đủ, Pod bắt đầu thành ứng viên',
      desc: KIT.desc(
        'Node-level reclaim thu về <code>' + fmtMi(reclaim.reclaimedMi) + '</code>, vẫn thiếu <b>' + fmtMi(deficitMi) + '</b>. Chỉ tới đây Pod mới vào danh sách ứng viên.',
        'Đây là ranh giới trách nhiệm: tới giờ kubelet chỉ <i>đo và dọn dẹp</i>. Từ đây nó <i>chấm dứt workload của người khác</i> — nên cần một thứ tự xếp hạng giải thích được.',
        '<b>Thứ tự này quan trọng khi debug.</b> Node báo <code>DiskPressure</code> mà không Pod nào bị evict thường <span class="ok">không phải lỗi</span> — image GC đã dọn đủ. <code>MemoryPressure</code> thì gần như luôn dẫn tới eviction, vì nhánh reclaim đó không tồn tại.'),
      focus: ['kubelet', 'pod-a', 'pod-b', 'pod-c', 'pod-static'],
      set: {
        kubelet: KIT.pulse('danger', 'Pods are candidates now', {at: 1.2, dy: 2.5})
      },
      scene(a) {
        ['pod-a', 'pod-b', 'pod-c', 'pod-static'].forEach(function(key, i) {
          // Four lines out of one component — `lift` fans them apart so they
          // read as four decisions rather than one thick smear.
          KIT.link(a, 'kubelet', key, 'warn', {at: 0.25 + i * 0.15, lift: i * 0.3, label: 'mark candidate'});
        });
      }
    }
  ]
}

  ];
};
})();
