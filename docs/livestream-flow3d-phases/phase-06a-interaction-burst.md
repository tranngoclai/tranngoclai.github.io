# Phase 6A — Interaction burst

[Previous: 5B](phase-05b-add-regional-shield-tier.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 6B](phase-06b-isolate-interaction-plane.md)

## Intent

Cho thấy media delivery vẫn khỏe trong khi naive comment/like broadcast tạo
outbound fan-out amplification và làm interaction path nghẽn.

## Starting state

Hero room đang phục vụ 2,1 triệu Viewer qua media architecture đã tối ưu.
Interaction thì chưa đi đâu cả: từ Stage 2 tới giờ nó vẫn nằm trên đúng một
`single-server`, và suốt Stage 3, 4, 5 nó mang verdict `UNTESTED` chứ không phải
`PASS`. Đây là khoản nợ deck cố tình giữ lại — và bây giờ đến hạn.

v1 chỉ pressure-test accepted comment/like và
outbound presentation. Presence, socket termination và reconnect storm nằm
ngoài v1 với failure/capacity assumption hiển thị trong evidence.

`scope: hero-room` · `workloadId: hero-interaction-fanout`

`architecture: media=shielded · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after pressure: media=PASS · interaction=FAIL · financial=UNTESTED · fleet=UNTESTED`

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 23.400/h · worst plane FAIL`

## Single action

Vặn núm **interaction rate**: `attemptedInteractionEventsPerSecond` từ baseline
lên 40.000/s, giữ nguyên 2,1 triệu Viewer. Auth/quota derive `accepted = 2.000/s`
và `rateLimited = 38.000/s`.

## Choreography

Phase mở bằng camera pan từ MEDIA CORE xuống INTERACTION CORE; media path vẫn
nhìn thấy ở background để nhấn mạnh video chưa hỏng. Scope không đổi.

Media lane tiếp tục tone healthy. Attempted events đi qua auth/rate limit; model
tách `attempted`, `accepted` và `rateLimited`. Accepted Comment/Like tăng ở lane
metadata riêng; naive Interaction Handler broadcast `accepted × viewers` =
4,2e9 deliveries/s và chuyển danger khi outbound vượt capacity. Chưa reveal
queue hoặc regional gateway của fix.

## Panel message

Media plane đã được pressure-test qua nhiều capability; interaction ở peak vẫn
`UNTESTED`. Phase này bắt đầu một workload/plane test mới, không ngầm tuyên bố
bottleneck của toàn hệ thống vừa “di trú” từ một thiết kế overall healthy.

Viewer count không tự suy ra event rate, nhưng nó nhân fan-out cost của mỗi event.
Interaction load cần assumption riêng; không phải mọi comment/like đều cần phát
nguyên dạng tới mọi Viewer.

## HUD

`Changed: attempted interaction rate baseline → 40.000/s` ·
`Boundary: 4,2 tỷ deliveries/s > 5 triệu/s handler capacity` ·
`Result: interaction FAIL (840 lần); media PASS`

```text
attempted            40.000/s
accepted              2.000/s      (38.000/s bị rate limit)
naive fan-out         2.000/s × 2.100.000 = 4,2e9 deliveries/s
handler capacity      5,0e6 deliveries/s
thiếu hụt             840 lần
```

Con số hàng tỷ này là output của model từ hai input trên, không phải một cách
nói cho kêu. Nó lớn đúng vì mỗi event nhân với toàn bộ audience.

`View evidence`: attempted/accepted/rate-limited, Viewer count và connection-layer
assumptions outside v1.

## Learning checkpoint

**Predict:** accepted ingress hay outbound fan-out vi phạm capacity. Rationale
đặt hai con số cạnh nhau: ingress 2.000/s nằm thừa trong hạn, còn outbound
4,2e9/s vượt 840 lần — trong khi media SLO vẫn đạt. Breach tự highlight; không gate
Apply fix.

## End state and acceptance

- Media và interaction có verdict độc lập.
- Overload đến từ outbound amplification `accepted × viewers`, không bị mô tả
  thành media hoặc ingest bottleneck.
- Mọi con số fan-out đến từ model; deck không dùng đơn vị "hàng tỷ" như một cách
  nói tu từ tách rời khỏi phép nhân đang hiển thị.
- Deck nói rõ interaction chuyển từ `UNTESTED` sang `FAIL` — nó chưa từng
  `PASS`, nên đây không phải một regression mới xuất hiện.
- Fix split-plane/aggregation/selected delivery chưa tự xuất hiện.
