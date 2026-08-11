# Livestream architecture source notes

Tài liệu này ghi lại ý chính từ một buổi TechTalk về cách một hệ thống quy mô
TikTok Live có thể xử lý sự kiện khoảng 2,1 triệu người xem đồng thời, lấy case
livestream của bà Nguyễn Phương Hằng làm ví dụ. Buổi chia sẻ được dẫn dắt bởi
Dray Nguyễn (cựu kỹ sư phần mềm mảng Livestreaming tại TikTok Úc) cùng các kỹ
sư từng hoặc đang làm việc tại TikTok và Microsoft.

## Trạng thái và cách đọc

Đây là **source notes**, không phải mô tả đã được xác minh về production
architecture của TikTok. Trước khi đưa một claim vào bài học, phải phân loại nó:

- **Observed:** điều diễn giả nói hoặc demo; cần gắn nguồn và thời điểm.
- **Estimated:** kết quả tính từ các planning assumptions được công khai.
- **Illustrative:** kiến trúc hoặc con số dùng để giải thích, không khẳng định đó
  là implementation thực tế của TikTok.

Những câu kiểu "TikTok dùng/đặt/lưu" chỉ được dùng như fact khi có citation.
Nếu chưa có citation, deck phải diễn đạt là "một thiết kế có thể dùng".

Source metadata hiện có:

- `sourceId`: `techtalk-livestream-2m1-notes`
- Recording URL/timecode: chưa được cung cấp trong workspace.
- Recording/event date: chưa được cung cấp trong workspace.
- Verification status: `unverified-source-note`; không được nâng thành `observed`
  cho tới khi bổ sung URL/timecode và kiểm tra lại claim.

## Normative teaching contract

Deck phải giữ ba plane riêng biệt:

1. **Media plane:** Streamer -> ingest -> transcoder/packager -> origin ->
   Regional Shield Cache -> CDN edge -> player.
2. **Interaction/control plane:** presence, comment, like, moderation, counters và
   routing signals. Message queue có thể nằm ở đây; không mặc định Kafka/MQ vận
   chuyển raw audio/video.
3. **Financial plane:** gift/donate command -> durable ledger -> committed read
   model. Hiệu ứng UI không phải bằng chứng giao dịch đã commit.

Mọi scenario phải công khai workload, latency target, consistency requirement,
failure assumption và nguồn của cost/rate. Mũi tên trong animation phải nói rõ
nó mang `media`, `control`, `metadata` hay `money`.

Ba plane tiến hóa độc lập. Deck phải biểu diễn trạng thái như một tập capability
(`media`, `interaction`, `financial`, `fleetPolicy`), không ép chúng vào một
generation ID tuyến tính. Mỗi plane có verdict `pass | fail | untested`;
`media: pass` không chứng minh interaction hoặc financial path đã sẵn sàng.
Financial Core là region riêng trong world; money command không được vẽ như một
nhánh metadata của Interaction Core.

---

## 1. Kiến trúc cơ bản và sự đa dạng thiết bị

- **Illustrative baseline:** Streamer -> Server -> Viewer.
- Viewer dùng thiết bị, codec, tỷ lệ màn hình và mạng khác nhau. Một source 4K
  không phù hợp với mọi player hoặc đường truyền.
- Transcoding/packaging có thể tạo một adaptive bitrate ladder, ví dụ 1080p,
  720p, 540p và 360p. Player chọn rendition theo năng lực thiết bị và mạng.
- Watermark, subtitle và các bước xử lý nội dung có thể nằm trong cùng pipeline,
  nhưng không nhất thiết do một service duy nhất thực hiện.

## 2. Scale số lượng người xem

Một server đơn lẻ sớm gặp giới hạn CPU, memory, network interface, connection
state hoặc egress capacity.

- **Vertical scaling:** tăng năng lực một node, nhưng vẫn có giới hạn vật lý và
  tạo failure domain lớn.
- **Horizontal scaling:** streamer vẫn chỉ push một stream tới ingest node được
  routing chọn; streamer không phải upload tới mọi distribution node.
- **Media fan-out:** ingest chuyển media vào transcoder/packager và hierarchy
  origin/relay/CDN để phục vụ nhiều viewer. Kafka/MQ có thể truyền job, state,
  telemetry hoặc metadata; nó không phải mặc định là raw-video fan-out bus.

