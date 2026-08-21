/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — BIND & NODE (steps ⑥–⑨)

   Tiếp nối k8s-flow-3d-scenario-scheduler-pipeline-control-plane.js, cùng bộ
   helper của SCENE_KIT. Cùng mô hình phase: một phase = một lời giải thích +
   một hành động. Bước ⑥ là điểm bàn giao — mọi thứ sau nó xảy ra trên Node.

   Hành trình của hộp `pod` khép lại ở đây: nó đang nằm trong ActiveQ từ bước
   ③, được pop ở ⑥, và `KIT.move` đưa nó đáp xuống Worker A đúng lúc kubelet
   nhận việc (⑦) — đó mới là khoảnh khắc quyền điều khiển thật sự chuyển từ
   Control Plane xuống Node. Label của nó chỉ đổi khi field trong etcd đổi:
   `nodeName: ""` → `"worker-a"` (⑥) → `Running` (⑨).
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const MODEL = window.SCHEDULER_MODEL;

/* Cùng một model với control-plane: tên Node thắng và priority của Pod không
   được gõ lại ở đây. */
const RUN = MODEL.simulate(MODEL.DEFAULT_CONFIG);
const PRI = 'P=' + MODEL.DEFAULT_CONFIG.pod.priority;
const P = window.SCHED_POS;

/* Nhịp chuỗi bind ở bước ⑥: scheduler → API Server → etcd. */
const BIND_PACE = {at: 0.30, dur: 1.15};
const BIND_HOP = KIT.chainTimes(2, BIND_PACE);

/* Nhịp của chuỗi CRI ở bước ⑧ — `set`, `showAt` và `scene` cùng đọc một nguồn. */
const CRI_PACE = {at: 0.30, dur: 0.85};
const CRI_HOP = KIT.chainTimes(3, CRI_PACE);

/* Nhịp của chuỗi báo cáo ở bước ⑨: kubelet → API Server → etcd. */
const REPORT_PACE = {at: 0.30, dur: 1.20};
const REPORT_HOP = KIT.chainTimes(2, REPORT_PACE);

