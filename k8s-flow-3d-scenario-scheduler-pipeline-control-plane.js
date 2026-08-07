/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — CONTROL PLANE (steps ①–⑤)

   Each step is split into `phases`: one phase = one explanation + one action.
   The engine flattens them (see k8s-flow-3d-engine-phase-expander.js), so a
   phase only ever plays its own flows and its own state changes — the viewer
   reads a single beat, clicks Next, and watches exactly that beat.

   A phase inherits `focus` / `cam` / `dist` / `pipelineStep` from its step
   unless it overrides them. Timings inside a phase are small (0–1.5s) because
   a phase now holds one action instead of a whole step's choreography.
══════════════════════════════════════════════ */
window.SCHED_STEPS_CONTROL_PLANE = [

/* ── STEP ①: Client → API Server ── */
{
  title: '① Bạn gửi Pod — API Server gác 3 cửa',
  pipelineStep: 0,
  focus: ['client', 'authn', 'admission', 'apiserver'],
  cam: [-16, 1, 0], dist: 26,
  phases: [
    {
      title: 'kubectl dịch YAML thành một HTTP request',
      desc: '<span class="lead">Mọi thứ bắt đầu bằng một HTTP request bình thường.</span>'
          + 'Bạn gõ <code>kubectl apply -f deploy.yaml</code>. kubectl đọc file, dịch sang JSON và gửi <code>POST /apis/apps/v1/deployments</code> tới <span class="hi">API Server</span> — <b>cửa duy nhất</b> để vào cluster. '
          + 'Không component nào (kể cả scheduler, kubelet) được phép đi đường khác.'
          + '<span class="why"><b>Ghi nhớ:</b> lúc này chưa có gì được ghi, chưa có Pod nào tồn tại. Mới chỉ là một request đang bay tới cổng.</span>',
      set: { 'client': { at: 0.15, badge: 'kubectl apply', flash: '#3a7fff' } },
      scene(a) {
        a.flow([[-22.4, 1.5, 0], [-21.2, 2.5, 0], [-19.9, 1.1, 0]], '#3a7fff', {at: 0.35, dur: 0.85, loop: 3.4});
        a.note('POST /apis/apps/v1/deployments', -19.4, 4.6, 0, '#6aaaf8', 0.1);
      }
    },
    {
      title: 'Cửa 1 — Authentication: “Bạn là ai?”',
      desc: '<span class="lead">API Server phải biết <b>ai</b> đang gọi trước khi nghĩ tới chuyện cho phép hay không.</span>'
          + 'Nó xác thực danh tính bằng <span class="hi">client certificate</span>, <span class="hi">bearer token</span> (ServiceAccount) hoặc <span class="hi">OIDC</span> — tuỳ cách cluster được cấu hình. '
          + 'Kết quả chỉ là một danh tính: username + groups. '
          + '<span class="why"><b>Thất bại ở đây → <code>401 Unauthorized</code>.</b> Kubernetes <b>không có</b> khái niệm “user object” trong etcd — danh tính đến từ certificate/token do bên ngoài cấp.</span>',
      set: {
        'authn': { at: 0.55, badge: 'certificate / token ✓', flash: '#3a7fff',
                   label: 'Authn · Authr\n✓ authenticated', col: '#0a1c30', edge: '#2a5a90' }
      },
      scene(a) {
        a.note('ai đang gọi? → username + groups', -19.4, 4.4, 0, '#6aaaf8', 0.2);
      }
    },
    {
      title: 'Cửa 2 — Authorization / RBAC: “Bạn được phép làm việc này không?”',
      desc: '<span class="lead">Danh tính đã rõ, giờ mới xét quyền.</span>'
          + 'RBAC đối chiếu: user này có <code>Role</code> / <code>ClusterRole</code> nào cho phép <code>create</code> trên resource <code>deployments</code>, trong đúng namespace này không? '
          + 'Quyền được nối vào user qua <code>RoleBinding</code> / <code>ClusterRoleBinding</code>. '
          + '<span class="why"><b>Thất bại ở đây → <code>403 Forbidden</code>.</b> Phân biệt rõ với 401: <b>401 = không biết bạn là ai</b>, <b>403 = biết bạn là ai nhưng không cho phép</b>. Đọc đúng mã lỗi giúp bạn sửa đúng chỗ.</span>',
      set: {
        'authn': { at: 0.55, badge: 'RBAC: allow', flash: '#18a855',
                   label: 'Authn · Authr\n✓ allowed', col: '#0a2418', edge: '#1a7040' }
      },
      scene(a) {
        a.flow([[-17.9, 1.1, 0], [-16.8, 2.3, 0], [-15.8, 1.3, 0]], '#18a855', {at: 0.75, dur: 0.85, loop: 3.4});
      }
    },
    {
      title: 'Cửa 3 — Admission Controllers: sửa và kiểm nội dung, rồi chấp nhận',
      desc: '<span class="lead">Cửa cuối chạy <b>2 pha</b> và là nơi duy nhất object có thể bị <b>thay đổi</b>.</span>'
          + '<b>Mutating</b> chạy trước — sửa object: inject sidecar (Istio), gắn default <code>resources</code>, thêm label, gán ServiceAccount. '
          + '<b>Validating</b> chạy sau — chỉ được nói có/không: <code>ResourceQuota</code> của namespace còn đủ? Pod Security Standard có pass? '
          + 'Qua hết → API Server chấp nhận request.'
          + '<span class="why"><b>Toàn bộ lớp bảo mật này fail-fast:</b> chỉ cần một cửa từ chối là dừng ngay, chưa ghi gì xuống. Nếu <code>kubectl apply</code> báo lỗi mà <code>kubectl get pods</code> không thấy gì, request đã chết ở bước ① này.</span>',
      set: {
        'admission': { at: 0.60, badge: 'mutate ✓ · validate ✓', flash: '#18a855',
                       label: 'Admission\n✓ admitted', col: '#0a2418', edge: '#1a7040' },
        'apiserver': { at: 1.60, badge: 'request admitted', flash: '#3a7fff' }
      },
      scene(a) {
        a.flow([[-13.5, 1.3, 0], [-12.4, 2.8, 0], [-11.2, 2.4, 0]], '#18a855', {at: 0.85, dur: 0.90, loop: 3.6});
        a.note('mutating → validating', -14.2, 4.4, 0, '#6a8ab0', 0.2);
      }
    }
  ]
},

/* ── STEP ②: API Server → etcd ── */
{
  title: '② Pod được ghi vào etcd — ra đời ở trạng thái Pending',
  pipelineStep: 1,
  focus: ['apiserver', 'etcd', 'pod-object'],
  cam: [-9, 1, -4], dist: 26,
  phases: [
    {
      title: 'Pod object được ghi xuống etcd',
      desc: '<span class="lead">API Server persist object vào <span class="hi">etcd</span> — key-value store là <b>nguồn sự thật duy nhất</b> của cluster.</span>'
          + 'Hai field quyết định số phận Pod lúc này: <code>spec.nodeName: ""</code> (chuỗi rỗng — <span class="warn">chưa Node nào nhận</span>) và <code>status.phase: Pending</code>. '
          + 'Từ giây phút này Pod chính thức <b>tồn tại</b> trong cluster, dù chưa có container nào chạy và chưa Node nào biết đến nó.'
          + '<span class="why">etcd là <b>component duy nhất</b> có trạng thái (stateful) trong control plane. Mất etcd = mất cluster; mọi thứ còn lại đều có thể dựng lại từ nó.</span>',
      show: ['pod-object'],
      showAt: { 'pod-object': 1.15 },
      set: {
        'pod-object': { label: 'Pod\nnodeName: ""\nphase: Pending',
                        badge: 'created · Pending', flash: '#c08000', dy: 1.1 }
      },
      scene(a) {
        a.flow([[-9, 3.2, -2.2], [-9, 4.8, -4.6], [-9, 3.0, -6.6]], '#c08000', {at: 0.30, dur: 1.05, loop: 3.8});
        a.note('PUT /api/v1/pods → Pending', -5.4, 4.8, -4, '#c08000', 0.3);
      }
    },
    {
      title: 'Raft consensus — write chỉ commit khi đa số đồng ý',
      desc: '<span class="lead">etcd không ghi ngay lập tức.</span>'
          + 'Nó chạy <span class="hi">Raft consensus</span>: node leader đề xuất write, gửi tới các member, và <b>chờ quá bán (quorum) xác nhận</b> rồi mới commit. Với cluster 3 node etcd, cần 2 node đồng ý.'
          + '<span class="why"><b>Đây là lý do etcd luôn chạy số lẻ (3, 5, 7).</b> Quorum của 3 là 2 → chịu được 1 node chết. Quorum của 4 cũng là 3 → vẫn chỉ chịu được 1 node chết, nhưng tốn thêm một máy. Số chẵn không mua thêm được khả năng chịu lỗi nào.</span>',
      set: { 'etcd': { at: 0.55, badge: 'Raft commit ✓ (quorum)', flash: '#c08000' } },
      scene(a) {
        a.note('leader → followers → quorum ✓', -9, 6.0, -6.6, '#c08000', 0.2);
      }
    },
    {
      title: '201 Created — và terminal của bạn thoát ngay tại đây',
      desc: '<span class="lead">Commit xong, API Server trả <code>201 Created</code> về cho kubectl. Lệnh <code>apply</code> kết thúc.</span>'
          + 'Pod vẫn đang <span class="warn">Pending</span>, chưa có Node, chưa có container. Nhưng với client thì request đã <b>thành công</b>.'
          + '<span class="why"><b>Hiểu nhầm phổ biến nhất:</b> <code>kubectl apply</code> trả về OK <span class="danger">không có nghĩa là ứng dụng đã chạy</span>. Nó chỉ có nghĩa <b>“ý định của bạn đã được ghi nhận vào etcd”</b>. Kubernetes là hệ <b>khai báo và bất đồng bộ</b>: bạn khai báo trạng thái mong muốn, các controller mới dần dần kéo thực tế về khớp với nó. Đó là lý do Pod có thể kẹt <code>Pending</code> hàng giờ mà lệnh apply vẫn “thành công”.</span>',
      set: { 'apiserver': { at: 1.30, badge: '201 Created', flash: '#18a855' } },
      scene(a) {
        a.flow([[-11.6, 1.8, 0.8], [-17, 3.6, 1.1], [-22.6, 1.6, 0.8]], '#18a855', {at: 0.30, dur: 1.05, loop: 3.8});
        a.note('② Pending ≠ Running', -9, -2.8, -6, '#6a8ab0', 0.4);
      }
    }
  ]
},

/* ── STEP ③: Scheduler WATCH → Queue ── */
{
  title: '③ Scheduler thấy Pod chưa có Node — xếp vào hàng đợi',
  pipelineStep: 2,
  focus: ['apiserver', 'scheduler', 'queue', 'q-pod-hi', 'q-pod-lo'],
  cam: [-7, 1, 6], dist: 24,
  phases: [
    {
      title: 'Scheduler mở List-Watch — không ai “gọi” nó cả',
      desc: '<span class="lead">Không có ai ra lệnh cho scheduler. Nó <b>chủ động lắng nghe</b>.</span>'
          + 'Cơ chế 2 pha: <b>List</b> lấy snapshot toàn bộ Pod đang có; <b>Watch</b> giữ một HTTP streaming connection dài hạn để nhận event <code>ADDED / MODIFIED / DELETED</code> ngay khi có thay đổi — <b>không hề polling</b>. '
          + 'Thấy Pod có <code>spec.nodeName == ""</code> → đây là Pod chưa ai nhận, việc của scheduler.'
          + '<span class="why"><b>Chi tiết quan trọng:</b> scheduler <span class="danger">không bao giờ nói chuyện trực tiếp với etcd</span>. Mọi component đều đi qua API Server — nhờ vậy etcd không bị hàng chục client cày, và mọi truy cập đều chịu chung một lớp auth + admission.</span>',
      set: { 'scheduler': { at: 1.20, badge: 'watch event nhận được', flash: '#8b6cff' } },
      scene(a) {
        a.flow([[-9, 3.2, 2.2], [-9, 4.9, 4.6], [-9, 2.7, 6.2]], '#8b6cff', {at: 0.30, dur: 1.05, loop: 3.8});
        a.note('WATCH pods?fieldSelector=spec.nodeName=', -9.6, 5.6, 4.4, '#8b6cff', 0.2);
      }
    },
    {
      title: 'Pod được đẩy vào ActiveQ',
      desc: '<span class="lead">Scheduler không xử lý Pod ngay khi nhận event — nó đẩy Pod vào hàng đợi <span class="hi">ActiveQ</span>.</span>'
          + 'Thực tế scheduler quản 3 hàng đợi: <b>activeQ</b> (sẵn sàng schedule), <b>backoffQ</b> (vừa thất bại, chờ retry với backoff tăng dần), và <b>unschedulableQ</b> (không có Node nào phù hợp, nằm chờ cho tới khi cluster đổi trạng thái).'
          + '<span class="why"><b>Vì sao phải có queue:</b> scheduler chỉ chạy <b>một Pod tại một thời điểm</b> (single-threaded scheduling cycle), để mỗi quyết định luôn nhất quán với snapshot tài nguyên hiện tại. Queue vừa hấp thụ burst hàng nghìn Pod, vừa là nơi Pod thất bại quay về retry thay vì bị bỏ rơi.</span>',
      show: ['queue'],
      showAt: { 'queue': 0.85 },
      set: { 'queue': { badge: 'ActiveQ', flash: '#5a3acc' } },
      scene(a) {
        a.flow([[-6.7, 1.7, 8], [-5.8, 2.7, 8], [-5.0, 1.5, 8]], '#5a3acc', {at: 0.25, dur: 0.70, loop: 3.2});
      }
    },
    {
      title: 'Xếp hàng theo PriorityClass — không phải FIFO',
      desc: '<span class="lead">ActiveQ là <b>priority queue</b>, không phải hàng đợi vào-trước-ra-trước.</span>'
          + 'Pod được sắp theo <span class="warn">PriorityClass</span> (field <code>spec.priority</code>). Pod <code>P=500</code> vừa vào sẽ <b>chen lên trước</b> Pod <code>P=100</code> đã đợi sẵn, và được pop ra xử lý trước.'
          + '<span class="why"><b>Đây là chỗ PriorityClass thực sự phát huy tác dụng.</b> Khi cluster rảnh, priority gần như vô nghĩa — mọi Pod đều được schedule. Khi tài nguyên cạn và hàng đợi dài, nó quyết định workload nào được xét trước. Và nếu vẫn không đủ chỗ, priority còn kích hoạt <b>Preemption</b> — đuổi Pod thấp điểm để nhường chỗ (xem kịch bản Preemption).</span>',
      show: ['q-pod-hi', 'q-pod-lo'],
      showAt: { 'q-pod-lo': 0.35, 'q-pod-hi': 0.85 },
      set: {
        'q-pod-lo': { flash: '#3a2a70' },
        'q-pod-hi': { badge: 'P=500 → đầu queue', flash: '#8b6cff', dy: 2.6 }
      },
      scene(a) {
        a.note('③ enqueue theo priority', -4.6, -3.0, 8, '#6a8ab0', 0.3);
      }
    }
  ]
},

/* ── STEP ④: Filter ── */
{
  title: '④ Filter — Node nào chạy được Pod này?',
  pipelineStep: 3,
  focus: ['scheduler', 'node-a', 'node-d', 'node-b', 'node-c', 'chip-a', 'chip-d', 'chip-b', 'chip-c'],
  cam: [1, 1, -1], dist: 40,
  phases: [
    {
      title: 'Worker A — pass: đủ tài nguyên, không vướng taint',
      desc: '<span class="lead">Pha đầu của scheduling cycle là <span class="hi">Filter</span> — câu hỏi <b>nhị phân</b>, không có điểm số: Node này <b>có thể</b> chạy Pod hay không?</span>'
          + 'Scheduler lấy danh sách Node từ <span class="hi">in-memory cache</span> (bản sao cluster state giữ sẵn trong RAM, đồng bộ qua Watch — nên quyết định mất mili-giây chứ không phải gọi API mỗi lần), rồi chạy <b>song song</b> các Filter plugin trên từng Node. '
          + 'Worker A qua hết: <code>NodeResourcesFit</code> ✓, <code>TaintToleration</code> ✓, <code>NodeAffinity</code> ✓.'
          + '<span class="why"><code>NodeResourcesFit</code> so với <b><code>requests</code></b>, không phải mức dùng thực tế. Node đang chạy 90% CPU vẫn “còn chỗ” nếu tổng requests còn thấp — đó là lý do đặt requests sai làm hỏng toàn bộ scheduling.</span>',
      show: ['chip-a'],
      showAt: { 'chip-a': 1.25 },
      set: { 'chip-a': { badge: '✓ fits', flash: '#22dd66', dy: 1.0 } },
      scene(a) {
        a.flow([[-3.2, 0.9, 8.4], [0.5, 2.8, 9.6], [4.4, -0.9, 10.8]], '#22dd66', {at: 0.30, dur: 1.10, loop: 3.8});
      }
    },
    {
      title: 'Worker D — pass: chật hơn nhưng vẫn đủ',
      desc: '<span class="lead">Worker D cũng qua được toàn bộ Filter.</span>'
          + 'Nó còn ít tài nguyên trống hơn A, nhưng Filter <b>không quan tâm nhiều hay ít</b> — chỉ cần <code>requests</code> của Pod lọt vào phần <code>allocatable</code> còn lại là pass.'
          + '<span class="why"><b>Đây chính là ranh giới giữa hai pha:</b> Filter trả lời <b>“được hay không”</b>, còn chuyện <b>“A hay D tốt hơn”</b> hoàn toàn không thuộc về nó — đó là việc của pha Score ở bước ⑤. Trộn lẫn hai câu hỏi này là nguồn gốc của rất nhiều hiểu nhầm về scheduler.</span>',
      show: ['chip-d'],
      showAt: { 'chip-d': 1.25 },
      set: { 'chip-d': { badge: '✓ fits', flash: '#22dd66', dy: 1.0 } },
      scene(a) {
        a.flow([[-3.2, 0.7, 7.8], [1.5, 2.6, 4.2], [6.6, -0.9, 1.3]], '#22dd66', {at: 0.30, dur: 1.10, loop: 3.8});
      }
    },
    {
      title: 'Worker B — rejected: không đủ CPU',
      desc: '<span class="lead">Worker B trượt <code>NodeResourcesFit</code>: tổng <code>requests</code> của các Pod đang chạy cộng với Pod mới đã vượt <code>allocatable</code>.</span>'
          + 'Node <b>bị loại ngay lập tức</b> — scheduler không buồn chạy nốt các plugin còn lại cho Node này.'
          + '<span class="why"><b>Logic Filter là AND tuyệt đối:</b> <span class="danger">chỉ cần MỘT plugin trả về false là Node bị loại</span>, bất kể nó tốt đến đâu ở mọi tiêu chí khác. Không có “gần đủ”, không có điểm an ủi.</span>',
      show: ['chip-b'],
      showAt: { 'chip-b': 1.25 },
      set: {
        'chip-b': { badge: '✗ Insufficient cpu', flash: '#c43030', dy: 1.0 },
        'node-b': { col: '#1a0808', edge: '#5a1818', at: 1.25, flash: '#c43030' }
      },
      scene(a) {
        a.flow([[-3.2, 0.5, 7.2], [1.5, 2.8, -0.8], [6.6, -0.9, -4.7]], '#c43030', {at: 0.30, dur: 1.10, loop: 3.8});
      }
    },
    {
      title: 'Worker C — rejected: vướng taint · 2 Node sống sót',
      desc: '<span class="lead">Worker C trượt <code>TaintToleration</code>: Node bị bôi <code>taint</code> (ví dụ <code>node-role.kubernetes.io/control-plane:NoSchedule</code>) mà Pod không khai <code>toleration</code> tương ứng.</span>'
          + 'Kết quả bước ④: <b>4 Node vào, 2 Node ra</b>. Chỉ A và D được chuyển sang pha Score.'
          + '<span class="why"><b>Đây là lý do #1 khiến Pod không chạy.</b> Nếu <b>không Node nào</b> qua được Filter, Pod quay về queue với event <code>FailedScheduling</code> và đứng mãi ở <code>Pending</code>. <code>kubectl describe pod</code> sẽ nói chính xác plugin nào đã loại và loại bao nhiêu Node: <i>“0/4 nodes are available: 2 Insufficient cpu, 2 node(s) had untolerated taint”</i> — đọc dòng đó là biết phải sửa gì.</span>',
      show: ['chip-c'],
      showAt: { 'chip-c': 1.25 },
      set: {
        'chip-c': { badge: '✗ untolerated taint', flash: '#c43030', dy: 1.0 },
        'node-c': { col: '#1a0808', edge: '#5a1818', at: 1.25, flash: '#c43030' }
      },
      scene(a) {
        a.flow([[-3.2, 0.3, 6.8], [1.5, 3.0, -5.6], [6.6, -0.9, -10.7]], '#c43030', {at: 0.30, dur: 1.10, loop: 3.8});
        a.note('④ 4 Node → 2 Node qua được Filter', -6.5, -3.2, 2, '#6a8ab0', 1.5);
      }
    }
  ]
},

/* ── STEP ⑤: Score ── */
{
  title: '⑤ Score — trong số đó, Node nào tốt nhất?',
  pipelineStep: 3,
  focus: ['scheduler', 'node-a', 'node-d', 'chip-a', 'chip-d'],
  cam: [3, 1, 5], dist: 32,
  phases: [
    {
      title: 'Worker D được 71 điểm',
      desc: '<span class="lead">Filter cho ta các Node <b>khả thi</b>. Pha Score chọn ra Node <b>tối ưu</b> — ở đây không còn đúng/sai, chỉ có tốt hơn / kém hơn.</span>'
          + 'Mỗi plugin chấm Node một điểm 0–100, rồi cộng có trọng số: <code>Score = Σ(plugin_score × weight)</code>. '
          + 'Worker D được <span class="hi">71</span>: hợp lệ hoàn toàn, nhưng đang chật hơn nên <code>LeastAllocated</code> chấm thấp.'
          + '<span class="why">Điểm số <b>không</b> được lưu ở đâu cả — nó được tính lại từ đầu cho mỗi lần schedule. Cùng một Pod, schedule ở hai thời điểm khác nhau, có thể ra hai Node khác nhau.</span>',
      scoreMode: true,
      scoreTitle: 'score = Σ(plugin × weight)',
      scores: [{name: 'Worker A', v: 94, win: true}, {name: 'Worker D', v: 71}],
      set: { 'chip-d': { label: '✓ Pass · Score 71', at: 1.15, badge: 'score 71', flash: '#6aaaf8', dy: 1.0 } },
      scene(a) {
        a.flow([[-6.6, 1.6, 7.4], [0.5, 3.2, 4.2], [6.6, -0.9, 1.3]], '#6aaaf8', {at: 0.30, dur: 1.05, loop: 3.8});
        a.note('⑤ Score = Σ(plugin × weight)', -7, -3.2, 8, '#6a8ab0', 0.2);
      }
    },
    {
      title: 'Worker A được 94 điểm — các plugin đã chấm những gì',
      desc: '<span class="lead">Worker A đạt <span class="ok">94</span>. Các plugin chính đóng góp vào con số đó:</span>'
          + '<code>NodeResourcesLeastAllocated</code> — Node còn trống nhiều được điểm cao, giúp <b>trải đều tải</b> (mặc định); đổi sang <code>MostAllocated</code> nếu bạn muốn <b>dồn Pod để scale-down bớt Node</b> cho rẻ · '
          + '<code>InterPodAffinity / AntiAffinity</code> — thưởng Node đã có Pod “bạn” (giảm latency), phạt Node đã có Pod cùng loại (tránh trứng một giỏ) · '
          + '<code>PodTopologySpread</code> — thưởng Node ở zone đang có ít replica, để service sống sót khi mất cả một AZ · '
          + '<code>ImageLocality</code> — Node đã cache sẵn image được cộng điểm vì khỏi phải pull vài trăm MB.',
      scoreMode: true,
      scoreTitle: 'score = Σ(plugin × weight)',
      scores: [{name: 'Worker A', v: 94, win: true}, {name: 'Worker D', v: 71}],
      set: {
        'chip-a': { label: '✓ Pass · Score 94 ★', col: '#2a2000', edge: '#fbbf24',
                    at: 1.15, badge: 'score 94 ★', flash: '#fbbf24', dy: 1.0 }
      },
      scene(a) {
        a.flow([[-6.6, 2.0, 8.4], [0.5, 3.6, 9.6], [4.4, -0.9, 10.8]], '#fbbf24', {at: 0.30, dur: 1.05, loop: 3.8});
      }
    },
    {
      title: 'Node điểm cao nhất thắng — và đây là chỗ bạn “lái” được scheduler',
      desc: '<span class="lead">Scheduler chọn Node có tổng điểm cao nhất: <b>Worker A (94)</b>. Hoà điểm thì chọn ngẫu nhiên trong nhóm dẫn đầu, để tránh dồn cục vào một Node.</span>'
          + 'Quyết định đã xong — nhưng lưu ý nó mới chỉ nằm <b>trong bộ nhớ của scheduler</b>, chưa ai khác biết.'
          + '<span class="why"><b>Đây là toàn bộ chỗ bạn có thể điều khiển hành vi đặt Pod:</b> chỉnh <code>weight</code> của từng plugin trong <b>Scheduler Profile</b>, thêm <code>topologySpreadConstraints</code>, dùng affinity, hoặc viết plugin riêng qua <b>Scheduler Framework</b> — <span class="danger">không cần fork kube-scheduler.</span> Nếu Pod cứ dồn vào một Node, câu trả lời gần như luôn nằm ở pha Score chứ không phải Filter.</span>',
      scoreMode: true,
      scoreTitle: 'score = Σ(plugin × weight)',
      scores: [{name: 'Worker A', v: 94, win: true}, {name: 'Worker D', v: 71}],
      set: {
        'node-a': { col: '#0d2018', edge: '#1a7040',
                    at: 0.60, badge: '★ selected node', flash: '#fbbf24', dy: 2.6 }
      },
      scene(a) {
        a.note('★ Worker A thắng', 4.4, -2.4, 10.8, '#fbbf24', 0.3);
      }
    }
  ]
}

];
