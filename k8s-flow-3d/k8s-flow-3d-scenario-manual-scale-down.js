/* ══════════════════════════════════════════════
   MANUAL SCALE — CHƯƠNG 2: SCALE DOWN (5 → 2) + CHƯƠNG 3: ĐỐI CHIẾU PDB

   Chương 2 là phần đắt nhất của kịch bản: **Pod nào bị xoá, và vì sao**.

   Cách trình bày: MỘT PHASE = MỘT TIÊU CHÍ, không phải một ứng viên.
   `k8s-flow-3d-scenario-kubelet-eviction-ranking.js` đã giải đúng bài này —
   cả năm Pod nằm thường trực trên HUD theo một thứ tự cố định, mỗi phase đổi
   tone và đổi hạng của chúng. Quét từng Pod một (KIT.sweep) sẽ thành 5×6 phase
   và làm mất chính bài học, vì bài học nằm ở THỨ TỰ CÁC LUẬT chứ không ở
   từng Pod.

   Ba luật trong ladder không tách được tập Pod này (unassigned, Pending,
   restarts) hiện lên HUD dạng xám "not applicable" — dạy rằng chúng tồn tại
   mà không tốn một phase nào.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;

window.createManualScaleDownSteps = function(run) {
const hud = window.manualScaleHud(run);
const P = window.MANUAL_SCALE_POS;
const down = run.contract.down;
const V = run.victims;                       // đã theo thứ tự xoá 1 → 3
const rule = function(id) {
  return run.ladder.filter(function(r) { return r.id === id; })[0];
};
const victimOf = function(id) {
  return V.filter(function(v) { return v.rule === id; })[0];
};

/* Năm Pod, LUÔN cùng thứ tự, trên mọi phase xếp hạng — có vậy mắt mới đọc
   được "hàng nào vừa đổi" thay vì phải đọc lại cả bảng. `read` lấy giá trị
   của đúng trường mà tiêu chí đang xét. */
const ladderRows = function(field, decided) {
  return run.pods.map(function(p) {
    const isVictim = decided.indexOf(p.key) >= 0;
    const value = field === 'ready' ? (p.ready ? 'Ready' : 'not Ready')
                : field === 'readySeconds' ? p.readySeconds + 's Ready'
                : field === 'restarts' ? p.restarts + ' restarts'
                : field === 'createdAt' ? 't+' + p.createdAt + 's'
                : p.phase + ' · ' + p.node;
    return KIT.gauge(p.name, isVictim ? run.maxReplicas : 0, run.maxReplicas, '',
      {txt: value, tone: isVictim ? 'danger' : undefined});
  });
};

/* Luật không tách được tập này — nêu tên, nêu lý do, không vờ là nó đã hành động. */
const inertRow = function(id) {
  const r = rule(id);
  /* HUD chỉ đủ chỗ cho một từ; câu giải thích đầy đủ (r.note) nằm ở prose. */
  return KIT.score(r.name, 0, {txt: 'no-op'});
};

