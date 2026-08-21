/* Node-wide Linux OOM — 5 steps / 14 phases (③ sweeps `run.candidates`, the
   deck's one KIT.sweep candidate list). Mirrors k8s-flow-3d-scenario-oom-
   killer-steps.js: same shared mergeBeatState helper, same kernel-OOM beat
   vocabulary. The chip that must survive to the end is `node` `full` — host
   pressure, not a container limit — plus the two survivors staying `running`
   while the Burstable process died: the anti-lesson against "BestEffort
   always dies first". */
(function() {
const KIT = window.SCENE_KIT;
const M = window.OOM_KILLER_MODEL;
const mergeBeatState = window.mergeBeatState;

/* ── Step ③.2: per-candidate copy ──
   Descriptions are hand-written, the phase structure is generated from
   `run.candidates` via KIT.sweep. Each candidate states exactly one claim:
   its own footprint + adjustment + projection. */
var CANDIDATE_TITLES = {
  'best-effort-process': 'BestEffort: footprint thấp nhưng adjustment tối đa',
  'burstable-process': 'Burstable: footprint cao nhất trong ba candidate',
  'guaranteed-process': 'Guaranteed: adjustment âm kéo projection xuống thấp'
};

window.createNodeWideOomSteps = function(run) {
  const f = M.fmtMi;
  if (!run.globalOomEntered || !run.victim) {
    throw new Error('Node-wide OOM journey requires an explicit global OOM premise and victim');
  }
  const best = run.candidates.find(function(candidate) { return candidate.key === 'best-effort-process'; });
  const burstable = run.candidates.find(function(candidate) { return candidate.key === 'burstable-process'; });
  const guaranteed = run.candidates.find(function(candidate) { return candidate.key === 'guaranteed-process'; });
  const victim = run.victim;
  const victimPodKey = victim.podKey;
  const victimProcessLabel = victim.name + '\nselected · teaching projection';
  const killedProcessLabel = victim.name + ' · PID 1\nSIGKILL · global victim';
  const restartedProcessLabel = victim.name + ' #2 · PID 1\nRunning · restartCount 1';

  var CANDIDATE_DESCS = {
    'best-effort-process': KIT.desc(
      'BestEffort không khai request/limit nào — kernel gán adjustment cao nhất.',
      'Footprint <b>' + f(best.usageMi) + '</b> cộng <code>oom_score_adj=' + best.oomScoreAdj + '</code> cho projection ≈ <b>' + Math.round(best.badnessProjection) + '</b>.',
      '<code>oom_score_adj=1000</code> vẫn hữu hạn — không tự động biến process này thành victim.'
    ),
    'burstable-process': KIT.desc(
      'Burstable đang giữ footprint lớn nhất trong ba candidate.',
      'Footprint <b>' + f(burstable.usageMi) + '</b> cộng <code>oom_score_adj=' + burstable.oomScoreAdj + '</code> cho projection ≈ <b>' + Math.round(burstable.badnessProjection) + '</b>. Process này cũng đang sở hữu allocation event đang chờ.',
      'Adjustment trung bình của Burstable phụ thuộc tỉ lệ request/node capacity, không phải hằng số cố định.'
    ),
    'guaranteed-process': KIT.desc(
      'Guaranteed được kernel bảo vệ mạnh nhất bằng adjustment âm.',
      'Footprint <b>' + f(guaranteed.usageMi) + '</b> cộng <code>oom_score_adj=' + guaranteed.oomScoreAdj + '</code> cho projection ≈ <b>' + Math.round(guaranteed.badnessProjection) + '</b>.',
      'Âm không phải miễn nhiễm tuyệt đối — chỉ là trọng số kéo projection xuống thấp hơn hai lớp còn lại.'
    )
  };
  var CANDIDATE_EXPLAIN = {
    'best-effort-process': [
      {of: 'best-effort-process', tone: 'mute', text: 'Footprint <b>' + f(best.usageMi) + '</b>, không khai request/limit nào nên kernel gán <code>oom_score_adj=' + best.oomScoreAdj + '</code> — mức cao nhất.'},
      {of: 'best-effort-process', tone: 'warn', text: 'Projection ≈ <b>' + Math.round(best.badnessProjection) + '</b>. Hữu hạn, không phải victim tự động.'}
    ],
    'burstable-process': [
      {of: 'burstable-process', tone: 'warn', text: 'Footprint <b>' + f(burstable.usageMi) + '</b> — lớn nhất trong ba candidate — cộng <code>oom_score_adj=' + burstable.oomScoreAdj + '</code>.'},
      {of: 'burstable-process', tone: 'warn', text: 'Projection ≈ <b>' + Math.round(burstable.badnessProjection) + '</b>, và process này cũng đang sở hữu allocation event đang chờ.'}
    ],
    'guaranteed-process': [
      {of: 'guaranteed-process', tone: 'mute', text: 'Footprint <b>' + f(guaranteed.usageMi) + '</b> cộng adjustment âm <code>' + guaranteed.oomScoreAdj + '</code> — mức bảo vệ mạnh nhất.'},
      {of: 'guaranteed-process', tone: 'mute', text: 'Projection ≈ <b>' + Math.round(guaranteed.badnessProjection) + '</b>. Âm không phải miễn nhiễm tuyệt đối.'}
    ]
  };

  const candidatePhases = KIT.sweep(run.candidates, function(c, i) {
    const isVictim = c.key === victim.key;
    const tone = isVictim ? 'danger' : 'warn';
    const beat = KIT.beat('oom', c.key, tone, {
      link: {label: 'compare finite projection'},
      mark: [tone, 'proj ≈ ' + Math.round(c.badnessProjection)],
      dy: 2.5
    });
    const extra = {};
    if (!isVictim) extra[c.key] = {status: 'running'};
    return {
      title: CANDIDATE_TITLES[c.key],
      desc: CANDIDATE_DESCS[c.key],
      focus: ['oom', c.key],
      labels: [c.key, c.podKey],
      scoreMode: true,
      scoreTitle: c.name + ' footprint',
      scores: [KIT.gauge(c.name + ' footprint', c.usageMi, run.node.memoryCapacityMi, 'Mi', {tone: tone})],
      explain: CANDIDATE_EXPLAIN[c.key],
      ...mergeBeatState(beat, extra)
    };
  });

  return [
    {title: 'Kubelet chuẩn bị mức bảo vệ process', pipelineStep: 0, focus: ['kubelet', 'runtime', 'best-effort-process', 'burstable-process', 'guaranteed-process'], phases: [
      {
        title: 'QoS được chuyển thành oom_score_adj',
        desc: KIT.desc(
          'Kubelet suy QoS thành oom_score_adj trước khi container chạy — ba mức bảo vệ khác nhau.',
          'BestEffort <code>' + best.oomScoreAdj + '</code>, Burstable <code>' + burstable.oomScoreAdj + '</code>, Guaranteed <code>' + guaranteed.oomScoreAdj + '</code>.',
          'PriorityClass thông thường không phải input trực tiếp của phép tính QoS này. System-critical Pods là ngoại lệ được kubelet bảo vệ ở <code>-997</code>.'
        ),
        focus: ['kubelet', 'best-effort-process', 'burstable-process', 'guaranteed-process'],
        labels: ['kubelet', 'best-effort-process', 'burstable-process', 'guaranteed-process'],
        explain: [
          {of: 'kubelet', tone: 'info', text: 'Trước khi container chạy, kubelet suy QoS từ requests/limits rồi tính adjustment cho từng process: BestEffort <code>' + best.oomScoreAdj + '</code>, Burstable <code>' + burstable.oomScoreAdj + '</code>, Guaranteed <code>' + guaranteed.oomScoreAdj + '</code>.'},
          {of: ['best-effort-process', 'burstable-process', 'guaranteed-process'], tone: 'mute', text: 'QoS ảnh hưởng global OOM gián tiếp qua adjustment; PriorityClass không phải input trực tiếp của phép tính này.'}
        ],
        ...KIT.beat('kubelet', 'runtime', 'info', {link: {label: 'QoS OOM settings'}, mark: ['info', 'adjustments derived'], dy: 3.0})
      },
      {
        title: 'Runtime áp adjustment lên Linux tasks',
        desc: KIT.desc(
          'Runtime tạo container processes với các giá trị kubelet cung cấp.',
          'Khi OOM xảy ra, kernel xếp hạng <b>Linux task</b>, không xếp hạng Pod object hay nhãn QoS trực tiếp.',
          'Guaranteed được bảo vệ mạnh hơn nhưng không tuyệt đối miễn nhiễm; kết quả vẫn phụ thuộc memory footprint và kernel state.'
        ),
        focus: ['runtime', 'best-effort-process', 'burstable-process', 'guaranteed-process'],
        labels: ['runtime', 'best-effort-process', 'burstable-process', 'guaranteed-process'],
        explain: [
          {of: 'runtime', tone: 'info', text: 'Runtime tạo container processes với các giá trị kubelet cung cấp — mỗi process mang adjustment riêng của mình.'},
          {of: ['best-effort-process', 'burstable-process', 'guaranteed-process'], tone: 'mute', text: 'Khi OOM xảy ra, kernel xếp hạng <b>Linux task</b>, không xếp hạng Pod object hay nhãn QoS trực tiếp.'}
        ],
        ...mergeBeatState(
          KIT.beat('runtime', 'burstable-process', 'info', {link: {label: 'apply oom_score_adj'}, mark: ['info', 'process settings applied'], dy: 2.6}),
          {'best-effort-process': {status: 'running'}, 'burstable-process': {status: 'running'}, 'guaranteed-process': {status: 'running'}}
        )
      }
    ]},
    {title: 'Node không đáp ứng được allocation', pipelineStep: 1, focus: ['allocator', 'node'], phases: [
      {
        title: 'Allocation nhắm vào process đã tồn tại từ trước',
        desc: KIT.desc(
          '<b>' + run.sourceProcess.name + '</b> xin thêm <b>' + f(run.event.allocationMi) + '</b> trên Worker A — allocation nhắm vào process đã tồn tại, không phải workload mới.',
          'Yêu cầu này nhắm vào process/resource đã đang chạy trên Node từ trước, không phải workload mới xuất hiện.',
          'Container này vẫn dưới memory limit riêng. Đây là host pressure, khác với <code>memory.max</code> OOM của một cgroup.'
        ),
        focus: [run.sourceProcess.key, 'allocator', 'node'],
        labels: [run.sourceProcess.key, 'allocator', 'node'],
        scoreMode: true,
        scoreTitle: 'node-wide allocation pressure',
        scores: [KIT.gauge('available after reclaim', run.initialSnapshot.availableAfterReclaimMi, run.node.memoryCapacityMi, 'Mi', {tone: 'danger'}), KIT.gauge('allocation', run.event.allocationMi, run.node.memoryCapacityMi, 'Mi', {tone: 'warn'})],
        explain: [
          {of: run.sourceProcess.key, tone: 'warn', text: '<b>' + run.sourceProcess.name + '</b> xin thêm <b>' + f(run.event.allocationMi) + '</b> trên Worker A — nhắm vào process đã đang chạy từ trước, không tạo workload mới.'},
          {of: 'node', tone: 'mute', text: 'Container này vẫn dưới memory limit riêng của nó — đây là host pressure, khác với <code>memory.max</code> OOM của một cgroup.'}
        ],
        ...KIT.beat(run.sourceProcess.key, 'allocator', 'warn', {link: {label: 'request pages'}, mark: ['warn', f(run.event.allocationMi) + ' needed'], dy: 3.0})
      },
      {
        title: 'Reclaim thất bại — kernel vào global OOM',
        desc: KIT.desc(
          'Kernel đã thử reclaim nhưng không đủ để thỏa allocation, nên chuyển sang global OOM.',
          'Con số available sau reclaim, <b>' + f(run.initialSnapshot.availableAfterReclaimMi) + '</b>, chỉ là dấu hiệu quan sát được — không phải công thức kernel dùng để quyết định.',
          'Global OOM không suy ra bằng công thức đơn giản "allocation > available". Quyết định thật của kernel còn phụ thuộc GFP flags, order, zones/watermarks, cpusets, memory policy và tiến độ reclaim.'
        ),
        focus: ['allocator', 'oom', 'node'],
        labels: ['allocator', 'oom', 'node'],
        explain: [
          {of: 'allocator', tone: 'danger', text: 'Kernel đã thử reclaim nhưng không đủ để thỏa allocation, nên chuyển sang global OOM; available sau reclaim <b>' + f(run.initialSnapshot.availableAfterReclaimMi) + '</b> chỉ là dấu hiệu quan sát được.'},
          {of: 'node', tone: 'mute', text: 'Quyết định thật còn phụ thuộc GFP flags, order, zones/watermarks, cpusets, memory policy và reclaim progress — không chỉ một phép so sánh Mi.'}
        ],
        ...mergeBeatState(
          KIT.beat('allocator', 'oom', 'danger', {link: {label: 'explicit reclaim-failed premise'}, mark: ['danger', 'global OOM entered'], dy: 3.0}),
          {node: {status: 'full'}}
        )
      }
    ]},
    {title: 'Kernel xếp hạng các task killable', pipelineStep: 2, focus: ['oom', 'best-effort-process', 'burstable-process', 'guaranteed-process'], phases: [
      {
        title: 'Victim scope là allocation domain được phép',
        desc: KIT.desc(
          'Global OOM xét các Linux task killable trong allocation domain mà kernel cho phép ở thời điểm đó.',
          '"Toàn Node" chỉ là cách nói gọn — cpusets, memory policy, task eligibility và kernel state trong thực tế có thể thu hẹp phạm vi này.',
          'Ở đây chỉ so sánh ba process của ba QoS class — trên Node thật còn nhiều task khác cũng nằm trong candidate scope.'
        ),
        focus: ['oom', 'best-effort-process', 'burstable-process', 'guaranteed-process'],
        labels: ['oom', 'best-effort-process', 'burstable-process', 'guaranteed-process'],
        explain: [
          {of: 'oom', tone: 'danger', text: 'Global OOM xét các Linux task killable trong allocation domain mà kernel cho phép ở thời điểm đó.'},
          {of: ['best-effort-process', 'burstable-process', 'guaranteed-process'], tone: 'mute', text: 'Ở đây chỉ so sánh ba process của ba QoS class — "toàn Node" là cách nói gọn, không phải toàn bộ task trên host.'}
        ],
        ...KIT.beat('allocator', 'oom', 'danger', {link: {label: 'build candidate set'}, mark: ['danger', 'killable tasks'], dy: 3.0})
      },
      ...candidatePhases,
      {
        title: 'Kernel chọn ' + victim.qosClass + ' app process — projection cao nhất',
        desc: KIT.desc(
          'Với resource spec và footprint đã khai, <b>' + victim.name + '</b> của <b>' + victim.qosClass + ' Pod</b> đứng đầu finite projection ở <b>' + Math.round(victim.badnessProjection) + '</b>.',
          'Kết quả phụ thuộc đúng footprint và adjustment đo được lúc này.',
          'Không có luật "BestEffort luôn chết trước". Kết quả phụ thuộc đúng footprint và adjustment tại thời điểm OOM xảy ra — lệch một chút cũng đổi được ai là victim.'
        ),
        focus: ['oom', victim.key],
        labels: [victim.key],
        explain: [
          {of: victim.key, tone: 'warn', text: 'Với resource spec và footprint đã khai, <b>' + victim.name + '</b> của <b>' + victim.qosClass + ' Pod</b> đứng đầu finite projection ở <b>' + Math.round(victim.badnessProjection) + '</b>.'},
          {of: victim.key, tone: 'mute', text: 'Không có luật "BestEffort luôn chết trước" — kết quả phụ thuộc đúng footprint và adjustment đo được lúc này, lệch một chút cũng đổi được ai là victim.'}
        ],
        ...mergeBeatState(
          KIT.beat('oom', victim.key, 'warn', {link: {label: 'select highest projection'}, mark: ['warn', 'teaching approximation'], dy: 2.4}),
          (function() { const set = {}; set[victim.key] = {label: victimProcessLabel, status: 'terminating'}; return set; })()
        )
      }
    ]},
    {title: 'Kernel kill victim và thu hồi RAM', pipelineStep: 3, focus: ['oom', 'best-effort-process', 'reaper'], phases: [
      {
        title: 'SIGKILL được gửi tới Burstable main process',
        desc: KIT.desc(
          'Kernel gửi SIGKILL tới <b>' + victim.name + '</b>.',
          'Pod object <b>' + victim.podName + '</b> vẫn tồn tại; kernel không gọi Kubernetes API và không xóa Pod.',
          'Đây là container init/main process, nên khi nó chết, cả container instance coi như kết thúc — khác nếu chỉ một child process bị kill.'
        ),
        focus: ['oom', victim.key],
        labels: [victim.key],
        explain: [
          {of: victim.key, tone: 'danger', text: 'Kernel gửi <b>SIGKILL</b> tới <b>' + victim.name + '</b>. Pod object <b>' + victim.podName + '</b> vẫn tồn tại; kernel không gọi Kubernetes API và không xóa Pod.'},
          {of: victim.key, tone: 'mute', text: 'Đây là container init/main process, nên khi nó chết, cả container instance coi như kết thúc — khác nếu chỉ một child process bị kill.'}
        ],
        ...mergeBeatState(
          KIT.beat('oom', victim.key, 'danger', {link: {label: 'SIGKILL'}, mark: ['danger', 'global OOM victim'], dy: 2.4}),
          (function() { const set = {}; set[victim.key] = {label: killedProcessLabel, status: 'killed'}; return set; })()
        )
      },
      {
        title: 'OOM reaper giải phóng address space',
        desc: KIT.desc(
          'Kernel đánh thức OOM reaper để thu hồi address space của victim và giúp allocation có cơ hội tiến triển.',
          'Một victim không bảo đảm Node đã khỏe.',
          'Nếu pressure vẫn còn, kernel có thể phải xử lý OOM thêm lần nữa.'
        ),
        focus: ['oom', 'reaper'],
        labels: ['oom', 'reaper'],
        explain: [
          {of: ['oom', 'reaper'], tone: 'warn', text: 'Kernel đánh thức <b>OOM reaper</b> để thu hồi address space của victim và giúp allocation có cơ hội tiến triển.'},
          {of: 'reaper', tone: 'mute', text: 'Một victim không bảo đảm Node đã khỏe. Nếu pressure vẫn còn, kernel có thể phải xử lý OOM thêm lần nữa.'}
        ],
        ...KIT.beat('oom', 'reaper', 'warn', {link: {label: 'wake reaper'}, mark: ['warn', 'reclaim victim memory'], dy: 2.8})
      }
    ]},
    {title: 'Kubernetes quan sát và khởi chạy lại', pipelineStep: 4, focus: ['runtime', 'kubelet', 'apiserver', victim.key], phases: [
      {
        title: 'Runtime ghi nhận OOM termination có evidence',
        desc: KIT.desc(
          'Runtime đối chiếu OOM event với process exit rồi trả về terminated status qua CRI.',
          'Exit code <code>137</code> một mình không đủ chứng minh OOM.',
          'Runtime phải có bằng chứng OOM cụ thể mới được gắn reason OOMKilled — thiếu bằng chứng, kubelet không được suy diễn chỉ từ exit code.'
        ),
        focus: ['runtime', victim.key],
        labels: ['runtime', victim.key],
        explain: [
          {of: 'runtime', tone: 'warn', text: 'Runtime đối chiếu OOM event với process exit rồi trả về terminated status qua CRI.'},
          {of: victim.key, tone: 'mute', text: 'Exit code <code>137</code> một mình không đủ chứng minh OOM — kubelet chỉ ghi reason này khi runtime có bằng chứng OOM cụ thể đi kèm.'}
        ],
        ...KIT.beat('runtime', 'kubelet', 'warn', {link: {label: 'OOM termination evidence'}, mark: ['warn', 'runtime observed exit'], dy: 3.0})
      },
      {
        title: 'Kubelet cập nhật container status của victim Pod',
        desc: KIT.desc(
          'Kubelet đọc CRI status rồi cập nhật <code>reason: OOMKilled</code> cho container trong <b>' + victim.podName + '</b> qua API Server.',
          'Đây là container termination reason.',
          'Không phải Pod phase và không phải kubelet eviction.'
        ),
        focus: ['kubelet', 'apiserver', victimPodKey],
        labels: ['kubelet', 'apiserver', victimPodKey],
        explain: [
          {of: ['kubelet', 'apiserver'], tone: 'danger', text: 'Kubelet đọc CRI status rồi cập nhật <code>reason: OOMKilled</code> cho container trong <b>' + victim.podName + '</b> qua API Server.'},
          {of: victimPodKey, tone: 'mute', text: 'Đây là container termination reason, không phải Pod phase và không phải kubelet eviction.'}
        ],
        ...mergeBeatState(
          KIT.beat('kubelet', 'apiserver', 'danger', {link: {label: 'PATCH pods/status'}, mark: ['danger', 'OOMKilled recorded'], dy: 3.0}),
          (function() { const set = {}; set[victimPodKey] = KIT.mark('danger', 'container OOMKilled', {label: victim.qosClass + ' Pod\ncontainer: OOMKilled', dy: 2.4, status: 'killed'}); return set; })()
        )
      },
      {
        title: 'restartPolicy có sẵn từ spec khiến kubelet tạo instance mới',
        desc: KIT.desc(
          '<code>restartPolicy: ' + victim.restartPolicy + '</code> đã thuộc resource spec từ đầu.',
          'Vì victim là main process, kubelet/runtime tạo container instance mới trong cùng Pod; Pod UID giữ nguyên và <code>restartCount</code> tăng.',
          'Restart chỉ phục hồi process. Nếu nguyên nhân node-wide pressure còn tồn tại, OOM có thể tái diễn.'
        ),
        focus: ['kubelet', 'runtime', victim.key],
        labels: ['kubelet', 'runtime', victim.key, victimPodKey],
        explain: [
          {of: 'kubelet', tone: 'ok', text: '<code>restartPolicy: ' + victim.restartPolicy + '</code> đã thuộc resource spec từ đầu. Vì victim là main process, kubelet/runtime tạo container instance mới trong cùng Pod.'},
          {of: [victim.key, victimPodKey], tone: 'live', text: 'Pod UID giữ nguyên và <code>restartCount</code> tăng. Restart chỉ phục hồi process — nếu node-wide pressure còn tồn tại, OOM có thể tái diễn.'}
        ],
        ...mergeBeatState(
          KIT.beat('runtime', victim.key, 'ok', {link: {label: 'new container instance'}, mark: ['live', 'pressure may remain'], dy: 2.4}),
          (function() {
            const set = {};
            set[victim.key] = {label: restartedProcessLabel, status: 'running'};
            set[victimPodKey] = KIT.mark('live', 'Running · restart 1', {label: victim.qosClass + ' Pod\nRunning · restarts 1', dy: 2.4, status: 'running'});
            return set;
          })()
        )
      }
    ]}
  ];
};
})();
