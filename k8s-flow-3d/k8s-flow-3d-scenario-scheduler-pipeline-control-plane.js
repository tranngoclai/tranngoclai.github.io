/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — CONTROL PLANE (steps ①–⑤)

   Viết bằng SCENE_KIT: `KIT.desc` cho panel, `KIT.mark`/`pulse`/`move` cho
   state change, `KIT.flow`/`note` cho choreography, `KIT.score` cho HUD.

   Mỗi step chia thành `phases`: một phase = một lời giải thích + một hành
   động. Engine flatten chúng (xem flow3d-engine-phase-expander.js) nên mỗi
   phase chỉ chạy đúng flow và đúng state change của riêng nó — người xem đọc
   một nhịp, bấm Next, và thấy đúng nhịp đó chạy.

   Phase kế thừa `focus` / `cam` / `dist` / `pipelineStep` từ step nếu không
   override. Timing trong một phase nhỏ (0–1.5s) vì phase chỉ giữ một hành động.

   Hai điểm khác hẳn bản trước, theo đúng quy tắc của kit:

     · **Verdict nằm trên chính Node.** Bước ④ và ⑤ đổi tone + gắn badge lên
       `node-a/d/b/c` thay vì bật bốn hộp chip đứng cạnh. Label Node giữ
       nguyên tên + con số cpu suốt kịch bản.
     · **Một hộp `pod` duy nhất.** Nó được ghi xuống etcd ở ②, bay vào ActiveQ
       ở ③ (`KIT.move`), và ở lại đó cho tới khi kubelet nhận việc ở ⑦.

   Vì `focusLabels` bật, mỗi phase khai `labels` — danh sách component **được
   phép hiện caption** trong nhịp đó. Component khác vẫn đứng nguyên hình,
   chỉ là không kèm chữ, nên khung hình không biến thành bảng số.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const MODEL = window.SCHEDULER_MODEL;
const P = window.SCHED_POS;

/* Chạy đúng một lần. Verdict của bước ④ và điểm của bước ⑤ đều lấy từ đây, nên
   badge trên Node, con số trong lời giải thích và hàng HUD không thể lệch nhau
   — xem k8s-flow-3d-scenario-scheduler-model.js. */
const RUN = MODEL.simulate(MODEL.DEFAULT_CONFIG);

/* Verdict Filter tra theo key Node. */
const V = {};
RUN.filter.evaluated.forEach(function(e) { V[e.key] = e; });

/* Nhãn priority của Pod chính và Pod đang chờ — dùng cả trong label 3D lẫn
   trong lời giải thích ở bước ③. */
const POD = MODEL.DEFAULT_CONFIG.pod;
const PEER = MODEL.DEFAULT_CONFIG.queuePeer;
const PRI = 'P=' + POD.priority;

/* Hàng HUD của bước ⑤ — khai một lần, mọi phase của step dùng chung
   (phase expander kế thừa `scores` từ step). Thứ tự theo điểm giảm dần để
   người xem đọc được thứ hạng mà không cần đếm. */
const SCORE_ROWS = RUN.scored.map(function(e) {
  return KIT.score(e.name, e.score, {win: RUN.isWinner(e.key)});
});


/* ── Step ④ Filter: per-Node copy ──
   Descriptions are the whole point of the deck, so they stay hand-written.
   Only the structural boilerplate (set, scene, timing) is generated. */
