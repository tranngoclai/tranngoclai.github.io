# Phase 5B — Add regional shield tier

[Previous: 5A](phase-05a-shorten-the-latency-budget.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 6A](phase-06a-interaction-burst.md)

## Intent

Giảm fan-in về Origin bằng 3 Regional Shield Cache và request coalescing: 120
Edge hỏi 3 shield thay vì hỏi thẳng Origin.

## Starting state

120 Edge tạo independent fetch scope cho các active rendition key; ở cadence
0,2 s của Phase 5A, aggregate rate 2.400 fetch/s vượt origin capacity
1.500 fetch/s.

Replay đúng `scope: hero-room` · `workloadId: hero-latency-budget`;
chỉ đổi `architecture.media: global-cdn → shielded`.

`architecture: media=shielded · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after replay: media=PASS khi aggregate shielded rate <= C · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`invariant flip: originFetchRateWithinCapacity FAIL → PASS`

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 23.400/h · worst plane PASS`

## Single action

Reveal một Regional Shield Cache dùng chung cho các Edge trong mỗi region.

## Choreography

Mỗi aggregate Edge cluster công khai instance/PoP count; 40 Edge nằm dưới mỗi
shield region. Shield coalesce in-flight miss cùng key thành tối đa một Origin
fetch cho shield scope đó. World minh họa tracked key `120 → 3`; verdict toàn
Origin dùng:

```text
shieldedFetchRate = Σ activeKey shieldsRequesting(key) / cadence(key)

trước (5A)   120 edges × 4 renditions / 0,2 s = 2.400 fetch/s   > 1.500   FAIL
sau  (5B)      3 shields × 4 renditions / 0,2 s =    60 fetch/s   <= 1.500  PASS
```

Origin chỉ healthy khi aggregate rate `<= 1.500/s`. Glass-to-glass vẫn ≈ 3 s —
shield giữ nguyên latency budget đã mua ở 5A, chỉ trả lại phần origin load.

## Panel message

Request coalescing chỉ gộp concurrent in-flight miss theo segment/cache key bên
trong từng region. Regional shield thêm một cache hop và failure domain; nó không
biến cả livestream thành một object hoặc bảo đảm một Origin fetch toàn cầu.

## HUD

`Changed: 120 direct edge fetch scopes → 3 regional shield scopes` ·
`Boundary: 60 fetch/s <= 1.500 fetch/s origin capacity` ·
`Result: media FAIL → PASS; glass-to-glass giữ ≈ 3 s`

`View evidence`: tracked key `120 edge → 3 shield`, cluster cardinality và
aggregate formula.

`View calculation` (badge `ASSUMPTION`): shield tier thêm một hop hạ tầng nên
cost lên ≈ USD 23.400/h. Rẻ hơn nhiều so với nâng origin capacity 40 lần, và đó
chính là lý do tồn tại của tầng này.

## Replay and chapter recap

Fix phase mặc định mở split-screen ghost: cùng camera, cùng Edge clusters,
active keys/cadence và origin capacity 1.500/s; cột trái 5A, cột phải 5B. HUD
hiện tracked-key `120 edge → 3 shield` và aggregate invariant.

**Chapter recap — Media at scale:** chọn explanation nối isolation, replication,
nearest-edge routing và shield. Rationale nhấn mạnh shield giảm amplification
nhưng không bảo đảm một fetch toàn cầu hay luôn làm Origin healthy.

## End state and acceptance

- Upstream fetch count được model tính theo region/key và không thấp hơn một cách
  giả tạo thành một fetch toàn cầu.
- Cùng workload Phase 5A chỉ healthy khi aggregate formula `<= 1.500/s`; nếu
  không, scene vẫn giữ verdict quá capacity dù tracked key đã coalesce.
- Regional Shield Cache giữ identity ở các phase sau để topology không biến mất
  sau khi fix.
- `origin` giữ nguyên key khi label chuyển từ `Media Relay/Origin` sang `Origin`;
  Regional Shield Cache là node mới, không phải Origin được đổi tên.
