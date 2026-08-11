# Phase 4C — Compare cold and warm cache

[Previous: 4B](phase-04b-add-cdn-edges.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 5A](phase-05a-shorten-the-latency-budget.md)

## Intent

Giữ topology global CDN cố định và đổi riêng cache state để phân biệt access
locality với cache availability.

## Starting state

Remote Viewer đã route tới nearest regional CDN Edge.

`scope: hero-room` · `workloadId: hero-global-audience-cache-compare`

`architecture: media=global-cdn · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts: media cold=FAIL, warm=PASS cho TTFF <= 2.000 ms · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 22.700/h · worst plane FAIL (cold)`

## Single action

Toggle cùng normalized `segment + rendition` key từ `cold` sang `warm`.

## Choreography

Cold: Edge miss, fetch upstream, fill cache rồi phục vụ Viewer. Warm: cùng key
được phục vụ từ Edge; không có upstream fetch cho request đó. Topology, audience,
bitrate và viewer-to-serving-edge RTT giữ nguyên. Hai trace dùng cùng camera và
ghost overlay.

## Panel message

Nearest Edge giải access distance; warm cache tránh upstream fetch cho key đã có.
Hai cơ chế liên quan nhưng không phải cùng một biến.

## HUD

`Changed: cache cold → warm` · `Boundary: TTFF <= 2.000 ms` ·
`Result: cold 2.600 ms FAIL → warm 1.050 ms PASS`

`View evidence`: origin fetch count và startup timestamp waterfall.

## Guided takeaway

Cache state thay đổi startup/origin work; nó không thay đổi geography.

Và cần nhớ ai đang trả giá cold: với live stream, mọi segment đều bắt đầu ở
trạng thái cold. Stage 5 hỏi tiếp chuyện gì xảy ra khi tần suất cold đó tăng
lên.

## End state and acceptance

- Chỉ cache state đổi; architecture và audience giữ nguyên.
- Cold miss vẫn thấy Origin; warm hit không được mô tả là zero Origin traffic cho
  toàn livestream.
- Next sang Stage 5 dùng synchronized miss workload mới, không tái sử dụng verdict
  của một warm key.
