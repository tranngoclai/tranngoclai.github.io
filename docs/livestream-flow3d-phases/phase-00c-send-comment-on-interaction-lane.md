# Phase 0C — Send a comment on the interaction lane

[Previous: 0B](phase-00b-viewer-joins-and-plays.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 1A](phase-01a-network-drops.md)

## Intent

Chứng minh cùng một live room vẫn có media và metadata path khác semantics.

## Starting state

Room `LIVE`; Viewer đã subscribe và `PLAYING`; media uplink/downlink đang chạy.

`scope: hero-room` · `workloadId: hero-happy-path`

`architecture: media=mvp · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts: media=UNTESTED · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`scoreboard: viewers 1 · delivery cost ≈ USD 0,00/h · worst plane UNTESTED`

## Single action

Viewer gửi một comment event cố định từ model.

## Choreography

Một metadata bundle hình dot chạy `viewer → single-server.interaction`; server
phát event đến room subscribers. Media ribbon tiếp tục one-shot/end-state ở lane
riêng, không đổi tone hoặc path. Comment dùng `kind: metadata`, không tạo flow
kind mới tên `interaction`.

Canonical path: `Viewer → Single Server.interaction → room subscribers`.

## Panel message

Media và comment cùng thuộc một room nhưng khác contract, capacity và failure
path. UI dùng shape + path label, không chỉ màu, để phân biệt hai loại traffic.

## HUD

`Changed: accepted comments 0 → 1` · `Boundary: interaction happy path` ·
`Result: comment delivered; interaction UNTESTED (no pressure applied)`

## Guided takeaway

Cùng room không có nghĩa cùng transport. Stage 0 không có quiz hoặc gate.

## End state and acceptance

- Metadata flow đúng chiều và không thay đổi media path.
- Comment bundle và media ribbon phân biệt bằng shape/text trong forced colors.
- 3D, reduced motion và semantic DOM có cùng path/verdict.