var FILTER_TITLES = {
  'node-a': 'Worker A đạt — đủ tài nguyên, không vướng taint',
  'node-d': 'Worker D đạt — chật hơn nhưng vẫn đủ chỗ',
  'node-b': 'Worker B bị loại — thiếu CPU',
  'node-c': 'Worker C bị loại — vướng taint · còn 2 Node'
};
var FILTER_LABELS = {
  'node-a': ['scheduler', 'node-a'],
  'node-d': ['scheduler', 'node-a', 'node-d'],
  'node-b': ['scheduler', 'node-b'],
  'node-c': ['scheduler', 'node-c']
};
var FILTER_HOVER = {
  'node-a': 'cpu ' + MODEL.fmtCpu(V['node-a'].node) + ' — thừa chỗ, không taint chặn',
  'node-d': 'cpu ' + MODEL.fmtCpu(V['node-d'].node) + ' — chật hơn A nhưng Filter không chấm điểm',
  'node-b': 'cpu ' + MODEL.fmtCpu(V['node-b'].node) + ' — hết chỗ cho requests của Pod',
  'node-c': 'Còn thừa cpu — nhưng taint chặn, xoá Pod cũng không gỡ được taint'
};
var FILTER_DESCS = {
  'node-a': KIT.desc(
    'Pha đầu của scheduling cycle là <span class="hi">Filter</span> — câu hỏi <b>nhị phân</b>: Node này <b>có thể</b> chạy Pod không?',
    'Scheduler lấy danh sách Node từ <span class="hi">in-memory cache</span> (bản sao cluster state trong RAM, đồng bộ qua Watch — nên quyết định mất mili-giây, không cần gọi API mỗi lần), rồi chạy <b>song song</b> các Filter plugin trên từng Node. '
    + 'Worker A qua hết: <code>NodeResourcesFit</code> ✓, <code>TaintToleration</code> ✓, <code>NodeAffinity</code> ✓.',
    '<code>NodeResourcesFit</code> so với <b><code>requests</code></b>, không phải mức dùng thực tế. Node chạy 90% CPU vẫn "còn chỗ" nếu tổng requests còn thấp — đặt requests sai là hỏng cả scheduling.'),
  'node-d': KIT.desc(
    'Worker D cũng qua toàn bộ Filter.',
    'Nó ít tài nguyên trống hơn A (<code>cpu 11/16</code>), nhưng Filter <b>không quan tâm nhiều hay ít</b> — chỉ cần <code>requests</code> của Pod lọt vào <code>allocatable</code> còn lại là pass.',
    '<b>Ranh giới giữa hai pha:</b> Filter trả lời <b>"được hay không"</b>, còn <b>"A hay D tốt hơn"</b> là việc của pha Score ở bước ⑤. Lẫn lộn hai câu hỏi này là nguồn hiểu nhầm phổ biến về scheduler.'),
  'node-b': KIT.desc(
    'Worker B trượt <code>NodeResourcesFit</code>: tổng <code>requests</code> của các Pod đang chạy (<code>cpu 15/16</code>) cộng Pod mới đã vượt <code>allocatable</code>.',
    'Node <b>bị loại ngay</b> — scheduler không buồn chạy nốt các plugin còn lại.',
    '<b>Logic Filter là AND tuyệt đối:</b> <span class="danger">chỉ cần MỘT plugin false là Node bị loại</span>, dù tốt đến đâu ở tiêu chí khác. Không có "gần đủ", không có điểm an ủi.'),
  'node-c': KIT.desc(
    'Worker C trượt <code>TaintToleration</code>: Node bị bôi <code>taint</code> (<code>node-role.kubernetes.io/control-plane:NoSchedule</code>) mà Pod không khai <code>toleration</code> tương ứng.',
    'Nó là Node <b>rỗng nhất cluster</b> (<code>cpu 2/16</code>) mà vẫn bị loại. Kết quả bước ④: <b>4 Node vào, 2 Node ra</b> — chỉ A và D vào pha Score.',
    '<b>Lý do #1 khiến Pod không chạy.</b> Nếu <b>không Node nào</b> qua Filter, Pod quay về queue với event <code>FailedScheduling</code> và kẹt ở <code>Pending</code>. <code>kubectl describe pod</code> nói rõ plugin nào loại bao nhiêu Node: <i>"0/4 nodes are available: 2 Insufficient cpu, 2 node(s) had untolerated taint"</i> — đọc dòng đó là biết sửa gì.')
};
var FILTER_EXPLAIN = {
  'node-a': [
    {of: 'scheduler', tone: 'ok', text: 'Scheduler chạy <b>song song</b> các Filter plugin trên từng Node, lấy list từ <span class="hi">in-memory cache</span> (đồng bộ qua Watch) nên quyết định mất mili-giây.'},
    {of: 'node-a', tone: 'ok', text: 'Worker A qua hết: <code>NodeResourcesFit</code> ✓, <code>TaintToleration</code> ✓, <code>NodeAffinity</code> ✓.'}
  ],
  'node-d': [
    {of: 'node-d', tone: 'ok', text: 'Worker D cũng qua toàn bộ Filter — ít trống hơn A nhưng Filter <b>không quan tâm nhiều hay ít</b>, chỉ cần requests lọt vào allocatable còn lại.'},
    {of: ['node-a', 'node-d'], tone: 'mute', text: 'Filter trả lời "được hay không", còn "A hay D tốt hơn" là việc của pha Score ở bước ⑤.'}
  ],
  'node-b': [
    {of: 'node-b', tone: 'danger', text: 'Worker B trượt <code>NodeResourcesFit</code>: requests đang chạy cộng Pod mới đã vượt allocatable. Node bị loại ngay, không chạy nốt các plugin còn lại.'},
    {of: 'node-b', tone: 'mute', text: '<b>Logic Filter là AND tuyệt đối:</b> chỉ cần MỘT plugin false là Node bị loại, dù tốt đến đâu ở tiêu chí khác.'}
  ],
  'node-c': [
    {of: 'node-c', tone: 'danger', text: 'Worker C trượt <code>TaintToleration</code>: Node bị bôi taint mà Pod không khai toleration tương ứng — dù là Node rỗng nhất cluster.'},
    {of: 'scheduler', tone: 'mute', text: 'Nếu <b>không Node nào</b> qua Filter, Pod quay về queue với event <code>FailedScheduling</code> và kẹt Pending. <code>kubectl describe pod</code> nói rõ plugin nào loại bao nhiêu Node.'}
  ]
};

