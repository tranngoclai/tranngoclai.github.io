/* ══════════════════════════════════════════════
   PREEMPTION — PERSISTENT WORLD LAYOUT

   Dựng bằng SCENE_KIT (flow3d-kit-world-builder.js) và đặt theo luật bố cục
   dùng chung trong k8s-flow-3d-layout.js: cột theo trục X là giai đoạn của
   luồng, băng theo trục Z là nhóm vai trò, kích thước tra từ `SIZE`. Người xem
   đổi từ scenario Scheduler sang đây vẫn thấy API Server, scheduler và ActiveQ
   đứng nguyên chỗ cũ.

   Layout (top view):

     API Server ─┬─ kube-scheduler ─ ActiveQ ─┐
                 │  (băng z+, đặt chỗ)        ├→ Worker A / B / C
          etcd ──┘  (băng z−, nền)            ┘

   Ba Node cùng kích thước vì bước Filter đang so sánh chúng với nhau; mỗi Node
   chỉ mở ra hàng Pod, không mở hàng agent — kịch bản này nói về *quyết định*
   của scheduler, không về việc kubelet thực thi.

   Hai quy tắc của kit thể hiện ở đây:

     1 · Trạng thái của một Node nằm **trên chính Node đó** (tone + badge),
         không có "chip verdict" đứng riêng bên cạnh. Label chỉ mang **tên +
         cấu hình** — `Worker A` / `11/12Gi` — và chỉ đổi khi con số cấu hình
         thật sự đổi (Worker A còn `7/12Gi` sau khi victim tắt).
     2 · Một Pod chỉ có **một** hộp trong suốt cả kịch bản. Pod `checkout` là
         cùng một hộp **di chuyển** qua etcd → ActiveQ → Worker A (xem
         `KIT.move` trong các step). Hai victim cũng vậy: chúng bay ngược về
         ActiveQ ở bước ⑥.

   Worker A là Node duy nhất mà việc xoá Pod priority thấp làm Pod mới vừa chỗ
   — B và C tồn tại để người xem thấy **vì sao** preemption là chuyện của từng
   Node, không phải một cuộc quét toàn cluster.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;
const L = window.K8S_LAYOUT;
const S = L.SIZE;
const MODEL = window.PREEMPTION_MODEL;

/* Cùng một model với các step: dung lượng Node, priority và memory của từng
   Pod chỉ tồn tại ở k8s-flow-3d-scenario-preemption-model.js — label ở đây
   chỉ là cách trình bày chúng. */
const RUN = MODEL.simulate(MODEL.DEFAULT_CONFIG);
const POD = MODEL.DEFAULT_CONFIG.pod;

/* `Worker A\n11/12Gi` — tên + cấu hình, đúng quy tắc 3 của kit. */
function nodeLabel(key, suffix) {
  const n = RUN.byKey(key);
  return n.name + '\n' + MODEL.fmtNodeMem(n) + (suffix || '');
}

/* `batch-job\nP=50 · 1Gi` cho một Pod đang chạy trên Node. */
function podLabel(nodeKey, podKey) {
  const p = RUN.byKey(nodeKey).pods.filter(function(x) { return x.key === podKey; })[0];
  return p.name + '\nP=' + p.priority + ' · ' + MODEL.fmtGi(p.memGi);
}

/* Ba làn Node cùng độ sâu, canh giữa quanh z = 0. A gần người xem nhất vì đó
   là nơi câu chuyện xảy ra. */
const LANE = L.lanes([S.node[2], S.node[2], S.node[2]]);

/* Hàng Pod của mỗi Node, và bốn ô trên hàng đó. Worker A dùng cả bốn: ba victim
   ứng viên đang chạy, cộng ô cuối để Pod checkout đáp xuống. */
const POD_Y = L.on(S.pod[1]);
const A_POD = L.row.pod(LANE[0]);
const B_POD = L.row.pod(LANE[1]);
const C_POD = L.row.pod(LANE[2]);
const COL = L.cols(L.X.node, 4);

const Q = L.queueSlots(3);

/* Chỗ đứng của Pod checkout trên hành trình của nó, và ba khe trong ActiveQ.
   Steps tham chiếu qua `KIT.move(PREEMPT_POS.x)` nên toạ độ chỉ tồn tại đúng
   một lần trong toàn bộ kịch bản. */
window.PREEMPT_POS = {
  etcdShelf: [L.X.core, L.Y.shelf, L.Z.store],   // Pod object vừa được ghi xuống etcd
  queue0: Q[0],
  queue1: Q[1],
  queue2: Q[2],
  nodeA:  [COL[3], POD_Y, A_POD]               // ô trống trên hàng Pod của Worker A
};

