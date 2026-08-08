/* ══════════════════════════════════════════════
   K8S DECK — SHARED LAYOUT LAW

   Năm kịch bản trước đây mỗi cái tự chọn toạ độ và kích thước riêng, nên cùng
   một component (kubelet, API Server, một Pod…) lại to nhỏ khác nhau và đứng ở
   chỗ khác nhau tuỳ kịch bản. Người xem phải học lại bố cục mỗi lần đổi
   scenario. File này là **nguồn duy nhất** của cả hai thứ đó.

   ── Luật 1 · TRỤC X = GIAI ĐOẠN CỦA LUỒNG ──
   Đọc từ trái sang phải đúng theo đường đi của một request:

     actor → gate → API Server → scheduler/controllers → queue → worker nodes

   Cột nào cũng nằm ở đúng X đó trong MỌI kịch bản. Không có kịch bản nào đặt
   API Server ở giữa đám worker node nữa.

   ── Luật 2 · TRỤC Z = BĂNG VAI TRÒ ──
   Trong một cột, vị trí theo chiều sâu nói lên component đó thuộc nhóm nào:

     z+ (gần người xem)  băng ĐẶT CHỖ      scheduler, ActiveQ
     z  0 (sống lưng)    ĐƯỜNG ĐI REQUEST  client, gate, API Server
                          + workload controllers (ReplicaSet/Deployment)
     z− (xa người xem)   NỀN & NỀN SAU     etcd, policy, lifecycle, GC

   Nhờ vậy mắt phân nhóm chức năng bằng chiều sâu, không cần đọc chữ.

   ── Luật 3 · CÙNG CHỨC NĂNG = CÙNG KÍCH THƯỚC ──
   `SIZE` bên dưới là bảng tra duy nhất. Một kubelet luôn là `SIZE.agent` dù ở
   kịch bản nào; một Pod luôn là `SIZE.pod`. Kích thước trở thành **tín hiệu
   phân loại**: hộp cao là control plane, hộp dẹt là thứ nằm trên Node, tấm
   mỏng nằm ngang là Node.

   ── Luật 4 · MỘT NODE CÓ CÁC HÀNG CỐ ĐỊNH ──
   Mọi thứ nằm trên một Node đều rơi vào một trong ba hàng, luôn theo thứ tự
   này tính từ xa về gần người xem:

     hàng KERNEL  (chỉ node "mổ xẻ")  cgroup, page allocator, OOM killer…
     hàng AGENT                       kubelet, container runtime, kube-proxy…
     hàng POD                         các Pod, và process nằm ngay trên Pod

   Và trong một hàng, các ô cách nhau đúng `PITCH` — nên Pod ở kịch bản này
   thẳng hàng với Pod ở kịch bản kia.
══════════════════════════════════════════════ */

