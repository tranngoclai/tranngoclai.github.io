# Phase 4A — Add remote viewers

[Previous: 3B](phase-03b-scale-out-delivery-edges.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 4B](phase-04b-add-cdn-edges.md)

## Intent

Làm lộ ảnh hưởng của geography đến access path mà không đồng thời tăng total
Viewer workload.

## Starting state

Ingest, Transcoder/Packager, Media Relay/Origin và Delivery Edge đã tách nhưng
delivery vẫn tập trung trong region gốc.

`scope: hero-room` · `workloadId: hero-global-audience`

`architecture: media=edge-scaled · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`held constant: totalViewers · bitrate distribution · cacheState=warm`

`plane verdicts after pressure: media=FAIL (remote TTFF và rebuffer) · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 18.900/h · worst plane FAIL`

## Single action

Vặn núm **distribution**: relocate 60% Viewer hiện có từ region gốc sang US và
EU. `totalViewers` và bitrate distribution giữ nguyên — chỉ vị trí đổi.

## Choreography

Các media path dài từ Delivery Edge ở region gốc đến US/EU xuất hiện; link
chuyển warn. Model tính `viewerToServingEdgeRttMs`, `timeToFirstFrameMs`,
`rebufferRatio` và `steadyStateGlassToGlassLatencyMs` từ ordered timestamps.
Viewer nội vùng vẫn healthy; không dùng RTT thay cho toàn bộ playback latency.

Canonical path: `Streamer → Ingest → Transcoder/Packager → Media Relay/Origin →
Delivery Edge (source region) → remote Viewer`. Semantic DOM ghi rõ audience
distribution đã đổi nhưng total workload không đổi.

## Panel message

Khoảng cách vật lý làm access RTT tăng. Startup, rebuffer và glass-to-glass
latency còn phụ thuộc throughput/loss, encoding, GOP, packaging/segment duration,
cache state và player policy.

## HUD

`Changed: audience distribution local → local+US+EU` ·
`Boundary: TTFF <= 2.000 ms và rebufferRatio <= 1,0%` ·
`Result: media FAIL cho remote viewer (3.400 ms / 4,2%)`

```text
                      rtt      TTFF        rebuffer     verdict
local viewer          15 ms      900 ms       0,4%       PASS
remote US/EU         220 ms    3.400 ms       4,2%       FAIL
SLO                     —      2.000 ms       1,0%
```

`View latency trace` hiển thị hai waterfall của cùng snapshot:

```text
joinRequested → manifestReceived → firstSegmentDownloaded → firstFrameRendered
captured → encoded → packaged → originReady → edgeReady → downloaded → rendered
```

Derived metrics lấy từ timestamp; model từ chối timestamp đảo thứ tự. Các input
dùng badge `ASSUMPTION`.

## Learning checkpoint

**Predict:** metric nào chắc chắn đổi khi cùng audience được relocate — geography
và viewer-to-serving-edge RTT, không phải total Viewer. Rationale mở timestamp
waterfall; breach tự highlight và không gate Apply fix.

## End state and acceptance

- Local và remote Viewer có kết quả khác nhau từ cùng model snapshot.
- FAIL được phát biểu bằng hai ngưỡng có tên và có số (`TTFF <= 2.000 ms`,
  `rebufferRatio <= 1,0%`), không phải bằng cụm "access SLO" chung chung.
- `totalViewers` và bitrate distribution bằng Phase 3B; chỉ audience distribution
  thay đổi.
- Không dùng “20 giây” như propagation latency mặc định.
- Timestamp giữ đúng thứ tự; TTFF và steady-state latency được derive, không
  cộng hard-code GOP/segment/RTT.
- CDN fix chưa xuất hiện.