window.PREEMPTION_WORLD = function(raw) {
  const w = KIT.world(raw);
  const P = window.PREEMPT_POS;

  /* ── Đường đi request (băng z = 0) và băng nền (z−) ── */
  w.node('apiserver', {
    label: 'API Server', pos: [L.X.core, L.Y.ground, L.Z.spine], size: S.core,
    tone: 'core', order: 0,
    hover: 'Scheduler ghi nominatedNodeName và xoá victim đều qua đây'
  });
  w.node('etcd', {
    label: 'etcd', pos: [L.X.core, L.Y.ground, L.Z.store], size: S.store,
    tone: 'store', order: 1, shape: 'cylinder',
    hover: 'Nguồn sự thật: spec.priority, nominatedNodeName, nodeName'
  });

  /* ── Băng đặt chỗ (z+): scheduler và ActiveQ ── */
  w.node('scheduler', {
    label: 'kube-scheduler', pos: [L.X.control, L.Y.ground, L.Z.sched], size: S.scheduler,
    tone: 'system', order: 1,
    hover: 'Filter → PostFilter (Preemption) → Bind'
  });
  w.node('queue', {
    label: 'ActiveQ', pos: L.queuePlate.pos, size: S.queue,
    caption: L.queuePlate.caption,
    tone: 'queue', order: 2, hidden: true, shape: 'rack',
    hover: 'Priority queue — Pod priority cao được pop trước'
  });

  /* ── Pod checkout: MỘT hộp duy nhất cho cả kịch bản ──
     Nó xuất hiện trên nóc etcd (lúc object được ghi), bay vào ActiveQ, rồi đáp
     xuống ô trống trên hàng Pod của Worker A khi bind xong. */
  w.node('pod-checkout', {
    label: POD.name + '\nP=' + POD.priority + ' · ' + MODEL.fmtGi(POD.memGi),
    pos: P.etcdShelf, size: S.pod,
    tone: 'subject', order: 2, hidden: true, shape: 'seal',
    hover: 'Pod đang cần chỗ — priority 1000, requests.memory 4Gi'
  });
  w.node('pod-report', {
    label: 'report\nP=200', pos: P.queue1, size: S.pod,
    tone: 'peer', order: 3, hidden: true, shape: 'seal',
    hover: 'Pod thường đang chờ tới lượt — priority thấp hơn nên bị chen'
  });

  /* ── Worker A: Node duy nhất mà preemption cứu được ── */
  w.node('node-a', {
    label: nodeLabel('node-a'), pos: [L.X.node, L.Y.slab, LANE[0]], size: S.node,
    tone: 'surface', order: 4, shape: 'slab',
    hover: 'Còn 1Gi trống — Pod checkout cần 4Gi'
  });
  w.node('pod-a1', {
    label: podLabel('node-a', 'pod-a1'), pos: [COL[0], POD_Y, A_POD], size: S.pod,
    tone: 'live', order: 5, shape: 'seal',
    hover: 'Priority thấp nhất — victim đầu tiên bị nhắm tới'
  });
  w.node('pod-a2', {
    label: podLabel('node-a', 'pod-a2'), pos: [COL[1], POD_Y, A_POD], size: S.pod,
    tone: 'live', order: 5, shape: 'seal',
    hover: 'Priority thấp hơn 1000 — victim hợp lệ'
  });
  w.node('pod-a3', {
    label: podLabel('node-a', 'pod-a3'), pos: [COL[2], POD_Y, A_POD], size: S.pod,
    tone: 'live', order: 5, shape: 'seal',
    hover: 'Cũng thấp hơn 1000 — nhưng không cần xoá nếu đã đủ chỗ'
  });

  /* ── Worker B: đầy, nhưng toàn Pod priority CAO hơn ── */
  w.node('node-b', {
    label: nodeLabel('node-b'), pos: [L.X.node, L.Y.slab, LANE[1]], size: S.node,
    tone: 'surface', order: 5, shape: 'slab',
    hover: 'Đầy — và mọi Pod ở đây đều priority ≥ 2000'
  });
  w.node('pod-b1', {
    label: podLabel('node-b', 'pod-b1'), pos: [COL[0], POD_Y, B_POD], size: S.pod,
    tone: 'warn', order: 6, shape: 'seal',
    hover: 'Priority CAO HƠN Pod đang chờ → không thể là victim'
  });
  w.node('pod-b2', {
    label: podLabel('node-b', 'pod-b2'), pos: [COL[1], POD_Y, B_POD], size: S.pod,
    tone: 'warn', order: 6, shape: 'seal',
    hover: 'system-cluster-critical — bất khả xâm phạm'
  });

  /* ── Worker C: còn trống nhưng vướng taint ── */
  w.node('node-c', {
    label: nodeLabel('node-c', ' · gpu=true:NoSchedule'),
    pos: [L.X.node, L.Y.slab, LANE[2]], size: S.node,
    tone: 'surface', order: 6, shape: 'slab',
    hover: 'Còn 10Gi trống — nhưng Pod không có toleration'
  });
  w.node('pod-c1', {
    label: podLabel('node-c', 'pod-c1'), pos: [COL[0], POD_Y, C_POD], size: S.pod,
    tone: 'live', order: 7, shape: 'seal',
    hover: 'Priority thấp — nhưng xoá nó cũng vô ích, taint vẫn còn'
  });

  /* ── Region captions ── */
  w.region('CONTROL PLANE', L.X.core, 0, 9);
  w.region('WORKER NODES', L.X.node, 0, 9);

  w.cam([2, 0, 0], 44);
};
})();
