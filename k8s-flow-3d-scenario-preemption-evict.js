/* ══════════════════════════════════════════════
   PREEMPTION — NOMINATE, EVICT & BIND (steps ④–⑥)

   Tiếp nối k8s-flow-3d-scenario-preemption-filter.js. Cùng mô hình phase:
   một phase = một lời giải thích + một hành động.

   Ba bước cuối trả lời câu hỏi "chuyện gì thực sự xảy ra sau khi chọn xong
   victim" — và vì sao preemption không hề tức thời.

   Vẫn giữ nguyên tắc một-thứ-một-component: Pod `checkout` là **cùng một hộp**
   đã bay từ etcd vào ActiveQ ở bước ①, giờ đáp xuống Worker A. Hai victim
   `pod-a1`/`pod-a2` biến mất ở bước ④ rồi **quay lại chính chúng** trong
   ActiveQ ở bước ⑥ — vì ReplicaSet tạo lại đúng workload đó, không phải một
   thứ mới cần vẽ thêm hộp.

   Thanh pipeline (0 Queue · 1 Filter · 2 PostFilter · 3 Evict · 4 Bind ·
   5 Running) được đặt **theo phase** ở ba file này, và có hai chỗ nó **chạy
   ngược** — đúng như cơ chế thật:

     ④.3 Evict → Queue   Pod quay lại hàng đợi, scheduling cycle này thất bại
     ⑤.2 Evict → Filter  vòng schedule sau chạy lại Filter từ đầu
     ⑥.1 Running → Queue victim được ReplicaSet tạo lại và xếp hàng từ đầu
══════════════════════════════════════════════ */
(function() {
const P = window.PREEMPT_POS;

window.PREEMPT_STEPS_EVICT = [

/* ── STEP ④: Nominate & xoá victim ── */
{
  title: '④ Giữ chỗ, rồi xoá victim — nhẹ nhàng chứ không đột ngột',
  pipelineStep: 3,   // Evict — trừ hai phase override bên dưới
  focus: ['scheduler', 'apiserver', 'etcd', 'pod-checkout', 'node-a', 'pod-a1', 'pod-a2'],
  cam: [-8, 1, 2], dist: 34,
  phases: [
    {
      title: 'nominatedNodeName — đặt gạch trước khi dọn chỗ',
      desc: '<span class="lead">Việc đầu tiên scheduler làm <b>không</b> phải xoá Pod, mà là ghi <code>status.nominatedNodeName: worker-a</code> lên chính Pod đang chờ.</span>'
          + 'Đây là lời tuyên bố công khai: <i>“chỗ sắp trống trên Worker A là dành cho tôi”</i>. Nó nằm trong <code>status</code>, không phải <code>spec</code> — Pod <b>vẫn chưa</b> được bind vào đâu cả.'
          + '<span class="why"><b>Vì sao phải đặt gạch:</b> giữa lúc victim đang tắt và lúc Pod được bind có một khoảng trống hàng chục giây. Nếu không đánh dấu, scheduler khi xử lý các Pod khác sẽ thấy Worker A sắp trống và <b>phát cùng chỗ đó cho một Pod khác</b> — công đuổi Pod coi như đổ sông. <code>kubectl get pod -o wide</code> hiện <code>NOMINATED NODE</code> chính là field này; thấy nó có giá trị nghĩa là <b>preemption đã xảy ra và đang chờ hoàn tất</b>.</span>',
      // Nomination vẫn nằm trong PostFilter — chưa xoá gì cả.
      pipelineStep: 2,
      focus: ['scheduler', 'apiserver', 'etcd', 'pod-checkout', 'queue'],
      // Chỉ Pod đang được ghi nominatedNodeName mới cần đọc cấu hình.
      labels: ['scheduler', 'apiserver', 'etcd', 'pod-checkout'],
      cam: [-13, 1, 3], dist: 28,
      set: {
        'pod-checkout': { col: '#2a2000', edge: '#7a6010',
                          at: 1.35, badge: 'nominatedNodeName ← worker-a', flash: '#c08000', dy: 2.2,
                          hover: 'Đã đặt gạch trên Worker A — nhưng vẫn chưa bind' }
      },
      scene(a) {
        a.flow([[-14.2, 1.4, 1.2], [-16.4, 3.6, 0.8], [-15.9, 1.4, 0.4]], '#3a7fff', {at: 0.25, dur: 0.75, loop: 3.6});
        a.flow([[-16.6, 2.2, -1.2], [-14.6, 4.6, 2.4], [-12.2, 2.4, 6.2]], '#c08000', {at: 1.05, dur: 1.00, loop: 3.6});
        a.note('status.nominatedNodeName', -15.0, 5.6, 2, '#c08000', 0.3);
      }
    },
    {
      title: 'DELETE victim — SIGTERM trước, SIGKILL sau',
      desc: '<span class="lead">Scheduler gọi <code>DELETE</code> lên hai victim. Đây là <b>xoá bình thường</b>, đúng quy trình graceful shutdown, không phải giết ngay.</span>'
          + 'Pod chuyển sang <span class="warn">Terminating</span>, bị gỡ khỏi Service endpoints, kubelet chạy <code>preStop</code> hook rồi gửi <b>SIGTERM</b>. Nếu tiến trình chưa thoát trong <code>terminationGracePeriodSeconds</code> (mặc định <b>30s</b>), kubelet mới gửi <b>SIGKILL</b>.'
          + '<span class="why"><b>Ứng dụng của bạn hoàn toàn có thể tự bảo vệ mình ở đây</b> — bắt SIGTERM, ngừng nhận request mới, flush việc đang dở rồi thoát sạch. Ngược lại, <code>terminationGracePeriodSeconds</code> đặt quá dài trên một Pod priority thấp sẽ <b>kéo dài thời gian Pod priority cao phải chờ</b>. Preemption không nhanh hơn được cái grace period dài nhất trong tập victim.</span>',
      hide: ['pod-a1', 'pod-a2'],
      hideAt: { 'pod-a1': 1.05, 'pod-a2': 1.55 },
      set: {
        'pod-a1': { badge: 'Terminating · SIGTERM', flash: '#c43030', dy: 2.2 },
        'pod-a2': { badge: 'Terminating · SIGTERM', flash: '#c43030', dy: 2.2 }
      },
      focus: ['node-a', 'pod-a1', 'pod-a2', 'pod-a3'],
      cam: [4, 0, 8], dist: 28,
      scene(a) {
        a.flow([[-9.0, 1.2, 2.0], [-2, 4.2, 6.2], [1.6, 0.3, 8.6]], '#c43030', {at: 0.25, dur: 0.80, loop: 3.4});
        a.flow([[-9.0, 1.0, 2.4], [-1, 4.4, 6.6], [6.0, 0.3, 8.6]], '#c43030', {at: 0.75, dur: 0.80, loop: 3.4});
        a.note('preStop → SIGTERM → (30s) → SIGKILL', 6, -3.2, 11.9, '#c43030', 0.4);
      }
    },
    {
      title: 'Pod P=1000 không được bind ngay — nó vẫn nằm trong hàng đợi',
      desc: '<span class="lead">Đây là chỗ trực giác đánh lừa nhiều người nhất: chọn xong victim <b>không</b> đồng nghĩa Pod được xếp chỗ ngay.</span>'
          + 'Kết thúc PostFilter, scheduling cycle này <b>thất bại</b> — Pod <code>checkout</code> quay lại queue (mang theo <code>nominatedNodeName</code>). Tài nguyên chỉ thực sự trống khi victim <b>biến mất hẳn khỏi etcd</b>, và điều đó phụ thuộc vào grace period của chúng.'
          + '<span class="why"><b>Preemption là bất đồng bộ.</b> Trên timeline thực tế: <code>t=0</code> chọn victim và gửi DELETE · <code>t=0..30s</code> victim tắt dần · <code>t≈30s</code> Pod mới được xét lại và bind. Nếu bạn thấy Pod priority cao vẫn <code>Pending</code> vài chục giây <b>sau khi</b> đã có <code>NOMINATED NODE</code>, hệ thống không hỏng — nó đang chờ đúng quy trình.</span>',
      // Thanh pipeline chạy ngược về Queue — vì Pod thật sự quay lại hàng đợi.
      pipelineStep: 0,
      focus: ['scheduler', 'queue', 'pod-checkout', 'pod-report'],
      cam: [-11, 1, 4], dist: 24,
      set: { 'pod-checkout': { at: 0.75, badge: 'requeue · Pending', flash: '#8b6cff', dy: 2.2 } },
      scene(a) {
        a.flow([[-9.6, 1.4, 1.6], [-10.4, 3.4, 4.4], [-11.5, 2.4, 6.2]], '#8b6cff', {at: 0.25, dur: 0.90, loop: 3.4});
        a.note('④ cycle thất bại', -11.5, -4.2, 7, '#6a8ab0', 1.0);
      }
    }
  ]
},

/* ── STEP ⑤: Retry & Bind ── */
{
  title: '⑤ Vòng schedule sau — lần này Worker A vừa chỗ',
  pipelineStep: 3,   // Evict vừa xong — hai phase sau đi tiếp Filter rồi Bind
  focus: ['scheduler', 'node-a', 'pod-a3'],
  cam: [0, 1, 5], dist: 34,
  phases: [
    {
      title: 'Victim biến mất — Worker A còn 5Gi',
      desc: '<span class="lead">Hai victim thoát hẳn, kubelet báo cáo, object bị xoá khỏi etcd. Kế toán tài nguyên của Worker A được tính lại.</span>'
          + 'Chỉ còn <code>payments</code> giữ 7Gi trên tổng 12Gi <code>allocatable</code> → <span class="ok">còn trống 5Gi</span>. Scheduler cập nhật snapshot in-memory của mình qua watch event.'
          + '<span class="why">Cùng lúc đó, <b>ReplicaSet của <code>batch-job</code> và <code>log-agent</code> đã lập tức tạo Pod thay thế</b>. Chúng vừa được đẩy vào queue và sẽ phải tự tìm chỗ — hệ quả này sẽ quay lại ở bước ⑥.</span>',
      set: {
        'node-a': { label: 'Worker A\n7/12Gi', col: '#0a2014', edge: '#1a7040',
                    at: 0.55, badge: '+4Gi trống', flash: '#22dd66', dy: 3.0,
                    hover: 'Victim đã thoát — Node giờ đủ chỗ cho Pod 4Gi' }
      },
      focus: ['node-a', 'pod-a3'],
      cam: [3, 0, 8], dist: 28,
      // Cùng HUD, cùng thứ tự Node như bước ①.3 — chỉ hàng Worker A đổi. Đó là
      // toàn bộ thứ preemption làm được: một Node bớt chật, hai Node còn nguyên.
      scoreMode: true,
      scoreTitle: 'memory đã cấp / allocatable · sau preemption',
      scores: [
        {name: 'Worker A', v: 58,  txt: '7/12Gi',  tone: 'ok'},
        {name: 'Worker B', v: 100, txt: '16/16Gi', tone: 'danger'},
        {name: 'Worker C', v: 38,  txt: '6/16Gi',  tone: 'warn'}
      ],
      scene(a) {
        a.note('12Gi − 7Gi = 5Gi ≥ 4Gi', 6, -3.2, 11.9, '#22dd66', 0.6);
      }
    },
    {
      title: 'Filter chạy lại từ đầu — nominatedNodeName chỉ là gợi ý',
      desc: '<span class="lead">Pod <code>checkout</code> được pop lại. Scheduler <b>không</b> tin vào <code>nominatedNodeName</code> một cách mù quáng — nó chạy lại <b>toàn bộ</b> Filter + Score như một Pod mới hoàn toàn.</span>'
          + 'Lần này Worker A pass. B và C vẫn trượt như cũ. Chỉ còn một ứng viên nên Score gần như không phải làm gì.'
          + '<span class="why"><b>Field đó là gợi ý, không phải chỗ đã đặt cọc.</b> Trong khoảng chờ, một Pod khác priority còn cao hơn hoàn toàn có thể chen vào chiếm mất Worker A. Khi đó Pod <code>checkout</code> lại rơi vào Filter fail → PostFilter → <b>preempt tiếp lần nữa</b>, và những Pod vừa bị hy sinh coi như chết vô ích. Đây là lý do <b>đừng phát priority cao tràn lan</b>: càng nhiều Pod “rất quan trọng”, cluster càng dễ rơi vào cảnh đuổi lẫn nhau vòng quanh.</span>',
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
      scores: [{name: 'Worker A', v: 88, win: true}],
      set: { 'scheduler': { at: 0.65, badge: 'Filter · 1/3 khả thi', flash: '#22dd66', dy: 3.9 } },
      scene(a) {
        a.flow([[-9.2, 1.0, 1.5], [-4.0, 4.2, 5.0], [0.4, -0.6, 7.4]], '#22dd66', {at: 0.25, dur: 1.00, loop: 3.6});
      }
    },
    {
      title: 'Bind — và tất cả những gì scheduler làm vẫn chỉ là ghi một chuỗi',
      desc: '<span class="lead">Scheduler gọi <code>POST /api/v1/.../pods/checkout/binding</code>, API Server ghi <code>spec.nodeName: "worker-a"</code> xuống etcd, <code>nominatedNodeName</code> được xoá đi.</span>'
          + 'kubelet trên Worker A thấy event <code>MODIFIED</code>, kéo image, dựng sandbox, chạy container. Pod chuyển <span class="ok">Running</span> — <b>chính cái hộp đã đi từ etcd qua ActiveQ giờ đáp xuống Node</b>.'
          + '<span class="why"><b>Nhìn lại toàn cảnh:</b> để đuổi hai Pod và xếp chỗ cho một Pod, kube-scheduler chỉ làm đúng ba lời gọi API — <code>PATCH status</code> (nominate), <code>DELETE</code> (victim), <code>POST binding</code>. Nó <span class="danger">không</span> giết tiến trình nào, <span class="danger">không</span> nói chuyện với Node nào. Mọi thứ nặng nề đều do kubelet tự làm khi thấy trạng thái trong etcd đổi.</span>',
      // Cùng hộp Pod: rời ActiveQ, hạ cánh xuống Worker A.
      set: {
        'pod-checkout': { col: '#132f18', edge: '#22aa66',
                          pos: P.nodeA, at: 1.05, badge: 'nodeName ← worker-a · Running', flash: '#22dd66', dy: 2.2,
                          hover: 'Đã bind và đang chạy trên Worker A' }
      },
      // Bind rồi Running — chặng cuối của hành trình Pod checkout.
      pipelineStep: 5,
      focus: ['node-a', 'pod-a3', 'pod-checkout'],
      cam: [3, 0, 7], dist: 30,
      scene(a) {
        a.flow([[-9.6, 1.8, 6.6], [-2.0, 5.0, 6.4], [4.4, 0.4, 6.4]], '#22dd66', {at: 0.25, dur: 1.10, loop: 3.8});
        a.note('⑤ preemption hoàn tất', 6, -3.2, 3.9, '#22dd66', 1.5);
      }
    }
  ]
},

/* ── STEP ⑥: Hệ quả & cách kiểm soát ── */
{
  title: '⑥ Cái giá của preemption — và cách bạn ghìm nó lại',
  pipelineStep: 5,   // mỗi phase nhảy về đúng chặng mà nó đang nói tới
  focus: [],
  cam: [-2, 1, 0], dist: 46,
  phases: [
    {
      title: 'Victim không biến mất — chúng quay lại hàng đợi',
      desc: '<span class="lead">Pod bị preempt gần như luôn thuộc một Deployment hay ReplicaSet. Controller thấy <b>2 ≠ 3</b> và <b>lập tức tạo Pod thay thế</b>.</span>'
          + 'Đúng hai workload vừa bị đuổi — <code>batch-job</code> và <code>log-agent</code> — <b>xuất hiện lại trong ActiveQ</b>, xếp sau <code>report</code> theo đúng thứ tự priority. Chúng chạy lại Filter, và cluster thì vẫn kín chỗ như cũ, nên sẽ nằm <code>Pending</code> cho tới khi có Node rảnh hoặc Cluster Autoscaler thêm máy.'
          + '<span class="why"><b>Preemption không tạo ra tài nguyên, nó chỉ dời vấn đề sang Pod khác.</b> Ở cluster nhỏ, hệ quả có thể là một vòng lặp khó chịu: Pod thấp priority bị đuổi → được tạo lại → lại bị đuổi. Nếu <b>tổng requests luôn vượt tổng capacity</b>, thứ bạn cần là thêm Node hoặc giảm requests — priority chỉ quyết định <i>ai được đau ít hơn</i>.</span>',
      // Vòng lặp khép lại: hai victim quay về đúng chặng Queue đã mở màn ①.
      pipelineStep: 0,
      focus: ['queue', 'pod-report', 'pod-a1', 'pod-a2', 'scheduler'],
      cam: [-11, 1, 4], dist: 31,
      // Chính hai hộp victim quay về queue — vòng đời khép kín, không hộp mới.
      show: ['pod-a1', 'pod-a2'],
      showAt: { 'pod-a2': 1.05, 'pod-a1': 1.55 },
      set: {
        'pod-report': { pos: P.queue0, at: 0.55,
                        badge: 'lên đầu queue', flash: '#3a2a70', dy: 2.2 },
        'pod-a2': { col: '#151030', edge: '#3a2a70',
                    pos: P.queue1, at: 1.05, badge: 'ReplicaSet · Pending', flash: '#c43030', dy: 1.75 },
        'pod-a1': { col: '#151030', edge: '#3a2a70',
                    pos: P.queue2, at: 1.55, badge: 'ReplicaSet · Pending', flash: '#c43030', dy: 1.75 }
      },
      scene(a) {
        a.note('⑥ Pending lại', -11.5, -4.2, 7, '#c43030', 1.8);
      }
    },
    {
      title: 'PDB được tôn trọng “trong khả năng” — không phải một lời hứa',
      desc: '<span class="lead">Scheduler <b>ưu tiên</b> chọn tập victim không vi phạm <code>PodDisruptionBudget</code>. Nhưng nếu mọi phương án đều vi phạm, nó vẫn xoá.</span>'
          + 'So sánh cho rõ: <code>kubectl drain</code> đi qua <b>Eviction API</b> và <span class="ok">bị PDB chặn thật</span> — lệnh sẽ đứng chờ. Preemption thì gọi thẳng <code>DELETE</code>, nên PDB chỉ là <span class="warn">một tiêu chí chấm điểm</span>, không phải rào chắn.'
          + '<span class="why"><b>Ba cơ chế hay bị gộp làm một, thực ra rất khác nhau:</b> <b>Preemption</b> — do <i>scheduler</i>, xét <i>priority</i>, xảy ra khi <i>không đủ chỗ để schedule</i> · <b>Kubelet eviction</b> — do <i>kubelet</i>, xét <i>QoS class</i>, xảy ra khi <i>Node sắp hết RAM/disk thật</i> · <b>OOM Kill</b> — do <i>kernel</i>, xét <i>oom_score_adj</i>, xảy ra khi <i>cgroup vượt limit</i>. Chẩn đoán nhầm cái nào đang xảy ra là đi sai đường ngay từ đầu.</span>',
      // Phase này nói về cách victim bị xoá → đứng ở chặng Evict.
      pipelineStep: 3,
      focus: ['node-a', 'pod-a3', 'pod-checkout'],
      cam: [4, 0, 8], dist: 30,
      scene(a) {
        a.note('DELETE ≠ Eviction API', 6, -3.2, 11.9, '#c08000', 0.4);
      }
    },
    {
      title: 'Bốn cái nút bạn thực sự vặn được',
      desc: '<span class="lead">Preemption là hành vi mặc định của scheduler. Bạn không tắt nó, nhưng bạn định hình được nó:</span>'
          + '<b>1 · <code>preemptionPolicy: Never</code></b> — Pod vẫn được <b>xếp hàng ưu tiên</b> nhờ priority cao, nhưng <span class="ok">không đuổi ai</span>. Đúng cho batch/ML quan trọng nhưng không gấp · '
          + '<b>2 · Thiết kế bậc PriorityClass</b> — vài bậc rõ ràng (<code>system</code> 2000 · <code>critical</code> 1000 · <code>default</code> 0 · <code>batch</code> −10), thay vì mỗi team tự phát một con số · '
          + '<b>3 · Priority âm</b> — Pod “dùng chỗ thừa”, sẵn sàng bị đuổi đầu tiên · '
          + '<b>4 · <code>ResourceQuota</code> theo <code>scopeSelector: PriorityClass</code></b> — chặn ngay từ Admission việc lạm dụng priority cao.'
          + '<span class="why"><b>Câu hỏi kiểm tra hiểu bài:</b> Pod <code>P=1000</code> kẹt <code>Pending</code>, <code>describe</code> báo <i>“1 node(s) had untolerated taint”</i>. Preemption có cứu được không? <span class="danger">Không</span> — xoá Pod không gỡ được taint. Preemption <b>chỉ</b> gỡ được những thất bại do tài nguyên đang bị Pod khác giữ.</span>',
      // Bốn cái nút đều vặn vào PostFilter — nơi quyết định có preempt hay không.
      pipelineStep: 2,
      focus: ['scheduler', 'node-a', 'node-b', 'node-c'],
      cam: [-2, 1, 0], dist: 46,
      set: { 'scheduler': { at: 0.55, badge: 'preemptionPolicy · PriorityClass', flash: '#8b6cff', dy: 3.9 } },
      scene(a) {
        a.note('⑥ chỉ gỡ được thất bại tài nguyên', -4.6, -3.6, 0, '#6a8ab0', 1.2);
      }
    }
  ]
}

];
})();
