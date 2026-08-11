# Phase 6B — Isolate interaction plane

[Previous: 6A](phase-06a-interaction-burst.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 6C](phase-06c-bound-viewer-presentation.md)

## Intent

Tách interaction khỏi room-control thành resource/failure boundary có queue và
backpressure riêng. Media responsibilities đã rời Single Server từ Stage 2;
phase này không nhận công lao isolation đã có. Chưa aggregate Like/chọn Comment.

## Starting state

Naive comment/like broadcast khuếch đại `I` input thành xấp xỉ `I × V` outbound
deliveries; media delivery vẫn healthy.

Replay đúng `scope: hero-room` · `workloadId: hero-interaction-fanout`; chỉ đổi
`architecture.interaction: mvp → isolated`.

`architecture: media=shielded · interaction=isolated · financial=absent · fleetPolicy=transcode-all`

`plane verdicts: media=PASS · interaction=FAIL (presentation still unbounded) · financial=UNTESTED · fleet=UNTESTED`

`invariant flips:`

```text
roomControlUnaffectedByInteractionLoad   FAIL → PASS
presentationFanoutWithinCapacity         FAIL → FAIL   (chuyển sang Phase 6C)
```

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 23.400/h · worst plane FAIL`

## Single action

Reveal resource boundary riêng:

```text
Interaction Ingress → Per-room Partition/Queue → Naive presentation worker
```

## Choreography

Ingress, queue và worker nằm trong capacity container riêng khỏi room-control;
dependencies không nối vào media delivery. Cùng unbounded broadcast vẫn vượt
presentation capacity, nên interaction chưa `PASS`. Khi boundary mới active,
`single-server.interaction` chuyển `historical`; room-control vẫn active.

## Panel message

Isolation bảo vệ room-control và cho interaction có quota/backpressure độc lập;
media vốn đã ở boundary riêng. Nó không tự giảm `accepted × viewers`; Phase 6C
mới thay presentation semantics.

## HUD

`Changed: interaction shares room-control → isolated queue/backpressure boundary` ·
`Boundary: 4,2 tỷ deliveries/s vẫn > 5 triệu/s` ·
`Result: media PASS unchanged; interaction vẫn FAIL, blast radius thu hẹp`

Đây là lần thứ hai deck lặp lại đúng một bài học của Phase 2B ở một plane khác:
isolation mua **blast radius**, không mua **capacity**. Con số fan-out không
nhúc nhích một chút nào sau khi tách boundary.

## Replay and takeaway

Fix phase mặc định mở split-screen ghost: cùng camera, cùng
`hero-interaction-fanout`, cột trái 6A, cột phải 6B. Chứng minh room-control và
media không đổi nhưng presentation vẫn overload. Takeaway: isolation giải shared
fate với room-control, không giải amplification.

## End state and acceptance

- Interaction overload không đổi room-control/media verdict; topology nói rõ
  media đã isolated từ Stage 2 và queue mới chỉ tách interaction khỏi room-control.
- `accepted × viewers` vẫn giữ nguyên 4,2e9/s; model phải chứng minh con số
  không đổi và từ chối mọi verdict nâng interaction lên `PASS` ở phase này.
- Money/Financial Core vẫn absent và không đi qua metadata queue.
