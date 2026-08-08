/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — PERSISTENT WORLD LAYOUT

   Dựng bằng SCENE_KIT (flow3d-kit-world-builder.js): mỗi component khai **vai
   trò** (`tone`) chứ không khai màu, caption tự dán vào mặt trước hộp. Cluster
   được dựng đúng một lần và không bao giờ bị tháo — 9 bước chỉ reveal, đổi
   tone, focus, move và chạy flow.

   Toạ độ và kích thước KHÔNG gõ tay ở đây. Chúng đến từ k8s-flow-3d-layout.js,
   file luật bố cục dùng chung cho cả năm kịch bản — nên API Server ở đây to
   bằng API Server ở mọi kịch bản khác, và cột control plane đứng đúng chỗ cũ
   khi người xem đổi scenario.

   Layout (top view), đọc trái → phải theo đường đi của request:

     client → authn → admission → API Server ─┬─ kube-scheduler ─ ActiveQ ─┐
                                              │  (băng z+, đặt chỗ)        │
                                       etcd ──┘  controller-manager        ├→ Worker A / D / B / C
                                       (băng z−, nền)                      ┘

   Bốn Node xếp thành bốn làn cùng kích thước — chúng đang bị **so sánh** với
   nhau ở bước Filter và Score, nên không Node nào được to hơn Node nào.

   Hai quy tắc của kit áp vào đây:

     1 · **Một thứ = một hộp.** Pod object trong etcd và Pod trong ActiveQ là
         *cùng một Pod*, nên chỉ có **một hộp `pod`** đi suốt hành trình:
         etcd → ActiveQ → Worker A.

     2 · **Verdict nằm trên chính component.** Kết quả Filter/Score là tone +
         badge **trên chính Node đó**. Label Node chỉ mang **tên + cấu hình**
         (`Worker B` / `cpu 15/16`) — và chính con số đó là thứ giải thích vì
         sao nó trượt, nên không cần chữ nào thêm.

   Cấu hình CPU của bốn Node đến từ k8s-flow-3d-scenario-scheduler-model.js,
   cùng nguồn với verdict ở bước ④ và điểm số ở bước ⑤ — nên label, badge và
   HUD không thể lệch nhau.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;
const L = window.K8S_LAYOUT;
const S = L.SIZE;
const MODEL = window.SCHEDULER_MODEL;

/* Node facts, tra theo key — label và hover cùng đọc từ đây. */
const NODE = {};
MODEL.DEFAULT_CONFIG.nodes.forEach(function(n) { NODE[n.key] = n; });

/* `Worker A\ncpu 4/16` — tên + cấu hình, đúng quy tắc 3 của kit. */
function nodeLabel(key, suffix) {
  return NODE[key].name + '\ncpu ' + MODEL.fmtCpu(NODE[key]) + (suffix || '');
}

/* Bốn làn Node cùng độ sâu, canh giữa quanh z = 0: A gần người xem nhất vì nó
   là Node thắng và là nơi Pod đáp xuống. */
const LANE = L.lanes([S.node[2], S.node[2], S.node[2], S.node[2]]);
const A = LANE[0];

/* Hai hàng trên Worker A và các ô trong mỗi hàng. */
const A_AGENT = L.row.agent(A);
const A_POD   = L.row.pod(A);
const A_COL   = L.cols(L.X.node, 3);

const Q = L.queueSlots(2);

/* Ba chỗ đứng của Pod trên hành trình của nó. Steps tham chiếu qua
   `KIT.move(SCHED_POS.x)` nên toạ độ chỉ tồn tại đúng một lần. */
window.SCHED_POS = {
  etcdShelf: [L.X.core, L.Y.shelf, L.Z.store],   // Pod object vừa được ghi xuống etcd
  queue0: Q[0],
  queue1: Q[1],
  nodeA: [A_COL[0], L.on(S.pod[1]), A_POD]       // ô Pod trên Worker A, cạnh kubelet
};

