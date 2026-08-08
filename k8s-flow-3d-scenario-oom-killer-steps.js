(function() {
const KIT = window.SCENE_KIT, M = window.OOM_KILLER_MODEL;
window.createOomKillerSteps = function(run) {
  const f = M.fmtMi;
  return [
    {title: 'Một container sắp xin nhiều RAM hơn mức cho phép', pipelineStep: 0, focus: ['burstable-process', 'cgroup'],
      phases: [{title: 'Container này sắp chạm trần bộ nhớ',
        desc: KIT.desc('Container Burstable có memory limit <b>' + f(run.limitMi) + '</b>, nhưng sắp xin cấp thêm <b>' + f(run.allocationMi) + '</b> — cộng dồn sẽ vượt xa limit.', 'Khi đó ai đó phải giết một process để cluster không sập vì cạn RAM. Trước khi tới pha đó, kịch bản này cho xem Kubernetes đã <i>chuẩn bị sẵn</i> gì từ lúc container mới khởi động — chính là cấu hình quyết định process nào bị chọn.'),
        focus: ['burstable-process', 'cgroup'], ...KIT.beat('burstable-process', 'cgroup', 'warn', {mark: ['warn', 'sắp cấp phát vượt limit'], dy: 2.8})}]},
    {title: 'Kubelet gắn "điểm ưu tiên sống sót" cho container', pipelineStep: 0, focus: ['kubelet', 'runtime'],
      phases: [{title: 'Kubelet gửi cấu hình OOM cho runtime',
        desc: KIT.desc('Kubelet suy ra QoS từ resources của Pod, rồi tính <code>oom_score_adj</code> cho từng container trước khi runtime tạo process.', 'Pod Burstable này: <code>1000 − 1000 × ' + f(run.requestMi) + '/' + f(run.nodeCapacityMi) + ' = ' + run.burstableAdj + '</code> (clamp 2..999). BestEffort là <code>1000</code>; Guaranteed là <code>-997</code>. PriorityClass không nằm trong phép tính này.'),
        focus: ['kubelet', 'runtime'], ...KIT.beat('kubelet', 'runtime', 'info', {mark: ['info', 'OOM settings received'], dy: 3.0})}]},
    {title: 'Runtime áp giới hạn bộ nhớ lên cgroup', pipelineStep: 0, focus: ['runtime', 'cgroup'],
      phases: [{title: 'Runtime khai báo memory.max cho cgroup',
        desc: KIT.desc('Runtime tạo container process trong Linux cgroup và áp memory limit của Pod thành <code>memory.max=' + f(run.limitMi) + '</code>.', 'Kịch bản này scope tới <b>cgroup v2</b>. Cờ kubelet <code>singleProcessOOMKill=true</code> giữ hành vi kill một process; nếu dùng group OOM, nhiều process killable trong <i>cùng cgroup</i> có thể bị kill chung.'),
        focus: ['runtime', 'cgroup'], ...KIT.beat('runtime', 'cgroup', 'info', {mark: ['info', 'memory.max applied'], dy: 2.8})}]},
    {title: 'Container vượt limit — kernel ra tay', pipelineStep: 1, focus: ['burstable-process', 'cgroup'],
      phases: [
        {title: 'App xin thêm bộ nhớ, vượt luôn giới hạn', desc: KIT.desc('App process xin thêm <b>' + f(run.allocationMi) + '</b>. Linux memory controller charge phần này vào cgroup của container.', f(run.usedMi) + ' + ' + f(run.allocationMi) + ' = <b>' + f(run.projectedMi) + '</b>, vượt limit <b>' + f(run.limitMi) + '</b> đúng <b>' + f(run.excessMi) + '</b>. Đây là <b>memcg OOM</b>, không phải kubelet eviction.'), focus: ['burstable-process', 'cgroup'], scoreMode: true, scoreTitle: 'container cgroup limit', scores: [KIT.gauge('used', run.usedMi, run.limitMi, 'Mi', {tone: 'warn'}), KIT.gauge('requested', run.projectedMi, run.limitMi, 'Mi', {tone: 'danger'}), KIT.gauge('memory.max', run.limitMi, run.limitMi, 'Mi')], ...KIT.beat('burstable-process', 'cgroup', 'danger', {mark: ['danger', 'limit exceeded'], dy: 2.8})},
        {title: 'Cgroup gọi kernel OOM killer vào cuộc', desc: KIT.desc('Cgroup không thể cấp thêm bộ nhớ trong giới hạn đã cấu hình, nên kernel bắt đầu xử lý OOM cho <b>cgroup đó</b>.', 'Vùng chọn nạn nhân của memcg OOM là cgroup vượt limit; không phải cuộc thi BestEffort/Burstable/Guaranteed trên toàn Node.'), focus: ['cgroup', 'oom'], ...KIT.beat('cgroup', 'oom', 'danger', {mark: ['danger', 'memcg OOM'], dy: 3.0})},
        {title: 'Kernel giết process — SIGKILL', desc: KIT.desc('Kernel chọn và gửi SIGKILL tới một <b>Linux process</b> trong cgroup bị OOM. Pod object không phải thứ kernel kill.', 'Container kết thúc vì process chính đã chết; Kubernetes sẽ ghi nhận hậu quả ở bước sau.'), focus: ['oom', 'burstable-process'], ...KIT.beat('oom', 'burstable-process', 'danger', {mark: ['danger', 'SIGKILL · OOM victim'], dy: 2.4})},
        {title: 'OOM reaper dọn dẹp bộ nhớ nạn nhân', desc: KIT.desc('Sau khi chọn nạn nhân, kernel đánh thức <b>OOM reaper</b> để giải phóng address space của process đó ngay.', 'OOM reaper là Linux kernel helper, không phải controller Kubernetes và không chọn Pod thay kubelet.'), focus: ['oom', 'reaper'], ...KIT.beat('oom', 'reaper', 'warn', {mark: ['warn', 'reclaiming victim memory'], dy: 2.8})}
      ]},
    {title: 'Tình huống khác: cả Node cạn RAM', pipelineStep: 2, focus: ['allocator', 'oom'],
      phases: [
        {title: 'Node hết RAM — một sự cố riêng biệt', desc: KIT.desc('Đây là <b>nhánh khác</b>, không phải bước tiếp theo của memcg OOM ở trên: toàn Node chỉ còn <b>' + f(run.globalAvailableMi) + '</b>, nhưng cần <b>' + f(run.globalRequestMi) + '</b> sau khi reclaim vẫn không đủ.', 'Global OOM không cần container nào vượt limit riêng. Kernel chọn nạn nhân trong toàn node bằng badness thực tế + <code>oom_score_adj</code>.'), focus: ['allocator', 'oom'], scoreMode: true, scoreTitle: 'global allocation pressure · alternative', scores: [KIT.gauge('available', run.globalAvailableMi, run.nodeCapacityMi, 'Mi', {tone: 'danger'}), KIT.gauge('allocation', run.globalRequestMi, run.nodeCapacityMi, 'Mi', {tone: 'warn'})], ...KIT.beat('allocator', 'oom', 'danger', {mark: ['danger', 'global OOM'], dy: 3.0})},
        {title: 'Process "kém bảo vệ" nhất bị chọn trước', desc: KIT.desc('Trong ví dụ global OOM này, kernel chọn <b>worker process</b> của BestEffort Pod. <code>oom_score_adj=1000</code> khiến nó kém bảo vệ hơn Burstable <code>' + run.burstableAdj + '</code> và Guaranteed <code>-997</code>.', 'Đây là xu hướng, không phải luật tuyệt đối: badness còn phụ thuộc memory usage và kernel state. PriorityClass không nằm trong luật xếp hạng global-OOM.'), focus: ['oom', 'best-effort-process', 'guaranteed-process'], ...KIT.beat('oom', 'best-effort-process', 'danger', {mark: ['danger', 'SIGKILL · global victim'], dy: 2.4})}
      ]},
    {title: 'Kubelet ghi nhận hậu quả', pipelineStep: 3, focus: ['runtime', 'kubelet', 'apiserver'],
      phases: [
        {title: 'Kubelet hỏi runtime: container sao rồi?', desc: KIT.desc('Trở lại vụ <b>container limit OOM</b>: kubelet gọi CRI để đọc ContainerStatus. Kubelet là bên chủ động hỏi; runtime không tự gọi ngược lại.', 'Đây là ranh giới giữa Linux process lifecycle và Kubernetes reconciliation.'), focus: ['kubelet', 'runtime'], ...KIT.beat('kubelet', 'runtime', 'info', {mark: ['info', 'ContainerStatus requested'], dy: 3.0})},
        {title: 'Runtime báo container đã chết', desc: KIT.desc('Runtime trả status của process đã exit cho kubelet qua CRI.', 'Đây chỉ là phản hồi cho câu hỏi của kubelet; kernel đã quyết định kill từ trước.'), focus: ['runtime', 'kubelet'], ...KIT.beat('runtime', 'kubelet', 'warn', {mark: ['warn', 'container terminated'], dy: 3.0})},
        {title: 'Kubelet ghi OOMKilled lên Pod status', desc: KIT.desc('Kubelet ghi <code>containerStatuses[*].state.terminated.reason: OOMKilled</code> lên Pod status qua API Server.', '<code>OOMKilled</code> nghĩa là kernel đã kill container process — khác <code>Evicted</code>, một quyết định chủ động của kubelet khi node pressure.'), focus: ['kubelet', 'apiserver'], ...KIT.beat('kubelet', 'apiserver', 'danger', {mark: ['danger', 'OOMKilled recorded'], dy: 3.0})}
      ]},
    {title: 'Container tự khởi động lại', pipelineStep: 4, focus: ['kubelet', 'runtime', 'burstable-process'],
      phases: [
        {title: 'Kubelet yêu cầu runtime restart container', desc: KIT.desc('Với <code>restartPolicy: Always</code>, kubelet reconcile Pod rồi yêu cầu runtime khởi chạy lại container.', 'Không có ReplicaSet hay scheduler nào tham gia việc restart container trong cùng Pod.'), focus: ['kubelet', 'runtime'], ...KIT.beat('kubelet', 'runtime', 'ok', {mark: ['ok', 'restart requested'], dy: 3.0})},
        {title: 'Process mới thay thế process đã chết', desc: KIT.desc('Runtime tạo process mới cho <b>cùng container</b>. Component process quay về Running để nhấn mạnh đây không phải Pod mới.', 'Nếu memory limit vẫn quá thấp, chuỗi OOM → restart có thể lặp lại và back-off dần thành CrashLoopBackOff.'), focus: ['runtime', 'burstable-process'], ...KIT.beat('runtime', 'burstable-process', 'ok', {mark: ['live', 'restarted'], dy: 2.4})}
      ]}
  ];
};
})();
