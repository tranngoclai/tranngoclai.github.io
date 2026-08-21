/* ══════════════════════════════════════════════
   MANUAL SCALE — CHƯƠNG 1: SCALE UP (3 → 5)

   Một phase = một causal claim. Chương này đi hết ba chặng của scale-up:
   PATCH vào object → Deployment controller sửa RS → RS controller tạo Pod,
   rồi mới tới scheduler và kubelet.

   Điểm dạy: `kubectl scale` không hề chạm vào Pod nào. Ba controller khác
   nhau nối tiếp mới ra được Pod, và Deployment controller cũng không tạo Pod.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;

/* HUD dùng chung cả kịch bản: MẪU SỐ LUÔN LÀ `run.maxReplicas`.
   Nếu mẫu số chạy theo tử số thì 3/3, 5/5 và 2/2 đều vẽ ra một thanh đầy —
   toàn bộ câu chuyện scale sẽ hiện lên thành "không có gì đổi". */
window.manualScaleHud = function(run) {
  return function(desired, current, ready) {
    return [
      /* Hai hàng dưới là `status.replicas` và `status.readyReplicas`; tiền tố
         bị bỏ vì cột tên của HUD chỉ chứa ~14 ký tự trước khi đè lên thanh bar.
         Chỉ `spec.` được giữ — đó là tiền tố duy nhất mang thông tin ở đây:
         một hàng là mong muốn, hai hàng còn lại là thực tế. */
      KIT.gauge('spec.replicas', desired, run.maxReplicas, ' Pods',
        {txt: desired + ' desired'}),
      KIT.gauge('replicas', current, run.maxReplicas, ' Pods'),
      KIT.gauge('readyReplicas', ready, run.maxReplicas, ' Pods',
        {tone: ready === desired ? 'ok' : 'warn', win: ready === desired})
    ];
  };
};

