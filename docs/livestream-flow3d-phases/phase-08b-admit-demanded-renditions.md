# Phase 8B — Promote demanded renditions

[Previous: 8A](phase-08a-add-cold-rooms.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 8C](phase-08c-demote-unused-renditions.md)

## Intent

Warm từng optional rendition rung theo sustained eligible demand và encoder
headroom; không promote cả room thành toàn bộ optional rung.

## Starting state

Replay reset cùng `fleet-room-mix` dưới policy mới. Trạng thái transcode-all của
8A chỉ còn ghost comparison; nó không phải một tập encoder đang chạy chờ 8C dọn.
Mọi optional rung bắt đầu `off`, target-profile baseline vẫn active.

Replay `scope: platform-fleet` · `workloadId: fleet-room-mix`; chỉ đổi
`architecture.fleetPolicy: transcode-all → per-rung-on-demand`.

`architecture: media=shielded · interaction=split-plane · financial=money-safe · fleetPolicy=per-rung-on-demand`

`current-scope plane verdicts: fleet=PASS after admission · media/interaction/financial=UNTESTED at platform-fleet`

`reference only: hero-room last-known media=PASS · interaction=PASS · financial=PASS`

`invariant flip: encoderLoadWithinPoolCapacity FAIL → PASS`

`scoreboard (platform-fleet): rooms 40.000 · encoder cost ≈ USD 720/h · worst plane PASS`

## Single action

Áp per-rung admission cho toàn room mix; non-demanded rung giữ `off`, còn một
demanded rung minh họa state `off → warming → ready`.

## Choreography

Mỗi rung có eligible demand từ device/network capability, QoE need và Viewer
selection; policy dùng smoothed demand, promotion threshold/dwell time, encoder
cost và reserved headroom. Non-demanded rung không launch. Encoder của demanded
rung warm trước; rung chỉ vào manifest khi `ready`, rồi Player ABR mới có thể
chọn. Room popularity không mặc định bật mọi rung.

## Panel message

Đây là server-side per-rung admission, khác Player ABR ở Stage 1. Admission quyết
định choices nào tồn tại; Player quyết định chọn choice nào đã ready.

## HUD

`Changed: transcode-all → per-rung admission` ·
`Boundary: 14.400 admitted units <= 60.000 pool capacity` ·
`Result: fleet FAIL → PASS; demanded rung ready before switch`

```text
trước (8A)   40.000 × 3         = 120.000 units   > 60.000   FAIL
sau  (8B)    120.000 × 12%      =  14.400 units   <= 60.000  PASS
```

`View evidence`: per-rung demand, QoE, encoder cost, dwell time và warm-up latency.

## Replay and takeaway

Replay cùng room mix; takeaway tự xuất hiện: sustained demand/headroom, không
binary hot/cold room label, quyết định promotion. Không có prompt.

## End state and acceptance

- Target-profile baseline luôn available.
- Optional rung chỉ publish sau `ready`; Player không switch vào rung đang warm.
- Không promote mọi rung chỉ vì room được gọi là hot.
- PASS đến từ fresh same-workload replay nơi unused rung không launch, không phải
  dừng encoder in-place trước khi drain. Demotion của một previously-ready rung
  là claim riêng ở 8C.
