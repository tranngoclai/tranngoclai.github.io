/* ══════════════════════════════════════════════
   PREEMPTION — NOMINATE, EVICT & BIND (steps ④–⑥)

   Tiếp nối k8s-flow-3d-scenario-preemption-filter.js, viết bằng cùng bộ helper
   của SCENE_KIT. Cùng mô hình phase: một phase = một lời giải thích + một
   hành động.

   Ba bước cuối trả lời câu hỏi "chuyện gì thực sự xảy ra sau khi chọn xong
   victim" — và vì sao preemption không hề tức thời.

   Vẫn giữ nguyên tắc một-thứ-một-component: Pod `checkout` là **cùng một hộp**
   đã bay từ etcd vào ActiveQ ở bước ①, giờ `KIT.move` đưa nó đáp xuống Worker
   A. Hai victim `pod-a1`/`pod-a2` biến mất ở bước ④ rồi **quay lại chính
   chúng** trong ActiveQ ở bước ⑥ — vì ReplicaSet tạo lại đúng workload đó,
   không phải một thứ mới cần vẽ thêm hộp.

   Thanh pipeline (0 Queue · 1 Filter · 2 PostFilter · 3 Evict · 4 Bind ·
   5 Running) được đặt **theo phase** ở ba file này, và có hai chỗ nó **chạy
   ngược** — đúng như cơ chế thật:

     ④.3 Evict → Queue   Pod quay lại hàng đợi, scheduling cycle này thất bại
     ⑤.2 Evict → Filter  vòng schedule sau chạy lại Filter từ đầu
     ⑥.1 Running → Queue victim được ReplicaSet tạo lại và xếp hàng từ đầu
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const MODEL = window.PREEMPTION_MODEL;

/* Cùng một model với bước ①–③. `AFTER` là Worker A sau khi victim tắt — con số
   7/12Gi không gõ tay, nó là kết quả của chính tập victim đã chọn. */
const RUN = MODEL.simulate(MODEL.DEFAULT_CONFIG);
const NEED = RUN.pod.memGi;
const BEFORE = RUN.byKey('node-a');
const AFTER = RUN.afterEviction;
const FREED = MODEL.memFree(AFTER);
const P = window.PREEMPT_POS;

