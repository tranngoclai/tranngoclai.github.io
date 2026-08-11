/* ══════════════════════════════════════════════
   EVOLUTION — PERSISTENT WORLD

   World được dựng một lần và không bao giờ tháo. Stage 0 chỉ có ba actor,
   nhưng cả ba đã đứng đúng cột của layout law: Stage 2 tách trách nhiệm ra
   khỏi `single-server` bằng cách reveal component mới ở cột trống bên cạnh,
   KHÔNG dịch `single-server` đi chỗ khác và cũng không tạo `server-v2`.

   ── Vì sao Camera/Mic và Encoder không phải hộp riêng ──
   Chúng là chi tiết nội bộ của Streamer, không phải component có capacity,
   failure path hay verdict riêng trong bài học này. Chúng nằm trong label
   (Luật 3: name + configuration) và được kể bằng pulse trong phase 0A.

   ── Tone ──
   `viewer` mang tone `subject` vì đó là thứ deck theo dõi xuyên suốt: nó là
   một người ở Stage 0 và là 2,1 triệu người ở Stage 3. `single-server` là
   `core` — hub mà mọi lane đang cùng đi qua, và chính sự gộp đó là bottleneck
   Stage 2 sẽ mổ. `streamer` là `system`: nó tự phát, không ai gọi nó.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;
const L = window.LIVESTREAM_LAYOUT;
const M = window.LIVESTREAM_EVOLUTION_MODEL;
const X = L.X, Z = L.Z, Y = L.Y, S = L.SIZE;

window.createEvolutionWorld = function(run) { return function(raw) {
  const w = KIT.world(raw);
  const c = run.config;

  w.node('streamer', {
    label: 'Streamer\ncamera · mic · encoder ' + M.fmtMbps(c.sourceBitrateMbps),
    pos: [X.streamer, Y.ground, Z.spine], size: S.actor, tone: 'system', order: 0,
    hover: 'Nguồn phát: camera/mic và encoder là chi tiết bên trong actor này, không phải component riêng'
  });

  w.node('single-server', {
    label: 'Single Livestream Server\nroom control · media · interaction',
    pos: [X.server, Y.ground, Z.spine], size: S.core, tone: 'core', order: 1,
    hover: 'Ở MVP, một máy gánh cả ba trách nhiệm: giữ trạng thái live room, nhận/relay media và xử lý interaction'
  });

  w.node('viewer', {
    label: 'Viewer\n1 người xem',
    pos: [X.viewer, Y.ground, Z.spine], size: S.actor, tone: 'subject', order: 2,
    hover: 'Người xem — subject của deck: 1 người ở Stage 0, 2,1 triệu ở Stage 3'
  });

  w.region('SOURCE', X.streamer, Z.spine, 8);
  w.region('MEDIA CORE', X.server, Z.spine, 8);
  w.region('AUDIENCE', X.viewer, Z.spine, 8);

  w.cam(L.CAM.overview.target, L.CAM.overview.dist);
}; };
})();