window.SCHED_STEPS_NODE = [

/* ── STEP ⑥: Bind ── */
{
  title: 'Bind — chốt Node bằng một dòng spec.nodeName',
  pipelineStep: 4,
  focus: ['scheduler', 'apiserver', 'etcd', 'pod'],
  phases: [
    {
      title: 'Pod rời ActiveQ — và scheduler “assume” nó đã nằm trên Worker A',
      desc: KIT.desc(
        'Pod pop khỏi <span class="hi">ActiveQ</span>. Trước khi gọi bind thật, scheduler làm một việc tinh tế: <b>assume</b>.',
        'Nó cập nhật ngay <b>cache nội bộ</b> — coi như Pod đã chiếm tài nguyên trên Worker A — <b>trước khi</b> API Server xác nhận gì cả.',
        '<b>Vì sao cần assume:</b> bind là một network call, mất vài chục ms. Nếu lúc đó scheduler xử lý Pod tiếp theo mà cache vẫn báo Worker A còn trống, nó sẽ <b>phát cùng chỗ đó cho hai Pod</b>. Assume giữ các quyết định liên tiếp không giẫm nhau. Bind fail thì cache rollback (<i>unassume</i>), Pod quay lại queue.'),
      focus: ['scheduler', 'queue', 'pod', 'q-pod-lo'],
      labels: ['scheduler', 'queue', 'pod'],
      explain: [
        {of: 'pod', tone: 'accent', text: 'Pod pop khỏi ActiveQ. Trước khi gọi bind thật, scheduler làm một việc tinh tế: <b>assume</b> — cập nhật ngay cache nội bộ, coi như Pod đã chiếm chỗ trên Worker A.'},
        {of: 'scheduler', tone: 'mute', text: 'Vì sao cần assume: bind mất vài chục ms. Không assume, scheduler xử lý Pod tiếp theo có thể phát cùng chỗ đó cho hai Pod. Bind fail thì cache rollback, Pod quay lại queue.'}
      ],
      set: {
        'pod': KIT.pulse('accent', 'popped khỏi ActiveQ', {at: 0.35, dy: 2.0})
      },
      scene(a) {
        KIT.note(a, 'assume: cache ghi trước, bind sau', 'scheduler', 'accent', 0.2);
      }
    },
    {
      /* Bind là một mạch: scheduler POST lên API Server, API Server ghi xuống
         etcd. Không có nhánh nào rẽ hay quay lại nên hai hop đi cùng một phase. */
      title: 'POST .../binding → API Server → etcd ghi nodeName',
      desc: KIT.desc(
        'Scheduler gọi <code>POST /api/v1/namespaces/default/pods/{name}/binding</code> — sub-resource chuyên để gắn Pod vào Node — và API Server persist <code>spec.nodeName = "worker-a"</code> xuống etcd.',
        ['<b>Đó là TẤT CẢ việc scheduler làm.</b> Nó <span class="danger">không tạo container, không nói chuyện với Node, không SSH đi đâu cả</span>. Sau lời gọi này, việc của nó với Pod đã xong hoàn toàn.',
         '<b>Và Pod vẫn là</b> <span class="warn">Pending</span> — đã có Node, chưa container nào chạy, vì kubelet trên Worker A còn chưa hay biết.'],
        '<b>Rút gọn lại:</b> kube-scheduler là chương trình đọc trạng thái cluster, chạy Filter + Score, rồi <b>viết đúng một chuỗi ký tự vào một field</b>. '
        + '<b>Đây cũng là ranh giới bàn giao</b> giữa Control Plane và Node, điểm mấu chốt của kiến trúc Kubernetes: các component <b>không gọi lẫn nhau</b>. Scheduler không báo kubelet, chỉ ghi vào etcd — bên nào quan tâm tự quan sát và phản ứng. Ghép nối lỏng kiểu này là lý do bạn restart bất kỳ component nào mà hệ thống vẫn hội tụ.'),
      labels: ['scheduler', 'apiserver', 'etcd', 'pod'],
      explain: [
        {of: 'scheduler', tone: 'info', text: 'Scheduler gọi <code>POST .../pods/{name}/binding</code> — và đó là <b>tất cả</b>. Nó <b>không</b> tạo container, không nói chuyện với Node, không SSH đi đâu cả. Xong lời gọi này là xong việc với Pod.'},
        {of: 'pod', tone: 'warn', text: 'etcd ghi <code>spec.nodeName = "worker-a"</code> — nhưng Pod <b>vẫn Pending</b>. Đã có Node, chưa container nào chạy, vì kubelet trên Worker A còn chưa hay biết.'},
        {of: ['scheduler', 'apiserver', 'etcd'], tone: 'mute', text: '<b>Đây là ranh giới bàn giao</b> Control Plane → Node. Các component <b>không gọi lẫn nhau</b>: scheduler chỉ ghi vào etcd, bên nào quan tâm tự quan sát. Ghép nối lỏng kiểu này là lý do restart bất kỳ component nào hệ thống vẫn hội tụ.'}
      ],
      // Field trong etcd đổi thật → đây là một trong số ít chỗ label được đổi.
      set: {
        'apiserver': KIT.pulse('info', 'POST .../binding ✓', {at: BIND_HOP[0].arrive}),
        'pod': KIT.mark('warn', 'nodeName ← worker-a', {
          label: 'Pod · ' + PRI + '\nnodeName: "worker-a"', status: 'bound',
          at: BIND_HOP[1].arrive, dy: 2.0,
          hover: 'Đã có Node, nhưng vẫn Pending — kubelet chưa hay biết'
        })
      },
      scene(a) {
        KIT.chain(a, ['scheduler', 'apiserver', 'etcd'], 'info', Object.assign({
          labels: ['POST .../binding', 'PUT nodeName ← worker-a'],
          inks: ['info', 'warn']
        }, BIND_PACE));
        KIT.note(a, '⑥ vẫn Pending — chỉ đổi nodeName', {of: 'etcd', band: true}, 'mute', BIND_HOP[1].arrive);
      }
    }
  ]
},

/* ── STEP ⑦: kubelet WATCH ── */
{
  title: 'kubelet nhận ra “Pod này là của tôi”',
  pipelineStep: 5,
  focus: ['apiserver', 'node-a', 'kubelet', 'pod'],
  phases: [
    {
      title: 'Mỗi kubelet chỉ watch đúng Pod của Node mình',
      desc: KIT.desc(
        'Mỗi Node chạy một <span class="hi">kubelet</span>, và mỗi kubelet cũng mở <code>List-Watch</code> riêng lên API Server — nhưng <b>filter theo tên Node của chính nó</b>.',
        'Cụ thể: <code>fieldSelector=spec.nodeName=worker-a</code>. Nhờ vậy kubelet chỉ nhận đúng Pod thuộc về mình, không quét toàn cluster — cluster 5000 Node vẫn không làm kubelet nào bận thêm.',
        'Cùng mô hình Watch scheduler dùng ở bước ③, chỉ khác bộ lọc. <b>List-Watch là xương sống của Kubernetes</b> — controller, kubelet, kube-proxy, operator của bạn đều chạy đúng cơ chế này.'),
      labels: ['apiserver', 'kubelet', 'node-a'],
      explain: [
        {of: 'kubelet', tone: 'sky', text: 'Mỗi Node chạy một kubelet, và mỗi kubelet cũng mở <code>List-Watch</code> riêng — nhưng filter theo tên Node của chính nó: <code>fieldSelector=spec.nodeName=worker-a</code>.'},
        {of: 'kubelet', tone: 'mute', text: 'Cluster 5000 Node vẫn không làm kubelet nào bận thêm. <b>List-Watch là xương sống của Kubernetes</b> — controller, kube-proxy, operator đều dùng đúng cơ chế này.'}
      ],
      scene(a) {
        KIT.link(a, 'apiserver', 'kubelet', 'info', {dur: 1.35, loop: 4.0, label: 'WATCH spec.nodeName'});
        KIT.note(a, 'WATCH spec.nodeName=worker-a', 'kubelet', 'sky', 0.2);
      }
    },
    {
      title: 'Event MODIFIED bắn ra — kubelet nhận việc',
      desc: KIT.desc(
        'Khoảnh khắc bước ⑥ ghi <code>nodeName</code> xuống etcd, watch stream của Worker A lập tức bắn ra event <code>MODIFIED</code>.',
        'Thường chỉ <b>vài chục mili-giây</b> sau khi bind. Đây là lúc quyền điều khiển thật sự chuyển từ Control Plane xuống Node — và cũng là lúc <b>hộp Pod</b> đi từ etcd qua ActiveQ đáp xuống Worker A.',
        'Không hàng đợi message, không broker, không RPC từ scheduler xuống kubelet. Chỉ là <b>một field đổi giá trị trong etcd</b> và một watcher đang lắng nghe đúng field đó.'),
      labels: ['kubelet', 'pod'],
      explain: [
        {of: 'kubelet', tone: 'sky', text: 'Khoảnh khắc bước ⑥ ghi <code>nodeName</code> xuống etcd, watch stream của Worker A lập tức bắn ra event <code>MODIFIED</code> — thường chỉ vài chục mili-giây sau khi bind.'},
        {of: 'pod', tone: 'mute', text: 'Không hàng đợi message, không broker, không RPC từ scheduler xuống kubelet. Chỉ là <b>một field đổi giá trị trong etcd</b> và một watcher đang lắng nghe đúng field đó.'}
      ],
      // Cùng hộp Pod: rời ActiveQ, hạ cánh xuống Worker A.
      set: {
        // kubelet là daemon: nó *làm* việc chứ không đổi trạng thái — badge đủ,
        // status chip chỉ dành cho thứ có vòng đời (Pod, sandbox, container).
        'kubelet': KIT.mark('ok', 'spec.nodeName == worker-a', {
          at: 0.55, dy: 1.5, flash: KIT.ink('info')
        }),
        'pod': KIT.move(P.nodeA, {badge: 'landed on worker-a', at: 1.15, dy: 2.0})
      },
      scene(a) {
        KIT.link(a, 'queue', 'pod', 'accent', {at: 0.55, dur: 1.10, loop: 3.8, label: 'pop from ActiveQ'});
        KIT.note(a, 'event MODIFIED → của tôi!', {of: 'kubelet', band: true}, 'sky', 0.3);
      }
    },
    {
      title: 'Chuẩn bị: image, volume, Secret, ConfigMap',
      desc: KIT.desc(
        'kubelet kéo về <b>full Pod spec</b> rồi chuẩn bị mọi thứ <b>trước khi</b> đụng tới container runtime.',
        'Xác định image và <code>imagePullPolicy</code>, giải quyết <code>imagePullSecrets</code>, mount <span class="warn">Volume / PVC</span>, fetch nội dung <span class="warn">Secret · ConfigMap</span> mà container sẽ đọc qua env hoặc file.',
        '<b>Mẹo debug quan trọng nhất pipeline:</b> đến đây scheduling đã <b>thành công</b>. Thiếu Secret, sai tên ConfigMap, PVC chưa bound hay không kéo được image → Pod đứng ở <code>ContainerCreating</code> / <code>ImagePullBackOff</code>, <b>không phải</b> <code>Pending</code>. Vậy: <code>Pending</code> ⇒ lỗi ở scheduler (bước ④), <code>ContainerCreating</code> ⇒ lỗi ở kubelet/Node (bước ⑦–⑧). Nhìn phase là biết tìm ở đâu.'),
      labels: ['kubelet', 'pod'],
      explain: [
        {of: 'kubelet', tone: 'warn', text: 'kubelet kéo về full Pod spec rồi chuẩn bị mọi thứ <b>trước khi</b> đụng tới container runtime: image, <code>imagePullSecrets</code>, mount Volume/PVC, fetch Secret · ConfigMap.'},
        {of: 'pod', tone: 'mute', text: '<b>Mẹo debug:</b> <code>Pending</code> ⇒ lỗi ở scheduler (bước ④); <code>ContainerCreating</code> / <code>ImagePullBackOff</code> ⇒ lỗi ở kubelet/Node (bước ⑦–⑧). Nhìn phase là biết tìm ở đâu.'}
      ],
      set: {
        'kubelet': KIT.pulse('warn', 'prepare dependencies', {at: 0.45, dy: 1.5}),
        'pod': KIT.mark('warn', 'ContainerCreating', {status: 'creating', at: 1.15, dy: 2.0})
      },
      scene(a) {
        KIT.note(a, '⑦ image · volumes · Secrets · ConfigMaps', {of: 'kubelet', band: true}, 'mute', 0.2);
      }
    }
  ]
},

/* ── STEP ⑧: CRI ── */
{
  title: 'containerd dựng và chạy container',
  pipelineStep: 6,
  focus: ['node-a', 'kubelet', 'containerd', 'sandbox', 'container', 'pod'],
  /* kubelet → containerd → sandbox → container là một hành trình một chiều:
     mỗi lời gọi CRI chỉ đẻ ra thứ tiếp theo, không có chặng nào quay lại. Cả
     đoạn chạy trong một phase bằng KIT.chain, và hai component mới hiện ra
     đúng lúc mũi tên tạo ra chúng cập bến (`showAt` = CRI_HOP[i].arrive). */
  phases: [
    {
      title: 'kubelet → CRI → sandbox → container',
      desc: KIT.desc(
        'kubelet <b>không</b> tự chạy container. Nó gọi xuống <span class="hi">CRI (Container Runtime Interface)</span> — gRPC API chuẩn hoá — và runtime dựng dần từng lớp.',
        ['<b>PullImage</b> — runtime (<code>containerd</code> / <code>CRI-O</code>) kéo layer từ registry, bỏ qua nếu Node đã cache. Thường là chặng <b>lâu nhất</b> pipeline.',
         '<b>RunPodSandbox</b> — dựng <span class="hi">sandbox</span>: một <b>pause container</b> tí hon gần như không làm gì, việc duy nhất là <b>giữ network namespace</b>. CNI plugin (Calico / Cilium / flannel) cấp IP cho <b>chính sandbox này</b>, không phải cho container ứng dụng.',
         '<b>CreateContainer + StartContainer</b> — container ứng dụng gắn vào namespace của sandbox, mount volume, áp <code>cgroups</code> theo <code>limits</code>, set namespace <code>pid / ipc / uts</code>, rồi chạy entrypoint.'],
        '<b>Pause container giải thích gần hết hành vi mạng của Pod:</b> IP thuộc về sandbox nên mọi container trong cùng Pod <b>dùng chung một IP</b> và gọi nhau qua <code>localhost</code>; app container crash-restart bao nhiêu lần thì <b>Pod IP vẫn không đổi</b>. '
        + '<b>Và container không có gì huyền bí</b> — chỉ là tiến trình Linux bị bao bởi <b>namespaces</b> (nhìn thấy gì) và <b>cgroups</b> (được dùng bao nhiêu); <code>limits</code> trong YAML kết thúc hành trình ở đây, thành vài con số trong file cgroup. '
        + '<b>Vì sao Docker bị gỡ:</b> CRI là interface, ai cài đúng đều cắm vào được — Docker không nói CRI nên phải chèn <code>dockershim</code>; bỏ shim là bỏ một tầng thừa, image vẫn chuẩn OCI như cũ.'),
      labels: ['kubelet', 'containerd', 'sandbox', 'container'],
      explain: [
        {of: 'containerd', tone: 'warn', text: 'kubelet <b>không</b> tự chạy container — nó gọi xuống <b>CRI</b>, gRPC API chuẩn hoá. Việc đầu tiên: <code>PullImage</code> kéo layer từ registry (bỏ qua nếu Node đã cache). Thường là chặng <b>lâu nhất</b> pipeline.'},
        {of: 'sandbox', tone: 'ok', text: '<b>Sandbox</b> là một <b>pause container</b> tí hon gần như không làm gì. Việc duy nhất: <b>giữ network namespace</b>. CNI cấp IP cho <b>chính sandbox này</b>, không phải cho container ứng dụng.'},
        {of: 'sandbox', tone: 'sky', text: 'Vì IP thuộc về sandbox nên mọi container trong cùng Pod <b>dùng chung một IP</b> và gọi nhau qua <code>localhost</code>; app container crash-restart bao nhiêu lần thì <b>Pod IP vẫn không đổi</b>. Đây cũng là nền tảng của sidecar.'},
        {of: 'container', tone: 'ok', text: 'Container ứng dụng gắn vào namespace của sandbox, mount volume, áp <code>cgroups</code> theo <code>limits</code>, set <code>pid / ipc / uts</code>, rồi chạy entrypoint. <b>Chỉ là tiến trình Linux</b> bị bao bởi namespaces (nhìn thấy gì) và cgroups (được dùng bao nhiêu).'},
        {of: ['kubelet', 'containerd'], tone: 'mute', text: '<b>Vì sao Docker bị gỡ khỏi Kubernetes:</b> CRI là interface, ai cài đúng đều cắm vào được. Docker không nói CRI nên phải chèn lớp dịch <code>dockershim</code>; bỏ shim là bỏ một tầng thừa — image vẫn chuẩn OCI như cũ.'}
      ],
      show: ['sandbox', 'container'],
      showAt: { 'sandbox': CRI_HOP[1].arrive, 'container': CRI_HOP[2].arrive },
      set: {
        'containerd': KIT.pulse('warn', 'CRI: PullImage', {at: CRI_HOP[0].arrive, dy: 1.4}),
        // sandbox không mang chip: nó chỉ có một trạng thái duy nhất — tồn tại.
        // Hiện ra đã là "ready", chip chỉ lặp lại điều mắt vừa thấy.
        'sandbox': KIT.pulse('ok', 'sandbox ✓ · CNI cấp IP', {dy: 1.3}),
        'container': KIT.pulse('ok', 'started', {status: 'running', dy: 1.3})
      },
      scene(a) {
        KIT.chain(a, ['kubelet', 'containerd', 'sandbox', 'container'], 'ok', Object.assign({
          labels: ['CRI PullImage', 'RunPodSandbox', 'CreateContainer + StartContainer'],
          inks: ['warn', 'ok', 'ok']
        }, CRI_PACE));
        KIT.note(a, '⑧ cgroups · namespaces · mounts', {of: 'container', band: true}, 'mute', CRI_HOP[2].arrive);
      }
    },
    {
      title: 'Probes — Startup, Liveness, Readiness',
      desc: KIT.desc(
        'Container chạy rồi, kubelet bắt đầu poll <span class="warn">probes</span> — và giữ vậy suốt vòng đời Pod.',
        ['<b>Startup</b> — chỉ chạy lúc khởi động, hoãn hai probe kia lại cho app khởi động chậm (JVM…) khỏi bị giết oan',
         '<b>Liveness</b> — fail thì <b>restart container</b>',
         '<b>Readiness</b> — fail thì <b>cắt Pod khỏi Service endpoints</b>: vẫn chạy nhưng không nhận traffic.'],
        '<b>Nhầm liveness với readiness là lỗi cấu hình phổ biến và nguy hiểm.</b> Đặt liveness vào endpoint phụ thuộc database: database chậm một nhịp → cả Pod bị restart hàng loạt, biến sự cố nhỏ thành outage. Quy tắc: <b>liveness hỏi “tiến trình này còn cứu được không?”</b>, <b>readiness hỏi “giờ có nên gửi traffic tới không?”</b>.'),
      labels: ['kubelet', 'container'],
      explain: [
        {of: 'container', tone: 'accent', text: 'Container chạy rồi, kubelet bắt đầu poll <b>probes</b> — và giữ vậy suốt vòng đời Pod. <b>Startup</b> hoãn hai probe kia lại cho app khởi động chậm khỏi bị giết oan.'},
        {of: 'container', tone: 'ok', text: '<b>Liveness</b> fail thì <b>restart container</b>. <b>Readiness</b> fail thì <b>cắt khỏi Service endpoints</b> — vẫn chạy nhưng không nhận traffic.'},
        {of: 'container', tone: 'danger', text: 'Nhầm liveness với readiness rất nguy hiểm: đặt liveness vào endpoint phụ thuộc database, database chậm một nhịp → cả Pod bị restart hàng loạt.'}
      ],
      set: {
        'container': KIT.pulse('ok', 'probes: startup·live·ready', {
          status: 'running', at: 0.50, dy: 1.3
        })
      },
      scene(a) {
        KIT.bubble(a, 'container', 'Startup ✓', {at: 0.25, dur: 2.1, tone: 'accent'});
        KIT.bubble(a, 'container', 'Liveness ✓', {at: 0.85, dur: 2.1, tone: 'ok', dy: 2.6});
        KIT.bubble(a, 'kubelet', 'Readiness ✓ → traffic', {at: 1.45, dur: 2.1, tone: 'ok'});
      }
    }
  ]
},

/* ── STEP ⑨: Report Running ── */
{
  title: 'Pod Running — cả cluster biết tin',
  pipelineStep: 7,
  focus: [],
  phases: [
    {
      title: 'Container healthy — thông tin bắt đầu đi ngược chiều',
      desc: KIT.desc(
        'Probes pass, container ổn định. Từ đây thông tin chảy <b>ngược lại</b>: từ Node lên Control Plane.',
        'Suốt 8 bước vừa rồi, dữ liệu đi một chiều xuống (Client → API Server → etcd → scheduler → kubelet → runtime). Giờ kubelet trở thành <b>bên báo cáo</b>.',
        'kubelet là component duy nhất được ghi <code>status</code> của Pod. <b>spec</b> do người dùng khai (mong muốn), <b>status</b> do kubelet báo (thực tế) — hai nửa gặp nhau trong cùng object, và cả Kubernetes chỉ làm mỗi việc thu hẹp khoảng cách giữa chúng.'),
      labels: ['container', 'kubelet'],
      explain: [
        {of: 'container', tone: 'ok', text: 'Probes pass, container ổn định. Từ đây thông tin chảy <b>ngược lại</b>: từ Node lên Control Plane. Suốt 8 bước vừa rồi dữ liệu đi một chiều xuống.'},
        {of: 'kubelet', tone: 'mute', text: 'kubelet là component duy nhất được ghi <code>status</code> của Pod. <b>spec</b> do người dùng khai (mong muốn), <b>status</b> do kubelet báo (thực tế).'}
      ],
      set: {
        'container': KIT.pulse('ok', 'healthy', {status: 'ready', at: 0.40, dy: 1.3})
      },
      scene(a) {
        KIT.note(a, 'spec = mong muốn · status = thực tế', {of: 'container', band: true}, 'mute', 0.2);
      }
    },
    /* Báo cáo cũng là một chuỗi một chiều: kubelet → API Server → etcd. Không
       chặng nào quay lại, nên nó chạy liền một mạch trong một phase. */
    {
      title: 'kubelet PATCH status → API Server → etcd: Pending → Running',
      desc: KIT.desc(
        'kubelet gọi <code>PATCH</code> lên sub-resource <code>pods/{name}/status</code>, API Server ghi tiếp xuống etcd — và Pod object cuối cùng đổi <span class="warn">Pending</span> → <span class="ok">Running</span>.',
        ['<b>PATCH pods/status</b> — báo <code>phase: Running</code> cùng trạng thái từng container và các condition (<code>Ready</code>, <code>ContainersReady</code>…). kubelet lặp lại việc này định kỳ: vừa báo cáo, vừa là <b>tín hiệu còn sống</b> của chính Node.',
         '<b>etcd: Pending → Running</b> — đây chính là khoảnh khắc <code>kubectl get pods</code> hiện <code>1/1 Running</code>, <b>rất lâu</b> sau khi <code>kubectl apply</code> của bạn đã trả về ở bước ②.'],
        'Nếu kubelet ngừng báo cáo, <b>node controller</b> đánh Node là <code>NotReady</code> sau <code>node-monitor-grace-period</code> (~40s) rồi evict Pod trên đó — một Node “chết” trong mắt Kubernetes chỉ là <b>một kubelet đã ngừng nói chuyện</b>. '
        + 'Còn khoảng cách giữa <code>201 Created</code> ở bước ② và <code>Running</code> ở đây chính là <b>toàn bộ 7 bước ở giữa</b>: Pod đứng yên khi bạn <code>watch kubectl get pods</code> nghĩa là nó đang kẹt ở một trong số đó, và cột <code>STATUS</code> nói cho bạn biết bước nào.'),
      labels: ['kubelet', 'apiserver', 'etcd', 'pod'],
      explain: [
        {of: 'kubelet', tone: 'ok', text: 'kubelet <code>PATCH</code> lên <code>pods/{name}/status</code>: <code>phase: Running</code> cùng trạng thái từng container và các condition. Nó lặp lại định kỳ — vừa báo cáo, vừa là <b>tín hiệu còn sống</b> của Node.'},
        {of: 'pod', tone: 'live', text: 'etcd đổi <b>Pending → Running</b>. Đây chính là khoảnh khắc <code>kubectl get pods</code> hiện <code>1/1 Running</code> — <b>rất lâu</b> sau khi <code>kubectl apply</code> của bạn đã trả về ở bước ②.'},
        {of: 'kubelet', tone: 'danger', text: 'Nếu kubelet ngừng báo cáo, node controller đánh Node <code>NotReady</code> sau ~40s rồi evict Pod. Một Node “chết” trong mắt Kubernetes chỉ là <b>một kubelet đã ngừng nói chuyện</b>.'},
        {of: ['kubelet', 'apiserver', 'etcd', 'pod'], tone: 'mute', text: 'Khoảng cách giữa <code>201 Created</code> ở bước ② và <code>Running</code> ở đây chính là <b>toàn bộ 7 bước ở giữa</b>. Pod đứng yên khi bạn <code>watch kubectl get pods</code> nghĩa là nó đang kẹt ở một trong số đó — cột <code>STATUS</code> nói cho bạn biết bước nào.'}
      ],
      set: {
        'apiserver': KIT.pulse('ok', 'PATCH pods/status', {at: REPORT_HOP[0].arrive}),
        'pod': KIT.mark('live', 'Pending → Running', {
          label: 'Pod · ' + PRI + '\nnodeName: "worker-a"', status: 'running',
          at: REPORT_HOP[1].arrive, dy: 2.0,
          hover: 'Cùng object đã ra đời ở bước ② — giờ mới thật sự chạy'
        })
      },
      scene(a) {
        KIT.chain(a, ['kubelet', 'apiserver', 'etcd'], 'ok', Object.assign({
          labels: ['PATCH pods/status', 'PUT status: Running'],
          inks: ['ok', 'warn']
        }, REPORT_PACE));
        KIT.note(a, 'PATCH pod/status: Running', 'apiserver', 'ok', 0.2);
      }
    },
    {
      title: 'Controller Manager đối chiếu replicas — và không làm gì cả',
      desc: KIT.desc(
        'ReplicaSet controller cũng đang watch. Nó so <b>desired</b> với <b>actual</b>: 3 mong muốn, 3 đang chạy. Khớp rồi → <b>không làm gì cả</b>.',
        '“Không làm gì” nghe như thất bại, nhưng đó là biểu hiện của một <b>reconcile loop khoẻ mạnh</b>: vòng lặp vẫn chạy mỗi khi có event, chỉ là không có việc để làm.',
        '<b>Nếu sau này Pod chết</b>, cùng vòng lặp phát hiện 2 ≠ 3 và tạo Pod thay thế — <b>toàn bộ pipeline ①→⑨ chạy lại từ đầu</b> cho Pod mới. Không ai “sửa” Pod cũ; Kubernetes chỉ liên tục hỏi <i>“thực tế đã khớp mong muốn chưa?”</i> và hành động khi câu trả lời là chưa.'),
      labels: ['ctrlmgr', 'apiserver'],
      explain: [
        {of: 'ctrlmgr', tone: 'pass', text: 'ReplicaSet controller cũng đang watch. Nó so <b>desired</b> với <b>actual</b>: 3 mong muốn, 3 đang chạy. Khớp rồi → <b>không làm gì cả</b>.'},
        {of: 'ctrlmgr', tone: 'mute', text: 'Nếu sau này Pod chết, cùng vòng lặp phát hiện 2 ≠ 3 và tạo Pod thay thế — <b>toàn bộ pipeline ①→⑨ chạy lại từ đầu</b> cho Pod mới.'}
      ],
      set: {
        'ctrlmgr': KIT.pulse('pass', 'replicas satisfied ✓', {at: 1.25, dy: 1.4})
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'ctrlmgr', 'pass', {dur: 1.00, loop: 3.6, label: 'watch replica count'});
      }
    },
    {
      title: 'kube-proxy cập nhật iptables/ipvs — Pod bắt đầu nhận traffic',
      desc: KIT.desc(
        'Pod đã <code>Ready</code> → EndpointSlice của Service cập nhật → <span class="hi">kube-proxy</span> trên <b>mọi Node</b> thấy thay đổi và viết lại rule <code>iptables</code> / <code>ipvs</code>.',
        'Từ giây này, traffic gửi tới ClusterIP của Service bắt đầu được load-balance tới IP của Pod mới. Pod thực sự <b>phục vụ người dùng</b>.',
        '<b>Bức tranh tổng thể sau 9 bước:</b> không component nào ra lệnh trực tiếp cho component nào. Tất cả chỉ <b>ghi trạng thái vào etcd qua API Server</b> và <b>watch</b> thứ mình quan tâm — mô hình <b>level-triggered reconciliation</b>. Chính vì thế Kubernetes tự phục hồi được: giết scheduler, giết kubelet, giết Pod — khi sống lại, mỗi bên đọc trạng thái <b>hiện tại</b> từ etcd và tiếp tục kéo thực tế về đúng khai báo, <b>không cần ai kể lại chuyện đã xảy ra</b>.'),
      labels: ['kubeproxy', 'apiserver', 'pod'],
      explain: [
        {of: 'kubeproxy', tone: 'info', text: 'Pod đã Ready → EndpointSlice cập nhật → kube-proxy trên <b>mọi Node</b> thấy thay đổi và viết lại rule <code>iptables</code>/<code>ipvs</code>.'},
        {of: 'pod', tone: 'ok', text: 'Từ giây này, traffic gửi tới ClusterIP bắt đầu load-balance tới IP của Pod mới. Pod thực sự <b>phục vụ người dùng</b>.'},
        {of: [], tone: 'mute', text: '<b>Bức tranh tổng thể:</b> không component nào ra lệnh trực tiếp cho component nào — tất cả chỉ ghi trạng thái vào etcd qua API Server và watch thứ mình quan tâm. Chính vì thế Kubernetes tự phục hồi được.'}
      ],
      set: {
        'kubeproxy': KIT.pulse('info', 'endpoints synced', {at: 1.35, dy: 1.3})
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'kubeproxy', 'info', {loop: 3.8, label: 'watch EndpointSlice'});
        KIT.note(a, '⑨ toàn bộ vòng đời Pod đã khép kín', {of: 'pod', band: true}, 'mute', 1.6);
        KIT.bubble(a, 'pod', 'nhận traffic!', {at: 2.1, dur: 2.6, tone: 'ok'});
      }
    }
  ]
}

];
})();
