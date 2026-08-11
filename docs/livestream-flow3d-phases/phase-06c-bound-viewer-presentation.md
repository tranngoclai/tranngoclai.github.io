# Phase 6C — Bound viewer presentation

[Previous: 6B](phase-06b-isolate-interaction-plane.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 7A](phase-07a-retry-a-coin-gift.md)

## Intent

Bound outbound presentation bằng selected Comment và aggregated Like, đồng thời
giữ accepted-event moderation/audit trail theo contract riêng.

## Starting state

Interaction đã isolated khỏi room-control; media responsibilities vốn đã ở
boundary riêng từ Stage 2. Naive broadcast vẫn overload.

Replay `scope: hero-room` · `workloadId: hero-interaction-fanout`; chỉ đổi
`architecture.interaction: isolated → split-plane`.

`architecture: media=shielded · interaction=split-plane · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after replay: media=PASS · interaction=PASS · financial=UNTESTED · fleet=UNTESTED`

`invariant flip: presentationFanoutWithinCapacity FAIL → PASS`

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 24.100/h · worst plane PASS`

## Single action

Kích hoạt bounded Viewer presentation: mỗi Viewer nhận tối đa 20 selected
comment/s và 1 counter update/s, thay vì toàn bộ 2.000 event/s.

## Choreography

```text
Accepted events → Per-room Partition/Queue
  ├─ Comment moderation decision + accepted-event audit → Selected Comments ┐
  └─ Windowed Like Aggregator → Counter Updates                             ├→ Regional Fan-out Gateways → Viewer
```

```text
per-viewer stream    20 comment/s + 1 counter/s = 21 msg/s   (trước: 2.000/s)
presentation total   2.100.000 × 21 = 44,1e6 deliveries/s     (trước: 4,2e9/s)
gateways             ceil(44,1e6 / 5,0e6) = 9 instances       PASS
audit append         2.000/s toàn bộ accepted event           PASS
```

Hai con số giảm vì hai lý do khác nhau: bounded presentation cắt 95 lần, fan-out
gateway chia phần còn lại. Audit **không** giảm — nó vẫn nhận đủ 2.000 event/s
vì contract của nó là completeness, không phải freshness.

Selected Comment và Like counter dùng shape khác nhau. Audit append chỉ claim
accepted events/decisions, không ngầm lưu mọi abusive attempt. Gateway phát
bounded updates; queue age phục hồi trong stabilization window.

## Panel message

Chỉ Viewer presentation đánh đổi completeness/freshness. Audit contract và
presentation contract khác nhau; đây không phải cách nói tắt của CAP theorem.

## HUD

`Changed: broadcast-all → selected comments + counter updates` ·
`Boundary: 44,1e6/s <= 9 × 5,0e6/s gateway capacity; audit 2.000/s trong hạn` ·
`Result: interaction FAIL → PASS; media unchanged`

`View evidence`: attempted/accepted/rate-limited, audit append, selected rate,
counter freshness, delivered/input ratio và queue age.

## Replay and takeaway

Fix phase mặc định mở split-screen ghost: cùng camera, cùng attempted rate và
viewer count, cột trái 6B, cột phải 6C. Takeaway tự xuất hiện: Viewer count nhân presentation cost
nhưng không tự tạo input event rate. Không có prompt ở fix phase.

## End state and acceptance

- Quality floor bắt buộc: selected Comment rate đạt minimum khi có accepted
  moderated input; counter freshness trong SLO.
- Không pass bằng cách drop toàn bộ presentation; 20 comment/s là sàn có tên,
  không phải hệ quả của việc bỏ bớt.
- Audit path và presentation path hiển thị hai con số riêng để thấy rõ chỉ một
  bên bị bound.
- Presence/socket capacity vẫn `UNTESTED` và được liệt kê ngoài v1.
- Money command không route qua best-effort metadata presentation.