window.SCHEDULER_WORLD = function(raw) {
  const w = KIT.world(raw);
  const P = window.SCHED_POS;

  /* ── Đường đi request (băng z = 0) ── */
  w.node('client', {
    label: 'Client\n(kubectl)', pos: [L.X.actor, L.Y.ground, L.Z.spine], size: S.actor,
    tone: 'surface', order: 0,
    hover: 'kubectl / CI-CD gửi request tới API Server'
  });
  w.node('authn', {
    label: 'Authn · Authr', pos: [L.X.gate1, L.Y.ground, L.Z.spine], size: S.gate,
    tone: 'gate', order: 1,
    hover: 'Xác thực token/cert rồi kiểm tra RBAC'
  });
  w.node('admission', {
    label: 'Admission\nWebhooks', pos: [L.X.gate2, L.Y.ground, L.Z.spine], size: S.gate,
    tone: 'gate', order: 2,
    hover: 'Mutating rồi Validating webhooks'
  });
  w.node('apiserver', {
    label: 'API Server', pos: [L.X.core, L.Y.ground, L.Z.spine], size: S.core,
    tone: 'core', order: 3,
    hover: 'Cửa ngõ duy nhất vào etcd — mọi component đều đi qua đây'
  });

  /* ── Băng nền (z−): store và controller chạy nền ── */
  w.node('etcd', {
    label: 'etcd', pos: [L.X.core, L.Y.ground, L.Z.store], size: S.store,
    tone: 'store', order: 4,
    hover: 'Nguồn sự thật duy nhất của cluster state'
  });
  w.node('ctrlmgr', {
    label: 'Controller\nManager', pos: [L.X.control, L.Y.ground, L.Z.workload], size: S.controller,
    tone: 'system', order: 5,
    hover: 'ReplicaSet controller WATCH số replicas thực tế'
  });

  /* ── Pod: MỘT hộp duy nhất cho cả 9 bước ──
     Xuất hiện trên nóc etcd lúc object được ghi (②), bay vào ActiveQ (③), rồi
     đáp xuống hàng Pod của Worker A khi kubelet nhận việc (⑦). `subject` là
     tone dành riêng cho nhân vật chính. */
  w.node('pod', {
    label: 'Pod · P=' + MODEL.DEFAULT_CONFIG.pod.priority + '\nnodeName: ""',
    pos: P.etcdShelf, size: S.pod,
    tone: 'subject', order: 5, hidden: true,
    hover: 'Chính Pod đang được schedule — theo nó suốt 9 bước'
  });

  /* ── Băng đặt chỗ (z+): scheduler và ActiveQ ──
     Queue là một tấm nền mỏng dựng phía sau, không phải hộp bọc lấy Pod: các
     Pod xếp hàng *trước mặt* nó nên vẫn đọc được. */
  w.node('scheduler', {
    label: 'kube-scheduler', pos: [L.X.control, L.Y.ground, L.Z.sched], size: S.scheduler,
    tone: 'system', order: 4,
    hover: 'Filter → Score → Bind, chỉ nói chuyện với API Server'
  });
  w.node('queue', {
    label: 'ActiveQ', pos: L.queuePlate.pos, size: S.queue,
    caption: L.queuePlate.caption,
    tone: 'queue', order: 6, hidden: true,
    hover: 'Priority queue — Pod priority cao được pop trước'
  });
  w.node('q-pod-lo', {
    label: MODEL.DEFAULT_CONFIG.queuePeer.name
         + '\nP=' + MODEL.DEFAULT_CONFIG.queuePeer.priority, pos: P.queue1, size: S.pod,
    tone: 'peer', order: 7, hidden: true,
    hover: 'Pod thường đang chờ tới lượt — priority thấp hơn nên bị chen'
  });

  /* ── Worker A: Node thắng, và là Node duy nhất mở ra cho thấy bên trong ──
     Hàng agent nằm sau (kubelet · containerd · kube-proxy), hàng Pod nằm trước
     (Pod đáp xuống · sandbox · container) — đúng thứ tự của luật 4. */
  w.node('node-a', {
    label: nodeLabel('node-a'), pos: [L.X.node, L.Y.slab, A], size: S.node,
    tone: 'surface', order: 6,
    hover: 'Node rộng nhất — sẽ pass Filter và thắng Score'
  });
  w.node('kubelet', {
    label: 'kubelet', pos: [A_COL[0], L.on(S.agent[1]), A_AGENT], size: S.agent,
    tone: 'gate', order: 7,
    hover: 'WATCH riêng lên API Server theo spec.nodeName'
  });
  w.node('containerd', {
    label: 'containerd\n(CRI)', pos: [A_COL[1], L.on(S.agent[1]), A_AGENT], size: S.agent,
    tone: 'engine', order: 8,
    hover: 'Container runtime: pull image, tạo sandbox, start container'
  });
  w.node('kubeproxy', {
    label: 'kube-proxy', pos: [A_COL[2], L.on(S.agent[1]), A_AGENT], size: S.agent,
    tone: 'system', order: 8,
    hover: 'WATCH Endpoints → cập nhật iptables/ipvs'
  });
  w.node('sandbox', {
    label: 'Pod sandbox', pos: [A_COL[1], L.on(S.sandbox[1]), A_POD], size: S.sandbox,
    tone: 'live', order: 9, hidden: true,
    hover: 'pause container giữ network namespace cho Pod'
  });
  w.node('container', {
    label: 'Container', pos: [A_COL[2], L.on(S.proc[1]), A_POD], size: S.proc,
    tone: 'live', order: 10, hidden: true,
    hover: 'Tiến trình ứng dụng thật, bị bao bởi namespaces + cgroups'
  });

  /* ── Ba Node ứng viên còn lại ──
     Cùng kích thước với Worker A vì bước ④ và ⑤ đang so sánh chúng với nhau.
     Con số cpu trên label chính là dữ kiện của hai bước đó — Node tự nói ra vì
     sao nó pass hay trượt, không cần chip verdict đứng cạnh. */
  w.node('node-d', {
    label: nodeLabel('node-d'), pos: [L.X.node, L.Y.slab, LANE[1]], size: S.node,
    tone: 'surface', order: 7,
    hover: 'Vẫn đủ chỗ — nhưng chật hơn A nên điểm LeastAllocated thấp hơn'
  });
  w.node('node-b', {
    label: nodeLabel('node-b'), pos: [L.X.node, L.Y.slab, LANE[2]], size: S.node,
    tone: 'surface', order: 8,
    hover: 'Gần kín CPU — sẽ trượt NodeResourcesFit'
  });
  w.node('node-c', {
    label: nodeLabel('node-c', ' · NoSchedule'), pos: [L.X.node, L.Y.slab, LANE[3]], size: S.node,
    tone: 'surface', order: 9,
    hover: 'Rỗng nhất cluster — nhưng mang taint nên Pod không được vào'
  });

  /* ── Region captions ── */
  w.region('CONTROL PLANE', L.X.core, 0);
  w.region('WORKER NODES', L.X.node, 0);

  w.cam([-5, 0, 0], 56);
};
})();