(function() {
const L = {};

/* Khoảng cách giữa hai ô liền nhau trong cùng một hàng trên Node.
   4.4 chừa ~1.0 khe hở quanh một ô agent/kernel (rộng 3.4) và ~1.4 quanh một
   ô pod (rộng 3.0) — đủ để mắt tách từng ô thay vì dính thành một dải. */
const PITCH = 4.4;

/* ── Luật 1 · các cột theo trục X ── */
L.X = {
  actor:  -30,    // kubectl / client — nơi request bắt đầu
  gate1:  -24.5,  // authn · authz
  gate2:  -19.2,  // admission webhooks
  core:   -13,    // API Server, và ngay sau lưng nó là store/policy
  control: -5,    // scheduler + controllers
  queue:     2,   // ActiveQ và mọi Pod đang Pending
  node:     16    // tâm của các tấm Node
};

/* ── Luật 2 · các băng vai trò theo trục Z ──
   Dùng chung cho cột `control` (scheduler/controllers) và cột `core`
   (API Server ở sống lưng, store/policy ở băng sau). */
L.Z = {
  sched:      9,   // băng đặt chỗ: kube-scheduler, ActiveQ
  spine:      0,   // đường đi request: client → gate → API Server
  workload:   3,   // controller sinh/huỷ workload: ReplicaSet, Deployment
  store:     -9,   // etcd, và các policy object được lưu (PDB)
  policy:    -3,   // controller canh policy: disruption controller
  lifecycle: -9,   // node lifecycle controller
  gc:       -15    // pod garbage collector
};

/* ── Trục Y ──
   Control plane đứng trên mặt đất; mọi thứ trên Node bám lên mặt tấm Node. */
L.Y = {
  ground: 0,
  slab:  -1.6,   // tâm tấm Node (dày 0.6 → mặt trên ở -1.3)
  shelf:  3.4,   // kệ ngay trên nóc etcd — nơi một object vừa được ghi xuống
  queue:  1.2    // khe trên cùng của ActiveQ
};

const SLAB_TOP = L.Y.slab + 0.3;

/* Tâm Y của một hộp cao `h` đặt nằm trên mặt tấm Node. */
L.on = function(h) { return +(SLAB_TOP + h / 2).toFixed(2); };

/* Tâm Y của một hộp cao `h` đặt chồng lên một hộp cao `baseH` trên tấm Node —
   dùng cho Linux process nằm trên chính Pod của nó. */
L.onTopOf = function(baseH, h) { return +(SLAB_TOP + baseH + 0.1 + h / 2).toFixed(2); };

/* ── Luật 3 · bảng tra kích thước duy nhất ──
   Chiều cao mã hoá tầng: control plane cao, thứ nằm trên Node dẹt, Node là
   tấm mỏng. Đừng khai size trực tiếp trong world file. */
L.SIZE = {
  actor:      [3.8, 4.4, 2.8],   // kubectl, client
  gate:       [3.6, 2.8, 2.6],   // authn, admission, PDB — thứ chặn/duyệt
  core:       [4.6, 6.0, 3.2],   // API Server — hộp cao nhất, là trục của deck
  store:      [4.2, 5.2, 3.0],   // etcd
  scheduler:  [4.6, 4.4, 3.0],   // kube-scheduler
  controller: [4.6, 3.8, 3.0],   // mọi controller trong kube-controller-manager
  queue:      [4.4, 5.6, 0.5],   // tấm nền ActiveQ, Pod xếp hàng trước mặt nó
  node:       [19.0, 0.6, 6.5],  // Node bình thường: hàng agent + hàng Pod
  nodeDeep:   [19.0, 0.6, 12.5], // Node được mổ xẻ: thêm hàng kernel
  agent:      [3.4, 1.8, 2.3],   // kubelet, CRI runtime, kube-proxy, cAdvisor
  kernel:     [3.4, 2.6, 2.3],   // cgroup, page allocator, OOM killer, reaper
  pod:        [3.0, 1.4, 2.1],   // MỌI Pod, ở mọi kịch bản
  proc:       [2.8, 1.0, 1.7],   // một Linux process bên trong Pod
  sandbox:    [3.0, 1.5, 2.1]    // pause container — to hơn process, nhỏ hơn Pod
};

/* ── Luật 4 · các hàng trên một tấm Node ──
   `cz` là tâm Z của tấm. Node thường có 2 hàng; node mổ xẻ có 3. */
L.row = {
  agent:      function(cz) { return +(cz - 1.7).toFixed(2); },
  pod:        function(cz) { return +(cz + 1.7).toFixed(2); },
  deepKernel: function(cz) { return +(cz - 4.2).toFixed(2); },
  deepAgent:  function(cz) { return cz; },
  deepPod:    function(cz) { return +(cz + 4.2).toFixed(2); }
};

/* `n` ô cách đều nhau quanh tâm — dùng cho các ô trong một hàng trên Node
   (`cols`) hoặc bất cứ chỗ nào cần chia đều. */
function spread(center, n, pitch) {
  const out = [], half = (n - 1) * pitch / 2;
  for (let i = 0; i < n; i++) out.push(+(center - half + i * pitch).toFixed(2));
  return out;
}
L.cols = function(cx, n) { return spread(cx, n, PITCH); };
L.spread = spread;

/* Xếp một dãy tấm Node theo chiều sâu, canh giữa quanh z = 0.
   Nhận độ sâu thật của từng tấm nên node mổ xẻ (sâu hơn) vẫn không đè lên
   hàng xóm. Trả về từ gần người xem về xa. */
L.lanes = function(depths, gap) {
  const g = gap === undefined ? 3.2 : gap;
  let total = 0;
  depths.forEach(function(d) { total += d; });
  total += g * (depths.length - 1);

  let z = total / 2;
  const out = [];
  depths.forEach(function(d) {
    z -= d / 2;
    out.push(+z.toFixed(2));
    z -= d / 2 + g;
  });
  return out;
};

/* Các khe trong ActiveQ: Pod xếp hàng *trước mặt* tấm nền, từ trên xuống. */
L.queueSlots = function(count) {
  return window.SCENE_KIT.stack([L.X.queue, L.Y.queue, L.Z.sched + 0.9], count, 1.5);
};

/* Tấm nền ActiveQ — vị trí và caption thủ công (caption mặc định của kit sẽ
   nằm ngay sau lưng hàng Pod). */
L.queuePlate = {
  pos:     [L.X.queue, -0.2, L.Z.sched - 0.8],
  caption: [L.X.queue, 2.9, L.Z.sched - 0.4]
};

window.K8S_LAYOUT = L;
})();