/* Nhịp của chuỗi 3 cửa ở bước ①. `set` và `scene` cùng đọc bộ số này nên chỉnh
   tốc độ một chỗ là badge và mũi tên vẫn khớp nhau. */
const GATE_PACE = {at: 0.35, dur: 0.85};
const GATE_HOP = KIT.chainTimes(3, GATE_PACE);

/* Nhịp chuỗi watch ở bước ③: API Server → scheduler → ActiveQ. */
const WATCH_PACE = {at: 0.30, dur: 0.90};
const WATCH_HOP = KIT.chainTimes(2, WATCH_PACE);

window.SCHED_STEPS_CONTROL_PLANE = [

/* ── STEP ①: Client → API Server ── */
{
  title: 'Bạn gửi Pod đi — API Server gác 3 cửa',
  pipelineStep: 0,
  focus: ['client', 'authn', 'admission', 'apiserver'],
  /* Ba cửa là ba chặng của MỘT request đang bay, không phải ba sự kiện rời:
     request không bao giờ quay lại cửa trước, và nó chỉ có một đích — API
     Server. Nên cả đoạn chạy trong một phase bằng KIT.chain, mark của từng cửa
     hẹn đúng lúc mũi tên chặng đó cập bến. Cửa nào từ chối thì chuỗi dừng —
     đó là chuyện của phase khác, không phải một nhánh vẽ chung ở đây. */
  phases: [
    {
      title: 'kubectl → Authn → Authz/RBAC → Admission → API Server',
      desc: KIT.desc(
        'Mọi thứ bắt đầu bằng một HTTP request bình thường, và nó phải qua <b>ba cửa liên tiếp</b> trước khi API Server chấp nhận.',
        ['Bạn gõ <code>kubectl apply -f deploy.yaml</code>. kubectl dịch YAML sang JSON và gửi <code>POST /apis/apps/v1/deployments</code> tới <span class="hi">API Server</span> — <b>cửa duy nhất</b> vào cluster; không component nào, kể cả scheduler hay kubelet, được đi đường khác.',
         '<b>Cửa 1 · Authentication</b> — “bạn là ai?”. Xác thực bằng <span class="hi">client certificate</span>, <span class="hi">bearer token</span> (ServiceAccount) hoặc <span class="hi">OIDC</span>. Kết quả chỉ là một danh tính: username + groups. Thất bại → <code>401</code>.',
         '<b>Cửa 2 · Authorization / RBAC</b> — “được phép làm việc này không?”. RBAC soi <code>Role</code>/<code>ClusterRole</code> nối vào user qua <code>RoleBinding</code>: có <code>create</code> trên <code>deployments</code> trong namespace này không? Thất bại → <code>403</code>.',
         '<b>Cửa 3 · Admission</b> — chạy 2 pha và là nơi <b>duy nhất</b> object bị sửa. <b>Mutating</b> inject sidecar, gắn default <code>resources</code>, gán ServiceAccount; <b>Validating</b> chỉ nói có/không: <code>ResourceQuota</code> còn đủ? Pod Security Standard pass chưa?'],
        '<b>401 vs 403:</b> 401 = không biết bạn là ai, 403 = biết nhưng không cho phép — đọc đúng mã là sửa đúng chỗ. '
        + '<b>Cả lớp này fail-fast:</b> một cửa từ chối là dừng ngay, chưa ghi gì xuống. <code>kubectl apply</code> báo lỗi mà <code>kubectl get pods</code> không thấy gì → request đã chết ở bước ① này, chưa Pod nào từng tồn tại.'),
      labels: ['client', 'authn', 'admission', 'apiserver'],
      /* Chuỗi chạy xong rồi mới tới phần đọc: mỗi cửa một nhịp, camera tự tới
         đúng cửa đang nói. Nhịp cuối nói về cả lớp cổng nên nó lùi ra ôm cả
         bốn component — chỗ đó không thuộc riêng cửa nào. */
      explain: [
        {of: 'client', tone: 'info', text: 'kubectl dịch YAML sang JSON rồi <code>POST /apis/apps/v1/deployments</code>. <b>API Server là cửa duy nhất</b> vào cluster — kể cả scheduler hay kubelet cũng không đi đường khác.'},
        {of: 'authn', tone: 'sky', text: '<b>Cửa 1 · Authentication</b> — “bạn là ai?”. Certificate, bearer token (ServiceAccount) hoặc OIDC. Kết quả chỉ là một danh tính: username + groups. Sai → <code>401</code>.'},
        {of: 'authn', tone: 'pass', text: '<b>Cửa 2 · Authorization</b> — “được phép không?”. RBAC soi <code>Role</code>/<code>ClusterRole</code> nối vào user qua <code>RoleBinding</code>. Không đủ quyền → <code>403</code>. <b>401 = không biết bạn là ai, 403 = biết nhưng không cho.</b>'},
        {of: 'admission', tone: 'warn', text: '<b>Cửa 3 · Admission</b> — nơi <b>duy nhất</b> object bị sửa. <b>Mutating</b> inject sidecar, gắn default <code>resources</code>; <b>Validating</b> chỉ nói có/không: quota còn đủ? Pod Security pass chưa?'},
        {of: ['client', 'authn', 'admission', 'apiserver'], tone: 'mute', text: 'Cả lớp này <b>fail-fast</b>: một cửa từ chối là dừng ngay, chưa ghi gì xuống. <code>kubectl apply</code> báo lỗi mà <code>kubectl get pods</code> không thấy gì → request đã chết ở đây, chưa Pod nào từng tồn tại.'}
      ],
      set: {
        'client': KIT.pulse('info', 'kubectl apply', {at: 0.15}),
        // Một badge cho mỗi cửa, hẹn đúng lúc mũi tên của cửa đó cập bến —
        // xem HOP bên dưới; số liệu ở đây phải khớp với chain, không gõ tay.
        'authn': KIT.mark('ok', 'authn ✓ · RBAC allow', {at: GATE_HOP[0].arrive, flash: KIT.ink('pass')}),
        'admission': KIT.mark('ok', 'mutate ✓ · validate ✓', {at: GATE_HOP[1].arrive, flash: KIT.ink('pass')}),
        'apiserver': KIT.pulse('info', 'request admitted', {at: GATE_HOP[2].arrive})
      },
      scene(a) {
        KIT.chain(a, ['client', 'authn', 'admission', 'apiserver'], 'info', Object.assign({
          labels: ['POST deployments', 'authorize · RBAC', 'admit request'],
          inks: ['info', 'pass', 'pass']
        }, GATE_PACE));
      }
    }
  ]
},

/* ── STEP ②: API Server → etcd ── */
{
  title: 'Pod ra đời trong etcd — nhưng vẫn đang Pending',
  pipelineStep: 1,
  focus: ['apiserver', 'etcd', 'pod'],
  phases: [
    {
      title: 'Pod object được ghi xuống etcd',
      desc: KIT.desc(
        'API Server persist object vào <span class="hi">etcd</span> — key-value store, <b>nguồn sự thật duy nhất</b> của cluster.',
        'Hai field quyết định số phận Pod: <code>spec.nodeName: ""</code> (rỗng — <span class="warn">chưa Node nào nhận</span>) và <code>status.phase: Pending</code>. '
        + 'Từ giây này Pod chính thức <b>tồn tại</b> trong cluster, dù chưa container nào chạy và chưa Node nào biết đến nó.',
        'etcd là <b>component duy nhất</b> stateful trong control plane. Mất etcd là mất cluster; mọi thứ khác dựng lại được từ nó.'),
      labels: ['etcd', 'pod'],
      explain: [
        {of: 'etcd', tone: 'warn', text: 'API Server persist object vào etcd — key-value store, <b>nguồn sự thật duy nhất</b> của cluster.'},
        {of: 'pod', tone: 'warn', text: 'Hai field quyết định số phận Pod: <code>spec.nodeName: ""</code> (chưa Node nào nhận) và <code>status.phase: Pending</code>. Từ giây này Pod chính thức <b>tồn tại</b>, dù chưa container nào chạy.'},
        {of: 'etcd', tone: 'mute', text: 'etcd là <b>component duy nhất</b> stateful trong control plane. Mất etcd là mất cluster; mọi thứ khác dựng lại được từ nó.'}
      ],
      show: ['pod'],
      showAt: { 'pod': 1.15 },
      set: {
        'pod': KIT.pulse('warn', 'created · Pending', {
          label: 'Pod · ' + PRI + '\nnodeName: ""', status: 'pending', dy: 1.1
        })
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'etcd', 'warn', {loop: 3.8, label: 'PUT Pod · Pending'});
        KIT.note(a, 'PUT /api/v1/pods → Pending', 'etcd', 'warn', 0.3);
      }
    },
    {
      title: 'Raft consensus — write chỉ commit khi đa số đồng ý',
      desc: KIT.desc(
        'etcd không ghi ngay.',
        'Nó chạy <span class="hi">Raft consensus</span>: leader đề xuất write, gửi tới các member, <b>chờ quá bán (quorum) xác nhận</b> rồi mới commit. Cluster 3 node etcd cần 2 node đồng ý.',
        '<b>Vì vậy etcd luôn chạy số lẻ (3, 5, 7).</b> Quorum của 3 là 2 → chịu được 1 node chết. Quorum của 4 cũng là 3 → vẫn chỉ chịu 1 node chết, nhưng tốn thêm một máy. Số chẵn không mua thêm khả năng chịu lỗi.'),
      labels: ['etcd'],
      explain: [
        {of: 'etcd', tone: 'warn', text: 'etcd không ghi ngay. Nó chạy <b>Raft consensus</b>: leader đề xuất write, gửi tới các member, <b>chờ quá bán (quorum)</b> xác nhận rồi mới commit.'},
        {of: 'etcd', tone: 'mute', text: '<b>Vì vậy etcd luôn chạy số lẻ (3, 5, 7).</b> Quorum của 3 là 2 → chịu được 1 node chết. Số chẵn không mua thêm khả năng chịu lỗi.'}
      ],
      set: {
        'etcd': KIT.pulse('warn', 'Raft commit ✓ (quorum)', {at: 0.55})
      },
      scene(a) {
        KIT.bubble(a, 'etcd', 'leader → followers', {at: 0.25, dur: 2.4, tone: 'warn'});
        KIT.bubble(a, 'etcd', 'quorum ✓', {at: 1.2, dur: 1.8, tone: 'ok', dy: 3.5});
      }
    },
    {
      title: '201 Created — và lệnh apply của bạn kết thúc ngay đây',
      desc: KIT.desc(
        'Commit xong, API Server trả <code>201 Created</code> cho kubectl. Lệnh <code>apply</code> kết thúc.',
        'Pod vẫn <span class="warn">Pending</span>, chưa Node, chưa container. Nhưng với client, request đã <b>thành công</b>.',
        '<b>Hiểu nhầm phổ biến nhất:</b> <code>kubectl apply</code> trả OK <span class="danger">không có nghĩa ứng dụng đã chạy</span> — chỉ nghĩa là <b>"ý định của bạn đã ghi vào etcd"</b>. Kubernetes <b>khai báo và bất đồng bộ</b>: bạn khai báo trạng thái mong muốn, controller dần kéo thực tế khớp nó. Vì vậy Pod có thể kẹt <code>Pending</code> hàng giờ mà apply vẫn "thành công".'),
      labels: ['client', 'apiserver', 'pod'],
      explain: [
        {of: ['client', 'apiserver'], tone: 'pass', text: 'Commit xong, API Server trả <code>201 Created</code> cho kubectl. Lệnh <code>apply</code> kết thúc — nhưng Pod vẫn <span class="warn">Pending</span>, chưa Node, chưa container.'},
        {of: 'pod', tone: 'mute', text: '<code>kubectl apply</code> trả OK <b>không có nghĩa ứng dụng đã chạy</b> — chỉ nghĩa "ý định của bạn đã ghi vào etcd". Kubernetes <b>khai báo và bất đồng bộ</b>: bạn khai báo, controller dần kéo thực tế khớp nó.'}
      ],
      set: {
        'apiserver': KIT.pulse('pass', '201 Created', {at: 1.30})
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'client', 'pass', {loop: 3.8, label: '201 Created'});
        KIT.note(a, '② Pending ≠ Running', {of: 'etcd', band: true}, 'mute', 0.4);
      }
    }
  ]
},

