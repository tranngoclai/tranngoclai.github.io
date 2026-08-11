# Phase 3B — Scale out delivery edges

[Previous: 3A](phase-03a-peak-audience-arrives.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 4A](phase-04a-add-remote-viewers.md)

## Intent

Nhân bản tầng delivery thành nhiều Delivery Edge phía sau Media Relay/Origin để
phục vụ peak audience mà vẫn giữ một publisher uplink.

## Starting state

Origin quá egress capacity ở cùng workload của Phase 3A.

Replay đúng `scope: hero-room` · `workloadId: hero-peak-fanout`; chỉ đổi
`architecture.media: isolated → edge-scaled`.

`architecture: media=edge-scaled · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after replay: media=PASS · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`invariant flip: deliveryEgressWithinCapacity FAIL → PASS` (flag mở từ Phase 2B)

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 18.900/h · worst plane PASS`

## Single action

Reveal aggregate cluster `edge-src` — nhiều Delivery Edge instance nhận copied
segment/rendition từ Media Relay/Origin. Label/HUD nêu cardinality.

```text
edgeCount   = ceil(4.200 Gbps / 40 Gbps) = 105 instances
origin out  = 105 × 11,3 Mbps ladder    = 1,19 Gbps / 40 Gbps    PASS
```

## Choreography

Media Relay/Origin fan-out sang nhiều Delivery Edge; audience clusters chia ra
nhận downlink từ các Edge khác nhau. Uplink vẫn là một đường Streamer → Ingest và
Transcoder/Packager vẫn tạo đúng một rendition ladder.

Canonical path: `Streamer → Ingest → Transcoder/Packager → Media Relay/Origin
→ Delivery Edge → Viewer`.

`Delivery Edge` ở stage này là fan-out node trong region gốc; Stage 4 mới phân bố
CDN Edge theo geography/cache.

## Panel message

Đây là horizontal scaling của đúng một tầng: tầng đang thiếu capacity. Origin
không còn phục vụ trực tiếp từng Viewer mà phục vụ một số lượng nhỏ Edge, còn
Edge gánh phần fan-out lớn.

Một fleet edge cỡ này đặt cùng một nơi là giả định của model để cô lập biến,
không phải thiết kế nên dùng thật. Nó giải quyết capacity, chưa giải quyết
khoảng cách địa lý.

Fan-out này chỉ áp cho media plane. Tầng connection/control — room state,
comment, presence — vẫn nằm trên đúng một `single-server` với 2,1 triệu Viewer
treo trên đó. Nó chưa chịu áp lực nào nên vẫn `UNTESTED`, không phải `PASS`.
Stage 6 quay lại đúng chỗ này.

## HUD

`Changed: 1 delivery instance → 105 edge instances` ·
`Boundary: 40 Gbps/edge × 105 = 4.200 Gbps >= 4.200 Gbps demand` ·
`Result: media FAIL → PASS; interaction vẫn UNTESTED`

`View calculation` (badge `ASSUMPTION`): publisher uplinks, edge count, per-edge
connections (20.000/60.000), aggregate bandwidth 4,2 Tbps và transfer-only cost
≈ USD 18.900/h — không đổi so với 3A, chỉ phân bố đổi.

`delivery edges` là giá trị model tính `ceil(demand / edgeCapacity)`, không phải
số hard-code trong world.

## Replay and takeaway

Fix phase mặc định mở split-screen ghost: cùng camera, cùng `hero-peak-fanout`,
cột trái 3A, cột phải 3B. Takeaway tự xuất hiện:
replication giải capacity khác isolation; aggregate bandwidth không giảm, chỉ
được chia qua nhiều instance. Không có prompt ở fix phase.

## End state and acceptance

- Streamer vẫn có đúng một uplink; rendition ladder vẫn được tạo một lần.
- Load được phân bố qua nhiều delivery edge; mọi tầng trở lại trong capacity.
- Aggregate bandwidth tổng không đổi giữa 3A và 3B; chỉ phân bố đổi.
- `edge-src` là key giữ nguyên về sau; Stage 4 thêm CDN Edge như instance mới chứ
  không move hay đổi tên component này.
- Verdict healthy được nói rõ là healthy về capacity, chưa nói gì về geography.
- `interaction` giữ `UNTESTED` và deck nói rõ tầng control chưa được scale —
  không được để người học suy ra rằng scale media đã scale cả hệ thống.
