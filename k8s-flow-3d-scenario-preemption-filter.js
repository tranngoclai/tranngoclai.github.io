/* ══════════════════════════════════════════════
   PREEMPTION — QUEUE, FILTER & POSTFILTER (steps ①–③)

   Viết bằng SCENE_KIT: `KIT.desc` cho panel, `KIT.mark`/`pulse`/`move` cho
   state change, `KIT.flow`/`note` cho choreography, `KIT.gauge` cho HUD. Ba
   helper state change ứng đúng ba kiểu thay đổi mà một phase được phép làm —
   xem flow3d-kit-state-marks.js.

   Cùng mô hình `phases`: một phase = một lời giải thích + một hành động.
   Engine flatten phases (xem flow3d-engine-phase-expander.js) nên mỗi phase
   chỉ chạy đúng flow và đúng state change của riêng nó.

   Ba bước đầu trả lời câu hỏi "vì sao lại phải preempt": Pod vào queue → mọi
   Node trượt Filter → PostFilter mô phỏng xem xoá Pod nào thì Node mới vừa.

   Hai quy tắc của kit chi phối cách viết ở đây (xem đầu file
   flow3d-kit-world-builder.js): label của mỗi hộp chỉ mang **tên + cấu hình**
   và gần như không đổi suốt kịch bản — verdict là **tone + badge**, diễn giải
   dài nằm ở panel. Và Pod checkout là **một hộp duy nhất di chuyển**
   (`KIT.move`), không phải nhiều hộp giống nhau bật/tắt ở các vị trí khác nhau.

   `pipelineStep` chỉ vào thanh pipeline riêng của kịch bản (khai trong
   k8s-flow-3d-scenario-preemption.js): 0 Queue · 1 Filter · 2 PostFilter ·
   3 Evict · 4 Bind · 5 Running.

   HUD số liệu ở đây đo **memory đã cấp / allocatable** chứ không phải điểm
   Score — vì toàn bộ câu chuyện preemption xoay quanh đúng con số đó. Cùng
   một HUD, cùng thứ tự Node, được bật lại ở bước ⑤ sau khi victim tắt, để
   người xem so trực tiếp trước/sau.
══════════════════════════════════════════════ */
(function() {
const KIT = window.SCENE_KIT;
const MODEL = window.PREEMPTION_MODEL;
const P = window.PREEMPT_POS;

/* Chạy đúng một lần — verdict Filter, tập victim và mọi con số dưới đây đều
   từ đây ra. Xem k8s-flow-3d-scenario-preemption-model.js. */
const RUN = MODEL.simulate(MODEL.DEFAULT_CONFIG);
const POD = RUN.pod;
const NEED = POD.memGi;                       // 4Gi Pod xin

/* Verdict Filter tra theo key Node. */
const V = {};
RUN.filter.evaluated.forEach(function(e) { V[e.key] = e; });

/* Kế hoạch PostFilter trên Worker A: tập victim tối thiểu và những Pod được
   giữ lại. `payments` nằm trong `spared` là kết quả tính toán, không phải một
   câu khẳng định viết tay. */
const PLAN = RUN.postFilter.chosen;
const A = RUN.byKey('node-a');

/* Chỗ trống tích luỹ sau mỗi victim — dùng cho HUD ở bước ③. */
const CUMULATIVE = (function() {
  const rows = [];
  let freed = MODEL.memFree(A);
  PLAN.victims.forEach(function(v) {
    freed += v.memGi;
    rows.push({name: '+ ' + v.name, freeGi: freed, victim: v});
  });
  return rows;
})();

/* '0/3 nodes are available: 2 Insufficient memory, 1 …untolerated taint' —
   đếm từ verdict thay vì gõ tay, nên thêm/bớt Node là dòng này tự đúng. */
const REJECTED_BY_REASON = {};
RUN.filter.rejected.forEach(function(e) {
  REJECTED_BY_REASON[e.reason] = (REJECTED_BY_REASON[e.reason] || 0) + 1;
});
const TOTAL_NODES = RUN.filter.evaluated.length;
const FEASIBLE_LABEL = RUN.filter.passed.length + '/' + TOTAL_NODES;


/* ── Step ② Filter: per-Node copy ──
   Same pattern as Scheduler Filter: hand-written descriptions, model-driven
   structure. Labels per phase are intentional subsets — only the Node being
   discussed and its resident Pods show captions. */
var PREEMPT_FILTER_TITLES = {
  'node-a': 'Worker A trượt — thiếu đúng 3Gi',
  'node-b': 'Worker B trượt — đầy, và đầy bởi Pod quan trọng hơn',
  'node-c': 'Worker C trượt vì taint — và Pod nhận FailedScheduling'
};
var PREEMPT_FILTER_LABELS = {
  'node-a': ['scheduler', 'pod-checkout', 'node-a', 'pod-a1', 'pod-a2', 'pod-a3'],
  'node-b': ['scheduler', 'pod-checkout', 'node-b', 'pod-b1', 'pod-b2'],
  'node-c': ['scheduler', 'pod-checkout', 'node-c', 'pod-c1']
};
var PREEMPT_FILTER_HOVER = {
  'node-a': 'Trượt vì tài nguyên đang bị Pod khác giữ — lý do DUY NHẤT preemption gỡ được',
  'node-b': 'Cùng lý do với Worker A, nhưng Pod chiếm chỗ đều priority cao hơn',
  'node-c': 'Còn thừa chỗ, nhưng trượt vì taint — xoá Pod không sửa được'
};
var PREEMPT_FILTER_LINK = {
  'node-a': {},
  'node-b': {dur: 0.95},
  'node-c': {}
};
var PREEMPT_FILTER_DESCS = {
  'node-a': KIT.desc(
    'Pha Filter hỏi mỗi Node một câu nhị phân: Pod này <b>có vừa</b> không?',
    '<code>NodeResourcesFit</code> tính: ' + MODEL.fmtGi(A.memUsed) + ' đã cấp + ' + MODEL.fmtGi(NEED) + ' yêu cầu = '
    + MODEL.fmtGi(A.memUsed + NEED) + ' > ' + MODEL.fmtGi(A.memTotal) + ' <code>allocatable</code>. Trượt. '
    + 'Chỉ thiếu ' + MODEL.fmtGi(V['node-a'].shortfallGi) + ', nhưng Filter <b>không có khái niệm "gần đủ"</b> — chỉ có pass hoặc fail.',
    '<b>Nhớ kỹ Node này.</b> Nó trượt vì <i>tài nguyên đang bị Pod khác giữ</i> — một lý do <b>có thể đảo ngược được</b> bằng cách xoá bớt Pod. Hai Node còn lại sẽ trượt vì những lý do khác hẳn, và chính sự khác biệt đó quyết định preemption cứu được Node nào.'),
  'node-b': KIT.desc(
    'Worker B cũng trượt <code>NodeResourcesFit</code>: 16Gi đã cấp hết cho <code>ingress-ctrl</code> và <code>core-dns</code>.',
    'Nhìn qua thì giống hệt Worker A — cùng một plugin, cùng một lý do. Nhưng có một chi tiết Filter <b>hoàn toàn không quan tâm</b>: hai Pod đang chiếm chỗ ở đây đều có <code>P=2000</code>, <b>cao hơn</b> Pod đang chờ.',
    '<b>Filter mù với priority.</b> Nó chỉ cộng <code>requests</code> và so với <code>allocatable</code> — ai đang chiếm chỗ, quan trọng cỡ nào, nó không hỏi. Priority chỉ được lôi ra dùng ở pha sau. Giữ chi tiết này lại: đến bước ③ nó sẽ là thứ loại Worker B ra khỏi cuộc chơi.'),
  'node-c': KIT.desc(
    'Worker C còn <b>10Gi trống</b>, nhưng trượt <code>TaintToleration</code>: Node mang <code>gpu=true:NoSchedule</code> mà Pod không khai <code>toleration</code>.',
    'Kết quả: <b>' + FEASIBLE_LABEL + ' Node khả thi</b>. Event <code>FailedScheduling</code> được ghi lên Pod: <i>"' + FEASIBLE_LABEL + ' nodes are available: '
    + REJECTED_BY_REASON['insufficient-memory'] + ' Insufficient memory, '
    + REJECTED_BY_REASON['untolerated-taint'] + ' node(s) had untolerated taint"</i>.',
    '<b>Với một Pod priority = 0, câu chuyện dừng tại đây</b> — Pod về <code>unschedulableQ</code> và nằm <code>Pending</code> cho tới khi cluster đổi trạng thái. Nhưng Pod này có <code>priority = 1000</code>, nên scheduler <b>không bỏ cuộc ngay</b>: nó chạy tiếp một extension point nữa tên là <span class="warn">PostFilter</span>. Đó chính là nơi Preemption sống.')
};

window.PREEMPT_STEPS_FILTER = [

/* ── STEP ①: Pod priority cao vào hàng đợi ── */
{
  title: 'Pod priority cao vào hàng đợi — cluster đã kín chỗ',
  pipelineStep: 0,
  focus: ['apiserver', 'etcd', 'pod-checkout', 'scheduler', 'queue', 'pod-report'],
  phases: [
    {
      title: 'PriorityClass biến một cái tên thành một con số',
      desc: KIT.desc(
        'Pod <code>checkout</code> khai <code>spec.priorityClassName: high-priority</code> — chỉ là một cái tên.',
        'Ở bước Admission, <b>PriorityClass admission plugin</b> tra object <code>PriorityClass</code> tương ứng và ghi giá trị thật vào <code>spec.priority: 1000</code>. Từ đây scheduler chỉ làm việc với con số đó. '
        + 'Pod không khai gì thì nhận <code>globalDefault</code>, thường là <span class="hi">0</span>.',
        '<b>Con số này được đóng băng ngay lúc tạo Pod.</b> Sửa object <code>PriorityClass</code> sau đó <span class="danger">không</span> thay đổi priority của các Pod đang chạy — chúng giữ nguyên giá trị đã ghi. Muốn đổi thì phải tạo lại Pod.'),
      labels: ['apiserver', 'etcd', 'pod-checkout'],
      show: ['pod-checkout'],
      showAt: { 'pod-checkout': 1.15 },
      set: {
        'pod-checkout': KIT.pulse('warn', 'spec.priority ← 1000', {dy: 2.2})
      },
      scene(a) {
        KIT.link(a, 'apiserver', 'etcd', 'warn');
      }
    },
    {
      title: 'ActiveQ sắp lại hàng — Pod P=1000 chen lên đầu',
      desc: KIT.desc(
        'Scheduler nhận watch event và đẩy Pod vào <span class="hi">ActiveQ</span> — một <b>priority queue</b>, không phải FIFO.',
        'Pod <code>report</code> (<code>P=200</code>) đã nằm chờ sẵn, nhưng <code>checkout</code> (<code>P=1000</code>) vẫn được <b>pop ra trước</b>. Priority quyết định <b>thứ tự xét</b>, trước khi nó quyết định bất cứ điều gì khác.',
        '<b>Đây là tác dụng đầu tiên và rẻ nhất của priority.</b> Khi cluster còn chỗ, câu chuyện dừng ở đây: Pod cao điểm được xét sớm hơn, rồi mọi Pod đều được schedule. <b>Preemption chỉ xuất hiện khi bước tiếp theo — Filter — không tìm được Node nào.</b>'),
      labels: ['scheduler', 'queue', 'pod-checkout', 'pod-report'],
      show: ['queue', 'pod-report'],
      showAt: { 'queue': 0.35, 'pod-report': 0.75 },
      // Cùng một hộp Pod bay từ etcd sang đầu ActiveQ — không tạo hộp mới.
      set: {
        'pod-report': KIT.pulse('peer'),
        'pod-checkout': KIT.move(P.queue0, {badge: 'pop trước report', at: 1.15, dy: 2.2})
      },
      scene(a) {
        KIT.link(a, 'etcd', 'queue', 'accent', {dur: 1.00});
      }
    },
    {
      title: 'Hiện trạng cluster: 3 Node, không Node nào còn 4Gi',
      desc: KIT.desc(
        'Pod <code>checkout</code> xin <code>requests.memory: 4Gi</code>. Nhìn qua cả cluster:',
        ['<b>Worker A</b> — 12Gi, đã cấp 11Gi (<code>batch-job</code> 1Gi + <code>log-agent</code> 3Gi + <code>payments</code> 7Gi) → còn <span class="warn">1Gi</span>',
         '<b>Worker B</b> — 16Gi, đã cấp hết cho <code>ingress-ctrl</code> và <code>core-dns</code>, cả hai <code>P=2000</code>',
         '<b>Worker C</b> — còn tới 10Gi trống, nhưng mang <code>taint</code> <code>gpu=true:NoSchedule</code>.'],
        '<b>Chú ý “đã cấp” chứ không phải “đang dùng”.</b> Scheduler cộng <code>requests</code>, không nhìn RAM thực tế. Ba Pod trên Worker A có thể chỉ đang dùng 2Gi thật — Node vẫn được coi là kín chỗ. Đây là lý do đặt <code>requests</code> quá tay làm cluster “hết chỗ” trong khi <code>top nodes</code> báo còn rất rảnh.'),
      focus: ['node-a', 'node-b', 'node-c', 'pod-a1', 'pod-a2', 'pod-a3', 'pod-b1', 'pod-b2', 'pod-c1'],
      // Phase kiểm kê cả cluster — đây là chỗ duy nhất mọi con số nên hiện
      // cùng lúc, cộng thêm yêu cầu 4Gi của Pod để so sánh.
      labels: ['node-a', 'node-b', 'node-c', 'pod-a1', 'pod-a2', 'pod-a3', 'pod-b1', 'pod-b2', 'pod-c1', 'pod-checkout'],
      // Kế toán tài nguyên của cả cluster trong một khung hình — chính con số
      // này sẽ được so lại ở bước ⑤ sau khi victim tắt.
      scoreMode: true,
      scoreTitle: 'memory đã cấp / allocatable',
      scores: RUN.nodes.map(function(n) {
        // Node nào không còn đủ chỗ cho Pod thì đỏ, còn lại vàng.
        return KIT.gauge(n.name, n.memUsed, n.memTotal, 'Gi',
          {tone: MODEL.memFree(n) < NEED ? 'danger' : 'warn'});
      }),
      set: {
        'pod-checkout': KIT.pulse('accent', 'requests.memory: ' + MODEL.fmtGi(NEED), {at: 0.35, dy: 2.2})
      },
      scene(a) {
        KIT.note(a, '① requests ≠ usage', {of: 'node-a', band: true}, 'mute', 0.6);
      }
    }
  ]
},

/* ── STEP ②: Filter trượt sạch ──
   Phases generated from the model's rejected list (`KIT.sweep`), with
   `KIT.beat` encoding the timing constraint. The last phase adds a
   FailedScheduling pulse on the Pod. */
{
  title: 'Filter chạy — 0/3 Node khả thi',
  pipelineStep: 1,
  focus: ['scheduler', 'node-a', 'node-b', 'node-c'],
  phases: KIT.sweep(RUN.filter.evaluated, function(e, i) {
    var isLast = i === RUN.filter.evaluated.length - 1;
    var beat = KIT.beat('scheduler', e.key, 'danger', {
      mark: ['danger', e.plugin + ' — fail'],
      dy: 3.0,
      hover: PREEMPT_FILTER_HOVER[e.key],
      link: PREEMPT_FILTER_LINK[e.key]
    });
    var baseSc = beat.scene;
    var set = beat.set;
    if (isLast) {
      set['pod-checkout'] = KIT.pulse('danger', 'FailedScheduling · ' + FEASIBLE_LABEL, {at: 1.7, dy: 2.2});
    }
    return {
      title: PREEMPT_FILTER_TITLES[e.key],
      desc:  PREEMPT_FILTER_DESCS[e.key],
      labels: PREEMPT_FILTER_LABELS[e.key],
      set:   set,
      scene: isLast ? function(a) {
        baseSc(a);
        KIT.note(a, '② ' + FEASIBLE_LABEL + ' nodes are available', {of: 'scheduler', band: true}, 'danger', 1.6);
      } : baseSc
    };
  })
},

/* ── STEP ③: PostFilter — mô phỏng và chọn victim ── */
{
  title: 'PostFilter — “nếu xoá bớt Pod thì Node nào vừa?”',
  pipelineStep: 2,
  focus: ['scheduler', 'node-a', 'node-b', 'node-c'],
  phases: [
    {
      title: 'PostFilter chỉ chạy khi Filter đã thất bại hoàn toàn',
      desc: KIT.desc(
        'Preemption <b>không phải</b> một tính năng riêng — nó là plugin <code>DefaultPreemption</code> cắm vào extension point <span class="hi">PostFilter</span> của Scheduler Framework.',
        'PostFilter chỉ được gọi khi <b>không Node nào</b> qua được Filter. Và plugin chỉ chịu làm việc nếu Pod thoả hai điều kiện: '
        + '<code>spec.priority</code> đủ để có Pod nào đó thấp hơn, và <code>spec.preemptionPolicy</code> <span class="warn">không phải</span> <code>Never</code>.',
        '<b>Thứ tự này quan trọng:</b> preemption <span class="danger">không bao giờ</span> chạy song song hay chạy trước Filter. Cluster còn dù chỉ một Node vừa chỗ → không có Pod nào bị đuổi, bất kể priority chênh lệch bao nhiêu. <b>Preemption là phương án cuối, không phải quyền ưu tiên thường trực.</b>'),
      // Phase này nói về điều kiện chạy plugin, không về Node nào cả.
      labels: ['scheduler', 'pod-checkout'],
      set: {
        'scheduler': KIT.pulse('accent', 'PostFilter · DefaultPreemption', {at: 0.55, dy: 3.9})
      },
      scene(a) {
        KIT.note(a, 'Filter fail → PostFilter', 'scheduler', 'accent', 0.2);
      }
    },
    {
      title: 'Mô phỏng trên từng Node — hai trong ba Node bị loại ngay',
      desc: KIT.desc(
        'Với mỗi Node vừa trượt, scheduler chạy một phép thử <b>trong bộ nhớ</b>: <i>giả sử xoá hết Pod có priority thấp hơn 1000, Node có pass Filter không?</i>',
        ['<b>Worker A</b> → xoá <code>batch-job</code>, <code>log-agent</code>, <code>payments</code> thì dư sức chứa → <span class="ok">ứng viên hợp lệ</span>',
         '<b>Worker B</b> → mọi Pod đều <code>P=2000</code>, <span class="danger">không có gì hợp lệ để xoá</span>, Node vẫn đầy → loại',
         '<b>Worker C</b> → xoá <code>gpu-train</code> cũng vô ích, vì Node trượt vì <b>taint</b> chứ không phải vì thiếu chỗ → loại.'],
        '<b>Đây là quy tắc gọn nhất về preemption:</b> nó chỉ gỡ được những Filter thất bại <b>do tài nguyên bị Pod khác giữ</b>. Taint, node affinity, nodeSelector, volume zone mismatch — <span class="danger">xoá bao nhiêu Pod cũng không sửa được</span>. Pod của bạn kẹt <code>Pending</code> vì taint thì priority cao đến mấy cũng vô nghĩa.'),
      // Phép thử chạy trên cả ba Node, và nó so priority của từng Pod đang
      // chiếm chỗ — nên cấu hình của Pod phải đọc được ở đây.
      labels: ['node-a', 'node-b', 'node-c', 'pod-a1', 'pod-a2', 'pod-a3', 'pod-b1', 'pod-b2', 'pod-c1'],
      set: {
        'node-a': KIT.mark('ok', 'ứng viên duy nhất', {
          at: 0.45, dy: 3.0,
          hover: 'Node duy nhất mà xoá Pod giải quyết được vấn đề'
        }),
        'node-b': KIT.pulse('danger', 'không có victim', {at: 0.95, dy: 3.0}),
        'node-c': KIT.pulse('danger', 'taint ≠ resource', {at: 1.45, dy: 3.0})
      },
      scene(a) {
        KIT.note(a, '③ chỉ Worker A còn cửa', {of: 'node-a', band: true}, 'ok', 1.7);
      }
    },
    {
      title: 'Tập victim tối thiểu — xoá từ dưới lên, dừng ngay khi vừa đủ',
      desc: KIT.desc(
        'Trên Worker A, scheduler <b>không</b> xoá sạch. Nó sắp Pod theo priority tăng dần rồi cộng dồn cho tới khi vừa đủ chỗ:',
        CUMULATIVE.map(function(row, i) {
          const enough = row.freeGi >= NEED;
          const last = i === CUMULATIVE.length - 1;
          return '<code>' + row.victim.name + '</code> <b>P=' + row.victim.priority + '</b> → '
            + (i === 0 ? 'giải phóng ' : 'thêm ') + MODEL.fmtGi(row.victim.memGi) + ', tổng trống '
            + (enough
                ? '<span class="ok">' + MODEL.fmtGi(row.freeGi) + ' ≥ ' + MODEL.fmtGi(NEED) + '</span>' + (last ? ' → <b>dừng</b>' : '')
                : MODEL.fmtGi(row.freeGi) + ' — <span class="warn">chưa đủ ' + MODEL.fmtGi(NEED) + '</span>');
        }).concat(PLAN.spared.map(function(p) {
          return '<code>' + p.name + '</code> <b>P=' + p.priority + '</b> tuy vẫn thấp hơn '
            + POD.priority + ' nhưng <span class="ok">được giữ nguyên</span>.';
        })),
        '<b>Hai điều thường bị hiểu sai ở bước này.</b> Thứ nhất, scheduler cố <b>tránh vi phạm PodDisruptionBudget</b> khi chọn victim — nhưng đó là <i>ưu tiên</i>, không phải ràng buộc: hết lựa chọn thì nó vẫn xoá và vẫn vi phạm PDB. Thứ hai, <b>QoS class hoàn toàn không được xét</b> ở đây — một Pod <code>Guaranteed</code> priority thấp vẫn bị đuổi trước một Pod <code>BestEffort</code> priority cao. Kubelet Eviction cũng không sort trực tiếp theo QoS: với memory pressure nó xét usage vượt request, rồi Priority, rồi excess usage — hai cơ chế vẫn có trigger và owner khác nhau hoàn toàn.'),
      focus: ['node-a', 'pod-a1', 'pod-a2', 'pod-a3'],
      // Cộng dồn theo đúng thứ tự scheduler duyệt: hàng thứ hai chạm 100% là
      // chỗ nó dừng lại — `payments` không có mặt vì không bị đụng tới.
      scoreMode: true,
      scoreTitle: 'chỗ trống tích luỹ / ' + MODEL.fmtGi(NEED) + ' cần',
      scores: CUMULATIVE.map(function(row) {
        const enough = row.freeGi >= NEED;
        return KIT.gauge('+ ' + row.victim.name, row.freeGi, NEED, 'Gi',
          {txt: MODEL.fmtGi(row.freeGi), tone: enough ? undefined : 'danger', win: enough});
      }),
      // Victim và Pod được giữ đều do model quyết — không hộp nào bị đánh dấu
      // 'doomed' bằng tay, nên hình và lời giải thích không thể lệch nhau.
      set: (function() {
        const out = {};
        PLAN.victims.forEach(function(v, i) {
          out[v.key] = KIT.mark('doomed', 'victim · −' + MODEL.fmtGi(v.memGi),
            {at: 0.45 + i * 0.60, dy: 2.2});
        });
        PLAN.spared.forEach(function(p, i) {
          out[p.key] = KIT.mark('ok', 'giữ lại',
            {at: 0.45 + (PLAN.victims.length + i) * 0.60, dy: 2.2});
        });
        return out;
      })(),
      scene(a) {
        KIT.note(a, 'tập victim tối thiểu', {of: 'node-a', band: true}, 'mute', 1.8);
      }
    }
  ]
}

];
})();
