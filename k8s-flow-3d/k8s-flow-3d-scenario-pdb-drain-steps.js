/* A phase states exactly one causal claim (Rule 4, docs/flow3d-deck-authoring.md
   §2). A fixed sequence of hops toward one destination — no branching, one
   endpoint — is ONE phase drawn with KIT.chain, not one phase per hop. Only a
   genuinely independent decision (a filter that can pass or fail on its own)
   gets its own phase. */
(function() {
const KIT = window.SCENE_KIT;
window.createPdbDrainSteps = function(run) {
  const budget = function(healthy, allowed, tone) { return [
    KIT.gauge('currentHealthy', healthy, run.replicas, ' Pods', {tone: tone}),
    KIT.gauge('minAvailable', run.minAvailable, run.replicas, ' Pods'),
    KIT.score('disruptionsAllowed', allowed, {tone: tone})
  ]; };

  /* Shared hop schedule for every chain in this file — one PACE, so a badge
     timed off HOP[i].arrive never drifts from the arrow it announces. */
  const PACE = {at: 0.35, dur: 0.85};
  const CORDON_HOP = KIT.chainTimes(2, PACE);   // kubectl → apiserver → worker-a
  const EVICT_HOP  = KIT.chainTimes(2, PACE);   // kubectl → apiserver → pdb
  const TERM_AT    = EVICT_HOP[1].arrive + 0.12; // apiserver → pod-api-0, after the gate
  const STOP_HOP   = KIT.chainTimes(2, PACE);   // kubelet-a → runtime-a → pod-api-0
  const CREATE_HOP = KIT.chainTimes(3, PACE);   // apiserver → rs-controller → apiserver → pod-api-3
  const BIND_HOP   = KIT.chainTimes(3, PACE);   // apiserver → scheduler → apiserver → pod-api-3
  const START_HOP  = KIT.chainTimes(2, PACE);   // kubelet-c → runtime-c → pod-api-3
  const READY_HOP  = KIT.chainTimes(2, PACE);   // kubelet-c → apiserver → pod-api-3

  return [
    {title: 'Bối cảnh: Worker A cần bảo trì, api vẫn phải sống', pipelineStep: 0, focus: ['worker-a', 'pdb'], phases: [
      {title: 'Đội hạ tầng cần drain Worker A để patch OS', desc: KIT.desc(
        'Worker A cần bảo trì — phải rút hết Pod ra an toàn trước.',
        'Đội hạ tầng cần đưa <b>Worker A</b> vào bảo trì (patch OS/kernel). Deployment <code>api</code> có <b>' + run.replicas + ' replicas</b>, <code>minAvailable: ' + run.minAvailable + '</code>. Rút Pod quá nhanh có thể làm mất quá nhiều bản sao cùng lúc khi đang phục vụ traffic.',
        '<code>PodDisruptionBudget</code> sinh ra để chặn đúng chuyện đó — không ngăn drain, chỉ ngăn nó đi <i>quá nhanh</i>.'),
        focus: ['worker-a', 'pdb'], labels: ['worker-a', 'pdb'],
        explain: [
          {of: 'worker-a', tone: 'warn', text: 'Worker A sắp cordon để patch OS/kernel — hai Pod của Deployment <code>api</code> đang chạy ở đây phải rút ra an toàn trước.'},
          {of: 'pdb', tone: 'sky', text: '<code>PodDisruptionBudget</code> không chặn drain, chỉ giới hạn <b>bao nhiêu Pod được rút cùng lúc</b> khi đang phục vụ traffic.'}
        ],
        ...KIT.beat('worker-a', 'pdb', 'warn', {link: {label: 'maintenance intent'}, mark: ['warn', 'maintenance needed'], dy: 2.8})}
    ]},
    {title: 'Disruption controller công bố hạn mức PDB ban đầu', pipelineStep: 0, focus: ['disruption-controller', 'pdb'], phases: [
      {title: 'Disruption controller cập nhật PDB: cho phép một lần gián đoạn', desc: KIT.desc(
        'Disruption controller đếm ' + run.initialHealthy + '/' + run.replicas + ' Pod Ready rồi cập nhật PDB status.',
        '<code>minAvailable: ' + run.minAvailable + '</code> nên <code>disruptionsAllowed=' + run.initialAllowed + '</code>. PDB chỉ là policy object — controller duy trì status, không tự terminate Pod.',
        'PDB không tính theo phần trăm cố định — <code>currentHealthy</code> đến từ đếm Pod Ready thật mỗi lần, <code>disruptionsAllowed</code> chỉ là kết quả phép trừ, không phải cấu hình gõ tay.'),
        focus: ['disruption-controller', 'pdb'], labels: ['disruption-controller', 'pdb'],
        scoreMode: true, scoreTitle: 'PDB status · initial', scores: budget(run.initialHealthy, run.initialAllowed, 'ok'),
        explain: [
          {of: 'disruption-controller', tone: 'sky', text: 'Đếm Pod Ready khớp selector của PDB, rồi ghi lại <code>currentHealthy</code>/<code>disruptionsAllowed</code> — nó chỉ quan sát, không tự xoá Pod nào.'},
          {of: 'pdb', tone: 'ok', text: run.initialHealthy + '/' + run.replicas + ' Ready và <code>minAvailable ' + run.minAvailable + '</code> nên đúng <b>' + run.initialAllowed + '</b> disruption được phép ngay lúc này.'}
        ],
        set: {
          'pod-api-0': KIT.pulse('ok', '', {status: 'ready'}),
          'pod-api-1': KIT.pulse('ok', '', {status: 'ready'}),
          'pod-api-2': KIT.pulse('ok', '', {status: 'ready'})
        },
        ...KIT.beat('disruption-controller', 'pdb', 'ok', {link: {label: 'update PDB status'}, mark: ['ok', run.initialHealthy + ' healthy · allowed ' + run.initialAllowed], status: 'ready', dy: 2.8})}
    ]},
    {title: 'Trước khi evict, drain cordon Node mục tiêu', pipelineStep: 1, focus: ['kubectl', 'apiserver', 'worker-a'], phases: [
      {title: 'kubectl → API Server → Worker A: cordon trước khi evict bất kỳ Pod nào', desc: KIT.desc(
        'kubectl drain cordon Worker A trước — chưa evict Pod nào cả.',
        '<code>kubectl drain worker-a</code> gửi <code>PATCH spec.unschedulable=true</code> cho API Server, và API Server ghi thẳng vào Node object. Cordon không dừng Pod đang chạy, chỉ ngăn scheduler đặt <i>Pod mới</i> lên Worker A.',
        'Từ đây Pod thay thế của Deployment phải qua scheduler để tới Node khác. DaemonSet, mirror/static Pod không thuộc phạm vi Eviction API — cần thêm <code>--ignore-daemonsets</code> nếu Node có DaemonSet Pod.'),
        focus: ['kubectl', 'apiserver', 'worker-a'], labels: ['kubectl', 'apiserver', 'worker-a'],
        explain: [
          {of: 'kubectl', tone: 'info', text: '<code>kubectl drain worker-a</code> luôn cordon trước — <code>PATCH spec.unschedulable=true</code> — trước khi gửi Eviction request nào.'},
          {of: 'apiserver', tone: 'info', text: 'API Server chỉ ghi lại Node spec; cordon không đụng tới Pod đang chạy trên Worker A.'},
          {of: 'worker-a', tone: 'warn', text: 'Worker A giờ unschedulable: scheduler loại nó khỏi mọi Pod mới, nhưng hai Pod hiện có vẫn đứng nguyên tới khi bị evict.'}
        ],
        set: {
          'apiserver': KIT.pulse('info', 'cordon accepted', {at: CORDON_HOP[0].arrive}),
          'worker-a': KIT.mark('warn', 'unschedulable', {at: CORDON_HOP[1].arrive, status: 'rejected', dy: 2.7})
        },
        scene(a) {
          KIT.chain(a, ['kubectl', 'apiserver', 'worker-a'], 'info', Object.assign({
            labels: ['PATCH unschedulable', 'commit Node spec'],
            inks: ['info', 'warn']
          }, PACE));
        }}
    ]},
    {title: 'Yêu cầu evict đầu tiên được chấp nhận và chấm dứt một Pod', pipelineStep: 2, focus: ['kubectl', 'apiserver', 'pdb', 'pod-api-0'], phases: [
      {title: 'kubectl → API Server → PDB: eviction cho api-0 được chấp nhận, api-0 sang Terminating', desc: KIT.desc(
        'Eviction request cho api-0 qua được cửa PDB, rồi api-0 chuyển Terminating.',
        'Drain gửi <code>pods/eviction</code> cho <b>api-0</b> thay vì DELETE trực tiếp, nên API Server phải xét PDB trước khi chấp nhận. <code>currentHealthy=' + run.initialHealthy + '</code>, <code>minAvailable=' + run.minAvailable + '</code> nên đúng một slot được tiêu, atomically.',
        'Eviction chấp nhận gắn deletion timestamp lên chính api-0, chấm dứt graceful theo <code>terminationGracePeriodSeconds</code>. <code>--disable-eviction</code> đổi request sang DELETE nên bỏ qua hoàn toàn hàng rào PDB.'),
        focus: ['kubectl', 'apiserver', 'pdb', 'pod-api-0'], labels: ['kubectl', 'apiserver', 'pdb', 'pod-api-0'],
        scoreMode: true, scoreTitle: 'PDB status · admission', scores: budget(run.initialHealthy, 0, 'warn'),
        explain: [
          {of: 'kubectl', tone: 'info', text: 'Drain gọi <code>POST pods/eviction</code>, không DELETE trực tiếp — <code>--disable-eviction</code> mới bỏ qua hàng rào PDB.'},
          {of: 'pdb', tone: 'warn', text: 'API Server đối chiếu PDB status rồi tiêu đúng một disruption slot: <code>' + run.initialAllowed + ' → 0</code>.'},
          {of: 'pod-api-0', tone: 'warn', text: 'Chấp nhận eviction gắn deletion timestamp lên chính api-0 — graceful, tôn trọng grace period, khác kubelet node-pressure eviction.'}
        ],
        set: {
          'apiserver': KIT.pulse('info', 'Eviction requested', {at: EVICT_HOP[0].arrive}),
          'pdb': KIT.mark('warn', run.initialAllowed + ' allowed → 0', {at: EVICT_HOP[1].arrive, status: 'full', dy: 2.8}),
          'pod-api-0': KIT.mark('doomed', run.evictionReason, {at: TERM_AT + PACE.dur, status: 'terminating', dy: 2.3})
        },
        scene(a) {
          KIT.chain(a, ['kubectl', 'apiserver', 'pdb'], 'info', Object.assign({
            labels: ['POST pods/eviction', 'consume budget'],
            inks: ['info', 'warn']
          }, PACE));
          KIT.link(a, 'apiserver', 'pod-api-0', 'warn', {at: TERM_AT, dur: PACE.dur, label: 'set deletionTimestamp'});
        }},
      {title: 'kubelet A → CRI runtime A → api-0: container dừng graceful', desc: KIT.desc(
        'Kubelet A thấy api-0 Terminating và yêu cầu CRI dừng container graceful.',
        'PDB chỉ quyết định admission ở control plane — không gửi tín hiệu xuống runtime, không kéo dài grace period. Pod object vẫn là api-0 trên Worker A tới khi termination xong.',
        'Muốn Pod tắt sạch trước khi bị SIGKILL, chỉnh <code>terminationGracePeriodSeconds</code> trên chính Pod — PDB không có khái niệm grace period, nó chỉ gác cửa số lượng.'),
        focus: ['kubelet-a', 'runtime-a', 'pod-api-0'], labels: ['kubelet-a', 'runtime-a', 'pod-api-0'],
        explain: [
          {of: 'kubelet-a', tone: 'warn', text: 'Kubelet A theo dõi Pod trên Node của nó, thấy Terminating và yêu cầu CRI dừng container.'},
          {of: 'pod-api-0', tone: 'mute', text: 'api-0 không “di chuyển” đi đâu — nó vẫn là cùng một object, đang dừng tại chỗ trên Worker A.'}
        ],
        set: {
          'runtime-a': KIT.pulse('warn', 'graceful stop requested', {at: STOP_HOP[0].arrive}),
          'pod-api-0': KIT.mark('doomed', 'containers stopping', {at: STOP_HOP[1].arrive, status: 'terminating', dy: 2.3})
        },
        scene(a) {
          KIT.chain(a, ['kubelet-a', 'runtime-a', 'pod-api-0'], 'warn', Object.assign({
            labels: ['CRI StopContainer', 'graceful stop']
          }, PACE));
        }}
    ]},
    {title: 'ReplicaSet controller tạo Pod thay thế để khôi phục availability', pipelineStep: 3, focus: ['replicaset-controller', 'scheduler', 'pod-api-3'], phases: [
      {title: 'API Server → ReplicaSet controller → API Server → api-3: Pod thay thế được tạo', desc: KIT.desc(
        'ReplicaSet controller thấy thiếu replica và tạo api-3 — object mới, Pending.',
        'ReplicaSet controller theo dõi API Server, thấy api-0 terminating rồi tạo <b>api-3</b> — một Pod object hoàn toàn mới với UID mới. PDB không tạo Pod thay thế; OwnerReference từ api-0 tới ReplicaSet mới khiến controller reconcile replica count.',
        'api-0 không "di chuyển" sang Worker C — nó vẫn Terminating trên Worker A, chỉ api-3 là Pod thay thế. Deployment controller không tạo Pod trực tiếp, chỉ quản lý ReplicaSet.'),
        focus: ['apiserver', 'replicaset-controller', 'pod-api-3'], labels: ['apiserver', 'replicaset-controller', 'pod-api-3'],
        explain: [
          {of: 'replicaset-controller', tone: 'info', text: 'Theo dõi API Server, thấy replica hiện tại đang terminating rồi tạo <b>api-3</b> — Pod object mới, UID mới, không phải api-0 hồi sinh.'},
          {of: 'pod-api-3', tone: 'info', text: 'API Server lưu api-3 Pending — chưa Node nào nhận, phải qua scheduler trước khi kubelet nào khởi động container.'}
        ],
        show: ['pod-api-3'], showAt: {'pod-api-3': CREATE_HOP[2].arrive},
        set: {
          'replicaset-controller': KIT.pulse('info', 'replica shortfall observed', {at: CREATE_HOP[0].arrive}),
          'apiserver': KIT.pulse('info', 'api-3 created', {at: CREATE_HOP[1].arrive}),
          'pod-api-3': KIT.mark('peer', 'Pending', {at: CREATE_HOP[2].arrive, status: 'pending', dy: 2.3})
        },
        scene(a) {
          KIT.chain(a, ['apiserver', 'replicaset-controller', 'apiserver', 'pod-api-3'], 'info', Object.assign({
            labels: ['watch replica count', 'CREATE api-3', 'persist Pending'],
            inks: ['info', 'info', 'info']
          }, PACE));
        }},
      {title: 'API Server → scheduler → API Server → api-3: api-3 được bind vào Worker C', desc: KIT.desc(
        'Scheduler chọn Worker C — schedulable — và bind api-3 vào đó.',
        'Scheduler thấy api-3 chưa có <code>nodeName</code>, bắt đầu scheduling cycle. Worker A đã cordon nên không còn là candidate; PDB không chọn Node, không bind Pod — chỉ scheduler làm việc đó.',
        'Nếu Worker C không đủ capacity, api-3 vẫn Pending và drain tiếp tục treo — cluster hết chỗ mới là nguyên nhân thật, không phải PDB "kẹt".'),
        focus: ['apiserver', 'scheduler', 'pod-api-3', 'worker-c'], labels: ['apiserver', 'scheduler', 'pod-api-3', 'worker-c'],
        explain: [
          {of: 'scheduler', tone: 'ok', text: 'Worker A đã cordon nên bị loại khỏi candidate list ngay từ đầu; scheduler chọn Worker C còn schedulable.'},
          {of: 'pod-api-3', tone: 'ok', text: 'Binding là control-plane write qua API Server — cùng một object Pending, giờ có thêm <code>nodeName=worker-c</code>, chưa phải Pod mới.'}
        ],
        set: {
          'scheduler': KIT.pulse('info', 'api-3 Pending', {at: BIND_HOP[0].arrive}),
          'apiserver': KIT.pulse('ok', 'api-3 bound Worker C', {at: BIND_HOP[1].arrive}),
          // Cùng một hộp Pod rời cột queue và đáp xuống hàng Pod của Worker C —
          // binding là lúc object Pending có chỗ đứng thật, không phải lúc một
          // Pod mới được vẽ ra. Move phải là entry cuối cùng cho 'pod-api-3' vì
          // nó mang cả pos lẫn status; một mark khác ghi sau sẽ mất vị trí này.
          'pod-api-3': KIT.move(window.PDB_DRAIN_POS.replacementRunning, {
            tone: 'ok', badge: 'nodeName ← worker-c', at: BIND_HOP[2].arrive, dy: 2.2,
            hover: 'Same Pending object, now bound to Worker C', status: 'bound'
          })
        },
        scene(a) {
          KIT.chain(a, ['apiserver', 'scheduler', 'apiserver', 'pod-api-3'], 'info', Object.assign({
            labels: ['watch Pending Pod', 'POST binding', 'set nodeName'],
            inks: ['info', 'ok', 'ok']
          }, PACE));
        }},
      {title: 'kubelet C → CRI runtime C → api-3: container khởi động', desc: KIT.desc(
        'Kubelet C thấy binding và yêu cầu CRI khởi động container cho api-3.',
        'Runtime khởi động container, nhưng Running chưa phải Ready — PDB chưa có disruption slot mới. api-3 có thể Running trước khi readiness probe pass; PDB vẫn coi nó unavailable tới khi Ready.',
        'Đây là chỗ hay nhầm nhất khi debug drain treo: Pod đã "Running" trên dashboard nhưng PDB vẫn không nhúc nhích, vì nó chỉ đếm Ready.'),
        focus: ['kubelet-c', 'runtime-c', 'pod-api-3'], labels: ['kubelet-c', 'runtime-c', 'pod-api-3'],
        explain: [
          {of: 'runtime-c', tone: 'info', text: 'CRI runtime C tạo container cho api-3 trên Worker C — container Running không đồng nghĩa Pod Ready.'},
          {of: 'pod-api-3', tone: 'mute', text: 'PDB chỉ đếm Pod <b>Ready</b>; api-3 Running vẫn chưa cộng lại vào <code>currentHealthy</code>.'}
        ],
        set: {
          'runtime-c': KIT.pulse('info', 'start api-3', {at: START_HOP[0].arrive}),
          'pod-api-3': KIT.mark('info', 'Running · not Ready', {at: START_HOP[1].arrive, status: 'starting', dy: 2.3})
        },
        scene(a) {
          KIT.chain(a, ['kubelet-c', 'runtime-c', 'pod-api-3'], 'info', Object.assign({
            labels: ['CRI start api-3', 'containers started']
          }, PACE));
        }}
    ]},
    {title: 'Drain chờ tới khi Pod thay thế sẵn sàng (Ready)', pipelineStep: 4, focus: ['kubectl', 'apiserver', 'pdb', 'pod-api-1'], phases: [
      {title: 'kubectl xin evict tiếp Pod kế tiếp trên Worker A', desc: KIT.desc(
        'Cùng lệnh drain tiếp tục xin evict api-1 trong lúc api-3 chưa Ready.',
        'Khi api-3 còn Starting/not Ready, <b>cùng lệnh drain Worker A</b> tiếp tục gửi Eviction cho api-1. Lúc này chỉ api-1, api-2 Ready: <code>currentHealthy=' + run.afterFirstHealthy + '</code>, vừa chạm <code>minAvailable=' + run.minAvailable + '</code>.',
        '<code>kubectl drain</code> không đợi Pod thay thế Ready rồi mới xin Pod tiếp theo — nó cứ gửi tiếp, để PDB tự làm hàng rào chặn đúng lúc cần.'),
        focus: ['kubectl', 'apiserver'], labels: ['kubectl', 'apiserver'],
        scoreMode: true, scoreTitle: 'PDB status · while replacement starts', scores: budget(run.afterFirstHealthy, run.blockedAllowed, 'danger'),
        explain: [
          {of: 'kubectl', tone: 'warn', text: 'Cùng một lệnh <code>kubectl drain worker-a</code> tiếp tục xin evict api-1 — nó không dừng lại sau lần evict đầu.'},
          {of: 'apiserver', tone: 'warn', text: 'currentHealthy vừa chạm minAvailable (' + run.afterFirstHealthy + '/' + run.minAvailable + '), nên request này sẽ bị PDB xét kỹ.'}
        ],
        ...KIT.beat('kubectl', 'apiserver', 'warn', {link: {label: 'retry pods/eviction'}, mark: ['warn', 'api-1 Eviction requested'], dy: 3.2})},
      {title: 'API Server từ chối evict api-1, kubectl tự retry', desc: KIT.desc(
        'API Server từ chối evict api-1 — thêm một Pod nữa sẽ phá minAvailable.',
        'API Server từ chối vì evict thêm api-1 sẽ làm healthy replicas tụt dưới PDB. <code>kubectl drain</code> không bỏ qua PDB — nó retry request bị từ chối tới khi budget mở lại hoặc timeout.',
        'Đây chính là cơ chế PDB "chặn drain": không có API riêng để tạm dừng, chỉ là API Server liên tục từ chối tới khi budget mở lại — kubectl tự retry, không cần bạn can thiệp.'),
        focus: ['apiserver', 'pdb', 'pod-api-1'], labels: ['apiserver', 'pdb', 'pod-api-1'],
        scoreMode: true, scoreTitle: 'PDB gate · request refused', scores: budget(run.afterFirstHealthy, run.blockedAllowed, 'danger'),
        explain: [
          {of: 'pdb', tone: 'danger', text: 'disruptionsAllowed = ' + run.blockedAllowed + ': evict thêm api-1 lúc này sẽ phá <code>minAvailable</code>, nên API Server từ chối.'},
          {of: 'pod-api-1', tone: 'mute', text: 'api-1 vẫn Ready và chạy bình thường — bị từ chối evict không phải một lỗi của chính nó.'}
        ],
        set: {
          'pod-api-1': KIT.pulse('warn', 'eviction refused', {status: 'running', dy: 2.3})
        },
        ...KIT.beat('apiserver', 'pdb', 'danger', {link: {label: 'check budget'}, mark: ['danger', 'refuse · allowed ' + run.blockedAllowed], dy: 2.8})},
      {title: 'kubelet C → API Server → api-3: api-3 báo cáo Ready', desc: KIT.desc(
        'api-3 pass readiness probe; kubelet C báo Ready lên API Server.',
        'Sau khi startup và readiness probe pass, kubelet C cập nhật status Ready lên API Server, rồi API Server ghi status Ready lên chính api-3. Chỉ Pod Ready mới khôi phục <code>currentHealthy</code> — riêng Running chưa đủ.',
        'Chuỗi phụ thuộc giờ mới khép kín: api-3 Ready → budget mở lại → api-1 mới được evict tiếp. Bỏ một mắt xích nào cũng làm drain treo mãi.'),
        focus: ['kubelet-c', 'apiserver', 'pod-api-3'], labels: ['kubelet-c', 'apiserver', 'pod-api-3'],
        explain: [
          {of: 'kubelet-c', tone: 'ok', text: 'Readiness probe pass → kubelet C <code>PATCH</code> status Ready lên API Server.'},
          {of: 'pod-api-3', tone: 'ok', text: 'Có status Ready rồi, disruption controller mới đủ dữ liệu để mở lại PDB budget ở bước kế tiếp.'}
        ],
        set: {
          'apiserver': KIT.pulse('ok', 'api-3 Ready', {at: READY_HOP[0].arrive}),
          'pod-api-3': KIT.mark('live', 'Ready', {at: READY_HOP[1].arrive, status: 'ready', dy: 2.3})
        },
        scene(a) {
          KIT.chain(a, ['kubelet-c', 'apiserver', 'pod-api-3'], 'ok', Object.assign({
            labels: ['PATCH Ready status', 'commit Ready']
          }, PACE));
        }},
      {title: 'Disruption controller mở lại một slot disruption cho PDB', desc: KIT.desc(
        'PDB budget mở lại: api-1, api-2, api-3 đều Ready.',
        'Disruption controller thấy api-1, api-2, api-3 đều Ready và tính lại PDB status. <code>currentHealthy=' + run.restoredHealthy + '</code> trở lại nên <code>disruptionsAllowed=' + run.restoredAllowed + '</code> — retry drain kế tiếp mới được chấp nhận.',
        'Không ai "reset" budget bằng tay — nó tự tính lại mỗi khi trạng thái Pod đổi, đúng bằng số Pod Ready thật, không phải giá trị PDB nhớ sẵn.'),
        focus: ['disruption-controller', 'pdb'], labels: ['disruption-controller', 'pdb'],
        scoreMode: true, scoreTitle: 'PDB status · restored', scores: budget(run.restoredHealthy, run.restoredAllowed, 'ok'),
        explain: [
          {of: 'disruption-controller', tone: 'ok', text: 'Tính lại status: api-1, api-2, api-3 đều Ready — budget được phục hồi từ chính các Pod thật, không phải reset thủ công.'},
          {of: 'pdb', tone: 'ok', text: run.restoredHealthy + '/' + run.replicas + ' Ready nên disruptionsAllowed quay lại ' + run.restoredAllowed + ' — retry evict kế tiếp mới đi tiếp được.'}
        ],
        ...KIT.beat('disruption-controller', 'pdb', 'ok', {link: {label: 'refresh PDB status'}, mark: ['ok', run.restoredHealthy + ' healthy · allowed ' + run.restoredAllowed], status: 'ready', dy: 2.8})}
    ]}
  ];
};
})();
