# Phase 2B — Split ingest and delivery

[Previous: 2A](phase-02a-audience-outgrows-one-server.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 3A](phase-03a-peak-audience-arrives.md)

## Intent

Đặt ingest/transcode và delivery vào hai deployment boundary độc lập để delivery
overload không còn giết ingest và room-control. **Isolation không tạo ra
capacity** — và phase này nói thẳng điều đó thay vì giấu nó.

## Starting state

Single Server vượt egress ở cùng workload Phase 2A; ingest và room-control đang
bị vạ lây.

Replay đúng `scope: hero-room` · `workloadId: hero-growing-audience`; chỉ đổi
`architecture.media: adaptive → isolated`.

`architecture: media=isolated · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after replay: media=FAIL (delivery capacity vẫn thiếu) · interaction=PASS (room control) · financial=UNTESTED · fleet=UNTESTED`

`invariant flips:`

```text
ingestUnaffectedByDeliveryLoad     FAIL → PASS
roomControlJoinWithinSlo           FAIL → PASS
deliveryEgressWithinCapacity       FAIL → FAIL   (chuyển sang Stage 3)
```

`scoreboard: viewers 25.000 · delivery cost ≈ USD 225/h · worst plane FAIL`

## Single action

Reveal hai single-instance deployment/resource boundary độc lập:
`Ingest + Transcoder` và `Media Relay/Origin`.

## Choreography

Uplink giữ một đường Streamer → Ingest. Rendition ladder vẫn được tạo một lần.
Media Relay/Origin nhận delivery responsibility với budget riêng 40 Gbps.

World vẽ hai capacity container tách rời. Container `Ingest + Transcoder` trở lại
healthy ngay — demand của nó là `6 Mbps in / 11,3 Mbps out`, không phụ thuộc
viewer count. Container `Media Relay/Origin` **vẫn tràn**: 50 Gbps > 40 Gbps.

```text
Ingest + Transcoder    6 Mbps in · 11,3 Mbps ladder out   / 40 Gbps    PASS
Media Relay/Origin     50 Gbps required                   / 40 Gbps    FAIL
```

`single-server` vẫn `active` cho room-control và interaction MVP; chỉ các
responsibility media receive/delivery của nó chuyển `historical`. Room-control
join latency trở lại dưới 500 ms vì delivery đã rời khỏi máy đó.

Canonical path: `Streamer → Ingest → Transcoder/Packager → Media Relay/Origin
→ Viewer`.

## Panel message

Tách role tạo scaling boundary; nó không tự tạo thêm CPU, connection hay egress.
Cùng 50 Gbps demand vẫn nằm trên một node delivery 40 Gbps, nên Viewer vẫn mất
segment.

Cái đã thay đổi là **ai bị ảnh hưởng**. Streamer không còn rớt uplink, người mới
vẫn join được, và bán kính hư hại thu về đúng tầng đang quá tải. Đây là một fix
đúng và *một phần* — capacity là bài toán của Stage 3.

Badge: `ISOLATED · SINGLE INSTANCE · DELIVERY CAPACITY UNRESOLVED`.

## HUD

`Changed: one shared boundary → two single-instance boundaries` ·
`Boundary: ingest/control demand <= budget; delivery 50 Gbps vẫn > 40 Gbps` ·
`Result: interaction FAIL → PASS; media vẫn FAIL, blast radius thu hẹp`

`View evidence`: publisher uplinks, per-boundary budgets/provenance,
`ingestPacketLossPct`, `roomControlJoinLatencyMs` và dropped segments.

## Replay and takeaway

Fix phase mặc định mở split-screen ghost cùng camera và cùng
`hero-growing-audience`. Takeaway tự xuất hiện: adaptive bitrate không cung cấp
scaling, và isolation cũng không — isolation mua được **blast radius**, không mua
được **capacity**. Không có prompt ở fix phase.

## End state and acceptance

- Streamer vẫn có đúng một uplink; `ingestPacketLossPct` trở về 0.
- Room-control join trở lại dưới SLO và điều đó được hiển thị như một invariant
  flip có tên, không phải một dòng phụ.
- `media` **không** được nâng lên `PASS`. Model phải chứng minh 50 Gbps vẫn vượt
  40 Gbps ở cùng workload; verdict giả tạo bị từ chối.
- Deck không mô tả việc tách role như một nguồn capacity mới.
- `origin` là key giữ nguyên qua mọi media capability về sau; Stage 5 chỉ đổi
  label khi Regional Shield Cache nhận phần relay.
- `single-server` không còn active media flow nhưng vẫn giữ room-control và
  interaction path; semantic DOM ghi riêng responsibility active/historical.
