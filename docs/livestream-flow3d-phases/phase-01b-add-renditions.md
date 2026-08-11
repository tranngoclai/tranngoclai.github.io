# Phase 1B — Add renditions

[Previous: 1A](phase-01a-network-drops.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 2A](phase-02a-audience-outgrows-one-server.md)

## Intent

Thêm nhiều rendition để Player nhận bitrate phù hợp với network hiện tại.

## Starting state

Viewer đang buffer vì chỉ có một rendition cao hơn network capacity.

Replay đúng `scope: hero-room` · `workloadId: hero-constrained-network` từ
Phase 1A; chỉ đổi `architecture.media: mvp → adaptive`.

`architecture: media=adaptive · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after replay: media=PASS · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`invariant flip: abrSelectionFitsThroughput FAIL → PASS`

`scoreboard: viewers 1 · delivery cost ≈ USD 0,00/h · worst plane PASS`

## Single action

Reveal và kích hoạt `transcoder-packager`.

## Choreography

Media nguồn đi qua Ingest role vào Transcoder/Packager, tạo rendition ladder
`[6 · 3 · 1,5 · 0,8] Mbps` từ model. Packager publish manifest/segment
references. **Player ABR**, không phải
Transcoder hay CDN, chọn rendition có bitrate nằm trong throughput headroom.
Model chỉ cung cấp deterministic ABR decision trace cho choreography. Playback
buffer occupancy tăng lại vùng an toàn và stall kết thúc.

Canonical path: `Streamer → Single Server.ingest → Transcoder/Packager →
Single Server.delivery → Player-selected rendition`. Hai role của Single Server
chưa được tách thành service độc lập.

## Panel message

Transcoding/packaging tạo ladder; Player ABR chọn rendition phù hợp. Phase này
không dạy chi tiết codec hoặc thuật toán ABR.

## HUD

`Changed: media mvp → adaptive` ·
`Boundary: selected × 1,25 <= 1,2 Mbps → chọn rung 0,8 Mbps` ·
`Result: media FAIL → PASS`

```text
6,0 × 1,25 = 7,50 > 1,2   loại
3,0 × 1,25 = 3,75 > 1,2   loại
1,5 × 1,25 = 1,88 > 1,2   loại
0,8 × 1,25 = 1,00 <= 1,2  chọn
```

`View evidence`: available renditions, ABR decision trace, buffer và stall.

## Replay and chapter recap

Fix phase mặc định mở ở chế độ split-screen ghost: cùng camera, cùng
`hero-constrained-network`, cột trái là snapshot 1A, cột phải là 1B. Replay chạy
lại choreography và hiện invariant `selected bitrate × 1,25 <= 1,2 Mbps`.

**Chapter recap — Watchable:** chọn causal explanation phân biệt Transcoder tạo
choices, Player ABR chọn choice và CDN giải bài toán delivery khác. Đây là recap
prompt đầu tiên của deck; không có Inspect/Explain gate riêng.

## End state and acceptance

- Tất cả bitrate/label lấy từ model result.
- Chỉ rendition được chọn chạy tới Viewer.
- Viewer chuyển healthy mà không thay đổi network assumption.
- Before/after cùng `workloadId`; rationale nói đúng Player sở hữu ABR decision.
