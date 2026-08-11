# Phase 0A — Meet the system and go live

[Concept](../livestream-flow3d-concept.md) · [Next: 0B](phase-00b-viewer-joins-and-plays.md)

## Intent

Giới thiệu happy-path architecture cho đúng một Streamer, một Single Livestream
Server và một Viewer, rồi cho media uplink chạy lần đầu.

## Starting state

- World chưa có traffic.
- Chỉ các region `SOURCE`, `MEDIA CORE` và `AUDIENCE` được focus.
- Transcoder, CDN và các service scale-out vẫn hidden.

`scope: hero-room` · `workloadId: hero-happy-path`

`architecture: media=mvp · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts: media=UNTESTED · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

Stage 0 chỉ demo happy path và **không** áp pressure, nên không plane nào đạt
`PASS`. Verdict đầu tiên của deck xuất hiện ở Phase 1A.

`scoreboard: viewers 0 → 1 · delivery cost ≈ USD 0,00/h · worst plane UNTESTED`

## Single action

Streamer bắt đầu publish.

## Choreography

Camera lần lượt frame ba actor `streamer`, `single-server`, `viewer` trong một
reveal sequence. Camera/Mic và Encoder là chi tiết nội bộ của `streamer`, không
phải component riêng. Panel/focus/click giải thích Single Server đang gộp room control,
media receive/relay và interaction handling.

Sau reveal, pulse Camera/Mic và Encoder rồi chạy một media flow
`streamer → single-server`. Server đổi badge từ `OFFLINE` sang `LIVE`. Không chạy
downlink đến Viewer trong phase này.

Canonical path: `Streamer.Camera/Mic → Streamer.Encoder → Single Server.ingest`.
Semantic DOM liệt kê ba actor rồi dùng đúng thứ tự path này.

## Panel message

Một hệ thống tối thiểu cần nguồn phát, server giữ live room và player nhận nội
dung. Streamer chỉ upload một media stream lên server; ở MVP, server vừa nhận
media vừa giữ trạng thái của live room.

## HUD

`Changed: room OFFLINE → LIVE` · `Boundary: publisher uplinks = 1` ·
`Result: uplink established; media UNTESTED (no pressure applied)`

Pressure rail hiện đủ bảy núm nhưng chưa núm nào được vặn: `network · viewers ·
distribution · latency budget · interaction rate · retry · rooms`.

## Guided takeaway

Publisher uplink phải tồn tại trước media downlink. Phase tự chỉ ra quan hệ này;
Stage 0 không có quiz hoặc gate.

## End state and acceptance

- Ba actor visible, tone trung tính/healthy và label chỉ chứa name/config.
- Người học nhận diện được trách nhiệm của từng actor.
- Uplink đúng chiều Streamer → Server; room `LIVE`, Viewer chưa `PLAYING`.
- Không ngụ ý Streamer upload trực tiếp đến Viewer.
- Không có issue badge hoặc component tương lai xuất hiện.
- Invariant `publisher uplinks = 1` được lấy từ model snapshot.
- Không plane nào hiện `PASS`; Stage 0 chưa áp pressure.
- Plane chip chỉ hiện `media`; ba plane còn lại chưa vào cuộc nên bị ẩn khỏi HUD
  chính và chỉ xuất hiện trong disclosure `Why?`.
- 3D và semantic DOM có cùng actor list, path và takeaway.
