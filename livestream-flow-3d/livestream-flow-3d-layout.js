/* ══════════════════════════════════════════════
   LIVESTREAM DECK — SHARED LAYOUT LAW

   Deck chỉ có MỘT scenario (`evolution`) chạy suốt 24 phase trong một
   persistent world: hộp đã dựng thì không bao giờ bị tháo, và một thành phần
   giữ nguyên key/vị trí kể cả khi label đổi theo capability. Vì vậy toạ độ
   phải được chốt MỘT LẦN ở đây, trước khi stage đầu tiên được viết — nếu mỗi
   stage tự chọn cột thì Stage 4 sẽ phải đẩy Stage 0 sang chỗ khác và người
   học mất điểm neo thị giác.

   ── Luật 1 · TRỤC X = KHOẢNG CÁCH TỪ NGUỒN PHÁT TỚI NGƯỜI XEM ──
   Đọc trái sang phải đúng chiều media đi:

     SOURCE → MEDIA CORE → DELIVERY → AUDIENCE

   Các cột dưới đây là bản đồ đầy đủ của deck. Stage 0 chỉ dùng ba cột
   (`streamer`, `server`, `viewer`); các cột còn lại được giữ trống có chủ ý
   để stage sau thả component vào mà không phải dịch component cũ.

   ── Luật 2 · TRỤC Z = BĂNG VAI TRÒ ──
     z = +11  control     room control, join/subscribe, admin
     z =   0  spine       media data path, trái sang phải
     z = -12  interaction comment/like lane — metadata, KHÔNG phải media
     z = -24  financial   gift command, ledger — money, tách hẳn hai lane trên

   Ba lane nằm ở ba băng Z khác nhau vì bài học cốt lõi của deck là chúng có
   contract, capacity và failure path khác nhau. Vẽ chung một đường là nói dối.

   ── Luật 3 · CÙNG VAI TRÒ = CÙNG KÍCH THƯỚC ──
   `SIZE` là bảng tra duy nhất. Hộp không được to lên vì "quan trọng hơn" —
   biến đáng nhìn là tone/badge/gauge, không phải thể tích.
══════════════════════════════════════════════ */

(function() {
const L = {};

/* ── Luật 1 · các cột theo trục X ── */
L.X = {
  streamer:   -28,   // SOURCE — camera/mic + encoder nằm trong actor này
  ingest:     -18,   // MEDIA CORE — ingest role sau khi tách (Stage 2)
  server:     -11,   // MEDIA CORE — Single Livestream Server (MVP hub)
  transcoder:  -3,   // MEDIA CORE — Transcoder/Packager (Stage 1)
  origin:       6,   // DELIVERY — Media Relay/Origin (Stage 2+)
  shield:      13,   // DELIVERY — Regional Shield Cache (Stage 5)
  edge:        20,   // DELIVERY — Delivery/CDN Edge cluster (Stage 3+)
  viewer:      28    // AUDIENCE — viewer cluster
};

/* ── Luật 2 · các băng vai trò theo trục Z ── */
L.Z = {
  control:      11,
  spine:         0,
  interaction: -12,
  financial:   -24
};

L.Y = {ground: 0};

/* ── Luật 3 · bảng kích thước duy nhất ── */
L.SIZE = {
  actor:   [7.4, 3.4, 5.2],   // Streamer, Viewer — con người/thiết bị
  core:    [9.6, 4.4, 6.2],   // hub gộp nhiều trách nhiệm
  service: [7.0, 3.2, 4.8],   // một service đơn trách nhiệm
  gate:    [6.4, 3.0, 4.6],   // checkpoint có cache/policy
  store:   [6.4, 3.0, 4.6],   // storage bền
  cluster: [9.0, 3.6, 5.6]    // aggregate nhiều instance/PoP
};

/* ── Camera preset theo chapter ──
   Concept yêu cầu camera preset cố định theo chapter, không orbit tự do. Ở đây
   còn một lý do kỹ thuật: khi một step không khai `cam`, engine tự frame theo
   focus và CHẶN khoảng cách ở 58 (flow3d-engine-persistent-world.js), nên một
   shot ôm cả SOURCE lẫn AUDIENCE sẽ bị cắt. Chapter nào nhìn rộng thì phải
   khai preset của nó ở đây. */
L.CAM = {
  overview: {target: [0, 0, 0], dist: 96}   // Stage 0: SOURCE + MEDIA CORE + AUDIENCE
};

window.LIVESTREAM_LAYOUT = L;
})();