window.PREEMPT_STEPS_EVICT = [

/* ── STEP ④: Nominate & xoá victim ── */
{
  title: 'Giữ chỗ, rồi xoá victim — nhẹ nhàng chứ không đột ngột',
  pipelineStep: 3,   // Evict — trừ hai phase override bên dưới
  focus: ['scheduler', 'apiserver', 'etcd', 'pod-checkout', 'node-a', 'pod-a1', 'pod-a2'],
  cam: [-8, 1, 2], dist: 34,
  phases: [
    {
      title: 'nominatedNodeName — đặt gạch trước khi dọn chỗ',
      desc: KIT.desc(
        'Việc đầu tiên scheduler làm <b>không</b> phải xoá Pod, mà là ghi <code>status.nominatedNodeName: worker-a</code> lên chính Pod đang chờ.',
        'Đây là lời tuyên bố công khai: <i>“chỗ sắp trống trên Worker A là dành cho tôi”</i>. Nó nằm trong <code>status</code>, không phải <code>spec</code> — Pod <b>vẫn chưa</b> được bind vào đâu cả.',
        '<b>Vì sao phải đặt gạch:</b> giữa lúc victim đang tắt và lúc Pod được bind có một khoảng trống hàng chục giây. Nếu không đánh dấu, scheduler khi xử lý các Pod khác sẽ thấy Worker A sắp trống và <b>phát cùng chỗ đó cho một Pod khác</b> — công đuổi Pod coi như đổ sông. <code>kubectl get pod -o wide</code> hiện <code>NOMINATED NODE</code> chính là field này; thấy nó có giá trị nghĩa là <b>preemption đã xảy ra và đang chờ hoàn tất</b>.'),
      // Nomination vẫn nằm trong PostFilter — chưa xoá gì cả.
      pipelineStep: 2,
      focus: ['scheduler', 'apiserver', 'etcd', 'pod-checkout', 'queue'],
      // Chỉ Pod đang được ghi nominatedNodeName mới cần đọc cấu hình.
      labels: ['scheduler', 'apiserver', 'etcd', 'pod-checkout'],
      cam: [-13, 1, 3], dist: 28,
      set: {
        'pod-checkout': KIT.mark('warn', 'nominatedNodeName ← worker-a', {
          at: 1.35, dy: 2.2,
          hover: 'Đã đặt gạch trên Worker A — nhưng vẫn chưa bind'
        })
      },
      scene(a) {
        KIT.link(a, 'scheduler', 'apiserver', 'info', {at: 0.25, dur: 0.75});
        KIT.link(a, 'apiserver', 'pod-checkout', 'warn', {at: 1.05, dur: 1.00});
        KIT.note(a, 'status.nominatedNodeName', [-15.0, 5.6, 2], 'warn', 0.3);
      }
    },
    {
      title: 'DELETE victim — SIGTERM trước, SIGKILL sau',
      desc: KIT.desc(
        'Scheduler gọi <code>DELETE</code> lên hai victim. Đây là <b>xoá bình thường</b>, đúng quy trình graceful shutdown, không phải giết ngay.',
        'Pod chuyển sang <span class="warn">Terminating</span>, bị gỡ khỏi Service endpoints, kubelet chạy <code>preStop</code> hook rồi gửi <b>SIGTERM</b>. Nếu tiến trình chưa thoát trong <code>terminationGracePeriodSeconds</code> (mặc định <b>30s</b>), kubelet mới gửi <b>SIGKILL</b>.',
        '<b>Ứng dụng của bạn hoàn toàn có thể tự bảo vệ mình ở đây</b> — bắt SIGTERM, ngừng nhận request mới, flush việc đang dở rồi thoát sạch. Ngược lại, <code>terminationGracePeriodSeconds</code> đặt quá dài trên một Pod priority thấp sẽ <b>kéo dài thời gian Pod priority cao phải chờ</b>. Preemption không nhanh hơn được cái grace period dài nhất trong tập victim.'),
      hide: ['pod-a1', 'pod-a2'],
      hideAt: { 'pod-a1': 1.05, 'pod-a2': 1.55 },
      set: {
        'pod-a1': KIT.pulse('danger', 'Terminating · SIGTERM', {dy: 2.2}),
        'pod-a2': KIT.pulse('danger', 'Terminating · SIGTERM', {dy: 2.2})
      },
      focus: ['node-a', 'pod-a1', 'pod-a2', 'pod-a3'],
      cam: [4, 0, 8], dist: 28,
      scene(a) {
        KIT.link(a, 'scheduler', 'pod-a1', 'danger', {at: 0.25, dur: 0.80, loop: 3.4});
        KIT.link(a, 'scheduler', 'pod-a2', 'danger', {at: 0.75, dur: 0.80, loop: 3.4, lift: 0.5});
        KIT.note(a, 'preStop → SIGTERM → (30s) → SIGKILL', [6, -3.2, 11.9], 'danger', 0.4);
      }
    },
    {
      title: 'Pod P=1000 không được bind ngay — nó vẫn nằm trong hàng đợi',
      desc: KIT.desc(
        'Đây là chỗ trực giác đánh lừa nhiều người nhất: chọn xong victim <b>không</b> đồng nghĩa Pod được xếp chỗ ngay.',
        'Kết thúc PostFilter, scheduling cycle này <b>thất bại</b> — Pod <code>checkout</code> quay lại queue (mang theo <code>nominatedNodeName</code>). Tài nguyên chỉ thực sự trống khi victim <b>biến mất hẳn khỏi etcd</b>, và điều đó phụ thuộc vào grace period của chúng.',
        '<b>Preemption là bất đồng bộ.</b> Trên timeline thực tế: <code>t=0</code> chọn victim và gửi DELETE · <code>t=0..30s</code> victim tắt dần · <code>t≈30s</code> Pod mới được xét lại và bind. Nếu bạn thấy Pod priority cao vẫn <code>Pending</code> vài chục giây <b>sau khi</b> đã có <code>NOMINATED NODE</code>, hệ thống không hỏng — nó đang chờ đúng quy trình.'),
      // Thanh pipeline chạy ngược về Queue — vì Pod thật sự quay lại hàng đợi.
      pipelineStep: 0,
      focus: ['scheduler', 'queue', 'pod-checkout', 'pod-report'],
      cam: [-11, 1, 4], dist: 24,
      set: {
        'pod-checkout': KIT.pulse('accent', 'requeue · Pending', {at: 0.75, dy: 2.2})
      },
      scene(a) {
        KIT.link(a, 'scheduler', 'queue', 'accent', {at: 0.25, dur: 0.90, loop: 3.4});
        KIT.note(a, '④ cycle thất bại', [-11.5, -4.2, 7], 'mute', 1.0);
      }
    }
  ]
},

/* ── STEP ⑤: Retry & Bind ── */
{
  title: 'Vòng schedule sau — lần này Worker A vừa chỗ',
  pipelineStep: 3,   // Evict vừa xong — hai phase sau đi tiếp Filter rồi Bind
  focus: ['scheduler', 'node-a', 'pod-a3'],
  cam: [0, 1, 5], dist: 34,
  phases: [
    {
      title: 'Victim biến mất — ' + AFTER.name + ' còn ' + MODEL.fmtGi(FREED),
      desc: KIT.desc(
        'Hai victim thoát hẳn, kubelet báo cáo, object bị xoá khỏi etcd. Kế toán tài nguyên của Worker A được tính lại.',
        'Chỉ còn <code>' + AFTER.pods.map(function(p) { return p.name; }).join('</code>, <code>') + '</code> giữ '
        + MODEL.fmtGi(AFTER.memUsed) + ' trên tổng ' + MODEL.fmtGi(AFTER.memTotal) + ' <code>allocatable</code> → <span class="ok">còn trống '
        + MODEL.fmtGi(FREED) + '</span>. Scheduler cập nhật snapshot in-memory của mình qua watch event.',
        'Cùng lúc đó, <b>ReplicaSet của <code>batch-job</code> và <code>log-agent</code> đã lập tức tạo Pod thay thế</b>. Chúng vừa được đẩy vào queue và sẽ phải tự tìm chỗ — hệ quả này sẽ quay lại ở bước ⑥.'),
      // Con số cấu hình trên label thật sự đổi → đây là một trong số ít chỗ
      // label được phép thay, và nó thay vì Node bớt chật thật.
      set: {
        'node-a': KIT.mark('ok', '+' + MODEL.fmtGi(BEFORE.memUsed - AFTER.memUsed) + ' trống', {
          label: AFTER.name + '\n' + MODEL.fmtNodeMem(AFTER), at: 0.55, dy: 3.0,
          hover: 'Victim đã thoát — Node giờ đủ chỗ cho Pod ' + MODEL.fmtGi(NEED)
        })
      },
      focus: ['node-a', 'pod-a3'],
      cam: [3, 0, 8], dist: 28,
      // Cùng HUD, cùng thứ tự Node như bước ①.3 — chỉ hàng Worker A đổi. Đó là
      // toàn bộ thứ preemption làm được: một Node bớt chật, hai Node còn nguyên.
      scoreMode: true,
      scoreTitle: 'memory đã cấp / allocatable · sau preemption',
      // Cùng thứ tự Node như bước ①, nhưng Worker A đọc từ trạng thái SAU
      // eviction — đó chính là hàng người xem cần thấy đã dịch chuyển.
      scores: RUN.nodes.map(function(n) {
        const shown = n.key === 'node-a' ? AFTER : n;
        return KIT.gauge(shown.name, shown.memUsed, shown.memTotal, 'Gi',
          {tone: MODEL.memFree(shown) >= NEED ? 'ok'
               : (MODEL.memFree(shown) === 0 ? 'danger' : 'warn')});
      }),
      scene(a) {
        KIT.note(a, MODEL.fmtGi(AFTER.memTotal) + ' − ' + MODEL.fmtGi(AFTER.memUsed)
                  + ' = ' + MODEL.fmtGi(FREED) + ' ≥ ' + MODEL.fmtGi(NEED),
                 [6, -3.2, 11.9], 'ok', 0.6);
      }
    },
    {
      title: 'Filter chạy lại từ đầu — nominatedNodeName chỉ là gợi ý',
      desc: KIT.desc(
        'Pod <code>checkout</code> được pop lại. Scheduler <b>không</b> tin vào <code>nominatedNodeName</code> một cách mù quáng — nó chạy lại <b>toàn bộ</b> Filter + Score như một Pod mới hoàn toàn.',
        'Lần này Worker A pass. B và C vẫn trượt như cũ. Chỉ còn một ứng viên nên Score gần như không phải làm gì.',
        '<b>Field đó là gợi ý, không phải chỗ đã đặt cọc.</b> Trong khoảng chờ, một Pod khác priority còn cao hơn hoàn toàn có thể chen vào chiếm mất Worker A. Khi đó Pod <code>checkout</code> lại rơi vào Filter fail → PostFilter → <b>preempt tiếp lần nữa</b>, và những Pod vừa bị hy sinh coi như chết vô ích. Đây là lý do <b>đừng phát priority cao tràn lan</b>: càng nhiều Pod “rất quan trọng”, cluster càng dễ rơi vào cảnh đuổi lẫn nhau vòng quanh.'),
      // Chạy lại Filter thật — thanh pipeline lùi về đúng chặng đó.
      pipelineStep: 1,
      focus: ['scheduler', 'node-a', 'node-b', 'node-c'],
      // Filter chạy lại cho chính Pod này — cần thấy lại yêu cầu 4Gi của nó
      // bên cạnh con số mới của Worker A.
      labels: ['scheduler', 'node-a', 'node-b', 'node-c', 'pod-checkout'],
      cam: [-2, 1, 0], dist: 40,
      // Score vẫn chạy, chỉ là không còn gì để so — HUD nói ra điều đó thay vì
      // để người xem tưởng scheduler bỏ qua pha Score khi có preemption.
      scoreMode: true,
      scoreTitle: 'score — chỉ còn 1 ứng viên',
      scores: [KIT.score('Worker A', 88, {win: true})],
      set: {
        'scheduler': KIT.pulse('ok', 'Filter · 1/3 khả thi', {at: 0.65, dy: 3.9})
      },
      scene(a) {
        KIT.link(a, 'scheduler', 'node-a', 'ok', {at: 0.25, dur: 1.00});
      }
    },
    {
      title: 'Bind — và tất cả những gì scheduler làm vẫn chỉ là ghi một chuỗi',
      desc: KIT.desc(
        'Scheduler gọi <code>POST /api/v1/.../pods/checkout/binding</code>, API Server ghi <code>spec.nodeName: "worker-a"</code> xuống etcd, <code>nominatedNodeName</code> được xoá đi.',
        'kubelet trên Worker A thấy event <code>MODIFIED</code>, kéo image, dựng sandbox, chạy container. Pod chuyển <span class="ok">Running</span> — <b>chính cái hộp đã đi từ etcd qua ActiveQ giờ đáp xuống Node</b>.',
        '<b>Nhìn lại toàn cảnh:</b> để đuổi hai Pod và xếp chỗ cho một Pod, kube-scheduler chỉ làm đúng ba lời gọi API — <code>PATCH status</code> (nominate), <code>DELETE</code> (victim), <code>POST binding</code>. Nó <span class="danger">không</span> giết tiến trình nào, <span class="danger">không</span> nói chuyện với Node nào. Mọi thứ nặng nề đều do kubelet tự làm khi thấy trạng thái trong etcd đổi.'),
      // Cùng hộp Pod: rời ActiveQ, hạ cánh xuống Worker A — và tone đổi sang
      // `live` vì đến đây nó đã là một Pod đang chạy như những Pod cùng Node.
      set: {
        'pod-checkout': KIT.move(P.nodeA, {
          tone: 'live', badge: 'nodeName ← worker-a · Running', at: 1.05, dy: 2.2,
          hover: 'Đã bind và đang chạy trên Worker A'
        })
      },
      // Bind rồi Running — chặng cuối của hành trình Pod checkout.
      pipelineStep: 5,
      focus: ['node-a', 'pod-a3', 'pod-checkout'],
      cam: [3, 0, 7], dist: 30,
      scene(a) {
        KIT.link(a, 'scheduler', 'pod-checkout', 'ok', {at: 0.25, dur: 1.10, loop: 3.8});
        KIT.note(a, '⑤ preemption hoàn tất', [6, -3.2, 3.9], 'ok', 1.5);
      }
    }
  ]
},

/* ── STEP ⑥: Hệ quả & cách kiểm soát ── */
{
  title: 'Cái giá của preemption — và cách bạn ghìm nó lại',
  pipelineStep: 5,   // mỗi phase nhảy về đúng chặng mà nó đang nói tới
  focus: [],
  cam: [-2, 1, 0], dist: 46,
  phases: [
    {
      title: 'Victim không biến mất — chúng quay lại hàng đợi',
      desc: KIT.desc(
        'Pod bị preempt gần như luôn thuộc một Deployment hay ReplicaSet. Controller thấy <b>2 ≠ 3</b> và <b>lập tức tạo Pod thay thế</b>.',
        'Đúng hai workload vừa bị đuổi — <code>batch-job</code> và <code>log-agent</code> — <b>xuất hiện lại trong ActiveQ</b>, xếp sau <code>report</code> theo đúng thứ tự priority. Chúng chạy lại Filter, và cluster thì vẫn kín chỗ như cũ, nên sẽ nằm <code>Pending</code> cho tới khi có Node rảnh hoặc Cluster Autoscaler thêm máy.',
        '<b>Preemption không tạo ra tài nguyên, nó chỉ dời vấn đề sang Pod khác.</b> Ở cluster nhỏ, hệ quả có thể là một vòng lặp khó chịu: Pod thấp priority bị đuổi → được tạo lại → lại bị đuổi. Nếu <b>tổng requests luôn vượt tổng capacity</b>, thứ bạn cần là thêm Node hoặc giảm requests — priority chỉ quyết định <i>ai được đau ít hơn</i>.'),
      // Vòng lặp khép lại: hai victim quay về đúng chặng Queue đã mở màn ①.
      pipelineStep: 0,
      focus: ['queue', 'pod-report', 'pod-a1', 'pod-a2', 'scheduler'],
      cam: [-11, 1, 4], dist: 31,
      // Chính hai hộp victim quay về queue — vòng đời khép kín, không hộp mới.
      // Chúng đổi tone sang `peer` (Pod đang chờ) nhưng vẫn chớp đỏ, vì thứ
      // vừa xảy ra với chúng là một lần bị đuổi.
      show: ['pod-a1', 'pod-a2'],
      showAt: { 'pod-a2': 1.05, 'pod-a1': 1.55 },
      set: {
        'pod-report': KIT.move(P.queue0, {ink: 'peer', badge: 'lên đầu queue', at: 0.55, dy: 2.2}),
        'pod-a2': KIT.move(P.queue1, {tone: 'peer', badge: 'ReplicaSet · Pending',
                                      flash: KIT.ink('danger'), at: 1.05, dy: 1.75}),
        'pod-a1': KIT.move(P.queue2, {tone: 'peer', badge: 'ReplicaSet · Pending',
                                      flash: KIT.ink('danger'), at: 1.55, dy: 1.75})
      },
      scene(a) {
        KIT.note(a, '⑥ Pending lại', [-11.5, -4.2, 7], 'danger', 1.8);
      }
    },
    {
      title: 'PDB được tôn trọng “trong khả năng” — không phải một lời hứa',
      desc: KIT.desc(
        'Scheduler <b>ưu tiên</b> chọn tập victim không vi phạm <code>PodDisruptionBudget</code>. Nhưng nếu mọi phương án đều vi phạm, nó vẫn xoá.',
        'So sánh cho rõ: <code>kubectl drain</code> đi qua <b>Eviction API</b> và <span class="ok">bị PDB chặn thật</span> — lệnh sẽ đứng chờ. Preemption thì gọi thẳng <code>DELETE</code>, nên PDB chỉ là <span class="warn">một tiêu chí chấm điểm</span>, không phải rào chắn.',
        '<b>Ba cơ chế hay bị gộp làm một, thực ra rất khác nhau:</b> <b>Preemption</b> — do <i>scheduler</i>, xét <i>priority</i>, xảy ra khi <i>không đủ chỗ để schedule</i> · <b>Kubelet eviction</b> — do <i>kubelet</i>, với memory pressure xét <i>usage vượt request → Priority → excess usage</i>, xảy ra khi <i>Node sắp hết RAM thật</i> · <b>OOM Kill</b> — do <i>kernel</i>, xét <i>oom_score_adj</i>, có thể do <i>container cgroup vượt limit</i> hoặc node/global OOM. Chẩn đoán nhầm cái nào đang xảy ra là đi sai đường ngay từ đầu.'),
      // Phase này nói về cách victim bị xoá → đứng ở chặng Evict.
      pipelineStep: 3,
      focus: ['node-a', 'pod-a3', 'pod-checkout'],
      cam: [4, 0, 8], dist: 30,
      scene(a) {
        KIT.note(a, 'DELETE ≠ Eviction API', [6, -3.2, 11.9], 'warn', 0.4);
      }
    },
    {
      title: 'Bốn cái nút bạn thực sự vặn được',
      desc: KIT.desc(
        'Preemption là hành vi mặc định của scheduler. Bạn không tắt nó, nhưng bạn định hình được nó:',
        ['<b>1 · <code>preemptionPolicy: Never</code></b> — Pod vẫn được <b>xếp hàng ưu tiên</b> nhờ priority cao, nhưng <span class="ok">không đuổi ai</span>. Đúng cho batch/ML quan trọng nhưng không gấp',
         '<b>2 · Thiết kế bậc PriorityClass</b> — vài bậc rõ ràng (<code>system</code> 2000 · <code>critical</code> 1000 · <code>default</code> 0 · <code>batch</code> −10), thay vì mỗi team tự phát một con số',
         '<b>3 · Priority âm</b> — Pod “dùng chỗ thừa”, sẵn sàng bị đuổi đầu tiên',
         '<b>4 · <code>ResourceQuota</code> theo <code>scopeSelector: PriorityClass</code></b> — chặn ngay từ Admission việc lạm dụng priority cao.'],
        '<b>Câu hỏi kiểm tra hiểu bài:</b> Pod <code>P=1000</code> kẹt <code>Pending</code>, <code>describe</code> báo <i>“1 node(s) had untolerated taint”</i>. Preemption có cứu được không? <span class="danger">Không</span> — xoá Pod không gỡ được taint. Preemption <b>chỉ</b> gỡ được những thất bại do tài nguyên đang bị Pod khác giữ.'),
      // Bốn cái nút đều vặn vào PostFilter — nơi quyết định có preempt hay không.
      pipelineStep: 2,
      focus: ['scheduler', 'node-a', 'node-b', 'node-c'],
      cam: [-2, 1, 0], dist: 46,
      set: {
        'scheduler': KIT.pulse('accent', 'preemptionPolicy · PriorityClass', {at: 0.55, dy: 3.9})
      },
      scene(a) {
        KIT.note(a, '⑥ chỉ gỡ được thất bại tài nguyên', [-4.6, -3.6, 0], 'mute', 1.2);
      }
    }
  ]
}

];
})();
