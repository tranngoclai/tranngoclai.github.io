# Phase 2A — Audience outgrows one server

[Previous: 1B](phase-01b-add-renditions.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 2B](phase-02b-split-ingest-and-delivery.md)

## Intent

Cho thấy delivery overload kéo sập **ingest và room-control** khi cả ba trách
nhiệm nằm trên cùng một máy. Đây là bài học về shared fate/blast radius, không
phải bài học về capacity — capacity là Stage 3.

## Starting state

Adaptive video hoạt động; Single Server vẫn nhận uplink, giữ room state và phục
vụ mọi downlink.

`scope: hero-room` · `workloadId: hero-growing-audience`

`architecture: media=adaptive · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after pressure: media=FAIL · interaction=FAIL (room control) · financial=UNTESTED · fleet=UNTESTED`

`scoreboard: viewers 1 → 25.000 · delivery cost ≈ USD 225/h · worst plane FAIL`

## Single action

Vặn núm **viewers**: `viewerCount` 1 → `growthViewers` = 25.000. Đây là nấc tăng
trưởng thứ nhất, chưa phải peak.

## Choreography

Audience clusters nhân lên; mọi downlink xuất phát từ Single Server. Model tính
trên cùng `shared-server` boundary:

```text
required egress    = 25.000 × 2 Mbps = 50 Gbps
declared capacity  = 40 Gbps                    vi phạm
open connections   = 25.000 / 60.000            còn trong hạn
```

Egress vi phạm trước connection. Container capacity của `single-server` **tràn**
(overflow visual, không chỉ đổi badge), rồi hai thứ hoàn toàn khác bắt đầu hỏng
theo vì dùng chung NIC/CPU/process:

- Uplink RTMP của Streamer mất packet — `ingestPacketLossPct` rời 0.
- Join request mới vượt `roomControlJoinSloMs = 500 ms`.

Viewer **đã** kết nối vẫn xem được. Cái hỏng là những người mới đến và chính
người đang phát. Canonical path không đổi: `Streamer → Single Server.ingest →
Transcoder/Packager → Single Server.delivery → Viewer clusters`.

## Panel message

Đây chưa phải câu chuyện "cần thêm máy". Đây là câu chuyện một process đang gánh
ba trách nhiệm có nhu cầu scale khác nhau, nên tải của trách nhiệm nặng nhất
(delivery) phá hỏng hai trách nhiệm nhẹ nhất (ingest, room control).

Streamer không upload quá nhiều — anh ta vẫn có đúng một uplink. Anh ta là nạn
nhân của audience.

## HUD

`Changed: viewers 1 → 25.000` ·
`Boundary: 50 Gbps egress demand > 40 Gbps shared capacity` ·
`Result: media FAIL; interaction FAIL — ingest và room-control bị vạ lây`

`View evidence`: egress demand/capacity, connection count, `ingestPacketLossPct`,
`roomControlJoinLatencyMs` và dropped segments.

## Learning checkpoint

**Predict:** connection hay egress vi phạm trước. Rationale hiện `25.000/60.000`
connection còn trong hạn trong khi `50 > 40 Gbps`, và chỉ ra `publisher uplinks:
1` không đổi. Breach tự highlight; focus/click không gate Apply fix.

## End state and acceptance

- Viewer được biểu diễn bằng cluster, không phải hàng nghìn node.
- Failure được quy cho **shared boundary**, không quy cho "quá nhiều viewer cho
  toàn hệ thống".
- Ba metric hỏng thuộc ba trách nhiệm khác nhau và hiển thị riêng biệt; người học
  thấy sự lan truyền, không chỉ thấy một badge đỏ.
- Egress vi phạm trước connection và cả hai con số đến từ model.
- Transcoder vẫn tồn tại; fix chưa xuất hiện.
- Snapshot mang provenance cho viewer count, egress capacity và connection
  capacity.