return [
  {title: 'Cùng một lệnh, chỉ đổi dấu: scale xuống ' + run.scaleDown,
   pipelineStep: 0, focus: ['kubectl', 'apiserver', 'deploy-api'], phases: [
    {title: 'kubectl PATCH đúng scale subresource đó, lần này xuống ' + run.scaleDown,
     desc: KIT.desc(
       '<code>kubectl scale deploy/api --replicas=' + run.scaleDown + '</code> — cùng subresource, cùng ba chặng controller, chỉ khác dấu.',
       'Thay đổi: <code>' + down.changedInput + '</code>. Giữ nguyên: ' + down.heldConstant.join(', ') + '.',
       'Đường đi giống hệt scale-up cho tới ReplicaSet controller. Chỗ rẽ nhánh nằm ở bước sau: thay vì gọi scheduler, controller phải tự <i>chọn</i>.'),
     focus: ['kubectl', 'apiserver', 'deploy-api'],
     scoreMode: true, scoreTitle: 'Replica state · desired dropped',
     scores: hud(run.scaleDown, run.scaleUp, run.scaleUp - 1),
     ...KIT.beat('kubectl', 'apiserver', 'warn', {
       link: {label: 'PATCH scale · control'},
       mark: ['warn', 'spec.replicas ' + run.scaleUp + ' → ' + run.scaleDown], dy: 3.2,
       hover: 'control flow, mode=commit — the same write, opposite direction'})}
  ]},

  {title: 'ReplicaSet controller phải chọn ' + V.length + ' Pod để xoá',
   pipelineStep: 2, focus: ['replicaset-controller'], phases: [

    {title: 'Trước mọi tiêu chí: có Pod nào được gắn pod-deletion-cost không?',
     desc: KIT.desc(
       'RS controller thấy dư <b>' + V.length + '</b> Pod. Việc đầu tiên nó xét là annotation <code>controller.kubernetes.io/pod-deletion-cost</code>.',
       'Không Pod nào trong Deployment này gắn annotation đó, nên cả ladder tiêu chí bên dưới được chạy đầy đủ. Nếu có, nó ghi đè gần như toàn bộ phần còn lại.',
       'Đây là cần gạt duy nhất bạn thật sự điều khiển được. Thứ tự bên dưới là heuristic của controller, không phải API bạn ký hợp đồng.'),
     focus: ['replicaset-controller'],
     scoreMode: true, scoreTitle: 'pod-deletion-cost · none set',
     scores: run.pods.map(function(p) {
       return KIT.gauge(p.name, 0, run.maxReplicas, '', {txt: 'no annotation'});
     }),
     ...KIT.beat('apiserver', 'replicaset-controller', 'warn', {
       link: {label: 'watch replica surplus · metadata'},
       mark: ['warn', V.length + ' Pods surplus'], dy: 2.8,
       hover: 'metadata flow, mode=no-op — a watch, nothing written yet'})},

    /* Từ đây trở đi pipeline sang `Select`: phase trên mới là Reconcile (phát
       hiện dư), còn bốn phase dưới là việc CHỌN — stage phải nói đúng việc đó. */
    {pipelineStep: 4,
     title: 'Tiêu chí đầu: trạng thái thắng tuổi đời — Pod chưa Ready đi trước',
     desc: KIT.desc(
       'Ladder xét trạng thái trước: chưa gán Node → <code>Pending</code> trước <code>Running</code> → <b>chưa Ready trước Ready</b>.',
       'Ở tập Pod này chỉ luật thứ ba tách được: <b>' + victimOf('ready').name + '</b> đang Running nhưng chưa Ready, nên nó là <b>victim #' + victimOf('ready').order + '</b>. Hai luật kia không phân biệt được Pod nào với Pod nào.',
       'Trực giác "xoá thằng mới nhất" sai ngay từ đây: một Pod cũ mà chưa Ready vẫn bị xoá trước một Pod mới đã Ready.'),
     /* Focus là CẢ hàng Pod: claim ở đây là so sánh giữa các Pod với nhau, và
        khung hình phải chứa đủ tập được so sánh. Kéo controller (x ≈ -5) vào
        focus sẽ giãn khung ra hơn 25 đơn vị và đẩy Pod ra rìa. */
     focus: run.pods.map(function(p) { return 'pod-' + p.key; }),
     scoreMode: true, scoreTitle: 'Rule 1–3 · state',
     scores: [inertRow('unassigned'), inertRow('phase')]
       .concat(ladderRows('ready', [victimOf('ready').key])),
     /* ba luật = bằng chứng có thứ tự cho MỘT claim, nên là beats trong một
        phase chứ không phải ba phase; tổng < 600 ms nên không cần playback */
     set: (function() {
       const s = {};
       s['pod-' + victimOf('ready').key] = KIT.mark('doomed',
         'victim #' + victimOf('ready').order + ' · ' + victimOf('ready').ruleShort,
         {at: 1.0, dy: 2.3,
          hover: victimOf('ready').detail + ' — ' + victimOf('ready').why +
                 ' · ' + victimOf('ready').provenance.evidenceClass});
       return s;
     })(),
     /* Một note mỗi phase (luật của kit), neo vào component chứ không phải toạ
        độ tay. Luật nào no-op, luật nào chạy — HUD đã liệt kê đủ ở trên. */
     scene: function(a) {
       KIT.note(a, 'trạng thái xét trước tuổi đời',
         {of: 'pod-' + victimOf('ready').key, band: true}, 'danger', 0.7);
     }},

    {pipelineStep: 4,
     title: 'Tiêu chí sau: hoà trạng thái thì xét tuổi — Pod mới hơn đi trước',
     desc: KIT.desc(
       'Bốn Pod còn lại đều Ready, nên ladder đi tiếp: <b>Ready ít giây hơn</b> → nhiều restart hơn → <b>creationTimestamp mới hơn</b>.',
       '<b>' + victimOf('readySeconds').name + '</b> mới Ready <b>' + victimOf('readySeconds').detail + '</b> nên là victim #' + victimOf('readySeconds').order + '. Ba Pod gốc thì Ready bằng nhau <i>và</i> restart bằng nhau, nên phải xuống tới tiêu chí cuối: <b>' + victimOf('newest').name + '</b> mới nhất → victim #' + victimOf('newest').order + '.',
       'Nhiều restart hơn <b>không</b> có nghĩa bị xoá trước — restart chỉ phá thế hoà mà readiness đã để lại. Ở đây cả năm Pod đều 0 restart nên luật đó không hề chạy.'),
     focus: run.pods.map(function(p) { return 'pod-' + p.key; }),
     scoreMode: true, scoreTitle: 'Rule 4–6 · age breaks the tie',
     scores: ladderRows('readySeconds', [victimOf('readySeconds').key])
       .concat([inertRow('restarts')]),
     set: (function() {
       const s = {};
       [victimOf('readySeconds'), victimOf('newest')].forEach(function(v, i) {
         s['pod-' + v.key] = KIT.mark('doomed', 'victim #' + v.order + ' · ' + v.ruleShort,
           {at: 0.7 + i * 0.3, dy: 2.3,
            hover: v.detail + ' — ' + v.why + ' · ' + v.provenance.evidenceClass});
       });
       return s;
     })(),
     scene: function(a) {
       KIT.note(a, 'hoà trạng thái → creationTimestamp quyết',
         {of: 'pod-' + victimOf('newest').key, band: true}, 'danger', 0.7);
     }},

    {pipelineStep: 4,
     title: 'Thứ tự chốt lại, và nó không phải thứ tự bạn đoán',
     desc: KIT.desc(
       'Thứ tự xoá: ' + V.map(function(v) { return '<b>' + v.name + '</b> (' + v.ruleName + ')'; }).join(' → ') + '.',
       'Sống sót: <b>' + run.survivors.map(function(p) { return p.name; }).join('</b>, <b>') + '</b> — hai Pod cũ nhất, Ready lâu nhất. Nạn nhân nằm trên <i>cả hai</i> Worker, nên scale-down không hề "dọn sạch một Node".',
       'PriorityClass không tham gia vào đây. Thứ tự này là heuristic hiện tại của ReplicaSet controller (' + V[0].provenance.sourceRef + ', đọc ngày ' + V[0].provenance.asOf + '), không phải cam kết API — nó đã đổi giữa các release.'),
     focus: V.map(function(v) { return 'pod-' + v.key; }),
     scoreMode: true, scoreTitle: 'Deletion order · ' + V[0].provenance.evidenceClass,
     scores: V.map(function(v) {
       /* nhãn ngắn cho HUD — tên đầy đủ của luật nằm ở prose và hover, HUD hẹp */
       return KIT.score('#' + v.order + ' ' + v.name, 100, {tone: 'danger', txt: v.ruleShort});
     })},

    {pipelineStep: 4,
     title: 'ReplicaSet controller gửi ' + V.length + ' lệnh DELETE',
     desc: KIT.desc(
       'RS controller gọi <code>' + run.deleteVerb + '</code> cho ba Pod đó qua API Server, và kubelet dừng container.',
       '<code>readyReplicas</code> về <b>' + run.scaleDown + '</b>, khớp <code>spec.replicas</code>. Reconcile kết thúc.',
       'Ba Pod bị xoá vẫn hiện trong hình vì chúng chính là bằng chứng của thứ tự vừa dựng — chúng đã retired, không bao giờ sống lại.'),
     focus: ['replicaset-controller', 'apiserver'],
     scoreMode: true, scoreTitle: 'Replica state · after scale-down',
     scores: hud(run.scaleDown, run.scaleDown, run.scaleDown),
     set: V.reduce(function(acc, v, i) {
       acc['pod-' + v.key] = KIT.move(P.deleted[i], {tone: 'doomed',
         badge: run.deleteVerb + ' · #' + v.order, at: 0.6 + i * 0.25, dy: 2.2,
         hover: 'Deleted by the ReplicaSet controller — ' + v.ruleName + ' (' + v.detail + ')'});
       return acc;
     }, {}),
     scene: function(a) {
       V.forEach(function(v, i) {
         KIT.link(a, 'replicaset-controller', 'pod-' + v.key, 'danger',
           {at: 0.2 + i * 0.2, dur: 0.7, label: run.deleteVerb + ' · control'});
       });
     }}
  ]},

  {title: 'Đối chiếu: đây là DELETE, không phải Eviction — PDB không được hỏi',
   pipelineStep: 4, focus: ['replicaset-controller', 'apiserver'], phases: [
    {title: 'Scale-down gọi DELETE thẳng, không đi qua pods/eviction',
     desc: KIT.desc(
       'Ba lệnh vừa rồi là <code>' + run.deleteVerb + '</code> trên Pod. Chúng <b>không</b> phải request <code>pods/eviction</code>.',
       'Mà PodDisruptionBudget chỉ gác ở admission của Eviction API. Không đi qua cửa đó thì PDB <b>không bao giờ được hỏi</b> — dù budget có bằng 0.',
       'Đối chiếu thẳng với kịch bản <i>PDB & kubectl drain</i> của deck này: cùng một PDB, cùng những Pod đó, nhưng drain bị chặn còn scale-down thì không.'),
     focus: ['replicaset-controller', 'apiserver'],
     scene: function(a) {
       KIT.note(a, 'DELETE ≠ Eviction API',
         {of: 'replicaset-controller', band: true}, 'danger', 0.4);
     }},

    {title: 'Nên rút ra gì: hạ replica là một quyết định về availability',
     desc: KIT.desc(
       'Không có hàng rào nào chặn bạn scale <code>' + run.scaleUp + ' → ' + run.scaleDown + '</code>, kể cả khi PDB yêu cầu giữ nhiều hơn thế.',
       'PDB bảo vệ khỏi <i>gián đoạn tự nguyện</i> như drain hay upgrade Node. Nó không bảo vệ khỏi việc chính bạn hạ desired state xuống.',
       'Và Pod nào ra đi thì do heuristic của controller quyết, không do bạn — trừ khi bạn gắn <code>pod-deletion-cost</code>, cần gạt duy nhất trong tay bạn.'),
     focus: ['deploy-api', 'worker-a', 'worker-b'],
     scoreMode: true, scoreTitle: 'Replica state · settled',
     scores: hud(run.scaleDown, run.scaleDown, run.scaleDown),
     hide: V.map(function(v) { return 'pod-' + v.key; })}
  ]}
];
};
})();
