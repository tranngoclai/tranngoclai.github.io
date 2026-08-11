# Phase 5A — Shorten the latency budget

[Previous: 4C](phase-04c-compare-cold-and-warm-cache.md) · [Concept](../livestream-flow3d-concept.md) · [Next: 5B](phase-05b-add-regional-shield-tier.md)

## Intent

Cho thấy glass-to-glass latency mua được bằng origin load: rút ngắn segment
duration làm mọi Edge miss dày hơn, và vì live stream không có segment nào "cũ"
để cache sẵn, toàn bộ chi phí đó dồn thẳng về Origin.

## Starting state

Global CDN đang phục vụ 2,1 triệu Viewer qua 120 Edge instance. Streamer than
phiền: comment của Viewer đến trễ 18 giây so với hành động trên sóng, nên phần
tương tác trực tiếp gần như không dùng được.

`scope: hero-room` · `workloadId: hero-latency-budget`

`architecture: media=global-cdn · interaction=mvp · financial=absent · fleetPolicy=transcode-all`

`plane verdicts after pressure: media=FAIL (origin fetch rate) · interaction=UNTESTED · financial=UNTESTED · fleet=UNTESTED`

`scoreboard: viewers 2.100.000 · delivery cost ≈ USD 22.700/h · worst plane FAIL`

## Single action

Vặn núm **latency budget**: `segmentDurationSec` 6 → phát chunked part 0,2 s
(LL-HLS). Không đổi viewer count, không đổi topology, không đổi ladder.

## Choreography

Cache của một VOD ấm dần theo thời gian vì cùng một file được xem lại nhiều lần.
Live stream không có tính chất đó: mỗi segment vừa sinh ra là **cold ở mọi
Edge**, được yêu cầu gần như đồng thời, rồi không bao giờ được xin lại. Cache
hit ratio cao ở đây đến từ nhiều Viewer chung một Edge trong cùng vài giây, không
đến từ độ tuổi của object.

Vì vậy rút ngắn đơn vị phát hành làm tần suất miss tăng tuyến tính:

```text
edges                   = 120
renditions              = 4
originFetchRate         = edges × renditions / cadence

6,0 s segment    120 × 4 / 6,0   =    80 fetch/s   glass-to-glass ≈ 18 s
2,0 s segment    120 × 4 / 2,0   =   240 fetch/s   glass-to-glass ≈  8 s
0,2 s part       120 × 4 / 0,2   = 2.400 fetch/s   glass-to-glass ≈  3 s

originFetchCapacity C   = 1.500 fetch/s           2.400 > 1.500   FAIL
```

World zoom vào một key để thấy 120 request hội tụ, rồi zoom ra để thấy verdict
được tính trên toàn bộ active key. Origin queue age tăng; Edge bắt đầu phục vụ
part trễ.

## Panel message

Latency không miễn phí — nó được trả bằng origin load. Mỗi lần cắt cadence đi một
nửa, số lần Origin bị hỏi tăng gấp đôi, và toàn bộ Edge hỏi *cùng lúc* vì chúng
bám cùng một segment boundary.

Coalescing trong một Edge gộp được Viewer của chính nó, nhưng không gộp được
giữa 120 Edge. Cache key bị fragment bởi query/token khác nhau còn đẩy con số
này cao hơn nữa.

Đây là chỗ chọn giao thức: HLS 6 s rẻ và trễ; LL-HLS chunked ~3 s đắt hơn về
origin fetch; WebRTC dưới 1 s bỏ hẳn mô hình segment/cache và đổi sang mô hình
kết nối, đắt hơn nhiều lần. Deck không chọn hộ; deck cho thấy hóa đơn.

## HUD

`Changed: segment cadence 6,0 s → 0,2 s part` ·
`Boundary: 2.400 fetch/s > 1.500 fetch/s origin capacity` ·
`Result: media FAIL; glass-to-glass 18 s → 3 s`

`View evidence`: per-key requesting edges, active key count/cadence, aggregate
`originFetchRate` và Origin queue age.

`View calculation` (badge `ASSUMPTION`): cadence, edge count và
`originFetchCapacity = 1.500/s` là input; `originFetchRate` là derived record có
`formula`.

## Learning checkpoint

**Predict:** cắt cadence từ 6 s xuống 0,2 s thì origin fetch rate tăng bao nhiêu
lần — không đổi, 6 lần, hay 30 lần. Rationale chỉ ra fetch rate tỉ lệ nghịch với
cadence và tỉ lệ thuận với số Edge, còn viewer count không xuất hiện trong công
thức. Breach tự highlight; không gate Apply fix.

## End state and acceptance

- Deck nói rõ live stream cold theo bản chất, không trình bày cache miss như một
  sự cố bất thường được dàn dựng.
- Mọi Edge hỏi đúng cùng một key vì cùng segment boundary, không phải vì trùng
  hợp.
- Bottleneck tại Origin đến từ aggregate formula, không phải đổi màu hard-code.
- Glass-to-glass latency giảm và origin load tăng được hiển thị **cùng lúc**;
  không được trình bày rút ngắn latency như một cải thiện thuần lợi.
- Workload seed Edge clusters, active keys/cadence và `originFetchCapacity` được
  giữ nguyên cho Phase 5B.
