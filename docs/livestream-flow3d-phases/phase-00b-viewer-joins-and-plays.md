# Phase 0B — Viewer joins and plays

[Previous: 0A](phase-00a-meet-the-system-and-go-live.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 0C](phase-00c-send-comment-on-interaction-lane.md)

## Intent

Cho thấy join là control request và media downlink chỉ xuất hiện sau khi
subscription được xác nhận.

## Starting state

Room đang `LIVE`; media uplink Streamer → Server tồn tại; Viewer chưa subscribe.

`scope: hero-room` · `workloadId: hero-happy-path`

`architecture: media=mvp · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts: media=UNTESTED · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

Join chạy đúng, nhưng happy path không phải pressure test nên không sinh `PASS`.

`scoreboard: viewers 1 · delivery cost ≈ USD 0,00/h · worst plane UNTESTED`

## Single action

Viewer join room.

## Choreography

Một control flow ngắn chạy `viewer → single-server`. Server xác nhận subscription
như hệ quả, sau đó media downlink chạy `single-server → viewer`; Viewer nhận badge
`PLAYING`.

Canonical paths — semantic DOM liệt kê riêng control request và media result:

```text
control      Viewer → Single Server
media        Streamer → Single Server → Viewer
```

## Panel message

Join là control request. Video là media flow riêng được server gửi sau khi Viewer
đã subscribe. Phase này chưa gửi comment.

## HUD

`Changed: active subscriptions 0 → 1` · `Boundary: subscription confirmed` ·
`Result: player PLAYING; media UNTESTED (no pressure applied)`

## Guided takeaway

Join request và media downlink có chiều/semantics khác nhau. Stage 0 không có
quiz hoặc gate.

## End state and acceptance

- Join request và media downlink có chiều và visual vocabulary khác nhau.
- Uplink vẫn chạy khi downlink xuất hiện.
- Viewer ở `PLAYING`; không reveal Transcoder hoặc CDN.
- Comment chưa chạy; Phase 0C mới giới thiệu metadata lane.
- Hai canonical path giống nhau trong 3D và semantic DOM.