/* ── STEP ③: Scheduler WATCH → Queue ── */
{
  title: 'Scheduler thấy Pod chưa có Node và xếp nó vào hàng đợi',
  pipelineStep: 2,
  focus: ['apiserver', 'scheduler', 'queue', 'pod', 'q-pod-lo'],
  /* Event bay từ API Server tới scheduler rồi Pod bị đẩy tiếp vào ActiveQ:
     một mạch, không chặng nào quay lại — nên chạy liền trong một phase. */
  phases: [
    {
      title: 'API Server → scheduler (watch) → ActiveQ',
      desc: KIT.desc(
        'Không ai ra lệnh cho scheduler. Nó <b>chủ động lắng nghe</b>, và Pod nó nhặt được đi thẳng vào hàng đợi.',
        ['<b>List-Watch</b> — <b>List</b> lấy snapshot toàn bộ Pod hiện có; <b>Watch</b> giữ một HTTP streaming connection dài hạn nhận event <code>ADDED / MODIFIED / DELETED</code> ngay khi có thay đổi, <b>không polling</b>. Thấy Pod <code>spec.nodeName == ""</code> → chưa ai nhận, việc của scheduler.',
         '<b>Push vào ActiveQ</b> — scheduler không xử lý Pod ngay. Nó quản 3 hàng đợi: <b>activeQ</b> (sẵn sàng schedule), <b>backoffQ</b> (vừa thất bại, chờ retry với backoff tăng dần), <b>unschedulableQ</b> (không Node nào phù hợp, chờ cluster đổi trạng thái).'],
        '<b>Scheduler không bao giờ nói chuyện trực tiếp với etcd</b> — mọi component đi qua API Server, nhờ vậy etcd không bị hàng chục client cày và mọi truy cập chịu chung lớp auth + admission. '
        + '<b>Và vì sao cần queue:</b> scheduler chỉ chạy <b>một Pod một lúc</b> (single-threaded) để quyết định luôn khớp snapshot tài nguyên hiện tại; queue hấp thụ burst hàng nghìn Pod và giữ chỗ cho Pod thất bại quay lại retry.'),
      labels: ['apiserver', 'scheduler', 'queue', 'pod'],
      explain: [
        {of: 'scheduler', tone: 'accent', text: 'Không ai ra lệnh cho scheduler — nó <b>chủ động lắng nghe</b>. <b>List</b> lấy snapshot, <b>Watch</b> giữ một HTTP stream dài hạn nhận <code>ADDED / MODIFIED / DELETED</code>, <b>không polling</b>. Thấy <code>spec.nodeName == ""</code> là việc của nó.'},
        {of: 'queue', tone: 'queue', text: 'Scheduler không xử lý ngay mà đẩy vào <b>ActiveQ</b>. Nó quản 3 hàng đợi: <b>activeQ</b> (sẵn sàng), <b>backoffQ</b> (vừa trượt, chờ retry), <b>unschedulableQ</b> (chưa Node nào hợp).'},
        {of: ['apiserver', 'scheduler'], tone: 'mute', text: 'Scheduler <b>không bao giờ nói chuyện trực tiếp với etcd</b> — mọi component đi qua API Server, nên etcd không bị hàng chục client cày và mọi truy cập chịu chung lớp auth + admission.'},
        {of: ['scheduler', 'queue'], tone: 'mute', text: 'Vì sao cần queue: scheduler chỉ chạy <b>một Pod một lúc</b> để quyết định luôn khớp snapshot tài nguyên hiện tại. Queue hấp thụ burst hàng nghìn Pod và giữ chỗ cho Pod trượt quay lại retry.'}
      ],
      show: ['queue'],
      showAt: { 'queue': WATCH_HOP[1].arrive },
      set: {
        'scheduler': KIT.pulse('accent', 'watch event nhận được', {at: WATCH_HOP[0].arrive}),
        'queue': KIT.pulse('queue', 'ActiveQ')
      },
      scene(a) {
        KIT.chain(a, ['apiserver', 'scheduler', 'queue'], 'accent', Object.assign({
          labels: ['watch event', 'push to ActiveQ'],
          inks: ['accent', 'queue']
        }, WATCH_PACE));
      }
    },
    {
      title: 'Xếp hàng theo PriorityClass — không phải FIFO',
      desc: KIT.desc(
        'ActiveQ là <b>priority queue</b>, không phải vào-trước-ra-trước.',
        'Pod sắp theo <span class="warn">PriorityClass</span> (field <code>spec.priority</code>). Pod <code>' + PRI + '</code> vừa vào <b>chen lên trước</b> Pod <code>P=' + PEER.priority + '</code> đã đợi sẵn, và được pop ra xử lý trước.',
        '<b>Đây là chỗ PriorityClass phát huy tác dụng.</b> Cluster rảnh, priority gần như vô nghĩa — mọi Pod đều được schedule. Tài nguyên cạn và hàng đợi dài, nó quyết định workload nào được xét trước. Vẫn không đủ chỗ thì priority kích hoạt <b>Preemption</b> — đuổi Pod thấp điểm nhường chỗ (xem kịch bản Preemption).'),
      labels: ['queue', 'pod', 'q-pod-lo'],
      explain: [
        {of: 'queue', tone: 'queue', text: 'ActiveQ là <b>priority queue</b>, không phải vào-trước-ra-trước. Pod sắp theo <code>spec.priority</code>.'},
        {of: 'pod', tone: 'queue', text: 'Pod <code>' + PRI + '</code> vừa vào <b>chen lên trước</b> Pod đã đợi sẵn, và được pop ra xử lý trước.'},
        {of: 'queue', tone: 'mute', text: 'Cluster rảnh, priority gần như vô nghĩa. Tài nguyên cạn, nó quyết định workload nào được xét trước. Vẫn không đủ chỗ thì kích hoạt <b>Preemption</b> — đuổi Pod thấp điểm nhường chỗ.'}
      ],
      show: ['q-pod-lo'],
      showAt: { 'q-pod-lo': 0.35 },
      // Cùng một hộp Pod bay từ etcd sang đầu ActiveQ — không tạo hộp mới.
      set: {
        'q-pod-lo': KIT.pulse('peer'),
        'pod': KIT.move(P.queue0, {badge: PRI + ' → đầu queue', at: 0.85, dy: 2.0})
      },
      scene(a) {
        KIT.link(a, 'etcd', 'queue', 'accent', {dur: 1.00, label: 'enqueue by priority'});
        KIT.note(a, '③ enqueue theo priority', {of: 'queue', band: true}, 'mute', 0.3);
      }
    }
  ]
},

