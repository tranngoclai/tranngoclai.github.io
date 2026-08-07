/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — BIND & NODE (steps ⑥–⑨)

   Continues k8s-flow-3d-scenario-scheduler-pipeline-control-plane.js. Same
   phase model: one phase = one explanation + one action. Step ⑥ is the
   handover point — everything after it happens on the worker Node.
══════════════════════════════════════════════ */
window.SCHED_STEPS_NODE = [

/* ── STEP ⑥: Bind ── */
{
  title: '⑥ Bind — chốt Node bằng một dòng spec.nodeName',
  pipelineStep: 4,
  focus: ['scheduler', 'apiserver', 'etcd', 'pod-object'],
  cam: [-8, 1, 0], dist: 30,
  phases: [
    {
      title: 'Pod rời ActiveQ — và scheduler “assume” nó đã nằm trên Worker A',
      desc: '<span class="lead">Pod được pop khỏi <span class="hi">ActiveQ</span>. Trước khi gọi bind thật, scheduler làm một việc tinh tế: <b>assume</b>.</span>'
          + 'Nó cập nhật ngay <b>cache nội bộ</b> của mình — coi như Pod đã chiếm tài nguyên trên Worker A — <b>trước khi</b> API Server xác nhận bất cứ điều gì.'
          + '<span class="why"><b>Vì sao cần assume:</b> bind là một network call, mất vài chục ms. Nếu trong lúc đó scheduler xử lý Pod tiếp theo mà cache vẫn báo Worker A còn trống, nó sẽ <b>phát cùng chỗ đó cho hai Pod</b>. Assume giữ cho các quyết định liên tiếp không giẫm lên nhau. Nếu bind fail, cache được rollback (<i>unassume</i>) và Pod quay lại queue.</span>',
      hide: ['q-pod-hi'],
      hideAt: { 'q-pod-hi': 0.55 },
      set: { 'q-pod-hi': { badge: 'popped khỏi ActiveQ', flash: '#8b6cff', dy: 2.6 } },
      scene(a) {
        a.note('assume: cache ghi trước, bind sau', -6.4, 4.4, 6.2, '#8b6cff', 0.2);
      }
    },
    {
      title: 'POST .../binding — toàn bộ việc scheduler làm là ghi một chuỗi',
      desc: '<span class="lead">Scheduler gọi <code>POST /api/v1/namespaces/default/pods/{name}/binding</code> — một sub-resource chuyên dụng chỉ để gắn Pod vào Node.</span>'
          + 'Đó là <b>tất cả</b>. Scheduler <span class="danger">không tạo container, không nói chuyện với Node, không SSH đi đâu cả.</span> '
          + 'Sau lời gọi này, công việc của nó với Pod đã kết thúc hoàn toàn.'
          + '<span class="why"><b>Rút gọn lại:</b> kube-scheduler là một chương trình đọc trạng thái cluster, chạy Filter + Score, rồi <b>viết đúng một chuỗi ký tự vào một field</b>. Mọi thứ phức tạp phía sau đều do component khác phản ứng với chuỗi đó.</span>',
      set: { 'apiserver': { at: 1.30, badge: 'POST .../binding ✓', flash: '#3a7fff' } },
      scene(a) {
        a.flow([[-9, 2.7, 6.2], [-9, 4.9, 4.4], [-9, 3.2, 2.2]], '#3a7fff', {at: 0.30, dur: 1.05, loop: 3.8});
        a.note('POST .../pods/{name}/binding', -5.2, 4.8, 4, '#3a7fff', 0.2);
      }
    },
    {
      title: 'etcd ghi nodeName — nhưng Pod vẫn còn Pending',
      desc: '<span class="lead">API Server persist <code>spec.nodeName = "worker-a"</code> xuống etcd. Pod object đổi trạng thái.</span>'
          + 'Nhưng chú ý dòng phase: Pod <b>vẫn là</b> <span class="warn">Pending</span>. Nó đã có Node, chưa có container nào chạy — vì kubelet trên Worker A còn chưa hay biết gì.'
          + '<span class="why"><b>Đây là ranh giới bàn giao</b> giữa Control Plane và Node, và là điểm mấu chốt của kiến trúc Kubernetes: các component <b>không gọi lẫn nhau</b>. Scheduler không báo cho kubelet. Nó chỉ ghi vào etcd, rồi bên nào quan tâm thì tự quan sát và phản ứng. Kiểu ghép nối lỏng này là lý do bạn có thể restart bất kỳ component nào mà hệ thống vẫn hội tụ.</span>',
      set: {
        'pod-object': { label: 'Pod\nnodeName: "worker-a"\nphase: Pending', col: '#2a2000', edge: '#7a6010',
                        at: 1.35, badge: 'nodeName ← worker-a', flash: '#c08000', dy: 1.1 }
      },
      scene(a) {
        a.flow([[-9, 3.2, -2.2], [-9, 4.8, -4.6], [-9, 3.0, -6.6]], '#c08000', {at: 0.30, dur: 1.05, loop: 3.8});
        a.note('⑥ vẫn Pending — chỉ đổi nodeName', -9, -2.8, -6, '#6a8ab0', 1.4);
      }
    }
  ]
},

/* ── STEP ⑦: kubelet WATCH ── */
{
  title: '⑦ kubelet nhận ra “Pod này là của tôi”',
  pipelineStep: 5,
  focus: ['apiserver', 'node-a', 'kubelet'],
  cam: [-1, 1, 5], dist: 34,
  phases: [
    {
      title: 'Mỗi kubelet chỉ watch đúng Pod của Node mình',
      desc: '<span class="lead">Mỗi Node chạy một <span class="hi">kubelet</span>, và mỗi kubelet cũng mở <code>List-Watch</code> riêng lên API Server — nhưng có <b>filter theo chính tên Node của nó</b>.</span>'
          + 'Cụ thể: <code>fieldSelector=spec.nodeName=worker-a</code>. Nhờ vậy kubelet chỉ nhận đúng những Pod thuộc về mình, không phải quét toàn cluster — cluster 5000 Node vẫn không làm kubelet nào bận thêm.'
          + '<span class="why">Cùng một mô hình Watch mà scheduler dùng ở bước ③, chỉ khác bộ lọc. <b>List-Watch là xương sống của toàn bộ Kubernetes</b> — controller, kubelet, kube-proxy, operator của bạn đều chạy đúng cơ chế này.</span>',
      scene(a) {
        a.flow([[-6.6, 2.4, 1.6], [-1, 5.0, 6], [4.6, 0.2, 9.4]], '#3a7fff', {at: 0.30, dur: 1.35, loop: 4.0});
        a.note('WATCH spec.nodeName=worker-a', -1.5, 5.8, 6, '#6aaaf8', 0.2);
      }
    },
    {
      title: 'Event MODIFIED bắn ra — kubelet nhận việc',
      desc: '<span class="lead">Khoảnh khắc bước ⑥ ghi <code>nodeName</code> xuống etcd, watch stream của Worker A lập tức bắn ra một event <code>MODIFIED</code>.</span>'
          + 'Thường chỉ <b>vài chục mili-giây</b> sau khi bind. Đây là lúc quyền điều khiển thực sự chuyển từ Control Plane xuống Node.'
          + '<span class="why">Không có hàng đợi message, không có broker, không có RPC từ scheduler xuống kubelet. Chỉ là <b>một field đổi giá trị trong etcd</b> và một watcher đang lắng nghe đúng field đó.</span>',
      set: {
        'kubelet': { label: 'kubelet\n✓ pod assigned', col: '#0a2418', edge: '#1a7040',
                     at: 0.55, badge: 'spec.nodeName == worker-a', flash: '#3a7fff', dy: 1.5 }
      },
      scene(a) {
        a.note('event MODIFIED → của tôi!', 6, -2.4, 9.4, '#6aaaf8', 0.3);
      }
    },
    {
      title: 'Chuẩn bị: image, volume, Secret, ConfigMap',
      desc: '<span class="lead">kubelet kéo về <b>full Pod spec</b> rồi chuẩn bị mọi thứ <b>trước khi</b> đụng tới container runtime.</span>'
          + 'Xác định image và <code>imagePullPolicy</code>, giải quyết <code>imagePullSecrets</code>, mount các <span class="warn">Volume / PVC</span>, và fetch nội dung <span class="warn">Secret · ConfigMap</span> mà container sẽ đọc qua env hoặc file.'
          + '<span class="why"><b>Mẹo debug quan trọng nhất trong toàn bộ pipeline:</b> đến đây scheduling đã <b>thành công</b> rồi. Nếu thiếu Secret, sai tên ConfigMap, PVC chưa bound hay không kéo được image, Pod sẽ đứng ở <code>ContainerCreating</code> / <code>ImagePullBackOff</code> — <b>không phải</b> <code>Pending</code>. Nên: <code>Pending</code> ⇒ lỗi ở scheduler (bước ④), <code>ContainerCreating</code> ⇒ lỗi ở kubelet/Node (bước ⑦–⑧). Nhìn phase là biết phải đi tìm ở đâu.</span>',
      scene(a) {
        a.note('⑦ image · volumes · Secrets · ConfigMaps', 6, -2.4, 9.4, '#6a8ab0', 0.2);
      }
    }
  ]
},

/* ── STEP ⑧: CRI ── */
{
  title: '⑧ containerd dựng và chạy container',
  pipelineStep: 5,
  focus: ['node-a', 'kubelet', 'containerd', 'sandbox', 'container'],
  cam: [10, 0, 8], dist: 22,
  phases: [
    {
      title: 'kubelet gọi CRI — nó không tự chạy container',
      desc: '<span class="lead">kubelet <b>không</b> tự chạy container. Nó gọi xuống <span class="hi">CRI (Container Runtime Interface)</span> — một gRPC API chuẩn hoá — để runtime làm phần việc thật.</span>'
          + 'Runtime thường là <code>containerd</code> hoặc <code>CRI-O</code>. Việc đầu tiên: <code>ImageService.PullImage</code> kéo các layer từ registry (bỏ qua nếu Node đã cache — và đây thường là bước <b>lâu nhất</b> của cả pipeline).'
          + '<span class="why"><b>Vì sao Docker bị gỡ khỏi Kubernetes:</b> CRI là một interface, ai cài đúng đều cắm vào được. Docker không nói CRI nên phải chèn thêm lớp dịch <code>dockershim</code>; bỏ shim đó đi là bỏ một tầng thừa, <b>không</b> phải Kubernetes ngừng chạy image Docker — image vẫn là chuẩn OCI như cũ.</span>',
      set: {
        'containerd': { label: 'containerd\n▶ pull image', at: 1.20,
                        badge: 'CRI: PullImage', flash: '#c08000', dy: 1.4 }
      },
      scene(a) {
        a.flow([[6.9, 0.1, 9.4], [7.7, 1.1, 9.4], [8.4, 0.1, 9.4]], '#c08000', {at: 0.30, dur: 0.85, loop: 3.4});
      }
    },
    {
      title: 'RunPodSandbox — pause container giữ chỗ network',
      desc: '<span class="lead">Trước container ứng dụng, runtime dựng <span class="hi">sandbox</span>: một <b>pause container</b> tí hon gần như không làm gì.</span>'
          + 'Việc duy nhất của nó là <b>giữ network namespace</b> cho Pod. CNI plugin (Calico / Cilium / flannel) được gọi và cấp <b>IP cho chính sandbox này</b>, không phải cho container ứng dụng.'
          + '<span class="why"><b>Pause container giải thích gần như mọi hành vi mạng của Pod:</b> vì IP thuộc về sandbox, nên <b>tất cả container trong cùng một Pod dùng chung một IP</b> và gọi nhau qua <code>localhost</code>; và app container có thể crash-restart nhiều lần mà <b>Pod IP không đổi</b>. Đây cũng là nền tảng để sidecar (Istio, log agent) hoạt động được.</span>',
      show: ['sandbox'],
      showAt: { 'sandbox': 1.15 },
      set: { 'sandbox': { badge: 'pause container ✓ · CNI cấp IP', flash: '#22dd66', dy: 1.3 } },
      scene(a) {
        a.flow([[11.5, 0.1, 9.4], [12.2, 1.2, 9.4], [12.9, 0.25, 9.4]], '#22dd66', {at: 0.30, dur: 0.85, loop: 3.6});
      }
    },
    {
      title: 'CreateContainer + StartContainer — cgroups và namespaces',
      desc: '<span class="lead">Container ứng dụng được tạo và <b>gắn vào namespace của sandbox</b> đã dựng ở phase trước.</span>'
          + 'Runtime mount volume, áp <code>cgroups</code> (giới hạn CPU/RAM theo <code>limits</code>), set các namespace <code>pid / ipc / uts</code>, rồi chạy entrypoint của image.'
          + '<span class="why"><b>Container không phải một thứ gì đó huyền bí</b> — nó chỉ là một tiến trình Linux bình thường bị bao bởi <b>namespaces</b> (nhìn thấy gì) và <b>cgroups</b> (được dùng bao nhiêu). <code>limits</code> bạn khai trong YAML kết thúc hành trình của mình ở đây, dưới dạng vài con số ghi vào file cgroup.</span>',
      show: ['container'],
      showAt: { 'container': 1.15 },
      set: { 'container': { label: 'Container A\n▶ Running', badge: 'started', flash: '#22dd66', dy: 1.3 } },
      scene(a) {
        a.flow([[14.4, 0.25, 8.3], [14.4, 1.2, 7.7], [14.4, -0.05, 7.2]], '#22dd66', {at: 0.30, dur: 0.80, loop: 3.4});
        a.note('⑧ cgroups · namespaces · mounts', 10, -2.6, 9.4, '#6a8ab0', 0.9);
      }
    },
    {
      title: 'Probes — Startup, Liveness, Readiness',
      desc: '<span class="lead">Container chạy rồi, kubelet bắt đầu poll <span class="warn">probes</span> — và giữ nguyên việc đó suốt vòng đời Pod.</span>'
          + '<b>Startup</b> — chỉ chạy lúc khởi động, hoãn hai probe kia lại cho app khởi động chậm (JVM…) khỏi bị giết oan · '
          + '<b>Liveness</b> — fail thì <b>restart container</b> · '
          + '<b>Readiness</b> — fail thì <b>cắt Pod khỏi Service endpoints</b>: vẫn chạy nhưng không nhận traffic.'
          + '<span class="why"><b>Nhầm liveness với readiness là lỗi cấu hình phổ biến và nguy hiểm.</b> Đặt liveness vào một endpoint phụ thuộc database: database chậm một nhịp → toàn bộ Pod bị restart hàng loạt, biến một sự cố nhỏ thành outage. Quy tắc: <b>liveness hỏi “tiến trình này còn cứu được không?”</b>, <b>readiness hỏi “giờ có nên gửi traffic tới không?”</b>.</span>',
      set: {
        'container': { label: 'Container A\n▶ Running', at: 0.50,
                       badge: 'probes: startup → liveness → readiness', flash: '#22dd66', dy: 1.3 }
      },
      scene(a) {
        a.note('kubelet poll liên tục', 14.4, -2.2, 7.2, '#6a8ab0', 0.3);
      }
    }
  ]
},

/* ── STEP ⑨: Report Running ── */
{
  title: '⑨ Pod Running — cả cluster biết tin',
  pipelineStep: 6,
  focus: [],
  cam: [-1, 1, 0], dist: 46,
  phases: [
    {
      title: 'Container healthy — thông tin bắt đầu đi ngược chiều',
      desc: '<span class="lead">Probes pass, container ổn định. Từ đây thông tin chảy <b>ngược lại</b>: từ Node lên Control Plane.</span>'
          + 'Suốt 8 bước vừa rồi, dữ liệu đi một chiều xuống (Client → API Server → etcd → scheduler → kubelet → runtime). Bây giờ kubelet trở thành <b>bên báo cáo</b>.'
          + '<span class="why">kubelet là component duy nhất được phép ghi <code>status</code> của Pod. <b>spec</b> do người dùng khai (mong muốn), <b>status</b> do kubelet báo (thực tế) — hai nửa này gặp nhau trong cùng một object, và toàn bộ Kubernetes chỉ làm mỗi việc thu hẹp khoảng cách giữa chúng.</span>',
      set: { 'container': { label: 'Container A\n▶ Running ✓', at: 0.40, badge: 'healthy', flash: '#22dd66', dy: 1.3 } },
      scene(a) {
        a.note('spec = mong muốn · status = thực tế', 8, -2.6, 9.4, '#6a8ab0', 0.2);
      }
    },
    {
      title: 'kubelet PATCH status lên API Server',
      desc: '<span class="lead">kubelet gọi <code>PATCH</code> lên sub-resource <code>pods/{name}/status</code>, báo <code>phase: Running</code> cùng trạng thái từng container và các condition (<code>Ready</code>, <code>ContainersReady</code>…).</span>'
          + 'Nó lặp lại việc này định kỳ — vừa là báo cáo trạng thái, vừa là <b>tín hiệu còn sống</b> của chính Node.'
          + '<span class="why">Nếu kubelet ngừng báo cáo, <b>node controller</b> sẽ đánh Node là <code>NotReady</code> sau <code>node-monitor-grace-period</code> (mặc định ~40s), rồi bắt đầu evict Pod trên đó. Một Node “chết” trong mắt Kubernetes đơn giản là <b>một kubelet đã ngừng nói chuyện</b>.</span>',
      set: { 'apiserver': { at: 1.30, badge: 'PATCH pods/status', flash: '#22dd66' } },
      scene(a) {
        a.flow([[4.6, 0.2, 9.4], [-1, 5.2, 6], [-6.6, 2.4, 1.6]], '#22dd66', {at: 0.30, dur: 1.35, loop: 4.0});
        a.note('PATCH pod/status: Running', -1.5, 6.0, 6, '#22dd66', 0.2);
      }
    },
    {
      title: 'etcd: Pending → Running — giờ kubectl mới thấy 1/1',
      desc: '<span class="lead">API Server ghi status xuống etcd. Pod object cuối cùng đổi <span class="warn">Pending</span> → <span class="ok">Running</span>.</span>'
          + 'Đây chính là khoảnh khắc <code>kubectl get pods</code> hiện <code>1/1 Running</code> — <b>rất lâu</b> sau khi lệnh <code>kubectl apply</code> của bạn đã trả về ở bước ②.'
          + '<span class="why">Khoảng cách giữa hai thời điểm đó — <code>201 Created</code> ở bước ② và <code>Running</code> ở đây — chính là <b>toàn bộ 7 bước ở giữa</b>. Mỗi lần bạn <code>watch kubectl get pods</code> và thấy Pod đứng yên, nó đang kẹt ở một trong các bước đó, và cột <code>STATUS</code> nói cho bạn biết là bước nào.</span>',
      set: {
        'pod-object': { label: 'Pod\nnodeName: "worker-a"\nphase: Running ✓', col: '#1a3010', edge: '#3a7030',
                        at: 1.35, badge: 'Pending → Running', flash: '#22dd66', dy: 1.1 }
      },
      scene(a) {
        a.flow([[-9, 3.2, -2.2], [-9, 4.8, -4.6], [-9, 3.0, -6.6]], '#c08000', {at: 0.30, dur: 1.05, loop: 3.8});
      }
    },
    {
      title: 'Controller Manager đối chiếu replicas — và không làm gì cả',
      desc: '<span class="lead">ReplicaSet controller cũng đang watch. Nó so <b>desired</b> với <b>actual</b>: 3 mong muốn, 3 đang chạy. Khớp rồi → <b>nó không làm gì cả</b>.</span>'
          + '“Không làm gì” nghe như thất bại, nhưng đó chính là biểu hiện của một <b>reconcile loop khoẻ mạnh</b>: vòng lặp vẫn chạy mỗi khi có event, chỉ là không có việc để làm.'
          + '<span class="why"><b>Nếu sau này Pod chết</b>, cùng vòng lặp đó phát hiện 2 ≠ 3 và tạo Pod thay thế — và <b>toàn bộ pipeline ①→⑨ chạy lại từ đầu</b> cho Pod mới. Không ai “sửa” Pod cũ cả; Kubernetes chỉ liên tục hỏi <i>“thực tế đã khớp mong muốn chưa?”</i> và hành động khi câu trả lời là chưa.</span>',
      set: { 'ctrlmgr': { at: 1.25, badge: 'replicas satisfied ✓', flash: '#18a855', dy: 1.4 } },
      scene(a) {
        a.flow([[-7.4, 1.6, -2.0], [-5, 3.2, -5], [-3.4, 1.6, -6.9]], '#18a855', {at: 0.30, dur: 1.00, loop: 3.6});
      }
    },
    {
      title: 'kube-proxy cập nhật iptables/ipvs — Pod bắt đầu nhận traffic',
      desc: '<span class="lead">Pod đã <code>Ready</code> → EndpointSlice của Service được cập nhật → <span class="hi">kube-proxy</span> trên <b>mọi Node</b> thấy thay đổi và viết lại rule <code>iptables</code> / <code>ipvs</code>.</span>'
          + 'Từ giây này, traffic gửi tới ClusterIP của Service bắt đầu được load-balance tới IP của Pod mới. Pod thực sự <b>phục vụ người dùng</b>.'
          + '<span class="why"><b>Bức tranh tổng thể sau 9 bước:</b> không component nào ra lệnh trực tiếp cho component nào. Tất cả chỉ <b>ghi trạng thái vào etcd qua API Server</b> và <b>watch</b> thứ mình quan tâm — mô hình <b>level-triggered reconciliation</b>. Chính vì thế Kubernetes tự phục hồi được: giết scheduler, giết kubelet, giết Pod — khi sống lại, mỗi bên đọc trạng thái <b>hiện tại</b> từ etcd và tiếp tục kéo thực tế về đúng khai báo, <b>không cần ai kể lại chuyện đã xảy ra</b>.</span>',
      set: {
        'kubeproxy': { label: 'kube-proxy\niptables/ipvs ✓', at: 1.35,
                       badge: 'endpoints synced', flash: '#3a7fff', dy: 1.3 }
      },
      scene(a) {
        a.flow([[-6.6, 1.4, 1.0], [-1, 3.4, 4], [4.2, -0.05, 6.2]], '#3a7fff', {at: 0.30, dur: 1.05, loop: 3.8});
        a.note('⑨ toàn bộ vòng đời Pod đã khép kín', -18, 0.4, 7, '#6a8ab0', 1.6);
      }
    }
  ]
}

];
