# Phase 8A — Add cold rooms

[Previous: 7D](phase-07d-publish-committed-result.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 8B](phase-08b-admit-demanded-renditions.md)

## Intent

Làm lộ chi phí compute khi mọi live room đều được transcode đủ rendition ladder
dù chỉ có một hoặc hai Viewer.

## Starting state

Hero room đã đi hết chuỗi media, interaction và money; mọi room mới đều có
target-profile playable baseline nhưng policy hiện tại vẫn khởi chạy mọi
optional rendition rung.

`scope: platform-fleet` · `workloadId: fleet-room-mix`

`architecture: media=shielded · interaction=split-plane · financial=money-safe · fleetPolicy=transcode-all`

`current-scope plane verdicts after pressure: fleet=FAIL · media/interaction/financial=UNTESTED at platform-fleet`

`reference only: hero-room last-known media=PASS · interaction=PASS · financial=PASS`

`scoreboard (platform-fleet): rooms 40.000 · encoder cost ≈ USD 6.000/h · worst plane FAIL`

## Single action

Vặn núm **rooms**: `concurrentColdRooms` lên 40.000, mỗi room chỉ 1–2 Viewer.

## Choreography

Phase mở bằng forward scope transition duy nhất: camera pull-back từ hero room ra
fleet view, HUD đổi `SCOPE: hero-room` → `SCOPE: platform-fleet`. Hero room vẫn
visible làm reference và không được cộng metric lần hai. Back về 7D phải đảo
transition, khôi phục hero-room camera/HUD/focus deterministic.

Sau đó cold-room clusters xuất hiện. Model cộng encoder cost của từng optional
rung đang bật cho mọi room:

```text
rooms                 40.000
optional rungs/room        3        (baseline không tính)
encoder units    40.000 × 3 = 120.000
pool capacity              60.000            vi phạm 2 lần

rung thực sự có sustained demand   ≈ 12%
```

Tổng load vượt pool capacity trong khi eligible demand ở phần lớn rung rất thấp.

## Panel message

Lesson rời hero room để nhìn cả nền tảng: vấn đề còn lại không đến từ một room
lớn mà từ số room × optional rendition rung.

Một nền tảng long-tail lãng phí compute nếu tạo mọi optional rung ngay từ đầu,
nhưng mỗi room vẫn phải giữ target-profile playable baseline.

## HUD

`Changed: concurrent cold-room cohort added` ·
`Boundary: 120.000 encoder units > 60.000 pool capacity` · `Result: fleet FAIL`

`View evidence`: room count, per-rung demand/device/network/QoE, encoder cost và
utilization.

## Learning checkpoint

**Predict:** pressure đến từ Viewer count hay active-room/optional-rung count.
Rationale mở per-rung load; breach tự highlight và không gate Apply fix.

## End state and acceptance

- Room được biểu diễn bằng cluster, không phải hàng triệu component.
- Pressure đến từ room count, không bị mô tả thành viewer spike.
- Mỗi room vẫn có target-profile baseline; issue là optional rungs được tạo quá
  sớm, không claim một baseline phù hợp mọi thiết bị/mạng.
- Hero room reference vẫn phục vụ bình thường.
- Scope transition hiện rõ trong cả 3D và semantic DOM; không có metric nào
  cộng chéo giữa `hero-room` và `platform-fleet`.