/* ── STEP ④: Filter ──
   Phases generated from the model's evaluated list (`KIT.sweep`), with
   `KIT.beat` encoding the timing constraint between each flow line and its
   target's mark. Hand-written copy per Node sits in FILTER_DESCS above. */
{
  title: 'Filter — Node nào chạy được Pod này?',
  pipelineStep: 3,
  focus: ['scheduler', 'node-a', 'node-d', 'node-b', 'node-c'],
  phases: KIT.sweep(RUN.filter.evaluated, function(e, i) {
    var tone = e.passed ? 'ok' : 'danger';
    var isLast = i === RUN.filter.evaluated.length - 1;
    var beat = KIT.beat('scheduler', e.key, tone, {
      mark: [tone, e.badge],
      // Verdict Filter là kết luận của cả kịch bản — nó phải còn đó khi Node kế
      // tiếp được chấm, và cả sau Bind. Badge chỉ chớp một phase; chip status
      // được replay nên nó ở lại.
      status: e.passed ? 'passed' : 'rejected',
      dy: e.key === 'node-a' ? 3.0 : 2.6,
      hover: FILTER_HOVER[e.key],
      link: {dur: 1.10, loop: 3.8, label: e.passed ? 'Filter pass' : e.plugin + ' fail'}
    });
    var baseSc = beat.scene;
    return {
      title: FILTER_TITLES[e.key],
      desc:  FILTER_DESCS[e.key],
      labels: FILTER_LABELS[e.key],
      explain: FILTER_EXPLAIN[e.key],
      set:   beat.set,
      scene: isLast ? function(a) {
        baseSc(a);
        KIT.note(a, '④ ' + RUN.filter.evaluated.length + ' Node → '
                  + RUN.filter.passed.length + ' Node qua được Filter',
                 {of: 'scheduler', band: true}, 'mute', 1.5);
      } : baseSc
    };
  })
},

