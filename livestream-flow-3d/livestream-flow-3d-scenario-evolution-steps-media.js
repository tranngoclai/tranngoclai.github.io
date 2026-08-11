/* ══════════════════════════════════════════════
   EVOLUTION — STEPS · MEDIA ARC (Stage 0 · 0A–0C)

   Stage 0 là guided walkthrough: không có pressure, không có quiz, không có
   gate. Ba phase, mỗi phase đúng MỘT causal claim:

     0A  uplink phải tồn tại trước đã
     0B  join là control; media downlink là hệ quả của subscription
     0C  cùng room, hai lane khác semantics

   Mọi con số trong copy và HUD đọc từ `run` (model). Copy không được tự viết
   một con số nào — đó là cách deck bảo đảm panel, label và HUD không bao giờ
   nói ba giá trị khác nhau về cùng một thứ.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;
const M = window.LIVESTREAM_EVOLUTION_MODEL;
const CAM = window.LIVESTREAM_LAYOUT.CAM.overview;

/* Media dùng `info` (ribbon liên tục), control dùng `sky` (pulse rỗng),
   metadata dùng `accent` (dot bundle). Ink chỉ là một nửa tín hiệu — nửa còn
   lại là label trên mỗi arrow, để forced-colors và semantic DOM vẫn phân biệt
   được ba loại traffic mà không cần màu. */
const INK = {media: 'info', control: 'sky', metadata: 'accent'};

function mediaLabel(run) { return 'media ▸ ' + M.fmtMbps(run.config.sourceBitrateMbps); }

/* ── 0A ── */
function phase0A(run) {
  const snap = run.byId['0a'];
  const rail = M.PRESSURE_KNOBS.join(' · ');
  return {
    title: '0A — Meet the system and go live',
    pipelineStep: 0,
    cam: CAM.target, dist: CAM.dist,
    focus: ['streamer', 'single-server', 'viewer'],
    phases: [Object.assign({
      title: 'Streamer bắt đầu publish',
      desc: KIT.desc(
        '<b>Một hệ thống livestream tối thiểu cần đúng ba vai:</b> nguồn phát, server giữ live room, và player nhận nội dung.',
        [
          'Streamer đẩy <b>một</b> media stream lên server — <code>' + M.fmtMbps(run.config.sourceBitrateMbps) + '</code> từ encoder. Camera/mic và encoder là chi tiết bên trong Streamer, không phải component có capacity riêng.',
          'Ở MVP, <span class="hi">Single Livestream Server</span> vừa giữ trạng thái live room, vừa nhận/relay media, vừa xử lý interaction — ba trách nhiệm trên cùng một máy.',
          'Pressure rail của deck có bảy núm: <code>' + rail + '</code>. Chưa núm nào được vặn.'
        ],
        'Publisher uplink phải tồn tại <b>trước</b> media downlink — Viewer không bao giờ nhận trực tiếp từ Streamer. Và vì chưa áp pressure nào, cả bốn plane vẫn <span class="warn">UNTESTED</span>: happy path chạy được không phải là bằng chứng hệ thống chịu được gì.'
      ),
      set: {
        streamer: KIT.pulse('accent', 'capture · encode', {at: 0.2, dy: 3.0}),
        'single-server': KIT.mark('live', 'LIVE', {at: 1.35, dy: 3.4, hover: 'Room chuyển OFFLINE → LIVE khi uplink được thiết lập'})
      },
      scene: function(a) {
        KIT.link(a, 'streamer', 'single-server', INK.media, {at: 0.3, label: mediaLabel(run)});
        // Băng note giữ ngắn: danh sách bảy núm đã nằm trong panel copy, in lại
        // đầy đủ dưới hộp sẽ đè lên caption của Streamer.
        KIT.note(a, 'pressure rail: ' + M.PRESSURE_KNOBS.length + ' núm — chưa vặn núm nào', {of: 'single-server', band: true}, 'mute', 1.6);
      }
    }, window.livestreamPhaseHud(snap, 'uplink established'))]
  };
}

/* ── 0B ──
   Ba arrow trong một phase vì cả ba là bằng chứng của cùng một claim: join
   (control) → xác nhận → downlink (media). Uplink vẫn được vẽ để người học
   thấy nó KHÔNG dừng lại khi downlink xuất hiện. */
