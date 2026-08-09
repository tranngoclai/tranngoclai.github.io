/* ══════════════════════════════════════════════
   WRITE PATH — STEPS · TRAPS (race condition §5, ORM-bypass §7)

   Hai arc độc lập, chạy sau cascade chuẩn:

   1. RACE: client-a/client-b là hai TRÌNH DUYỆT cố định (đứng ở cột client,
      không di chuyển). Request tự nó không phải một thực thể nên không có
      box riêng — mọi request/response là arrow (KIT.link). Đường ĐỌC đi
      đúng thứ tự thật theo §5 doc: client → app worker → redis (miss) →
      orm-cache → db-engine — không nhảy cóc thẳng client → DB hay client →
      Redis. Thứ tự step bám đúng timeline thật (aRead < write < bRead) và
      MỖI request chỉ kể xong mới sang request kế: A đi TRỌN đường tới DB và
      cầm giá cũ về → admin mới ghi → B mới đi TRỌN đường của nó và cầm giá
      mới về. Không gộp read của A/B vào step "cả hai cùng miss Redis" — gộp
      như vậy làm admin về đích trước A trên màn hình dù A gửi trước. A miss
      Redis do hết TTL, B miss do key vừa bị admin DEL — hai lý do khác nhau,
      cùng dẫn xuống DB. A và B đều là request ĐỌC THUẦN, không client nào gửi
      request ghi: lệnh SET vào Redis là CACHE-ASIDE FILL do chính worker
      phát ra ở đuôi mỗi request vừa miss, nên arrow ghi luôn là
      app-worker-x → redis, không bao giờ client → app. Hai step fill xếp
      theo aWriteAtMs/bWriteAtMs (firstFill/lastFill) chứ không hardcode A/B.
      Biến ẩn của cả arc là ĐỘ TRỄ round-trip (aLatencyMs/bLatencyMs = lúc SET
      trừ lúc gửi): A gửi trước nhưng SET sau vì query của nó chậm hơn. Độ trễ
      này hiện lên arrow + badge "block" trên chính hộp `app-worker-a` ngay ở
      step A chạm DB — giấu nó đi thì tới step SET cuối người xem không hiểu
      vì sao A đè được B. A và B đi qua HAI hộp worker riêng (app-worker-a/b)
      chứ không chung `origin-app`: hai hộp khác nhau cùng SET một key Redis
      mới vẽ đúng lost update, còn vẽ hai arrow từ cùng một hộp thì thành ra
      app tự ghi đè chính nó. `origin-app` ở giữa vẫn dành cho PATCH của admin
      và cascade.
      Hệ quả bắt buộc: step "SELECT chạm DB" CHỈ vẽ chiều đi (orm→db), TUYỆT
      ĐỐI không vẽ db→client, vì lúc đó kết quả chưa có. Cả đường về
      (db→app→redis SET→app→client) nằm trọn trong step fill của request đó,
      đúng mốc aWriteAtMs/bWriteAtMs. Vẽ response ngay ở step chạm DB là tự
      mâu thuẫn với badge "đang đợi". Dùng thẳng
      `WRITE_PATH_MODEL.raceOutcome()` nên số liệu trong desc và model.js
      không bao giờ lệch nhau.

   2. BYPASS: admin chạy raw SQL thẳng vào DB, né được đúng tín hiệu
      post_save của ORM — `bypassImpact()` liệt kê level nào vẫn đúng
      (db, os, redis, lb, cdn — vì các lệnh invalidate đó là code app
      riêng, không phụ thuộc ORM) và level nào sai (chỉ orm-cache). */
