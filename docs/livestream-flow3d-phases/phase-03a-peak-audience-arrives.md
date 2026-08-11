# Phase 3A — Peak audience arrives

[Previous: 2B](phase-02b-split-ingest-and-delivery.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 3B](phase-03b-scale-out-delivery-edges.md)

## Intent

Đẩy hero room lên peak 2,1 triệu Viewer để giải quyết đúng cái flag mà Stage 2 để
ngỏ — delivery capacity — và cho thấy quy mô thật của nó.

## Starting state

Ingest và Transcoder/Packager đã ở boundary riêng và khỏe. Delivery vẫn thiếu
capacity từ Phase 2B: `deliveryEgressWithinCapacity` còn `FAIL`.

`scope: hero-room` · `workloadId: hero-peak-fanout`

`architecture: media=isolated · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after pressure: media=FAIL · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`scoreboard: viewers 25.000 → 2.100.000 · delivery cost ≈ USD 18.900/h · worst plane FAIL`

## Single action

Vặn tiếp núm **viewers**: `growthViewers` 25.000 → `peakViewers` 2.100.000.
Cùng một núm, nấc thứ hai.

## Choreography

Audience clusters nhân lên đến peak; mọi downlink vẫn xuất phát từ một Media
Relay/Origin. Ingest và Transcoder/Packager giữ tone healthy — uplink và
rendition ladder không đổi khi audience tăng. Origin container tràn xa khỏi mép:

```text
required egress   = 2.100.000 × 2 Mbps = 4.200 Gbps = 4,2 Tbps
node capacity     = 40 Gbps
thiếu hụt         = 105 lần
ingest demand     = 6 Mbps        không đổi
ladder out        = 11,3 Mbps     không đổi
```

Ở Stage 2 khoảng thiếu là 1,25 lần và trông như một vấn đề provisioning. Ở đây
nó là 105 lần và không còn cách nào khác ngoài nhân bản.

Canonical path không đổi so với Phase 2B: `Streamer → Ingest →
Transcoder/Packager → Media Relay/Origin → Viewer`.

## Panel message

Stage 2 cô lập được bán kính hư hại nhưng để ngỏ delivery capacity. Ở peak, cái
flag đó trở thành toàn bộ bài toán: Origin đang phục vụ 2,1 triệu Viewer từ một
node.

Chú ý ingest và transcode **không nhúc nhích**. Workload của chúng phụ thuộc số
stream, không phụ thuộc số người xem. Đó là lý do tách role ở Stage 2 vẫn là điều
kiện cần.

Đây cũng là chỗ lesson dạy phép tính quy mô: aggregate bandwidth của một live
room được suy ra từ viewer count nhân average delivered bitrate, và từ đó ra
transferred data và chi phí egress.

## HUD

`Changed: viewers 25.000 → 2.100.000` ·
`Boundary: 4,2 Tbps egress demand > 40 Gbps node capacity` ·
`Result: media FAIL (thiếu 105 lần)`

`View calculation` (badge `ASSUMPTION`): aggregate bandwidth 4,2 Tbps, transferred
≈ 1.890 TB/h và estimated transfer-only delivery cost ≈ USD 18.900/h ở
`$0,01/GB`. Đây là stage giới thiệu phép tính `viewers × averageBitrate`; cả ba
giá trị là derived record có `formula` và `inputProvenanceIds`, không phải literal
trong panel copy. Cost group mở lại ở 3B, 4B, 5B và Stage 8 — nó không bị khóa
riêng cho stage này.

## Learning checkpoint

**Predict:** tầng nào vi phạm capacity trước khi audience lên peak — ingest,
transcode hay delivery. Rationale đặt ba con số cạnh nhau: ingest giữ nguyên
6 Mbps, ladder out giữ nguyên 11,3 Mbps, delivery nhảy lên 4.200 Gbps trên
budget 40 Gbps. Hai tầng đầu không đổi vì workload của chúng tính theo số
stream; chỉ delivery tính theo số viewer. Breach tự highlight; calculation mở
theo yêu cầu, không gate Apply fix.

## End state and acceptance

- Chỉ delivery vi phạm capacity; ingest và transcode giữ verdict healthy vì
  workload của chúng không phụ thuộc viewer count.
- Khoảng thiếu hụt hiển thị dưới dạng bội số (105 lần), không chỉ là badge đỏ —
  người học phải thấy đây là bài toán khác hẳn 1,25 lần của Stage 2.
- Viewer được biểu diễn bằng cluster, không phải hàng triệu node.
- Bottleneck gắn lên `origin`, không gắn lên `single-server` đã historical.
- Aggregate bandwidth và cost hiện badge `ASSUMPTION`; không được trình bày như
  giá hoặc telemetry production.
- Snapshot mang provenance cho peak viewers, average bitrate và delivery rate.
