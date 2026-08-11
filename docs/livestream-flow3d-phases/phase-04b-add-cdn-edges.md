# Phase 4B — Add CDN edges

[Previous: 4A](phase-04a-add-remote-viewers.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 4C](phase-04c-compare-cold-and-warm-cache.md)

## Intent

Đưa delivery edge đến gần Viewer và rút ngắn access path.

## Starting state

US/EU Viewer đang nhận media qua đường dài từ region gốc.

Replay đúng `scope: hero-room` · `workloadId: hero-global-audience` từ Phase 4A;
giữ `cacheState=warm`, chỉ đổi `architecture.media: edge-scaled → global-cdn`.

`architecture: media=global-cdn · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after replay: media=PASS (remote TTFF và rebuffer) · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`invariant flip: remoteTtffWithinSlo FAIL → PASS`

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 22.700/h · worst plane PASS`

## Single action

Reveal CDN Edge US và CDN Edge EU cùng nearest-edge routing.

## Choreography

Path delivery trực tiếp từ region gốc mờ đi; Origin vẫn đưa segment qua backbone
tới aggregate CDN Edge cluster US/EU. Hop `CDN Edge → Viewer` ngắn lại. Cache
state giữ `warm` giống 4A để chỉ geography/topology thay đổi. Camera giữ Origin
trong background; phase không claim upstream propagation giảm.

Canonical path: `Streamer → Ingest → Transcoder/Packager → Media Relay/Origin →
CDN Edge (viewer region) → Viewer`.

## Panel message

CDN giảm viewer-to-serving-edge RTT và có thể cải thiện startup/rebuffer khi segment đã
warm ở Edge. Nó không xóa nhu cầu Origin, không loại bỏ propagation upstream và
không tự giải quyết origin bottleneck.

Nó cũng không miễn phí. Cùng 1.890 TB/h nhưng chạy qua CDN ở `$0,012/GB` thay vì
egress tự vận hành ở `$0,01/GB`, nên chi phí lên ≈ USD 22.700/h. Đây là trade
đầu tiên deck tính bằng tiền: latency đổi lấy cost.

## HUD

`Changed: source-region edge → nearest regional edge` ·
`Boundary: TTFF <= 2.000 ms và rebufferRatio <= 1,0%` ·
`Result: media FAIL → PASS (1.050 ms / 0,6%)`

```text
                      rtt      TTFF        rebuffer     verdict
remote trước (4A)    220 ms    3.400 ms       4,2%       FAIL
remote sau  (4B)      25 ms    1.050 ms       0,6%       PASS
```

`View latency trace`: before/after cùng `cacheState=warm`; chỉ timestamp/span mà
nearest-edge routing thật sự tác động được phép đổi.

`View calculation` (badge `ASSUMPTION`): transferred GB/h không đổi, unit price
đổi, tổng cost đổi. Cost group mở ở đây chứ không chỉ ở Stage 3.

## Replay and takeaway

Fix phase mặc định mở split-screen ghost: cùng camera, cùng
`hero-global-audience`, cùng `cacheState=warm`, cột trái 4A, cột phải 4B.
Takeaway tự xuất hiện: CDN trực
tiếp rút ngắn viewer access path; end-to-end latency vẫn phụ thuộc toàn pipeline.
Cold/warm là claim riêng của 4C. Không có prompt ở fix phase.

## End state and acceptance

- Mỗi remote Viewer route đến Edge cùng region.
- `totalViewers`, bitrate distribution và audience distribution bằng Phase 4A.
- Viewer-to-serving-edge RTT giảm; các metric playback chỉ đổi theo cache/throughput inputs
  trong model, không tự động cùng giảm một mức.
- Origin vẫn visible; cache-state behavior được kiểm tra riêng ở 4C.
- `edge-us` và `edge-eu` là node mới được reveal; `edge-src` vẫn giữ key và vẫn
  phục vụ Viewer ở region gốc. Đây là replication, không phải movement.
- Chỉ timestamp/span mà CDN thật sự tác động mới đổi.
- Cost tăng được hiển thị cùng lúc với latency giảm; deck không trình bày CDN
  như một fix thuần lợi.
