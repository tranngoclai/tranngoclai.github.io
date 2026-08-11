# Phase 1A — Network drops

[Previous: 0C](phase-00c-send-comment-on-interaction-lane.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 1B](phase-01b-add-renditions.md)

## Intent

Làm lộ mismatch giữa bitrate nguồn và network capacity của Viewer.

## Starting state

Happy path Stage 0 hoạt động với một rendition chất lượng cao; chưa có
Transcoder/Packager.

`scope: hero-room` · `workloadId: hero-constrained-network`

`architecture: media=mvp · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after pressure: media=FAIL · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`scoreboard: viewers 1 · delivery cost ≈ USD 0,00/h · worst plane FAIL`

## Single action

Vặn núm **network**: Viewer chuyển từ `good` sang `constrained` trong model.

```text
source bitrate       = 6 Mbps
estimated throughput = 1,2 Mbps   (constrained)
rtt                  = 180 ms
```

## Choreography

Access-network queue/delay tăng khi `estimated throughput < source bitrate`.
Player download không theo kịp playback: `playback buffer occupancy` giảm dần về
0, sau đó `stall duration` tăng và Viewer chuyển `warn → danger`.
Infrastructure và server utilization không thay đổi trong phase này.

Canonical media path vẫn là `Streamer → Single Server → Viewer`; bottleneck nằm
trên viewer access network. Semantic DOM ghi riêng network queue delay,
playback buffer occupancy và stall duration.

## Panel message

Cùng một media stream không phù hợp với mọi thiết bị/network. Network capacity
thấp hơn bitrate khiến player buffer dù server vẫn khỏe.

## HUD

`Changed: network good → constrained` ·
`Boundary: 1,2 Mbps throughput < 6 Mbps source bitrate` · `Result: media FAIL`

`View evidence`: network queue delay, playback buffer seconds và stall duration.

## Learning checkpoint

**Predict:** bottleneck nằm ở Server, Transcoder hay viewer access network.
Rationale xuất hiện ngay sau lựa chọn: server vẫn khỏe; network/bitrate mismatch
làm Player cạn buffer. Breach tự highlight; focus/click chỉ mở evidence và không
gate Apply fix.

## End state and acceptance

- Model thể hiện `1,2 Mbps < 6 Mbps`; cả hai giá trị đến từ snapshot.
- Bottleneck nằm tại viewer access network, không gắn nhầm cho Server.
- Không tự động reveal fix.
- Breach cue và evidence giống nhau trong 3D/semantic DOM; không có Inspect gate.