function phase0B(run) {
  const snap = run.byId['0b'];
  return {
    title: '0B — Viewer joins and plays',
    pipelineStep: 0,
    cam: CAM.target, dist: CAM.dist,
    focus: ['streamer', 'single-server', 'viewer'],
    phases: [Object.assign({
      title: 'Viewer join room và bắt đầu phát',
      desc: KIT.desc(
        '<b>Join là control request; video là một media flow riêng.</b>',
        [
          'Viewer gửi <code>join/subscribe</code> lên server. Server xác nhận subscription, và chỉ <b>sau đó</b> media downlink mới chạy về Viewer.',
          'Uplink <code>Streamer → Server</code> vẫn chạy nguyên vẹn: server relay chứ không chuyển tiếp kết nối của Streamer cho Viewer.',
          'Active subscriptions <code>0 → 1</code>, player chuyển <code>PLAYING</code>.'
        ],
        'Hai flow này khác chiều và khác contract. Gộp chúng thành "một đường" là mất luôn lý do vì sao Stage 2 có thể tách delivery ra khỏi ingest mà publisher uplink vẫn giữ đúng một.'
      ),
      set: {
        'single-server': KIT.pulse('ok', 'subscription confirmed', {at: 1.35, dy: 3.4}),
        viewer: KIT.mark('live', 'PLAYING', {at: 2.65, dy: 3.0, hover: 'Player nhận media downlink sau khi subscription được xác nhận'})
      },
      scene: function(a) {
        KIT.link(a, 'streamer', 'single-server', INK.media, {at: 0.3, label: mediaLabel(run)});
        KIT.link(a, 'viewer', 'single-server', INK.control, {at: 0.3, lift: 3.2, label: 'control ▸ join · subscribe'});
        KIT.link(a, 'single-server', 'viewer', INK.media, {at: 1.6, label: 'media ▸ downlink ' + M.fmtMbps(run.config.averageDeliveredMbps)});
      }
    }, window.livestreamPhaseHud(snap, 'player PLAYING'))]
  };
}

/* ── 0C ── */
function phase0C(run) {
  const snap = run.byId['0c'];
  return {
    title: '0C — Send a comment',
    pipelineStep: 0,
    cam: CAM.target, dist: CAM.dist,
    focus: ['streamer', 'single-server', 'viewer'],
    phases: [Object.assign({
      title: 'Comment đi trên lane metadata riêng',
      desc: KIT.desc(
        '<b>Cùng một live room, nhưng comment không đi trên đường của media.</b>',
        [
          'Viewer gửi một comment (<code>kind: metadata</code>) lên server; server phát lại cho room subscribers — ở đây là đúng <code>1</code> người.',
          'Media ribbon không đổi tone, không đổi path, không dừng lại.',
          'Hai loại traffic phân biệt bằng <b>shape + nhãn trên arrow</b>, không chỉ bằng màu — để forced-colors và semantic DOM vẫn đọc được.'
        ],
        'Media, metadata và money là ba traffic class có contract, capacity và failure path khác nhau. Ép chúng thành một token cho "đẹp flow" là gieo đúng hiểu sai mà Stage 6 và Stage 7 phải mất bốn phase để gỡ.'
      ),
      set: {
        'single-server': KIT.pulse('accent', 'comment accepted ×1', {at: 1.35, dy: 3.4})
      },
      scene: function(a) {
        KIT.link(a, 'streamer', 'single-server', INK.media, {at: 0.3, label: mediaLabel(run)});
        KIT.link(a, 'single-server', 'viewer', INK.media, {at: 0.3, label: 'media ▸ downlink'});
        KIT.link(a, 'viewer', 'single-server', INK.metadata, {at: 0.9, lift: 3.4, label: 'metadata ▸ comment ×1'});
        KIT.link(a, 'single-server', 'viewer', INK.metadata, {at: 1.9, lift: 5.0, label: 'metadata ▸ fan-out → room subscribers ×1'});
      }
    }, window.livestreamPhaseHud(snap, 'comment delivered'))]
  };
}

window.createEvolutionMediaSteps = function(run) {
  return [phase0A(run), phase0B(run), phase0C(run)];
};
})();
