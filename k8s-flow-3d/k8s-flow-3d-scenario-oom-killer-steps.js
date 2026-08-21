/* Container-limit OOM — 5 steps / 12 phases. The scenario's whole thesis:
   exit 137 alone does not prove OOMKilled; the evidence chain does. That
   conclusion has to survive past the phase that produces it, so `cgroup`
   carries status 'full' from the failed charge onward, and `process`/`pod`
   carry 'killed' once the kernel and Kubernetes agree the container is
   gone — see the mergeBeatState() calls below (shared helper — see
   k8s-flow-3d-scenario-oom-shared-step-helpers.js). */
(function() {
const KIT = window.SCENE_KIT;
const M = window.OOM_KILLER_MODEL;
const mergeBeatState = window.mergeBeatState;

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
    /* ── STEP ①: Kubernetes chuẩn bị container ── */
    {
      title: 'Kubernetes chuẩn bị container',
      pipelineStep: 0,
      focus: ['kubelet', 'runtime', 'cgroup'],
      phases: [
        {
          title: 'Resource spec đã quyết định QoS và cấu hình OOM',
          desc: KIT.desc(
            'Pod khai limit rồi — QoS và oom_score_adj đã được quyết từ trước khi container chạy.',
            'Ngay từ trạng thái đầu, Pod đã khai <b>memory request ' + f(requestMi) + '</b>, <b>limit ' + f(limitMi) + '</b>, CPU request/limit đều không khai và <code>restartPolicy: ' + run.pod.restartPolicy + '</code>. Model tự suy ra QoS <b>' + run.pod.qosClass + '</b> rồi tính <code>oom_score_adj=' + run.process.oomScoreAdj + '</code>.',
            'QoS không tự nhiên mà có — nó suy thẳng từ requests/limits Pod khai báo, xong mới ra <code>oom_score_adj</code>. Nhầm PriorityClass với QoS là lỗi chẩn đoán phổ biến nhất khi debug OOMKilled.'
          ),
          focus: ['pod', 'kubelet', 'runtime'],
          labels: ['pod', 'kubelet'],
          explain: [
            {of: 'pod', tone: 'info', text: 'Pod khai <b>memory request ' + f(requestMi) + '</b>, <b>limit ' + f(limitMi) + '</b>; CPU request/limit đều không khai. <code>restartPolicy: ' + run.pod.restartPolicy + '</code> cũng nằm trên spec từ đầu.'},
            {of: 'kubelet', tone: 'mute', text: 'Từ đó kubelet suy ra QoS <b>' + run.pod.qosClass + '</b> rồi tính <code>oom_score_adj=' + run.process.oomScoreAdj + '</code> — hai bước nối tiếp nhau, không phải nhãn tự gắn tùy tiện; PriorityClass thông thường không phải input trực tiếp.'}
          ],
          ...mergeBeatState(
            KIT.beat('kubelet', 'runtime', 'info', {link: {label: 'derived OOM config'}, mark: ['info', 'oom_score_adj ' + run.process.oomScoreAdj], dy: 3.0}),
            {pod: {status: 'running'}}
          )
        },
        {
          title: 'Cgroup mode cũng tồn tại trước allocation',
          desc: KIT.desc(
            'Runtime đã tạo cgroup v2 với <code>memory.max=' + f(limitMi) + '</code> và <code>memory.oom.group=' + run.cgroup.memoryOomGroup + '</code>. Giá trị này khớp kubelet <code>singleProcessOOMKill=' + run.resources.kubelet.singleProcessOOMKill + '</code>.',
            'Cấu hình này đã có sẵn từ trước, không phải cái gì mới thêm vào lúc process chạm limit. Với <code>memory.oom.group=0</code>, kernel chọn riêng một task killable trong cgroup.'
          ),
          focus: ['runtime', 'cgroup', 'process'],
          labels: ['cgroup', 'runtime'],
          explain: [
            {of: 'runtime', tone: 'info', text: 'Runtime đã tạo cgroup v2 với <code>memory.max=' + f(limitMi) + '</code> và <code>memory.oom.group=' + run.cgroup.memoryOomGroup + '</code> — khớp kubelet <code>singleProcessOOMKill=' + run.resources.kubelet.singleProcessOOMKill + '</code>.'},
            {of: 'cgroup', tone: 'mute', text: 'Cấu hình này đã có sẵn từ trước, không phải mới thêm vào lúc process chạm limit. Với <code>memory.oom.group=0</code>, kernel chọn riêng một task killable trong cgroup.'}
          ],
          ...KIT.beat('runtime', 'cgroup', 'info', {link: {label: 'existing cgroup config'}, mark: ['info', 'max + group already set'], dy: 2.8})
        }
      ]
    },

    /* ── STEP ②: Process chạm giới hạn cgroup ── */
    {
      title: 'Process chạm giới hạn cgroup',
      pipelineStep: 1,
      focus: ['process', 'cgroup'],
      phases: [
        {
          title: 'Initial snapshot đã ghi usage và allocation kế tiếp',
          desc: KIT.desc(
            'PID 1 đang dùng <b>' + f(usedMi) + '</b>; event đã khai từ đầu rằng chính process này sẽ xin thêm <b>' + f(allocationMi) + '</b>. Pod vẫn Running và chưa có OOM kill.',
            'Usage là số đo tại thời điểm này; request, limit, process role và restart policy đều đã cố định trong spec, không đổi theo usage.'
          ),
          focus: ['process', 'cgroup'],
          labels: ['process', 'cgroup'],
          scoreMode: true,
          scoreTitle: 'container memory before allocation',
          scores: [KIT.gauge('used', usedMi, limitMi, 'Mi', {tone: 'warn'}), KIT.gauge('memory.max', limitMi, limitMi, 'Mi')],
          explain: [
            {of: 'process', tone: 'warn', text: 'PID 1 đang dùng <b>' + f(usedMi) + '</b>, và chính process này sắp xin thêm <b>' + f(allocationMi) + '</b> — không phải allocation mới phát sinh giữa chừng.'},
            {of: 'cgroup', tone: 'mute', text: 'Pod vẫn <b>Running</b> và chưa có OOM kill nào. Usage là số đo tại thời điểm này; request, limit, process role và restart policy đều đã cố định trong spec.'}
          ],
          ...mergeBeatState(
            KIT.beat('process', 'cgroup', 'warn', {link: {label: 'memory charged'}, mark: ['warn', f(usedMi) + ' used'], dy: 2.8}),
            {process: {status: 'running'}}
          )
        },
        {
          title: 'Charge thất bại sau reclaim — memcg OOM bắt đầu từ đây',
          desc: KIT.desc(
            'Process thực hiện allocation <b>' + f(allocationMi) + '</b>. Phép cộng cho gauge là ' + f(usedMi) + ' + ' + f(allocationMi) + ' = <b>' + f(run.charge.projectedMi) + '</b>, vượt <code>memory.max</code> <b>' + f(run.charge.excessMi) + '</b>.',
            'Phép cộng vượt limit không tự động nghĩa là memcg OOM — kernel phải thử reclaim trước. Ở đây reclaim không đủ, kernel ghi nhận <code>oomEntered=true</code>: đây là container OOM (memcg), khác kubelet eviction hay global OOM.'
          ),
          focus: ['process', 'cgroup'],
          labels: ['process', 'cgroup'],
          scoreMode: true,
          scoreTitle: 'authored failed charge after reclaim',
          scores: [KIT.gauge('used', usedMi, limitMi, 'Mi', {tone: 'warn'}), KIT.gauge('requested', run.charge.projectedMi, limitMi, 'Mi', {tone: 'danger'}), KIT.gauge('memory.max', limitMi, limitMi, 'Mi')],
          explain: [
            {of: 'process', tone: 'warn', text: 'Process thực hiện allocation <b>' + f(allocationMi) + '</b>. Gauge cộng ' + f(usedMi) + ' + ' + f(allocationMi) + ' = <b>' + f(run.charge.projectedMi) + '</b>, vượt <code>memory.max</code> <b>' + f(run.charge.excessMi) + '</b>.'},
            {of: 'cgroup', tone: 'danger', text: 'Nhưng phép cộng đó <b>không tự chứng minh</b> memcg OOM — kernel phải thử reclaim trước, và ở đây reclaim không đủ.'},
            {of: 'cgroup', tone: 'mute', text: '<code>oomEntered=true</code> là tín hiệu kernel ghi lại, không phải suy luận từ số học. Đây cũng không phải kubelet eviction hay global OOM — phạm vi vẫn nằm trong một cgroup.'}
          ],
          ...KIT.beat('process', 'cgroup', 'danger', {link: {label: 'explicit failed charge'}, mark: ['danger', 'memcg OOM premise'], dy: 2.8, status: 'full'})
        }
      ]
    },

    /* ── STEP ③: Kernel xử lý memcg OOM ── */
    {
      title: 'Kernel xử lý memcg OOM',
      pipelineStep: 2,
      focus: ['cgroup', 'oom', 'process'],
      phases: [
        {
          title: 'Cgroup kích hoạt OOM trong phạm vi của nó',
          desc: KIT.desc(
            'Allocation không thể được đáp ứng bên trong <code>memory.max</code>, nên kernel bắt đầu OOM handling cho <b>cgroup này</b>.',
            'Victim scope là các process killable trong cgroup vượt limit, không phải cuộc thi giữa mọi Pod trên Node.'
          ),
          focus: ['cgroup', 'oom'],
          labels: ['cgroup', 'oom'],
          explain: [
            {of: 'cgroup', tone: 'danger', text: 'Allocation không thể được đáp ứng bên trong <code>memory.max</code>, nên kernel bắt đầu OOM handling cho <b>cgroup này</b>.'},
            {of: 'oom', tone: 'mute', text: 'Victim scope là các process killable trong cgroup vượt limit — không phải cuộc thi giữa mọi Pod trên Node.'}
          ],
          ...KIT.beat('cgroup', 'oom', 'danger', {link: {label: 'trigger memcg OOM'}, mark: ['danger', 'memcg OOM'], dy: 3.0})
        },
        {
          title: 'Kernel gửi SIGKILL tới process main đã khai sẵn',
          desc: KIT.desc(
            'Victim là process có role <code>' + run.process.role + '</code>, đã tồn tại từ trước chứ không phải ai đó mới xuất hiện. Kernel gửi SIGKILL tới Linux task này, không kill Pod object.',
            'Vì victim là container init/main process, container instance #1 mới thực sự kết thúc. Nếu victim chỉ là child process thì model không được phép suy ra container restart.'
          ),
          focus: ['oom', 'process'],
          labels: ['oom', 'process'],
          explain: [
            {of: 'process', tone: 'danger', text: 'Victim là process có role <code>' + run.process.role + '</code>, đã tồn tại từ trước — không phải ai đó mới xuất hiện.'},
            {of: 'oom', tone: 'mute', text: 'Kernel gửi <b>SIGKILL</b> tới Linux task này, không kill Pod object. Vì victim là container init/main process, container instance #1 mới thực sự kết thúc.'}
          ],
          ...KIT.beat('oom', 'process', 'danger', {
            link: {label: 'SIGKILL'}, mark: ['danger', 'main process victim'], dy: 2.4,
            label: 'PID 1 · main\nSIGKILL · exit 137', status: 'killed'
          })
        },
        {
          title: 'OOM reaper thu hồi address space',
          desc: KIT.desc(
            'Sau khi chọn victim, kernel đánh thức <b>OOM reaper</b> để thu hồi address space của process và giúp giải phóng bộ nhớ sớm.',
            'OOM reaper là Linux kernel helper; nó không phải kubelet hay Kubernetes controller.'
          ),
          focus: ['oom', 'reaper'],
          labels: ['oom', 'reaper'],
          explain: [
            {of: ['oom', 'reaper'], tone: 'warn', text: 'Sau khi chọn victim ở nhịp trước, kernel đánh thức <b>OOM reaper</b> để thu hồi address space của process và giúp giải phóng bộ nhớ sớm.'},
            {of: 'reaper', tone: 'mute', text: 'OOM reaper là Linux kernel helper; nó không phải kubelet hay Kubernetes controller.'}
          ],
          ...KIT.beat('oom', 'reaper', 'warn', {link: {label: 'wake reaper'}, mark: ['warn', 'reclaim victim memory'], dy: 2.8})
        }
      ]
    },

    /* ── STEP ④: Kubernetes ghi nhận OOMKilled ── */
    {
      title: 'Kubernetes ghi nhận OOMKilled',
      pipelineStep: 3,
      focus: ['runtime', 'kubelet', 'apiserver'],
      phases: [
        {
          title: 'Kubelet hỏi runtime qua CRI',
          desc: KIT.desc(
            'Trong vòng reconcile, kubelet chủ động gọi CRI để đọc trạng thái container. Đây là ranh giới giữa Linux process lifecycle và Kubernetes reconciliation.',
            'Runtime không quyết định victim và cũng không tự gọi ngược kubelet.'
          ),
          focus: ['kubelet', 'runtime'],
          labels: ['kubelet', 'runtime'],
          explain: [
            {of: 'kubelet', tone: 'info', text: 'Trong vòng reconcile, kubelet chủ động gọi CRI để đọc trạng thái container — ranh giới giữa Linux process lifecycle và Kubernetes reconciliation.'},
            {of: 'runtime', tone: 'mute', text: 'Runtime không quyết định victim và cũng không tự gọi ngược kubelet.'}
          ],
          ...KIT.beat('kubelet', 'runtime', 'info', {link: {label: 'CRI ContainerStatus'}, mark: ['info', 'status requested'], dy: 3.0})
        },
        {
          title: 'Runtime trả terminated status kèm OOM evidence',
          desc: KIT.desc(
            'Runtime báo container instance #1 đã kết thúc với exit code <b>137</b>, kèm bằng chứng OOM termination — dmesg/cgroup event ghi nhận đúng lý do.',
            'Exit 137 một mình không đủ chứng minh OOMKilled — kubelet chỉ ghi reason này khi có bằng chứng OOM đi kèm từ runtime, không suy ra chỉ từ exit code.'
          ),
          focus: ['runtime', 'kubelet'],
          labels: ['runtime', 'kubelet'],
          explain: [
            {of: 'runtime', tone: 'warn', text: 'Runtime báo container instance #1 đã kết thúc với exit code <b>137</b>, kèm bằng chứng OOM termination — dmesg/cgroup event ghi nhận đúng lý do.'},
            {of: 'runtime', tone: 'danger', text: '<b>Exit 137 một mình không đủ chứng minh</b> OOMKilled.'},
            {of: 'kubelet', tone: 'mute', text: 'Kubelet chỉ ghi reason này khi có bằng chứng OOM từ runtime — không suy ra chỉ từ exit code.'}
          ],
          ...KIT.beat('runtime', 'kubelet', 'warn', {link: {label: 'terminated · OOM evidence'}, mark: ['warn', 'OOM termination observed'], dy: 3.0})
        },
        {
          title: 'Kubelet cập nhật Pod status',
          desc: KIT.desc(
            'Kubelet cập nhật <code>containerStatuses[*].state.terminated.reason: OOMKilled</code> qua API Server.',
            '<code>OOMKilled</code> là container termination reason, không phải Pod phase. Nó cũng khác <code>Evicted</code>, quyết định chủ động của kubelet khi node pressure.'
          ),
          focus: ['kubelet', 'apiserver', 'pod'],
          labels: ['kubelet', 'apiserver', 'pod'],
          explain: [
            {of: ['kubelet', 'apiserver'], tone: 'danger', text: 'Kubelet cập nhật <code>containerStatuses[*].state.terminated.reason: OOMKilled</code> qua API Server.'},
            {of: 'pod', tone: 'mute', text: '<code>OOMKilled</code> là container termination reason, không phải Pod phase — khác <code>Evicted</code>, quyết định chủ động của kubelet khi node pressure.'}
          ],
          ...mergeBeatState(
            KIT.beat('kubelet', 'apiserver', 'danger', {link: {label: 'PATCH pods/status'}, mark: ['danger', 'OOMKilled recorded'], dy: 3.0}),
            {pod: KIT.mark('danger', 'container OOMKilled', {label: 'Burstable Pod\ncontainer: OOMKilled', dy: 2.4, status: 'killed'})}
          )
        }
      ]
    },

    /* ── STEP ⑤: Kubelet tạo container instance mới ── */
    {
      title: 'Kubelet tạo container instance mới',
      pipelineStep: 4,
      focus: ['kubelet', 'runtime', 'process'],
      phases: [
        {
          title: 'Resource restartPolicy yêu cầu chạy instance mới',
          desc: KIT.desc(
            '<code>restartPolicy: ' + run.pod.restartPolicy + '</code> đã nằm trên Pod từ trạng thái đầu. Vì main process chết, kubelet mới được phép tạo và start một <b>container instance mới</b>.',
            'Không có ReplicaSet hay scheduler tham gia vì Pod không bị thay thế. Nếu policy là Never hoặc victim chỉ là child process, nhánh restart này không hợp lệ.'
          ),
          focus: ['kubelet', 'runtime'],
          labels: ['kubelet', 'runtime'],
          explain: [
            {of: 'kubelet', tone: 'ok', text: '<code>restartPolicy: ' + run.pod.restartPolicy + '</code> đã nằm trên Pod từ trạng thái đầu. Vì main process chết, kubelet mới được phép tạo và start một <b>container instance mới</b>.'},
            {of: 'runtime', tone: 'mute', text: 'Không có ReplicaSet hay scheduler tham gia vì Pod không bị thay thế. Nếu policy là Never hoặc victim chỉ là child process, nhánh restart này không hợp lệ.'}
          ],
          ...KIT.beat('kubelet', 'runtime', 'ok', {link: {label: 'CRI create + start'}, mark: ['ok', 'restart derived from spec'], dy: 3.0})
        },
        {
          title: 'Process #2 chạy trong cùng Pod',
          desc: KIT.desc(
            'Runtime tạo process mới cho container instance #2. Container ID thay đổi, nhưng Pod UID giữ nguyên và <code>restartCount</code> tăng lên <b>1</b>.',
            'Nếu memory limit vẫn quá thấp, OOM → restart sẽ lặp lại; back-off có thể khiến trạng thái hiển thị thành CrashLoopBackOff.'
          ),
          focus: ['runtime', 'process', 'pod'],
          labels: ['runtime', 'process', 'pod'],
          explain: [
            {of: 'runtime', tone: 'ok', text: 'Runtime tạo process mới cho container instance #2. Container ID thay đổi, nhưng Pod UID giữ nguyên.'},
            {of: ['process', 'pod'], tone: 'live', text: '<b>Cùng một Pod, một container instance mới</b> — không phải Pod mới, không phải scheduler chạy lại. <code>restartCount</code> tăng lên <b>1</b>.'},
            {of: 'pod', tone: 'mute', text: 'Nếu memory limit vẫn quá thấp, OOM → restart sẽ lặp lại; back-off có thể khiến trạng thái hiển thị thành CrashLoopBackOff.'}
          ],
          ...mergeBeatState(
            KIT.beat('runtime', 'process', 'ok', {link: {label: 'spawn new process'}, mark: ['live', 'same Pod · new instance'], dy: 2.4}),
            {
              process: {label: 'app process #2\nRunning · restartCount 1', status: 'running'},
              pod: KIT.mark('live', 'Running · restart 1', {label: 'Burstable Pod\nRunning · restarts 1', dy: 2.4, status: 'running'})
            }
          )
        }
      ]
    }
  ];
};
})();
