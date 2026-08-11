/* ══════════════════════════════════════════════
   EVOLUTION — HUD ROWS TỪ SNAPSHOT

   HUD mặc định của deck chỉ có ba hàng, cố định ở mọi phase:

     CHANGED    input vừa đổi
     BOUNDARY   capacity/SLO/invariant đang xét
     RESULT     verdict của plane bị tác động

   Ba hàng đó lấy thẳng từ `causalContract` và `planeVerdicts` của snapshot,
   nên không có cách nào viết một verdict vào HUD mà model không biết.

   ── Thanh bar nghĩa là gì ──
   `KIT.score` dùng `v` để vẽ độ dài bar. Ở đây bar KHÔNG phải utilization:
   CHANGED/BOUNDARY luôn đầy (sự kiện đã xảy ra / boundary đang được xét), còn
   RESULT dài theo mức bằng chứng — `untested` = 0 vì chưa có phép thử nào
   chứng minh điều gì. Stage sau có gauge utilization riêng cho capacity.

   Title của HUD là scoreboard ba số mà concept yêu cầu luôn hiển thị:
   đang ở scope nào, tốn bao nhiêu, plane tệ nhất đang ra sao.
══════════════════════════════════════════════ */

(function() {
const KIT = window.SCENE_KIT;
const M = window.LIVESTREAM_EVOLUTION_MODEL;

const VERDICT_BAR = {pass: 100, fail: 100, untested: 0};
const VERDICT_TONE = {pass: 'ok', fail: 'danger', untested: undefined};

function scoreboardTitle(snap) {
  const s = snap.scoreboard;
  return 'SCOPE: ' + s.scopeLabel
       + ' · ' + snap.workloadId
       + ' · viewers ' + M.fmtInt(s.viewers)
       + ' · ' + M.fmtUsd(s.costUsdPerHour) + '/h'
       + ' · worst plane ' + s.worstPlane;
}

/* resultText: câu kết quả của phase, do step viết vì nó là copy.
   Verdict thì lấy từ model — plane nào bị tác động thì đọc verdict plane đó. */
window.livestreamPhaseHud = function(snap, resultText) {
  const plane = snap.causalContract.affectedPlane;
  const verdict = snap.planeVerdicts[plane].status;
  return {
    scoreMode: true,
    scoreTitle: scoreboardTitle(snap),
    scores: [
      KIT.score('CHANGED', 100, {txt: snap.causalContract.changedInput}),
      KIT.score('BOUNDARY', 100, {txt: snap.causalContract.capacityBoundary}),
      KIT.score('RESULT', VERDICT_BAR[verdict], {
        txt: resultText + ' · ' + plane + ' ' + verdict.toUpperCase(),
        tone: VERDICT_TONE[verdict]
      })
    ]
  };
};
})();
