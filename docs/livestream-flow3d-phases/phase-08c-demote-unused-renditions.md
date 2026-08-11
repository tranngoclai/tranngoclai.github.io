# Phase 8C — Demote unused renditions

[Previous: 8B](phase-08b-admit-demanded-renditions.md) · [Concept](../livestream-flow3d-concept.md)

## Intent

Demote một optional rung an toàn sau sustained low demand mà không cắt ngang
Viewer đang dùng nó.

## Starting state

Per-rung admission active; một optional rung đã `ready` nhưng demand giảm.

`scope: platform-fleet` · `workloadId: fleet-room-mix`

`architecture: media=shielded · interaction=split-plane · financial=money-safe · fleetPolicy=per-rung-on-demand`

`current-scope plane verdicts: fleet=PASS · media/interaction/financial=UNTESTED at platform-fleet`

`reference only: hero-room last-known media=PASS · interaction=PASS · financial=PASS`

`scoreboard (platform-fleet): rooms 40.000 · encoder cost ≈ USD 720/h · worst plane PASS`

## Single action

Demote rung qua `ready → draining → off`.

## Choreography

Smoothed eligible demand ở dưới lower threshold đủ demotion dwell time. Policy
gỡ rung khỏi manifest để không có selection mới, đợi active consumers/segment TTL
drain về 0 rồi mới dừng encoder. Higher promotion threshold và lower demotion
threshold tạo hysteresis; không oscillate quanh một ngưỡng.

## Panel message

Compute chỉ được thu hồi sau khi rung không còn được chọn. Hysteresis và drain
order bảo vệ playback; chúng không biến một baseline thành universal codec/network
solution.

## HUD

`Changed: eligible demand sustained below H_down` ·
`Boundary: active consumers = 0 before encoder stop` ·
`Result: fleet PASS; compute saved without interrupted playback`

## Replay and chapter recap

Replay state machine với timeline controls.

**Chapter recap — Fleet economics:** chọn explanation phân biệt Player ABR với
server-side per-rung admission và safe demotion.

## End state and acceptance

- Manifest removal xảy ra trước drain; encoder stop cuối cùng.
- `H_down < H_up`, có dwell time và reserved headroom.
- Deck đóng bằng giới hạn overall readiness: redundancy, regional failover,
  recovery, N+1 capacity, target utilization, geographic skew và data residency
  chưa được chứng minh. Đặc biệt, toàn deck luôn giả định **uplink của Streamer
  còn sống** — ingest node chết, mạng người phát rớt giữa buổi, hay failover
  giữa hai ingest region đều nằm ngoài phạm vi và không có phase nào chứng minh
  chúng. DRM, recording/VOD và multi-CDN là product-dependent,
  không bị gọi nhầm là yêu cầu production phổ quát.
- Back về 8B/8A khôi phục state; Back qua 8A đảo scope transition về hero-room.