`Push node` và `Pull edge node` vẫn là abstraction hữu ích để dạy ingest khác
distribution, nhưng không nên đồng nhất abstraction đó với "microservices" hay
với một transport cụ thể.

Tách role/process chỉ tạo scaling boundary; nó không tự tạo thêm CPU, connection
hoặc egress capacity. Nếu cùng workload chuyển từ fail sang pass sau khi tách
role, model phải công khai deployment/resource boundary mới và phần capacity
được bổ sung. Nếu chưa bổ sung capacity, verdict đúng chỉ là bottleneck đã được
cô lập, chưa được giải quyết.

## 3. Khoảng cách địa lý và playback latency

- Cross-continent distance làm tăng RTT, nhưng không tự nó giải thích glass-to-
  glass latency cỡ 20 giây. Encode, GOP, packaging/segment duration, cache và
  player buffer thường chiếm phần đáng kể.
- CDN/edge giúp viewer lấy media từ điểm gần hơn và giảm tải origin. Edge gần
  hơn không đảm bảo low latency nếu ingest, packaging hoặc player vẫn buffer
  dài.
- RTMP là một lựa chọn ingest phổ biến. Playback có thể dùng HLS/DASH, LL-HLS,
  WebRTC hoặc protocol khác tùy latency target; không nên gọi chung là upload.
- Segment/recording bất biến có thể lưu trong **object storage** như Amazon S3.
  S3 không phải block storage. Live manifest/index có thể tiếp tục thay đổi;
  SQL/NoSQL có thể lưu metadata và index, không mang raw media path.

Latency lesson không cộng nguyên GOP duration, segment duration và RTT thành một
"công thức đúng" mặc định vì các công đoạn có thể overlap và giá trị chờ phụ
thuộc thời điểm frame đến. Model nên phát timestamp có thứ tự:
`captured -> encoded -> packaged -> originReady -> edgeReady -> downloaded ->
rendered`, rồi suy ra riêng time-to-first-frame, steady-state glass-to-glass và
rebuffer. CDN chỉ được ghi nhận tác động lên timestamp/path mà topology và cache
state thực sự thay đổi.

## 4. Bảo vệ origin

Khi nhiều edge cùng đọc một live stream, main origin có thể thành bottleneck.
Regional origin hoặc origin-shield/cache hierarchy có thể giảm số lần fetch
ngược. Deck này chọn tên/cơ chế canonical **Regional Shield Cache**; nó không
khẳng định đây là topology duy nhất có thể dùng.

Cache hit hoặc request coalescing có thể khiến nhiều request chia sẻ một upstream
fetch, nhưng không bảo đảm toàn bộ edge "chỉ hỏi origin đúng một lần". Kết quả
phụ thuộc cache key, freshness, segment/chunk cadence, eviction và failure. Deck
nên animation hóa `cache miss -> fill -> hit`, thay vì một mũi tên cache chung.

Với live ABR, một segment sequence có nhiều rendition/cache key. Edge-count chia
cadence chỉ mô tả đúng một normalized key. Origin request rate của cả ladder là
tổng `edgesRequesting(key) / cadence(key)` trên các active key; shield thay số
Edge bằng số shield thực sự fetch mỗi key. Deck phải chọn rõ đang dạy một key hay
toàn ladder, không dùng kết quả một key để kết luận capacity toàn Origin.

## 5. Planning estimate cho 2,1 triệu viewer

Các input dưới đây là **illustrative planning assumptions**, không phải giá hoặc
telemetry production đã được xác minh:

| Input | Giá trị minh họa | Trạng thái |
|---|---:|---|
| Concurrent viewers | 2.100.000 | Case-study input |
| Average delivered bitrate | 2 Mbps/viewer | Planning assumption |
| Duration | 1 giờ | Planning assumption |
| Transfer rate | USD 0,01/GB | Unverified illustrative rate; cần citation |

Với đơn vị SI:

- Throughput: `2.100.000 x 2 Mbps = 4,2 Tbps`.
- Data/giờ: `4,2 Tbps x 3.600 / 8 = 1,89 PB`, tức khoảng 1,89 triệu GB.
- Nếu thực sự áp dụng `USD 0,01/GB`, transfer-only estimate là khoảng
  `USD 18.900/giờ`. Dùng throughput đã làm tròn 4 Tbps cho ra khoảng USD 18.000,
  không tự tạo ra lower bound USD 14.000.

