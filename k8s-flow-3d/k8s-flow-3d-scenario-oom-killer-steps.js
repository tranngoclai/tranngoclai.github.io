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

window.createOomKillerSteps = function(run) {
  const f = M.fmtMi;
  if (!run.charge.memcgOomEntered || !run.victim) {
    throw new Error('Container OOM journey requires an explicit memcg OOM premise and victim');
  }
  const requestMi = run.container.resources.requests.memoryMi;
  const limitMi = run.cgroup.memoryMaxMi;
  const usedMi = run.cgroup.memoryCurrentMi;
  const allocationMi = run.event.allocationMi;
  return [
    {title: 'Kubernetes chuẩn bị container', pipelineStep: 0, focus: ['kubelet', 'runtime', 'cgroup'], phases: [
      {title: 'Resource spec đã quyết định QoS và cấu hình OOM', desc: KIT.desc('Ngay từ trạng thái đầu, Pod đã khai <b>memory request ' + f(requestMi) + '</b>, <b>limit ' + f(limitMi) + '</b>, CPU request/limit đều không khai và <code>restartPolicy: ' + run.pod.restartPolicy + '</code>. Model tự suy ra QoS <b>' + run.pod.qosClass + '</b> rồi tính <code>oom_score_adj=' + run.process.oomScoreAdj + '</code>.', 'QoS không phải chuỗi được action tự gắn vào. <code>oom_score_adj</code> ảnh hưởng kernel ranking nhưng Kubernetes PriorityClass thông thường không phải input trực tiếp của phép tính này.'), focus: ['pod', 'kubelet', 'runtime'], ...KIT.beat('kubelet', 'runtime', 'info', {link: {label: 'derived OOM config'}, mark: ['info', 'oom_score_adj ' + run.process.oomScoreAdj], dy: 3.0})},
      {title: 'Cgroup mode cũng tồn tại trước allocation', desc: KIT.desc('Runtime đã tạo cgroup v2 với <code>memory.max=' + f(limitMi) + '</code> và <code>memory.oom.group=' + run.cgroup.memoryOomGroup + '</code>. Giá trị này khớp kubelet <code>singleProcessOOMKill=' + run.resources.kubelet.singleProcessOOMKill + '</code>.', 'Scene không đợi tới action mới bổ sung limit hoặc group-kill mode. Với <code>memory.oom.group=0</code>, kernel chọn riêng một task killable trong cgroup.'), focus: ['runtime', 'cgroup', 'process'], ...KIT.beat('runtime', 'cgroup', 'info', {link: {label: 'existing cgroup config'}, mark: ['info', 'max + group already set'], dy: 2.8})}
    ]},
    {title: 'Process chạm giới hạn cgroup', pipelineStep: 1, focus: ['process', 'cgroup'], phases: [
      {title: 'Initial snapshot đã ghi usage và allocation kế tiếp', desc: KIT.desc('PID 1 đang dùng <b>' + f(usedMi) + '</b>; event đã khai từ đầu rằng chính process này sẽ xin thêm <b>' + f(allocationMi) + '</b>. Pod vẫn Running và chưa có OOM kill.', 'Usage là runtime snapshot; request, limit, process role và restart policy vẫn thuộc resource contract riêng.'), focus: ['process', 'cgroup'], scoreMode: true, scoreTitle: 'container memory before allocation', scores: [KIT.gauge('used', usedMi, limitMi, 'Mi', {tone: 'warn'}), KIT.gauge('memory.max', limitMi, limitMi, 'Mi')], ...KIT.beat('process', 'cgroup', 'warn', {link: {label: 'memory charged'}, mark: ['warn', f(usedMi) + ' used'], dy: 2.8})},
      {title: 'Explicit premise: charge vẫn thất bại sau reclaim', desc: KIT.desc('Process thực hiện allocation <b>' + f(allocationMi) + '</b>. Phép cộng cho gauge là ' + f(usedMi) + ' + ' + f(allocationMi) + ' = <b>' + f(run.charge.projectedMi) + '</b>, vượt <code>memory.max</code> <b>' + f(run.charge.excessMi) + '</b>.', 'Memcg OOM không được suy ra chỉ từ phép cộng đó. Kịch bản đã khai riêng premise kernel: reclaim không thỏa allocation và <code>oomEntered=true</code>. Đây không phải kubelet eviction hay global OOM.'), focus: ['process', 'cgroup'], scoreMode: true, scoreTitle: 'authored failed charge after reclaim', scores: [KIT.gauge('used', usedMi, limitMi, 'Mi', {tone: 'warn'}), KIT.gauge('requested', run.charge.projectedMi, limitMi, 'Mi', {tone: 'danger'}), KIT.gauge('memory.max', limitMi, limitMi, 'Mi')], ...KIT.beat('process', 'cgroup', 'danger', {link: {label: 'explicit failed charge'}, mark: ['danger', 'memcg OOM premise'], dy: 2.8})}
    ]},
    {title: 'Kernel xử lý memcg OOM', pipelineStep: 2, focus: ['cgroup', 'oom', 'process'], phases: [
      {title: 'Cgroup kích hoạt OOM trong phạm vi của nó', desc: KIT.desc('Allocation không thể được đáp ứng bên trong <code>memory.max</code>, nên kernel bắt đầu OOM handling cho <b>cgroup này</b>.', 'Victim scope là các process killable trong cgroup vượt limit, không phải cuộc thi giữa mọi Pod trên Node.'), focus: ['cgroup', 'oom'], ...KIT.beat('cgroup', 'oom', 'danger', {link: {label: 'trigger memcg OOM'}, mark: ['danger', 'memcg OOM'], dy: 3.0})},
      {title: 'Kernel gửi SIGKILL tới process main đã khai sẵn', desc: KIT.desc('Victim là process có role <code>' + run.process.role + '</code>, được khai từ initial snapshot chứ không xuất hiện sau action. Kernel gửi SIGKILL tới Linux task này, không kill Pod object.', 'Vì victim là container init/main process, container instance #1 mới thực sự kết thúc. Nếu victim chỉ là child process thì model không được phép suy ra container restart.'), focus: ['oom', 'process'], ...mergeBeatState(KIT.beat('oom', 'process', 'danger', {link: {label: 'SIGKILL'}, mark: ['danger', 'main process victim'], dy: 2.4}), {process: {label: 'PID 1 · main\nSIGKILL · exit 137'}})},
      {title: 'OOM reaper thu hồi address space', desc: KIT.desc('Sau khi chọn victim, kernel đánh thức <b>OOM reaper</b> để thu hồi address space của process và giúp giải phóng bộ nhớ sớm.', 'OOM reaper là Linux kernel helper; nó không phải kubelet hay Kubernetes controller.'), focus: ['oom', 'reaper'], ...KIT.beat('oom', 'reaper', 'warn', {link: {label: 'wake reaper'}, mark: ['warn', 'reclaim victim memory'], dy: 2.8})}
    ]},
    {title: 'Kubernetes ghi nhận OOMKilled', pipelineStep: 3, focus: ['runtime', 'kubelet', 'apiserver'], phases: [
      {title: 'Kubelet hỏi runtime qua CRI', desc: KIT.desc('Trong vòng reconcile, kubelet chủ động gọi CRI để đọc trạng thái container. Đây là ranh giới giữa Linux process lifecycle và Kubernetes reconciliation.', 'Runtime không quyết định victim và cũng không tự gọi ngược kubelet.'), focus: ['kubelet', 'runtime'], ...KIT.beat('kubelet', 'runtime', 'info', {link: {label: 'CRI ContainerStatus'}, mark: ['info', 'status requested'], dy: 3.0})},
      {title: 'Runtime trả terminated status kèm OOM evidence', desc: KIT.desc('Runtime báo container instance #1 đã kết thúc với exit code <b>137</b> và bằng chứng OOM termination đã được khai trong assumptions.', 'Exit 137 một mình không đủ chứng minh OOMKilled; model chỉ cho phép ghi reason này khi runtime evidence tồn tại.'), focus: ['runtime', 'kubelet'], ...KIT.beat('runtime', 'kubelet', 'warn', {link: {label: 'terminated · OOM evidence'}, mark: ['warn', 'OOM termination observed'], dy: 3.0})},
      {title: 'Kubelet cập nhật Pod status', desc: KIT.desc('Kubelet cập nhật <code>containerStatuses[*].state.terminated.reason: OOMKilled</code> qua API Server.', '<code>OOMKilled</code> là container termination reason, không phải Pod phase. Nó cũng khác <code>Evicted</code>, quyết định chủ động của kubelet khi node pressure.'), focus: ['kubelet', 'apiserver', 'pod'], ...mergeBeatState(KIT.beat('kubelet', 'apiserver', 'danger', {link: {label: 'PATCH pods/status'}, mark: ['danger', 'OOMKilled recorded'], dy: 3.0}), {pod: KIT.mark('danger', 'container OOMKilled', {label: 'Burstable Pod\ncontainer: OOMKilled', dy: 2.4})})}
    ]},
    {title: 'Kubelet tạo container instance mới', pipelineStep: 4, focus: ['kubelet', 'runtime', 'process'], phases: [
      {title: 'Resource restartPolicy yêu cầu chạy instance mới', desc: KIT.desc('<code>restartPolicy: ' + run.pod.restartPolicy + '</code> đã nằm trên Pod từ trạng thái đầu. Vì main process chết, evaluator mới cho phép kubelet tạo và start một <b>container instance mới</b>.', 'Không có ReplicaSet hay scheduler tham gia vì Pod không bị thay thế. Nếu policy là Never hoặc victim chỉ là child process, nhánh restart này không hợp lệ.'), focus: ['kubelet', 'runtime'], ...KIT.beat('kubelet', 'runtime', 'ok', {link: {label: 'CRI create + start'}, mark: ['ok', 'restart derived from spec'], dy: 3.0})},
      {title: 'Process #2 chạy trong cùng Pod', desc: KIT.desc('Runtime tạo process mới cho container instance #2. Container ID thay đổi, nhưng Pod UID giữ nguyên và <code>restartCount</code> tăng lên <b>1</b>.', 'Nếu memory limit vẫn quá thấp, OOM → restart sẽ lặp lại; back-off có thể khiến trạng thái hiển thị thành CrashLoopBackOff.'), focus: ['runtime', 'process', 'pod'], ...mergeBeatState(KIT.beat('runtime', 'process', 'ok', {link: {label: 'spawn new process'}, mark: ['live', 'same Pod · new instance'], dy: 2.4}), {process: {label: 'app process #2\nRunning · restartCount 1'}, pod: KIT.mark('live', 'Running · restart 1', {label: 'Burstable Pod\nRunning · restarts 1', dy: 2.4})})}
    ]}
  ];
};
})();