window.createManualScaleUpSteps = function(run) {
const hud = window.manualScaleHud(run);
const P = window.MANUAL_SCALE_POS;
const up = run.contract.up;
const newPods = run.created;          // api-3, api-4

return [
  {title: 'Bối cảnh: Deployment api đang chạy ' + run.initial + ' replica',
   pipelineStep: 0, focus: ['deploy-api', 'worker-a', 'worker-b'], phases: [
    {title: 'Ba Pod đang phục vụ traffic trên hai Worker',
     desc: KIT.desc(
       'Deployment <code>api</code> có <code>spec.replicas: ' + run.initial + '</code>, cả ba Pod đều <b>Ready</b>.',
       'Ba Pod này sinh ra cùng một lúc từ một lần rollout — cùng thời gian Ready, cùng số restart. Ghi nhớ điều đó: tới lúc scale-down nó sẽ là chi tiết quyết định.',
       'Trạng thái ban đầu cố tình cho ba replica "giống hệt nhau" để thấy controller phải xuống tới tiêu chí cuối cùng mới tách được chúng.'),
     focus: ['deploy-api', 'worker-a', 'worker-b'],
     scoreMode: true, scoreTitle: 'Replica state · steady',
     scores: hud(run.initial, run.initial, run.initial)}
  ]},

  {title: 'kubectl ghi vào scale subresource — không ghi vào Pod nào',
   pipelineStep: 0, focus: ['kubectl', 'apiserver', 'deploy-api'], phases: [
    {title: 'kubectl gửi PATCH lên scale subresource của deploy/api',
     desc: KIT.desc(
       '<code>kubectl scale deploy/api --replicas=' + run.scaleUp + '</code> gửi một PATCH duy nhất, tới <code>deploy/api</code>.',
       'Lệnh này <b>không</b> tạo Pod, không chọn Node, không gọi scheduler. Nó chỉ sửa một con số trên một object.',
       'Đây là lý do scale gần như tức thời còn Pod thì mất vài giây mới có: hai việc hoàn toàn khác nhau, do hai bên khác nhau làm.'),
     focus: ['kubectl', 'apiserver'],
     ...KIT.beat('kubectl', 'apiserver', 'info', {
       link: {label: 'PATCH scale · control'},
       mark: ['info', 'scale request accepted'], dy: 3.2,
       hover: 'control flow, mode=commit — one write, no Pod touched'})},

    {title: 'API Server lưu spec.replicas mới lên chính object deploy/api',
     desc: KIT.desc(
       'API Server ghi <code>spec.replicas=' + run.scaleUp + '</code> lên <b>deploy/api</b>. Tới đây lệnh scale đã xong.',
       'Thay đổi: <code>' + up.changedInput + '</code>. Giữ nguyên: ' + up.heldConstant.join(', ') + '.',
       'Scale subresource tồn tại để đổi đúng một trường replica mà không cần gửi lại cả object — nên RBAC có thể cấp quyền scale mà không cấp quyền sửa pod template.'),
     focus: ['apiserver', 'deploy-api'],
     scoreMode: true, scoreTitle: 'Replica state · desired changed',
     scores: hud(run.scaleUp, run.initial, run.initial),
     ...KIT.beat('apiserver', 'deploy-api', 'ok', {
       link: {label: 'commit spec.replicas'},
       mark: ['ok', 'spec.replicas ' + run.initial + ' → ' + run.scaleUp], dy: 2.6,
       label: 'deploy/api\nspec.replicas ' + run.scaleUp,
       hover: 'The Deployment object now asks for ' + run.scaleUp + ' replicas; no Pod exists yet'})}
  ]},

  {title: 'Deployment controller truyền con số xuống ReplicaSet',
   pipelineStep: 1, focus: ['deployment-controller', 'replicaset-controller'], phases: [
    {title: 'Deployment controller thấy object đổi và sửa replica count của RS',
     desc: KIT.desc(
       'Deployment controller watch <b>deploy/api</b>, thấy replica count đổi, rồi ghi con số đó xuống <b>ReplicaSet</b> mà nó đang sở hữu.',
       'Nó dừng ở đây. Deployment controller <b>không bao giờ tạo Pod</b> — nó chỉ quản lý ReplicaSet và pod template.',
       'Vì thế nó đứng lùi ra sau trong hình: chiều sâu ở cột này đọc là khoảng cách tới Pod.'),
     focus: ['deployment-controller', 'replicaset-controller'],
     ...KIT.beat('deployment-controller', 'replicaset-controller', 'info', {
       link: {label: 'set RS .spec.replicas · control'},
       mark: ['info', 'RS replicas ' + run.initial + ' → ' + run.scaleUp], dy: 2.8,
       hover: 'control flow, mode=commit — one controller writing another controller\'s input'})}
  ]},

  {title: 'ReplicaSet controller đối chiếu desired với actual rồi tạo Pod',
   pipelineStep: 2, focus: ['replicaset-controller', 'apiserver'], phases: [
    {title: 'ReplicaSet controller thấy thiếu ' + newPods.length + ' Pod và tạo bù',
     desc: KIT.desc(
       'RS controller so <code>spec.replicas=' + run.scaleUp + '</code> với <b>' + run.initial + '</b> Pod đang có, rồi tạo <b>' + newPods.length + ' Pod object mới</b>.',
       'Đây là controller <b>duy nhất</b> trong hình tạo hoặc xoá Pod. Cả chuỗi vừa rồi — kubectl, API Server, Deployment controller — không ai chạm vào Pod cả.',
       'Reconcile là so sánh desired với actual, không phải thi hành mệnh lệnh — nên xoá tay một Pod cũng kích hoạt đúng đường này.'),
     focus: ['replicaset-controller', 'apiserver'],
     ...KIT.beat('replicaset-controller', 'apiserver', 'info', {
       link: {label: 'CREATE ×' + newPods.length + ' · control/copy'},
       mark: ['info', newPods.length + ' Pod objects created'], dy: 3.2,
       hover: 'control flow, mode=copy — new Pod objects from the same template'})},

    {title: 'API Server lưu ' + newPods.length + ' Pod mới ở trạng thái Pending',
     desc: KIT.desc(
       '<b>' + newPods.map(function(p) { return p.name; }).join('</b> và <b>') + '</b> xuất hiện lần đầu, chưa có <code>nodeName</code>.',
       '<code>status.replicas</code> lên <b>' + run.scaleUp + '</b> ngay, nhưng <code>readyReplicas</code> vẫn là <b>' + run.initial + '</b> — Pod tồn tại không có nghĩa là Pod phục vụ được.',
       'Khoảng cách giữa hai con số này chính là thứ HPA và PDB thật sự quan tâm.'),
     focus: ['apiserver'], show: newPods.map(function(p) { return 'pod-' + p.key; }),
     scoreMode: true, scoreTitle: 'Replica state · Pods created',
     scores: hud(run.scaleUp, run.scaleUp, run.initial),
     set: newPods.reduce(function(acc, p) {
       acc['pod-' + p.key] = KIT.mark('peer', 'Pending', {at: 0.4, dy: 2.3,
         hover: 'Pod object exists, no nodeName yet'});
       return acc;
     }, {})}
  ]},

  {title: 'Scheduler bind Pod mới, kubelet khởi động container',
   pipelineStep: 3, focus: ['scheduler', 'worker-a', 'worker-b'], phases: [
    {title: 'Scheduler gán mỗi Pod mới vào một Worker',
     desc: KIT.desc(
       'Scheduler thấy hai Pod chưa có <code>nodeName</code> và bind chúng: <b>' + newPods[0].name + '</b> → ' + newPods[0].node + ', <b>' + newPods[1].name + '</b> → ' + newPods[1].node + '.',
       'Mỗi Pod đi qua một scheduling cycle riêng — scheduler xử lý từng Pod một, không bind cả lô.',
       'Hai Pod rơi vào hai Worker khác nhau, nên lát nữa scale-down xoá Pod ở cả hai bên chứ không dồn về một Node.'),
     focus: ['scheduler', 'apiserver'],
     /* Cùng hộp Pod rời cột queue và đáp xuống hàng Pod của Worker — bind là
        lúc object Pending có chỗ đứng thật, không phải lúc vẽ ra Pod mới. */
     set: newPods.reduce(function(acc, p) {
       acc['pod-' + p.key] = KIT.move(P[p.key], {tone: 'ok',
         badge: 'nodeName ← ' + p.node, at: 1.15, dy: 2.2,
         hover: 'Same Pending object, now bound to ' + p.node});
       return acc;
     }, {}),
     scene: function(a) {
       KIT.link(a, 'scheduler', 'pod-' + newPods[0].key, 'ok', {at: 0.3, dur: 0.9, label: 'bind'});
       KIT.link(a, 'scheduler', 'pod-' + newPods[1].key, 'ok', {at: 0.5, dur: 0.9, label: 'bind'});
     }},

    {title: 'kubelet khởi động container; chỉ ' + (newPods.length - 1) + ' Pod kịp Ready',
     desc: KIT.desc(
       'Hai kubelet tạo container. <b>' + newPods[0].name + '</b> pass readiness probe sau <b>' + newPods[0].readySeconds + 's</b>; <b>' + newPods[1].name + '</b> thì <b>chưa Ready</b>.',
       'Scale-up "xong" ở mức <code>status.replicas=' + run.scaleUp + '</code>, nhưng <code>readyReplicas=' + (run.scaleUp - 1) + '</code>. Đúng trạng thái này là đầu vào của chương sau.',
       'Running không phải Ready. Sự khác biệt đó sắp quyết định Pod nào bị xoá đầu tiên.'),
     focus: ['kubelet-a', 'kubelet-b'],
     scoreMode: true, scoreTitle: 'Replica state · after scale-up',
     scores: hud(run.scaleUp, run.scaleUp, run.scaleUp - 1),
     set: (function() {
       const s = {};
       newPods.forEach(function(p) {
         s['pod-' + p.key] = KIT.mark(p.ready ? 'live' : 'warn',
           p.ready ? 'Ready · ' + p.readySeconds + 's' : 'Running · not Ready',
           {at: 0.9, dy: 2.3, label: p.name + '\n' + (p.ready ? 'Ready' : 'not Ready'),
            hover: 'Pod ' + p.name + ' · Ready ' + p.readySeconds + 's · ' + p.restarts + ' restarts'});
       });
       return s;
     })(),
     scene: function(a) {
       KIT.link(a, 'kubelet-a', 'pod-api-4', 'warn', {at: 0.3, dur: 0.7, label: 'start containers'});
       KIT.link(a, 'kubelet-b', 'pod-api-3', 'ok', {at: 0.3, dur: 0.7, label: 'start containers'});
     }}
  ]}
];
};
})();
