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
      set: {
        'pod': KIT.pulse('accent', 'popped khỏi ActiveQ', {at: 0.35, dy: 2.0})
      },
      scene(a) {
        KIT.note(a, 'assume: cache ghi trước, bind sau', 'scheduler', 'accent', 0.2);
      }
    },
    {
      title: 'POST .../binding — toàn bộ việc scheduler làm là ghi một chuỗi',
      desc: KIT.desc(
        'Scheduler gọi <code>POST /api/v1/namespaces/default/pods/{name}/binding</code> — sub-resource chuyên để gắn Pod vào Node.',
        'Đó là <b>tất cả</b>. Scheduler <span class="danger">không tạo container, không nói chuyện với Node, không SSH đi đâu cả.</span> '
        + 'Sau lời gọi này, việc của nó với Pod đã xong hoàn toàn.',
        '<b>Rút gọn lại:</b> kube-scheduler là chương trình đọc trạng thái cluster, chạy Filter + Score, rồi <b>viết đúng một chuỗi ký tự vào một field</b>. Mọi thứ phức tạp phía sau là do component khác phản ứng với chuỗi đó.'),
      labels: ['scheduler', 'apiserver'],
      set: {
        'apiserver': KIT.pulse('info', 'POST .../binding ✓', {at: 1.30})
      },
      scene(a) {
        KIT.link(a, 'scheduler', 'apiserver', 'info', {loop: 3.8, label: 'POST .../binding'});
        KIT.note(a, 'POST .../pods/{name}/binding', 'apiserver', 'info', 0.2);
      }
    },
    {
      title: 'etcd ghi nodeName — nhưng Pod vẫn còn Pending',
      desc: KIT.desc(
        'API Server persist <code>spec.nodeName = "worker-a"</code> xuống etcd. Pod object đổi trạng thái.',
        'Nhưng chú ý: Pod <b>vẫn là</b> <span class="warn">Pending</span>. Đã có Node, chưa container nào chạy — vì kubelet trên Worker A còn chưa hay biết.',
        '<b>Đây là ranh giới bàn giao</b> giữa Control Plane và Node, điểm mấu chốt của kiến trúc Kubernetes: các component <b>không gọi lẫn nhau</b>. Scheduler không báo kubelet, chỉ ghi vào etcd — bên nào quan tâm tự quan sát và phản ứng. Ghép nối lỏng kiểu này là lý do bạn restart bất kỳ component nào mà hệ thống vẫn hội tụ.'),
      labels: ['apiserver', 'etcd', 'pod'],
      // Field trong etcd đổi thật → đây là một trong số ít chỗ label được đổi.
      set: {
        'pod': KIT.mark('warn', 'nodeName ← worker-a', {
          label: 'Pod · ' + PRI + '\nnodeName: "worker-a"', at: 1.35, dy: 2.0,
          hover: 'Đã có Node, nhưng vẫn Pending — kubelet chưa hay biết'
        })
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'etcd', 'warn', {loop: 3.8, label: 'PUT nodeName ← worker-a'});
        KIT.note(a, '⑥ vẫn Pending — chỉ đổi nodeName', {of: 'etcd', band: true}, 'mute', 1.4);
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
      // Cùng hộp Pod: rời ActiveQ, hạ cánh xuống Worker A.
      set: {
        'kubelet': KIT.mark('ok', 'spec.nodeName == worker-a', {
          label: 'kubelet\n✓ pod assigned', at: 0.55, dy: 1.5, flash: KIT.ink('info')
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
      set: {
        'kubelet': KIT.pulse('warn', 'prepare dependencies', {at: 0.45, dy: 1.5}),
        'pod': KIT.mark('warn', 'ContainerCreating', {at: 1.15, dy: 2.0})
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
  pipelineStep: 5,
  focus: ['node-a', 'kubelet', 'containerd', 'sandbox', 'container', 'pod'],
  phases: [
    {
      title: 'kubelet gọi CRI — nó không tự chạy container',
      desc: KIT.desc(
        'kubelet <b>không</b> tự chạy container. Nó gọi xuống <span class="hi">CRI (Container Runtime Interface)</span> — gRPC API chuẩn hoá — để runtime làm phần việc thật.',
        'Runtime thường là <code>containerd</code> hoặc <code>CRI-O</code>. Việc đầu tiên: <code>ImageService.PullImage</code> kéo layer từ registry (bỏ qua nếu Node đã cache — thường là bước <b>lâu nhất</b> pipeline).',
        '<b>Vì sao Docker bị gỡ khỏi Kubernetes:</b> CRI là interface, ai cài đúng đều cắm vào được. Docker không nói CRI nên phải chèn lớp dịch <code>dockershim</code>; bỏ shim đó là bỏ một tầng thừa, <b>không</b> phải Kubernetes ngừng chạy image Docker — image vẫn chuẩn OCI như cũ.'),
      labels: ['kubelet', 'containerd'],
      set: {
        'containerd': KIT.pulse('warn', 'CRI: PullImage', {
          label: 'containerd\n▶ pull image', at: 1.20, dy: 1.4
        })
      },
      scene(a) {
        KIT.link(a, 'kubelet', 'containerd', 'warn', {at: 0.30, dur: 0.85, loop: 3.4, label: 'CRI PullImage'});
      }
    },
    {
      title: 'RunPodSandbox — pause container giữ chỗ network',
      desc: KIT.desc(
        'Trước container ứng dụng, runtime dựng <span class="hi">sandbox</span>: một <b>pause container</b> tí hon gần như không làm gì.',
        'Việc duy nhất của nó là <b>giữ network namespace</b> cho Pod. CNI plugin (Calico / Cilium / flannel) được gọi và cấp <b>IP cho chính sandbox này</b>, không phải cho container ứng dụng.',
        '<b>Pause container giải thích gần hết hành vi mạng của Pod:</b> IP thuộc về sandbox nên <b>mọi container trong cùng Pod dùng chung một IP</b> và gọi nhau qua <code>localhost</code>; app container có thể crash-restart nhiều lần mà <b>Pod IP không đổi</b>. Đây cũng là nền tảng để sidecar (Istio, log agent) hoạt động được.'),
      labels: ['containerd', 'sandbox'],
      show: ['sandbox'],
      showAt: { 'sandbox': 1.15 },
      set: {
        'sandbox': KIT.pulse('ok', 'sandbox ✓ · CNI cấp IP', {dy: 1.3})
      },
      scene(a) {
        KIT.link(a, 'containerd', 'sandbox', 'ok', {at: 0.30, dur: 0.85, loop: 3.6, label: 'RunPodSandbox'});
      }
    },
    {
      title: 'CreateContainer + StartContainer — cgroups và namespaces',
      desc: KIT.desc(
        'Container ứng dụng được tạo và <b>gắn vào namespace của sandbox</b> đã dựng ở phase trước.',
        'Runtime mount volume, áp <code>cgroups</code> (giới hạn CPU/RAM theo <code>limits</code>), set namespace <code>pid / ipc / uts</code>, rồi chạy entrypoint của image.',
        '<b>Container không phải thứ gì huyền bí</b> — chỉ là tiến trình Linux bình thường bị bao bởi <b>namespaces</b> (nhìn thấy gì) và <b>cgroups</b> (được dùng bao nhiêu). <code>limits</code> bạn khai trong YAML kết thúc hành trình ở đây, thành vài con số ghi vào file cgroup.'),
      labels: ['sandbox', 'container'],
      show: ['container'],
      showAt: { 'container': 1.15 },
      set: {
        'container': KIT.pulse('ok', 'started', {label: 'Container A\n▶ Running', dy: 1.3})
      },
      scene(a) {
        KIT.link(a, 'sandbox', 'container', 'ok', {at: 0.30, dur: 0.80, loop: 3.4, label: 'CreateContainer + StartContainer'});
        KIT.note(a, '⑧ cgroups · namespaces · mounts', {of: 'container', band: true}, 'mute', 0.9);
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
      set: {
        'container': KIT.pulse('ok', 'probes: startup·live·ready', {
          label: 'Container A\n▶ Running', at: 0.50, dy: 1.3
        })
      },
      scene(a) {
        KIT.note(a, 'kubelet poll liên tục', 'kubelet', 'mute', 0.3);
      }
    }
  ]
},

/* ── STEP ⑨: Report Running ── */
{
  title: 'Pod Running — cả cluster biết tin',
  pipelineStep: 6,
  focus: [],
  phases: [
    {
      title: 'Container healthy — thông tin bắt đầu đi ngược chiều',
      desc: KIT.desc(
        'Probes pass, container ổn định. Từ đây thông tin chảy <b>ngược lại</b>: từ Node lên Control Plane.',
        'Suốt 8 bước vừa rồi, dữ liệu đi một chiều xuống (Client → API Server → etcd → scheduler → kubelet → runtime). Giờ kubelet trở thành <b>bên báo cáo</b>.',
        'kubelet là component duy nhất được ghi <code>status</code> của Pod. <b>spec</b> do người dùng khai (mong muốn), <b>status</b> do kubelet báo (thực tế) — hai nửa gặp nhau trong cùng object, và cả Kubernetes chỉ làm mỗi việc thu hẹp khoảng cách giữa chúng.'),
      labels: ['container', 'kubelet'],
      set: {
        'container': KIT.pulse('ok', 'healthy', {label: 'Container A\n▶ Running ✓', at: 0.40, dy: 1.3})
      },
      scene(a) {
        KIT.note(a, 'spec = mong muốn · status = thực tế', {of: 'container', band: true}, 'mute', 0.2);
      }
    },
    {
      title: 'kubelet PATCH status lên API Server',
      desc: KIT.desc(
        'kubelet gọi <code>PATCH</code> lên sub-resource <code>pods/{name}/status</code>, báo <code>phase: Running</code> cùng trạng thái từng container và các condition (<code>Ready</code>, <code>ContainersReady</code>…).',
        'Nó lặp lại việc này định kỳ — vừa báo cáo trạng thái, vừa là <b>tín hiệu còn sống</b> của chính Node.',
        'Nếu kubelet ngừng báo cáo, <b>node controller</b> đánh Node là <code>NotReady</code> sau <code>node-monitor-grace-period</code> (mặc định ~40s), rồi bắt đầu evict Pod trên đó. Một Node “chết” trong mắt Kubernetes đơn giản là <b>một kubelet đã ngừng nói chuyện</b>.'),
      labels: ['kubelet', 'apiserver'],
      set: {
        'apiserver': KIT.pulse('ok', 'PATCH pods/status', {at: 1.30})
      },
      scene(a) {
        KIT.link(a, 'kubelet', 'apiserver', 'ok', {dur: 1.35, loop: 4.0, label: 'PATCH pods/status'});
        KIT.note(a, 'PATCH pod/status: Running', 'apiserver', 'ok', 0.2);
      }
    },
    {
      title: 'etcd: Pending → Running — giờ kubectl mới thấy 1/1',
      desc: KIT.desc(
        'API Server ghi status xuống etcd. Pod object cuối cùng đổi <span class="warn">Pending</span> → <span class="ok">Running</span>.',
        'Đây chính là khoảnh khắc <code>kubectl get pods</code> hiện <code>1/1 Running</code> — <b>rất lâu</b> sau khi <code>kubectl apply</code> của bạn đã trả về ở bước ②.',
        'Khoảng cách giữa <code>201 Created</code> ở bước ② và <code>Running</code> ở đây chính là <b>toàn bộ 7 bước ở giữa</b>. Bạn <code>watch kubectl get pods</code> thấy Pod đứng yên? Nó đang kẹt ở một trong các bước đó, và cột <code>STATUS</code> nói cho bạn biết bước nào.'),
      labels: ['etcd', 'pod'],
      set: {
        'pod': KIT.mark('live', 'Pending → Running', {
          label: 'Pod · ' + PRI + '\nworker-a · Running ✓', at: 1.35, dy: 2.0,
          hover: 'Cùng object đã ra đời ở bước ② — giờ mới thật sự chạy'
        })
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'etcd', 'warn', {loop: 3.8, label: 'PUT status: Running'});
      }
    },
    {
      title: 'Controller Manager đối chiếu replicas — và không làm gì cả',
      desc: KIT.desc(
        'ReplicaSet controller cũng đang watch. Nó so <b>desired</b> với <b>actual</b>: 3 mong muốn, 3 đang chạy. Khớp rồi → <b>không làm gì cả</b>.',
        '“Không làm gì” nghe như thất bại, nhưng đó là biểu hiện của một <b>reconcile loop khoẻ mạnh</b>: vòng lặp vẫn chạy mỗi khi có event, chỉ là không có việc để làm.',
        '<b>Nếu sau này Pod chết</b>, cùng vòng lặp phát hiện 2 ≠ 3 và tạo Pod thay thế — <b>toàn bộ pipeline ①→⑨ chạy lại từ đầu</b> cho Pod mới. Không ai “sửa” Pod cũ; Kubernetes chỉ liên tục hỏi <i>“thực tế đã khớp mong muốn chưa?”</i> và hành động khi câu trả lời là chưa.'),
      labels: ['ctrlmgr', 'apiserver'],
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
      set: {
        'kubeproxy': KIT.pulse('info', 'endpoints synced', {
          label: 'kube-proxy\niptables/ipvs ✓', at: 1.35, dy: 1.3
        })
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'kubeproxy', 'info', {loop: 3.8, label: 'watch EndpointSlice'});
        KIT.note(a, '⑨ toàn bộ vòng đời Pod đã khép kín', {of: 'pod', band: true}, 'mute', 1.6);
      }
    }
  ]
}

];
})();