/* ── STEP ⑤: Score ── */
{
  title: 'Score — trong số đó, Node nào tốt nhất?',
  pipelineStep: 3,
  focus: ['scheduler', 'node-a', 'node-d'],
  // Khai một lần ở step; phase expander truyền xuống mọi phase. Mỗi phase chỉ
  // cần bật `scoreMode` cho riêng nó (nếu không HUD sẽ chạy lại mỗi nhịp).
  scoreTitle: 'score = Σ(plugin × weight)',
  scores: SCORE_ROWS,
  phases: [
    {
      title: 'Worker D được 71 điểm',
      desc: KIT.desc(
        'Filter cho ta các Node <b>khả thi</b>. Pha Score chọn Node <b>tối ưu</b> — không còn đúng/sai, chỉ tốt hơn / kém hơn.',
        'Mỗi plugin chấm Node 0–100, rồi cộng có trọng số: <code>Score = Σ(plugin_score × weight)</code>. '
        + 'Worker D được <span class="hi">71</span>: hợp lệ hoàn toàn, nhưng <code>cpu 11/16</code> khá chật nên <code>LeastAllocated</code> chấm thấp.',
        'Điểm số <b>không</b> lưu ở đâu cả — tính lại từ đầu mỗi lần schedule. Cùng một Pod, schedule ở hai thời điểm khác nhau có thể ra hai Node khác nhau.'),
      labels: ['node-a', 'node-d'],
      explain: [
        {of: 'scheduler', tone: 'sky', text: 'Filter cho ta các Node <b>khả thi</b>. Pha Score chọn Node <b>tối ưu</b> — không còn đúng/sai, chỉ tốt hơn / kém hơn. <code>Score = Σ(plugin_score × weight)</code>.'},
        {of: 'node-d', tone: 'sky', text: 'Worker D được <span class="hi">71</span>: hợp lệ hoàn toàn, nhưng <code>cpu 11/16</code> khá chật nên <code>LeastAllocated</code> chấm thấp.'}
      ],
      scoreMode: true,
      set: {
        'node-d': KIT.pulse('sky', 'score 71', {at: 1.15, dy: 2.6})
      },
      scene(a) {
        KIT.link(a, 'scheduler', 'node-d', 'sky', {loop: 3.8, label: 'score 71'});
        KIT.note(a, '⑤ Score = Σ(plugin × weight)', {of: 'scheduler', band: true}, 'mute', 0.2);
      }
    },
    {
      title: 'Worker A được 94 điểm — các plugin đã chấm những gì',
      desc: KIT.desc(
        'Worker A đạt <span class="ok">94</span>. Các plugin chính góp vào con số đó:',
        ['<code>NodeResourcesLeastAllocated</code> — Node càng trống điểm càng cao (A mới dùng <code>cpu 4/16</code>), giúp <b>trải đều tải</b> (mặc định); đổi sang <code>MostAllocated</code> nếu muốn <b>dồn Pod để scale-down</b> cho rẻ',
         '<code>InterPodAffinity / AntiAffinity</code> — thưởng Node đã có Pod “bạn” (giảm latency), phạt Node đã có Pod cùng loại (tránh trứng một giỏ)',
         '<code>PodTopologySpread</code> — thưởng Node ở zone ít replica, để service sống sót khi mất cả một AZ',
         '<code>ImageLocality</code> — Node đã cache sẵn image được cộng điểm vì khỏi pull vài trăm MB.']),
      labels: ['node-a', 'node-d'],
      explain: [
        {of: 'node-a', tone: 'crown', text: 'Worker A đạt <span class="ok">94</span>. <code>NodeResourcesLeastAllocated</code> thưởng Node càng trống (A mới dùng <code>cpu 4/16</code>) để <b>trải đều tải</b>.'},
        {of: 'node-a', tone: 'mute', text: 'Cộng thêm: <code>InterPodAffinity</code> (Pod "bạn" gần nhau), <code>PodTopologySpread</code> (trải zone), <code>ImageLocality</code> (image đã cache sẵn được cộng điểm).'}
      ],
      scoreMode: true,
      set: {
        'node-a': KIT.mark('crown', 'score 94 ★', {at: 1.15, dy: 3.0})
      },
      scene(a) {
        KIT.link(a, 'scheduler', 'node-a', 'crown', {loop: 3.8, label: 'score 94'});
      }
    },
    {
      title: 'Node điểm cao nhất thắng — và đây là chỗ bạn “lái” được scheduler',
      desc: KIT.desc(
        'Scheduler chọn Node tổng điểm cao nhất: <b>Worker A (94)</b>. Hoà điểm thì chọn ngẫu nhiên trong nhóm dẫn đầu, tránh dồn cục vào một Node.',
        'Quyết định xong — nhưng mới nằm <b>trong bộ nhớ scheduler</b>, chưa ai khác biết.',
        '<b>Đây là chỗ bạn điều khiển được hành vi đặt Pod:</b> chỉnh <code>weight</code> từng plugin trong <b>Scheduler Profile</b>, thêm <code>topologySpreadConstraints</code>, dùng affinity, hoặc viết plugin riêng qua <b>Scheduler Framework</b> — <span class="danger">không cần fork kube-scheduler.</span> Pod cứ dồn vào một Node? Câu trả lời gần như luôn nằm ở pha Score, không phải Filter.'),
      labels: ['node-a'],
      explain: [
        {of: 'node-a', tone: 'crown', text: 'Scheduler chọn Node tổng điểm cao nhất: <b>Worker A (94)</b>. Hoà điểm thì chọn ngẫu nhiên trong nhóm dẫn đầu, tránh dồn cục vào một Node.'},
        {of: 'node-a', tone: 'mute', text: 'Bạn "lái" scheduler bằng cách chỉnh <code>weight</code> từng plugin, thêm <code>topologySpreadConstraints</code>, dùng affinity, hoặc viết plugin riêng qua <b>Scheduler Framework</b>.'}
      ],
      scoreMode: true,
      set: {
        /* Tone phải là `crown`, không phải `ok`: đúng lúc công bố người thắng mà
           đổi Worker A về xanh là nó trở lại giống hệt Worker D — kẻ thua cũng
           xanh. Vàng giữ từ lúc thắng tới hết kịch bản, và chip `winner` mang
           kết luận đó qua các step sau. */
        'node-a': KIT.mark('crown', '★ selected node', {
          status: 'winner',
          at: 0.60, dy: 3.0, flash: KIT.ink('crown'),
          hover: 'Node được chọn — kubelet ở đây sẽ chạy Pod'
        })
      },
      scene(a) {
        KIT.note(a, '★ Worker A thắng', {of: 'node-a', band: true}, 'crown', 0.3);
      }
    }
  ]
}

];
})();