Đây chỉ là egress lower bound. Nó chưa gồm transcoding, origin/CDN replication,
inter-region traffic, storage, requests, observability, redundancy, headroom hay
commercial discount. Ví dụ "mỗi cluster 40 Gbps" cũng phải ghi target
utilization, geographic skew và N+1 capacity trước khi kết luận hệ thống xử lý
"dễ dàng".

## 6. Long-tail: rất nhiều stream nhưng ít viewer/stream

**Illustrative workload:** một triệu stream đồng thời, mỗi stream chỉ có 1-2
viewer. Transcode toàn bộ rendition ladder ngay lập tức có thể lãng phí compute.

Một policy hợp lý hơn có thể kết hợp:

- Source passthrough khi codec, resolution và bandwidth thật sự phù hợp viewer.
- Một baseline rendition tương thích cho viewer mạng yếu; không ép họ nhận
  1080p chỉ vì stream có ít view.
- Kích hoạt thêm rendition theo demand/QoE với threshold, hysteresis, pre-warm
  và startup-delay budget.
- Cho streamer/OBS đẩy nhiều rendition nếu uplink và CPU cho phép. Cách này giảm
  server compute nhưng tăng uplink, client complexity và trust/validation cost.

Admission nên quyết định theo từng rendition rung, dựa trên sustained demand,
device/network mix, QoE và encoder headroom. Room popularity không đồng nghĩa mọi
rung đều cần thiết; room ít Viewer vẫn có thể cần ngay một low-bitrate/compatible
rung cho target playback profile. Baseline là contract theo target profile,
không phải một rendition phổ quát cho mọi thiết bị và mạng.

Nguyên tắc 80/20 có thể là heuristic để kể chuyện, không phải phân phối đã được
xác minh nếu chưa có telemetry hoặc citation.

## 7. Interaction metadata: comment, like và counters

Không suy từ 2,1 triệu viewer thành "hàng tỷ request/giây" nếu chưa có action
rate. Workload phải dùng công thức:

`interaction ingress rate = active viewers x actions/viewer/second`

Ví dụ minh họa, 2,1 triệu viewer ở 0,1 action/giây tạo 210.000 events/giây trước
retry và amplification; đây vẫn là estimate, không phải observed traffic.

Tách riêng các causal stage:

1. Ingest và authenticate event.
2. Moderation/risk control, rate limit và abuse handling.
3. Durable event/count update theo contract của từng loại dữ liệu.
4. Aggregate, batch hoặc sample **outbound presentation** vì một client không thể
   đọc mọi comment/like.
5. Fan-out sampled comments và counters tới viewer.

V1 pressure-test accepted comment/like processing và outbound presentation.
Presence, socket termination và reconnect storms vẫn là bottleneck thực tế nhưng
nằm ngoài mô phỏng; deck phải ghi chúng `UNTESTED` và công khai capacity/failure
assumption của connection layer thay vì ngầm coi 2,1 triệu connection là healthy.

Sampling phần hiển thị không đồng nghĩa được bỏ toàn bộ source event. Comment
có yêu cầu moderation/audit khác like counter. Stale counter hoặc eventual read
model là consistency choice cụ thể; không nên gọi mọi đánh đổi latency là CAP.
CAP chỉ buộc lựa chọn consistency/availability khi có network partition.

## 8. Financial events: donate, gift và coin

Financial correctness không được bảo đảm chỉ bởi eventual consistency, Kafka
mirroring, distributed tracing hoặc khả năng refund.

Normative flow cần thể hiện:

1. Authenticate command và gắn idempotency key.
2. Persist/deduplicate command; queue có thể redeliver nhưng business effect chỉ
   được commit một lần.
3. Ghi durable ledger và balance transition theo invariant đã định nghĩa.
4. Chỉ publish committed result sang read model; UI có thể hiện `pending` trước
   đó nhưng không được giả là đã settlement.
5. Reconcile, trace và refund khi phát hiện sai lệch.

Routing về một core region/DC là một lựa chọn minh họa, không phải correctness
proof. Bài học còn phải nói rõ failover, data residency và hành vi khi region,
queue consumer hoặc ledger dependency không khả dụng.

Command, deduplication và ledger commit không được phụ thuộc best-effort
presentation. Sau commit, notification/UI effect có thể dùng một presentation
channel best-effort hoặc at-least-once với operation ID để client deduplicate;
mất hoặc lặp animation không được thay đổi ledger truth.