(function() {
const KIT = window.SCENE_KIT;
const LV = window.ECOM_CACHE_LEVELS;
const M = window.WRITE_PATH_MODEL;

const COMPONENT = {db: 'db-engine', os: 'os-cache', orm: 'orm-cache', redis: 'redis', lb: 'lb-proxy', cdn: 'cdn-edge', browser: 'browser-cache'};

function raceSteps(run) {
  const timeline = M.DEFAULT_RACE_TIMELINE;
  const outcome = M.raceOutcome(timeline, run);
  const winner = outcome.finalWriter === 'a' ? 'Request A' : 'Request B';

  /* Cache-aside fill: KHÔNG phải client gửi request ghi — chính worker phục
     vụ request đó SET lại Redis ở đuôi request ĐỌC vừa miss. Thứ tự hai SET
     lấy thẳng từ timeline nên step "SET trước" luôn đứng trước step "SET sau
     cùng" trên màn hình, đúng như mọi arrow khác trong arc. */
  const fillA = {who: 'A', client: 'client-a', worker: 'app-worker-a', value: outcome.aValue, atMs: timeline.aWriteAtMs, sentAtMs: timeline.aReadAtMs, lift: 1.0};
  const fillB = {who: 'B', client: 'client-b', worker: 'app-worker-b', value: outcome.bValue, atMs: timeline.bWriteAtMs, sentAtMs: timeline.bReadAtMs, lift: 2.0};
  const firstFill = fillA.atMs < fillB.atMs ? fillA : fillB;
  const lastFill = firstFill === fillA ? fillB : fillA;

  /* Độ trễ round-trip = lúc SET cache trừ lúc gửi request. Đây là biến ẩn
     giải thích toàn bộ race: A xuất phát trước nhưng về đích sau vì query của
     nó chậm hơn. Tính từ timeline chứ không hardcode, để chỉnh
     aWriteAtMs/bWriteAtMs là nhãn trên arrow tự khớp theo. */
  const aLatencyMs = timeline.aWriteAtMs - timeline.aReadAtMs;
  const bLatencyMs = timeline.bWriteAtMs - timeline.bReadAtMs;
  const slowerLabel = aLatencyMs > bLatencyMs ? 'A' : 'B';

  return [
    {
      title: 'Request A chạy trước — worker A hỏi Redis, miss',
      pipelineStep: 0,
      focus: ['client-a', 'app-worker-a', 'redis'],
      phases: [{
        title: 'A gửi GET lúc ' + timeline.aReadAtMs + 'ms — admin CHƯA ghi gì cả',
        desc: KIT.desc(
          '<b>A gửi request</b> lúc ' + timeline.aReadAtMs + 'ms — sớm nhất trong cả kịch bản, lúc này admin còn chưa đụng vào giá.',
          'Request rơi vào <b>app worker A</b> — một process riêng. Đây là chi tiết quyết định của §5: request B lát nữa sẽ do một worker KHÁC phục vụ, hai worker chạy song song và không hề biết nhau.',
          'Request đi qua app trước — không client nào chạm thẳng vào Redis hay DB (§5 doc: "App nhận request → GET Redis → miss → query DB").',
          'Key product:4521 vừa hết TTL nên Redis <b>miss</b> — điều kiện bắt buộc để A đi tiếp xuống DB; nếu còn hit, A dừng ở đây và không bao giờ có race.'
        ),
        focus: ['client-a', 'app-worker-a', 'redis'],
        show: ['client-a', 'app-worker-a'],
        set: {redis: KIT.mark('danger', 'miss · hết TTL', {at: 0.95})},
        scene: function(a) {
          KIT.link(a, 'client-a', 'app-worker-a', 'warn', {at: 0.15, dur: 0.5, label: 'GET · A · ' + timeline.aReadAtMs + 'ms'});
          KIT.link(a, 'app-worker-a', 'redis', 'warn', {at: 0.6, dur: 0.45, label: 'GET product:4521'});
        }
      }]
    },
    {
      title: 'SELECT của A chạm DB — đọc được ' + outcome.aValue + ', chưa trả về',
      pipelineStep: 0,
      focus: ['redis', 'orm-cache', 'db-engine', 'app-worker-a'],
      phases: [{
        title: 'DB đọc giá cũ ' + outcome.aValue + ' cho A lúc ' + timeline.aReadAtMs + 'ms — worker A bắt đầu chờ',
        desc: KIT.desc(
          'Redis miss → app đọc tiếp ORM cache (cũng miss) → DB engine — đúng thứ tự đọc thật redis → orm → db, y hệt read path.',
          '<b>SELECT của A chạm DB lúc ' + timeline.aReadAtMs + 'ms</b>, khi DB vẫn còn giá cũ ' + run.oldPrice + '. Đây là lúc giá trị A sẽ thấy được <b>chốt lại</b>: ' + outcome.aValue + '. Admin chưa gửi lệnh nào.',
          '<b>Nhưng query chưa xong.</b> Nó còn phải chạy nốt rồi truyền kết quả ngược lên — tổng cộng ' + aLatencyMs + 'ms (DB đang bận, chờ lock/connection pool, GC pause…). Nên chưa có mũi tên nào đi ngược lên: <b>worker A đang block, ngồi chờ kết quả</b>.',
          'Kết quả chỉ về tới worker A ở ' + timeline.aWriteAtMs + 'ms — 4 step nữa. Lúc đó nó mới SET được vào Redis (cache-aside). Chính khoảng chờ ' + aLatencyMs + 'ms này quyết định race, không phải việc A gửi trước.'
        ),
        focus: ['redis', 'orm-cache', 'db-engine', 'app-worker-a'],
        set: {
          'orm-cache': KIT.mark('danger', 'miss', {at: 0.5}),
          'db-engine': KIT.mark('warn', 'còn giá cũ ' + run.oldPrice, {at: 1.05}),
          'app-worker-a': KIT.mark('warn', 'block · chờ ' + aLatencyMs + 'ms', {at: 1.5})
        },
        scene: function(a) {
          KIT.link(a, 'redis', 'orm-cache', 'warn', {at: 0.1, dur: 0.4, label: 'forward'});
          KIT.link(a, 'orm-cache', 'db-engine', 'warn', {at: 0.5, dur: 0.6, label: 'SELECT price · chạy mất ' + aLatencyMs + 'ms'});
        }
      }]
    },
    {
      title: 'Admin ghi giá mới — sau khi A đã đọc xong',
      pipelineStep: 0,
      focus: ['admin-console', 'lb-proxy', 'origin-app', 'orm-cache', 'db-engine'],
      phases: [{
        title: 'Admin console gửi UPDATE giá ' + run.oldPrice + ' → ' + run.newPrice,
        desc: KIT.desc(
          '<b>Admin ghi giá mới</b> lúc ' + timeline.writeAtMs + 'ms — A đã đọc xong ở ' + timeline.aReadAtMs + 'ms, B thì chưa gửi (' + timeline.bReadAtMs + 'ms).',
          'PATCH đi trọn đường LB/reverse-proxy → App → ORM → DB engine — đây CŨNG là điểm bắt đầu của cascade 7 level phía sau, không phải hai sự kiện tách rời.',
          'Lệnh này do một worker khác phục vụ (hộp Origin App ở giữa) — nó không dùng chung state với worker A đang block bên cạnh, nên chẳng có cách nào báo cho A biết giá vừa đổi.',
          'DB engine đổi ' + run.oldPrice + ' → ' + run.newPrice + ' <b>ngay lúc này</b> — giá trị A vừa cầm về trở thành cũ mà A không hề hay biết.',
          'Đây là khoảng hở tạo ra race: A và B nhìn thấy DB ở hai thời điểm nằm hai bên lằn ranh này.'
        ),
        focus: ['admin-console', 'lb-proxy', 'origin-app', 'orm-cache', 'db-engine'],
        set: {
          'app-worker-a': KIT.mark('warn', 'vẫn block · tới ' + timeline.aWriteAtMs + 'ms', {at: 0.1}),
          'admin-console': KIT.pulse('danger', 'ghi giá · ' + timeline.writeAtMs + 'ms', {at: 0.2}),
          'lb-proxy': KIT.pulse('accent', 'forward PATCH', {at: 0.75}),
          'origin-app': KIT.pulse('accent', 'validate + save', {at: 1.3}),
          'orm-cache': KIT.pulse('accent', 'model.save()', {at: 1.9}),
          'db-engine': KIT.mark('ok', run.oldPrice + ' → ' + run.newPrice, {at: 2.55})
        },
        scene: function(a) {
          KIT.link(a, 'admin-console', 'lb-proxy', 'accent', {at: 0.25, dur: 0.5, label: 'PATCH giá'});
          KIT.link(a, 'lb-proxy', 'origin-app', 'accent', {at: 0.75, dur: 0.5, label: 'forward'});
          KIT.link(a, 'origin-app', 'orm-cache', 'accent', {at: 1.25, dur: 0.55, label: 'model.save()'});
          KIT.link(a, 'orm-cache', 'db-engine', 'accent', {at: 1.85, dur: 0.6, label: 'UPDATE row'});
        }
      }]
    },
    {
      title: 'Request B chạy sau — worker B hỏi Redis, vẫn miss',
      pipelineStep: 0,
      focus: ['client-b', 'app-worker-b', 'app-worker-a', 'redis'],
      phases: [{
        title: 'B gửi GET lúc ' + timeline.bReadAtMs + 'ms — vào một worker KHÁC, trong khi worker A còn block',
        desc: KIT.desc(
          '<b>B gửi request</b> lúc ' + timeline.bReadAtMs + 'ms — sau lằn ranh ' + timeline.writeAtMs + 'ms, tức sau khi DB đã có giá mới.',
          '<b>B rơi vào app worker B</b>, một process hoàn toàn khác. Worker A ngay bên cạnh vẫn đang block chờ query của nó — hai worker không chia sẻ biến, không xếp hàng, không chờ nhau. Đây chính là gốc của race.',
          'Redis lần này miss vì <b>vừa bị DEL</b> bởi lệnh invalidate của admin (§6) — khác lý do với A (A miss do hết TTL), nhưng kết quả giống nhau: B cũng phải xuống tận DB.'
        ),
        focus: ['client-b', 'app-worker-b', 'app-worker-a', 'redis'],
        show: ['client-b', 'app-worker-b'],
        set: {
          redis: KIT.mark('danger', 'miss · vừa bị DEL', {at: 0.95}),
          'app-worker-a': KIT.mark('warn', 'vẫn block · tới ' + timeline.aWriteAtMs + 'ms', {at: 0.1})
        },
        scene: function(a) {
          KIT.link(a, 'client-b', 'app-worker-b', 'accent', {at: 0.15, dur: 0.5, label: 'GET · B · ' + timeline.bReadAtMs + 'ms'});
          KIT.link(a, 'app-worker-b', 'redis', 'warn', {at: 0.6, dur: 0.45, label: 'GET product:4521'});
        }
      }]
    },
    {
      title: 'SELECT của B chạm DB — đọc được ' + outcome.bValue + ', query nhanh ' + bLatencyMs + 'ms',
      pipelineStep: 0,
      focus: ['redis', 'orm-cache', 'db-engine', 'app-worker-a', 'app-worker-b'],
      phases: [{
        title: 'DB đọc giá mới ' + outcome.bValue + ' cho B lúc ' + timeline.bReadAtMs + 'ms — trong khi worker A còn block',
        desc: KIT.desc(
          'Cùng một đường redis → orm → db như A, nhưng chạm DB ở thời điểm khác nên chốt được giá trị khác: <b>B lấy ' + outcome.bValue + '</b>, giá đúng.',
          '<b>Query của B chỉ mất ' + bLatencyMs + 'ms</b> — nhanh hơn A (' + aLatencyMs + 'ms) vì row vừa được admin UPDATE nên page đang nóng trong buffer pool, và worker B đang rảnh trong khi worker A vướng lock/GC. Không có gì đồng bộ hai worker này với nhau.',
          '<b>Nhìn hai hộp worker cạnh nhau: A vẫn block, B sắp xong.</b> B xuất phát sau A ' + (timeline.bReadAtMs - timeline.aReadAtMs) + 'ms nhưng sẽ có kết quả ở ' + timeline.bWriteAtMs + 'ms, còn A mãi ' + timeline.aWriteAtMs + 'ms. Xuất phát trước không có nghĩa về trước.',
          'Giờ hai request ĐỌC đã chốt hai giá trị khác nhau từ CÙNG một DB: ' + outcome.aValue + ' và ' + outcome.bValue + '. Cả hai đều miss nên app sẽ SET cả hai ngược vào Redis — race nằm ở chỗ lệnh SET nào chạm Redis SAU CÙNG.'
        ),
        focus: ['redis', 'orm-cache', 'db-engine', 'app-worker-a', 'app-worker-b'],
        set: {
          'orm-cache': KIT.mark('danger', 'miss', {at: 0.5}),
          'db-engine': KIT.mark('ok', 'giá mới ' + run.newPrice, {at: 1.05}),
          'app-worker-a': KIT.mark('warn', 'vẫn block · tới ' + timeline.aWriteAtMs + 'ms', {at: 0.1}),
          'app-worker-b': KIT.mark('accent', 'block · chờ ' + bLatencyMs + 'ms', {at: 1.5})
        },
        scene: function(a) {
          KIT.link(a, 'redis', 'orm-cache', 'warn', {at: 0.1, dur: 0.4, label: 'forward'});
          KIT.link(a, 'orm-cache', 'db-engine', 'warn', {at: 0.5, dur: 0.6, label: 'SELECT price · chạy mất ' + bLatencyMs + 'ms'});
        }
      }]
    },
    {
      title: 'Worker ' + firstFill.who + ' xong trước — SET Redis ' + firstFill.value,
      pipelineStep: 4,
      focus: ['db-engine', firstFill.worker, 'redis', firstFill.client, lastFill.worker],
      phases: [{
        title: 'Kết quả về worker ' + firstFill.who + ' lúc ' + firstFill.atMs + 'ms → cache-aside SET → trả response',
        desc: KIT.desc(
          '<b>Đây mới là lúc đường về của ' + firstFill.who + ' chạy.</b> Query gửi ở ' + firstFill.sentAtMs + 'ms, kết quả về worker ' + firstFill.who + ' ở ' + firstFill.atMs + 'ms — trước giờ chưa có mũi tên nào đi ngược lên vì kết quả chưa có.',
          '<b>Không có request ghi nào từ client cả.</b> ' + firstFill.who + ' chỉ là request ĐỌC — nhưng vì nó miss Redis và phải xuống tận DB, worker SET giá trị vừa đọc ngược vào Redis để lần sau hit. Đó là cache-aside (§6), phần đuôi của chính request GET đó.',
          'Thứ tự trong step này: DB trả kết quả lên worker ' + firstFill.who + ' → worker SET ' + firstFill.value + ' vào Redis → worker trả response về client ' + firstFill.who + '.',
          'Redis đang giữ ' + firstFill.value + '. Nhưng nhìn sang hộp worker ' + lastFill.who + ' bên cạnh: nó vẫn đang block, cầm sẵn giá ' + lastFill.value + ' chưa ghi. Không ai bảo nó rằng Redis vừa được cập nhật.'
        ),
        focus: ['db-engine', firstFill.worker, 'redis', firstFill.client, lastFill.worker],
        set: {
          redis: KIT.mark(firstFill.value === run.newPrice ? 'ok' : 'warn', 'SET ' + firstFill.value + ' · ' + firstFill.atMs + 'ms', {at: 1.15}),
          'app-worker-a': KIT.mark('warn', 'vẫn block · tới ' + timeline.aWriteAtMs + 'ms', {at: 0.1})
        },
        scene: function(a) {
          KIT.link(a, 'db-engine', firstFill.worker, 'accent', {at: 0.15, dur: 0.55, label: 'kết quả · ' + firstFill.value});
          KIT.link(a, firstFill.worker, 'redis', firstFill.value === run.newPrice ? 'ok' : 'warn', {at: 0.75, dur: 0.5, label: 'SET · cache-aside ' + firstFill.who});
          KIT.link(a, firstFill.worker, firstFill.client, 'mute', {at: 1.3, dur: 0.55, label: 'response · ' + firstFill.value});
        }
      }]
    },
    {
      title: 'Worker ' + lastFill.who + ' xong SAU — SET đè, ' + lastFill.value + ' thắng',
      pipelineStep: 4,
      focus: ['db-engine', lastFill.worker, 'redis', lastFill.client, firstFill.worker],
      phases: [{
        title: 'Kết quả của ' + lastFill.who + ' mãi ' + lastFill.atMs + 'ms mới về → worker ' + lastFill.who + ' SET đè lên giá trị của ' + firstFill.who,
        desc: KIT.desc(
          '<b>Đường về của ' + lastFill.who + ' chạy ở đây.</b> Query gửi từ ' + lastFill.sentAtMs + 'ms, tới giờ (' + lastFill.atMs + 'ms) kết quả mới về tới worker ' + lastFill.who + ' — nó đã block suốt ' + (lastFill.atMs - lastFill.sentAtMs) + 'ms, xuyên qua cả lệnh ghi của admin lẫn trọn vòng đời của request ' + firstFill.who + '.',
          '<b>Hai hộp worker khác nhau cùng bắn vào một key Redis</b> — đó là lost update. Worker ' + lastFill.who + ' cầm giá ' + lastFill.value + ' đọc từ ' + lastFill.sentAtMs + 'ms và ghi đè thẳng lên giá ' + firstFill.value + ' mà worker ' + firstFill.who + ' vừa ghi, vì nó không có cách nào biết chuyện đó đã xảy ra.',
          '<b>' + lastFill.who + ' SET lúc ' + lastFill.atMs + 'ms, ' + firstFill.who + ' đã SET lúc ' + firstFill.atMs + 'ms</b> — thứ tự chạm Redis, không phải thứ tự gửi request, quyết định giá trị cuối cùng.',
          'Request A gửi TRƯỚC (' + timeline.aReadAtMs + 'ms) nhưng SET SAU (' + timeline.aWriteAtMs + 'ms) vì query của nó ngốn ' + aLatencyMs + 'ms trong khi B chỉ mất ' + bLatencyMs + 'ms — đúng bản chất race: "đến trước, về sau".',
          'Không dòng code nào quyết định thứ tự này. Đổi độ trễ của ' + slowerLabel + ' cho nhanh hơn là bug biến mất — nên loại lỗi này chạy 1000 lần có thể chỉ sai vài lần, rất khó tái hiện.',
          winner + ' ghi sau cùng nên Redis giữ ' + outcome.value + ', dù DB đã có ' + run.newPrice + ' từ ' + timeline.writeAtMs + 'ms.',
          outcome.stale
            ? 'Đây chính là race condition §5: Redis stale trong khi DB đúng — không TTL nào cứu kịp vì key vẫn "còn hạn" theo Redis, chỉ là SAI GIÁ TRỊ. Không lệnh invalidate nào của admin sai cả; kẻ ghi đè là một request ĐỌC.'
            : 'Lần chạy này request về sau cầm giá mới nên Redis khớp DB — đổi aWriteAtMs/bWriteAtMs là đảo ngược kết quả, đúng bản chất race.'
        ),
        focus: ['db-engine', lastFill.worker, 'redis', lastFill.client, firstFill.worker],
        set: {
          redis: KIT.mark(outcome.stale ? 'danger' : 'ok', outcome.stale ? 'stale: ' + outcome.value : 'đúng: ' + outcome.value, {at: 1.15}),
          'app-worker-a': KIT.mark(outcome.finalWriter === 'a' ? 'danger' : 'ok', outcome.finalWriter === 'a' ? 'ghi đè · ' + outcome.aValue : 'xong · ' + outcome.aValue, {at: 1.35})
        },
        scene: function(a) {
          KIT.link(a, 'db-engine', lastFill.worker, 'accent', {at: 0.15, dur: 0.55, label: 'kết quả · ' + lastFill.value});
          KIT.link(a, lastFill.worker, 'redis', outcome.stale ? 'danger' : 'ok', {at: 0.75, dur: 0.55, label: 'SET · cache-aside ' + lastFill.who + ' · ĐÈ LÊN'});
          KIT.link(a, lastFill.worker, lastFill.client, 'mute', {at: 1.35, dur: 0.55, label: 'response · ' + lastFill.value});
        },
        scoreMode: true,
        scoreTitle: 'Write path · race outcome',
        scores: [
          KIT.score('Redis holds', outcome.stale ? 0 : 100, {txt: LV.fmtMoney(outcome.value), tone: outcome.stale ? 'danger' : 'ok'}),
          KIT.score('DB holds', 100, {txt: LV.fmtMoney(run.newPrice), tone: 'ok'}),
          KIT.score('stale?', outcome.stale ? 100 : 0, {txt: outcome.stale ? 'có' : 'không', tone: outcome.stale ? 'danger' : 'ok'})
        ]
      }]
    }
  ];
}

function bypassSteps(run) {
  const impact = M.bypassImpact(M.DEFAULT_BYPASS_CONFIG);

  const openPhase = {
    title: 'ORM-bypass — admin chạy raw SQL',
    pipelineStep: 3,
    focus: ['admin-console', 'db-engine', 'orm-cache'],
    phases: [{
      title: 'Raw SQL UPDATE thẳng vào DB, không qua ORM',
      desc: KIT.desc(
        '<b>Một script migration chạy raw SQL</b> <code>UPDATE products SET price=...</code> thẳng vào DB, không đi qua ORM model.',
        'DB engine vẫn ghi bình thường — buffer pool, WAL đều đúng. Nhưng <code>post_save</code> signal của ORM chỉ bắn khi update đi qua <code>model.save()</code>.',
        'Đây đúng bẫy §7: DB đúng, nhưng ORM cache không hề biết có update nào vừa xảy ra.'
      ),
      focus: ['admin-console', 'db-engine', 'orm-cache'],
      set: {
        'db-engine': KIT.mark('ok', 'raw UPDATE ✓', {at: 1.05}),
        'orm-cache': KIT.mark('danger', 'không có signal', {at: 1.55})
      },
      scene: function(a) {
        KIT.link(a, 'admin-console', 'db-engine', 'accent', {at: 0.25, dur: 0.7, lift: 2.2, label: 'raw SQL · bỏ qua ORM'});
      }
    }]
  };

  const impactPhase = {
    title: 'Hệ quả trên từng level',
    pipelineStep: 3,
    focus: impact.levels.map(function(l) { return COMPONENT[l.key]; }),
    phases: [{
      title: 'ORM cache là level DUY NHẤT sai',
      desc: KIT.desc(
        '<b>Mọi lệnh invalidate khác (Redis DEL, LB/CDN purge) là code app riêng</b>, không phụ thuộc signal của ORM — chúng vẫn chạy đúng nếu admin gọi qua app.',
        'Chỉ <code>orm-cache</code> phụ thuộc DUY NHẤT vào signal <code>post_save</code> — không có signal, không có gì báo nó tự xoá.',
        'Kết quả: người dùng đọc qua ORM cache (level 7) vẫn thấy giá cũ, dù DB, buffer pool, Redis, LB, CDN đều đã đúng.'
      ),
      focus: impact.levels.map(function(l) { return COMPONENT[l.key]; }),
      set: impact.levels.reduce(function(set, l, i) {
        var badge = l.status === 'danger' ? 'vẫn giữ giá cũ' : (l.status === 'warn' ? 'chỉ chờ TTL' : 'đúng');
        set[COMPONENT[l.key]] = KIT.mark(l.status, badge, {at: 0.25 + i * 0.16});
        return set;
      }, {}),
      scoreMode: true,
      scoreTitle: 'Write path · ORM-bypass',
      scores: [
        KIT.score('levels đúng', impact.levels.filter(function(l) { return l.status === 'ok'; }).length),
        KIT.score('levels sai', impact.levels.filter(function(l) { return l.status === 'danger'; }).length, {tone: 'danger'}),
        KIT.score('nguyên nhân', 100, {txt: 'raw SQL né signal ORM', tone: 'danger'})
      ]
    }]
  };

  return [openPhase, impactPhase];
}

window.createWritePathRaceSteps = raceSteps;
window.createWritePathBypassSteps = bypassSteps;
})();
