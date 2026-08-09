(function() {
const KIT = window.SCENE_KIT;
const M = window.OOM_KILLER_MODEL;

function mergeBeatState(beat, extra) {
  const set = Object.assign({}, beat.set);
  const first = Object.keys(beat.set)[0];
  const arrival = first ? beat.set[first].at : KIT.TIME.lead + KIT.TIME.draw;
  Object.keys(extra || {}).forEach(function(key) {
    set[key] = Object.assign({at: arrival}, set[key] || {}, extra[key]);
  });
  return {set: set, scene: beat.scene};
}

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
  return [
    {title: 'Kubelet chuẩn bị mức bảo vệ process', pipelineStep: 0, focus: ['kubelet', 'runtime', 'best-effort-process', 'burstable-process', 'guaranteed-process'], phases: [
      {title: 'QoS được chuyển thành oom_score_adj', desc: KIT.desc('Trước khi các container chạy, kubelet suy ra QoS từ requests/limits và tính adjustment: BestEffort <code>' + best.oomScoreAdj + '</code>, Burstable <code>' + burstable.oomScoreAdj + '</code>, Guaranteed <code>' + guaranteed.oomScoreAdj + '</code>.', 'PriorityClass thông thường không phải input trực tiếp của phép tính QoS này. System-critical Pods là ngoại lệ được kubelet bảo vệ ở <code>-997</code>. QoS ảnh hưởng global OOM gián tiếp qua adjustment.'), focus: ['kubelet', 'best-effort-process', 'burstable-process', 'guaranteed-process'], ...KIT.beat('kubelet', 'runtime', 'info', {link: {label: 'QoS OOM settings'}, mark: ['info', 'adjustments derived'], dy: 3.0})},
      {title: 'Runtime áp adjustment lên Linux tasks', desc: KIT.desc('Runtime tạo container processes với các giá trị kubelet cung cấp. Khi OOM xảy ra, kernel xếp hạng <b>Linux task</b>, không xếp hạng Pod object hay nhãn QoS trực tiếp.', 'Guaranteed được bảo vệ mạnh hơn nhưng không tuyệt đối miễn nhiễm; kết quả vẫn phụ thuộc memory footprint và kernel state.'), focus: ['runtime', 'best-effort-process', 'burstable-process', 'guaranteed-process'], ...KIT.beat('runtime', 'burstable-process', 'info', {link: {label: 'apply oom_score_adj'}, mark: ['info', 'process settings applied'], dy: 2.6})}
    ]},
    {title: 'Node không đáp ứng được allocation', pipelineStep: 1, focus: ['allocator', 'node'], phases: [
      {title: 'Allocation đã có owner trước khi action chạy', desc: KIT.desc('<b>' + run.sourceProcess.name + '</b> xin thêm <b>' + f(run.event.allocationMi) + '</b> trên Worker A. Event trỏ tới process/resource đã tồn tại trong initial snapshot; nó không tạo workload mới.', 'Container này vẫn dưới memory limit riêng. Đây là host pressure, khác với <code>memory.max</code> OOM của một cgroup.'), focus: [run.sourceProcess.key, 'allocator', 'node'], scoreMode: true, scoreTitle: 'node-wide allocation pressure', scores: [KIT.gauge('available after reclaim', run.initialSnapshot.availableAfterReclaimMi, run.node.memoryCapacityMi, 'Mi', {tone: 'danger'}), KIT.gauge('allocation', run.event.allocationMi, run.node.memoryCapacityMi, 'Mi', {tone: 'warn'})], ...KIT.beat(run.sourceProcess.key, 'allocator', 'warn', {link: {label: 'request pages'}, mark: ['warn', f(run.event.allocationMi) + ' needed'], dy: 3.0})},
      {title: 'Global OOM là explicit kernel premise', desc: KIT.desc('Kịch bản khai từ đầu rằng reclaim không thỏa allocation và kernel đã vào global OOM; snapshot <b>' + f(run.initialSnapshot.availableAfterReclaimMi) + '</b> chỉ giúp người xem quan sát pressure.', 'Evaluator không còn suy ra global OOM bằng công thức “allocation > available”. Quyết định thật còn phụ thuộc GFP flags, order, zones/watermarks, cpusets, memory policy và reclaim progress.'), focus: ['allocator', 'oom'], ...KIT.beat('allocator', 'oom', 'danger', {link: {label: 'explicit reclaim-failed premise'}, mark: ['danger', 'global OOM entered'], dy: 3.0})}
    ]},
    {title: 'Kernel xếp hạng các task killable', pipelineStep: 2, focus: ['oom', 'best-effort-process', 'burstable-process', 'guaranteed-process'], phases: [
      {title: 'Victim scope là allocation domain được phép', desc: KIT.desc('Global OOM xét các Linux task killable trong allocation domain mà kernel cho phép ở thời điểm đó.', '“Toàn Node” là shorthand của ví dụ này; cpusets, memory policy, task eligibility và kernel state có thể thu hẹp candidate scope. Scene chỉ so sánh ba workload processes để dạy QoS effect — không khẳng định chúng là toàn bộ task trên host.'), focus: ['oom', 'best-effort-process', 'burstable-process', 'guaranteed-process'], ...KIT.beat('allocator', 'oom', 'danger', {link: {label: 'build candidate set'}, mark: ['danger', 'killable tasks'], dy: 3.0})},
      {title: 'Finite badness kết hợp footprint và adjustment', desc: KIT.desc('Teaching projection dùng footprint snapshot cộng <code>oom_score_adj</code>: BestEffort ≈ <b>' + Math.round(best.badnessProjection) + '</b>, Burstable ≈ <b>' + Math.round(burstable.badnessProjection) + '</b>, Guaranteed ≈ <b>' + Math.round(guaranteed.badnessProjection) + '</b>.', '<code>oom_score_adj=1000</code> vẫn hữu hạn, không biến BestEffort thành victim tuyệt đối. Đây là mô hình so sánh có ghi scope, không phải badness score chính xác của mọi kernel release.'), focus: ['best-effort-process', 'burstable-process', 'guaranteed-process'], scoreMode: true, scoreTitle: 'authored candidate footprint snapshot', scores: [KIT.gauge('BestEffort footprint', best.usageMi, run.node.memoryCapacityMi, 'Mi', {tone: 'danger'}), KIT.gauge('Burstable footprint', burstable.usageMi, run.node.memoryCapacityMi, 'Mi', {tone: 'warn'}), KIT.gauge('Guaranteed footprint', guaranteed.usageMi, run.node.memoryCapacityMi, 'Mi', {tone: 'ok'})], ...KIT.beat('oom', victim.key, 'warn', {link: {label: 'compare finite projections'}, mark: ['warn', 'footprint + adjustment'], dy: 2.5})},
      {title: 'Snapshot này chọn Burstable app process', desc: KIT.desc('Với resource spec và footprint đã khai, <b>' + victim.name + '</b> của <b>' + victim.qosClass + ' Pod</b> đứng đầu finite projection ở <b>' + Math.round(victim.badnessProjection) + '</b>.', 'Kết quả đến từ chính snapshot này. Không có luật “BestEffort luôn chết trước”, và tie-break theo key chỉ là quy ước deterministic của bài học.'), focus: ['oom', victim.key], ...mergeBeatState(KIT.beat('oom', victim.key, 'warn', {link: {label: 'select highest projection'}, mark: ['warn', 'teaching approximation'], dy: 2.4}), (function() { const set = {}; set[victim.key] = {label: victimProcessLabel}; return set; })())}
    ]},
    {title: 'Kernel kill victim và thu hồi RAM', pipelineStep: 3, focus: ['oom', 'best-effort-process', 'reaper'], phases: [
      {title: 'SIGKILL được gửi tới Burstable main process', desc: KIT.desc('Kernel gửi SIGKILL tới <b>' + victim.name + '</b>. Pod object <b>' + victim.podName + '</b> vẫn tồn tại; kernel không gọi Kubernetes API và không xóa Pod.', 'Initial snapshot đã khai đây là container-init/main process, nên evaluator mới kết luận container instance kết thúc.'), focus: ['oom', victim.key], ...mergeBeatState(KIT.beat('oom', victim.key, 'danger', {link: {label: 'SIGKILL'}, mark: ['danger', 'global OOM victim'], dy: 2.4}), (function() { const set = {}; set[victim.key] = {label: killedProcessLabel}; return set; })())},
      {title: 'OOM reaper giải phóng address space', desc: KIT.desc('Kernel đánh thức OOM reaper để thu hồi address space của victim và giúp allocation có cơ hội tiến triển.', 'Một victim không bảo đảm Node đã khỏe. Nếu pressure vẫn còn, kernel có thể phải xử lý OOM thêm lần nữa.'), focus: ['oom', 'reaper'], ...KIT.beat('oom', 'reaper', 'warn', {link: {label: 'wake reaper'}, mark: ['warn', 'reclaim victim memory'], dy: 2.8})}
    ]},
    {title: 'Kubernetes quan sát và khởi chạy lại', pipelineStep: 4, focus: ['runtime', 'kubelet', 'apiserver', victim.key], phases: [
      {title: 'Runtime ghi nhận OOM termination có evidence', desc: KIT.desc('Runtime correlates OOM event với process exit rồi cung cấp terminated status qua CRI.', 'Exit code <code>137</code> một mình không đủ chứng minh OOM. Assumption đã khai rõ runtime có OOM evidence; thiếu evidence thì evaluator không được ghi reason OOMKilled.'), focus: ['runtime', victim.key], ...KIT.beat('runtime', 'kubelet', 'warn', {link: {label: 'OOM termination evidence'}, mark: ['warn', 'runtime observed exit'], dy: 3.0})},
      {title: 'Kubelet cập nhật container status của victim Pod', desc: KIT.desc('Kubelet đọc CRI status rồi cập nhật <code>reason: OOMKilled</code> cho container trong <b>' + victim.podName + '</b> qua API Server.', 'Đây là container termination reason, không phải Pod phase và không phải kubelet eviction.'), focus: ['kubelet', 'apiserver', victimPodKey], ...mergeBeatState(KIT.beat('kubelet', 'apiserver', 'danger', {link: {label: 'PATCH pods/status'}, mark: ['danger', 'OOMKilled recorded'], dy: 3.0}), (function() { const set = {}; set[victimPodKey] = KIT.mark('danger', 'container OOMKilled', {label: victim.qosClass + ' Pod\ncontainer: OOMKilled', dy: 2.4}); return set; })())},
      {title: 'Predeclared restartPolicy tạo instance mới', desc: KIT.desc('<code>restartPolicy: ' + victim.restartPolicy + '</code> đã thuộc resource spec từ đầu. Vì victim là main process, kubelet/runtime tạo container instance mới trong cùng Pod; Pod UID giữ nguyên và <code>restartCount</code> tăng.', 'Restart chỉ phục hồi process. Nếu nguyên nhân node-wide pressure còn tồn tại, OOM có thể tái diễn.'), focus: ['kubelet', 'runtime', victim.key], ...mergeBeatState(KIT.beat('runtime', victim.key, 'ok', {link: {label: 'new container instance'}, mark: ['live', 'pressure may remain'], dy: 2.4}), (function() { const set = {}; set[victim.key] = {label: restartedProcessLabel}; set[victimPodKey] = KIT.mark('live', 'Running · restart 1', {label: victim.qosClass + ' Pod\nRunning · restarts 1', dy: 2.4}); return set; })())}
    ]}
  ];
};
})();
