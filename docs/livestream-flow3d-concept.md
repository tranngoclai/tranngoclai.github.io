# Live Room Under Pressure — Flow3D concept report

## 1. Mục tiêu

Thiết kế một Flow3D scenario duy nhất mô phỏng quá trình một hệ thống
livestream tiến hóa từ MVP phục vụ vài người xem thành nền tảng chịu được một
sự kiện có 2,1 triệu người xem đồng thời.

Trọng tâm không phải trình bày lại kiến thức dưới dạng slide. Người học phải
nhìn thấy quan hệ nhân quả:

1. Áp lực mới xuất hiện.
2. Kiến trúc hiện tại bộc lộ bottleneck.
3. Một cơ chế được bổ sung để xử lý đúng bottleneck đó.
4. Cùng workload được chạy lại để quan sát kết quả.

Source notes và claim registry ban đầu:
[`docs/livestream-architecture.md`](livestream-architecture.md). Concept report và
các phase file là teaching contract chuẩn hóa; contract authoring nằm tại
[`docs/flow3d-deck-authoring.md`](flow3d-deck-authoring.md).

---

## 2. Quyết định concept

### Concept được chọn: pressure-driven evolution

Tên tạm thời của deck:

> **Live Room Under Pressure — từ 1 viewer đến 2,1 triệu viewer**

Toàn bộ bài học diễn ra trong một persistent world. Streamer, Live Room và các
thành phần đã xuất hiện không bị teardown khi chuyển stage. Mỗi giải pháp mới
được reveal và giữ lại, để người học thấy kiến trúc lớn dần cũng như bottleneck
dịch chuyển từ tầng này sang tầng khác.

Deck được điều hướng theo bốn chapter, còn trạng thái kiến trúc hiển thị bằng
bốn capability rail độc lập:

```text
WATCHABLE          MEDIA AT SCALE            INTERACTIVE & CORRECT  FLEET ECONOMICS
Stage 0–1          Stage 2–5                 Stage 6–7              Stage 8

Media        MVP → Adaptive → Isolated → Edge-scaled → Global CDN → Shielded
Interaction  MVP ─────────────────────────────→ Isolated → Split-plane
Financial    Absent → Naive → Idempotent command → Ledger-safe → Money-safe
Fleet policy Transcode-all ────────────────────────────────────────→ Per-rung on-demand
```

Mỗi rail giữ capability cuối cùng đã đạt; rail khác không bị thay thế khi một
capability mới xuất hiện. Model dùng object `architecture`, không dùng một
generation ID scalar:

```js
{
  media: "shielded",
  interaction: "split-plane",
  financial: "money-safe",
  fleetPolicy: "per-rung-on-demand"
}
```

Capability rail không biểu diễn data path. Active path được thể hiện trực tiếp
bằng flow/link trong world và semantic DOM. Mỗi plane có verdict riêng
`PASS | FAIL | UNTESTED`; deck không dùng media health làm overall health.

### Vì sao chọn hướng này

- Giữ đúng yêu cầu “một flow duy nhất”.
- Mỗi thay đổi có nguyên nhân, hậu quả và phép kiểm chứng rõ ràng.
- Hợp với persistent-world model của Flow3D: build một lần, reveal dần.
- Cho phép dùng Next/Back/Replay hiện có mà chưa cần xây một simulation engine
  tự do hoàn toàn.
- KISS/YAGNI: không cần nhiều scenario, router hoặc world độc lập.

### Hai hướng không chọn

#### Tách Media plane và Interaction plane thành hai scenario

Chính xác về mặt kỹ thuật và dễ giới hạn component hơn, nhưng làm mất cảm giác
đang quan sát một hệ thống duy nhất tiến hóa.

#### Mở đầu bằng incident 2,1 triệu viewer rồi điều tra ngược

Có tính kịch tính cao, nhưng chronology thiết kế bị đảo. Nhiều flashback và
camera jump khiến người học khó nhận ra mỗi quyết định đã giải quyết vấn đề nào.

---

## 3. Vòng lặp tương tác

Từ Stage 1, mỗi stage dùng cùng một nhịp quan sát:

```text
Baseline → Predict → Run pressure → Breach → Apply bounded fix(es) → Same-workload replay
```

- **Baseline:** tự chạy ngắn để người học thấy path đang healthy và biến nào
  sắp được giữ cố định.
- **Predict:** issue phase có đúng một câu hỏi bottleneck/invariant từ 2–3 đáp
  án. Trả lời sai vẫn tiếp tục sau rationale ngắn.
- **Run pressure:** issue phase thay đổi đúng một trục workload.
- **Breach:** component và capacity boundary tự highlight; click/focus chỉ mở
  detail, không gate nút Apply fix.
- **Apply bounded fix(es):** một stage có thể cần nhiều fix phase; mỗi phase chỉ
  thêm/kích hoạt một causal mechanism và giữ cùng workload.
- **Replay/compare:** chạy lại chính `workloadId` của issue phase; HUD hiển thị
  before/after theo cùng metric và SLO bằng ghost overlay hoặc scrubber.
- **Takeaway:** một câu kết luận xuất hiện tự động; không có Explain quiz ở mọi
  stage.

### Phân bổ checkpoint (normative)

Mỗi issue phase Stage 1–8 có đúng một Predict prompt. Một hoặc nhiều bounded fix
phase không có gate; Replay/compare là interaction trực tiếp. Cuối mỗi chapter
có một recap prompt:

| Vị trí | Checkpoint | Vai trò |
|---|---|---|
| Issue phase Stage 1–8 | **Predict** | Chọn bottleneck/invariant trước pressure |
| Fix phase | **Replay/compare** | Cùng workload, cùng camera, before/after; không tính là prompt |
| Sau 1B, 5B, 7D, 8C | **Chapter recap** | Chọn causal explanation nối các stage trong chapter |

Inspect là hành vi optional: focus/click component để xem evidence. Nó không mở
khóa navigation và không được tính là prompt.

Stage 0 là guided walkthrough, không có prompt. 0B chỉ chứng minh join tạo media
downlink; 0C chứng minh comment dùng metadata lane riêng.

Tổng v1: 8 Predict + 4 chapter recap = **12 prompt**.

Checkpoint là deterministic state của v1, không phải quiz chấm điểm hay simulation
tự do. Next/Back/Replay phải khôi phục cùng prompt, selection, snapshot và
rationale.

Trong engine, issue và fix vẫn là hai phase riêng. Replay là thao tác UI,
không phải phase chứa thêm thay đổi kiến trúc. Mỗi click chỉ có một
hành động ngữ nghĩa.

Một ordered trace dài hơn 600 ms cung cấp Play/Pause, Previous/Next beat,
Replay và Skip. Các beat phải cùng chứng minh một primary claim; chúng không tạo
thêm phase điều hướng hay thêm quiz.

---

## 4. Storyboard — 9 stage, 24 phase

Chi tiết của mỗi phase được giữ trong một file độc lập dưới
[`docs/livestream-flow3d-phases/`](livestream-flow3d-phases/). Report này chỉ là
nguồn cho contract dùng chung và thứ tự điều hướng.

| Stage | Phase | Vai trò |
|---|---|---|
| 0 — Happy path | [0A — Meet the system and go live](livestream-flow3d-phases/phase-00a-meet-the-system-and-go-live.md) | Giới thiệu ba actor và chạy media uplink |
| | [0B — Viewer joins and plays](livestream-flow3d-phases/phase-00b-viewer-joins-and-plays.md) | Join room rồi nhận media downlink |
| | [0C — Send a comment](livestream-flow3d-phases/phase-00c-send-comment-on-interaction-lane.md) | Gửi comment trên metadata lane riêng |
| 1 — Adaptive video | [1A — Network drops](livestream-flow3d-phases/phase-01a-network-drops.md) | Làm lộ mismatch giữa bitrate và network |
| | [1B — Add renditions](livestream-flow3d-phases/phase-01b-add-renditions.md) | Thêm Transcoder/Packager |
| 2 — Blast radius | [2A — Audience outgrows one server](livestream-flow3d-phases/phase-02a-audience-outgrows-one-server.md) | Delivery overload kéo sập ingest và room-control vì dùng chung một máy |
| | [2B — Split ingest and delivery](livestream-flow3d-phases/phase-02b-split-ingest-and-delivery.md) | Isolation thu hẹp bán kính hư hại; capacity vẫn thiếu và được chuyển sang Stage 3 |
| 3 — Edge scale-out | [3A — Peak audience arrives](livestream-flow3d-phases/phase-03a-peak-audience-arrives.md) | Đẩy lên peak 2,1 triệu và làm origin egress vượt capacity một node |
| | [3B — Scale out delivery edges](livestream-flow3d-phases/phase-03b-scale-out-delivery-edges.md) | Nhân bản tầng delivery; sở hữu phép tính aggregate bandwidth và cost |
| 4 — Global delivery | [4A — Add remote viewers](livestream-flow3d-phases/phase-04a-add-remote-viewers.md) | Relocate audience nhưng giữ nguyên total workload |
| | [4B — Add CDN edges](livestream-flow3d-phases/phase-04b-add-cdn-edges.md) | Route đến Edge gần nhất với cùng cache state |
| | [4C — Compare cold and warm cache](livestream-flow3d-phases/phase-04c-compare-cold-and-warm-cache.md) | Giữ topology cố định, đổi riêng cache state |
| 5 — Origin shield | [5A — Shorten the latency budget](livestream-flow3d-phases/phase-05a-shorten-the-latency-budget.md) | Rút ngắn cadence để giảm latency, và trả giá bằng origin fetch rate |
| | [5B — Add regional shield tier](livestream-flow3d-phases/phase-05b-add-regional-shield-tier.md) | Thêm shield tier và coalesce cùng segment/cache key |
| 6 — Interaction storm | [6A — Interaction burst](livestream-flow3d-phases/phase-06a-interaction-burst.md) | Làm outbound fan-out nghẽn trong khi accepted ingress còn an toàn |
| | [6B — Isolate interaction plane](livestream-flow3d-phases/phase-06b-isolate-interaction-plane.md) | Tách interaction khỏi room-control và tạo queue/backpressure boundary riêng |
| | [6C — Bound viewer presentation](livestream-flow3d-phases/phase-06c-bound-viewer-presentation.md) | Chọn Comment và aggregate Like nhưng giữ accepted-event audit |
| 7 — Money-safe events | [7A — Retry an internal coin gift](livestream-flow3d-phases/phase-07a-retry-a-coin-gift.md) | Làm lộ duplicate business effect khi response bị mất |
| | [7B — Persist one gift command](livestream-flow3d-phases/phase-07b-bind-gift-to-operation.md) | Scoped key/fingerprint và atomic Command Outbox tạo một operation |
| | [7C — Commit one ledger effect](livestream-flow3d-phases/phase-07c-deduplicate-ledger-consumption.md) | Hai queue delivery hội tụ tại Inbox + Ledger transaction |
| | [7D — Publish committed result](livestream-flow3d-phases/phase-07d-publish-committed-result.md) | Read model authoritative; UI notification tách khỏi commit |
| 8 — Long-tail efficiency | [8A — Add cold rooms](livestream-flow3d-phases/phase-08a-add-cold-rooms.md) | Khởi chạy mọi optional rung cho mọi active room và làm worker pool quá tải |
| | [8B — Promote demanded renditions](livestream-flow3d-phases/phase-08b-admit-demanded-renditions.md) | Warm từng rung theo sustained eligible demand/headroom |
| | [8C — Demote unused renditions](livestream-flow3d-phases/phase-08c-demote-unused-renditions.md) | Remove khỏi manifest, drain client rồi mới dừng encoder; đóng deck |

Stage 2 và Stage 3 là hai nấc tăng trưởng riêng biệt trên **cùng một núm**
viewers — nấc 25.000 và nấc 2,1 triệu. Stage 2 hỏi "shared resource/failure
boundary làm ba trách nhiệm ảnh hưởng nhau thế nào" và trả lời bằng isolation;
nó không được nói tách role tự sinh capacity, nên rời stage với `media` vẫn
`FAIL`. Stage 3 nhận đúng flag đó và hỏi "một tầng delivery duy nhất thì hỏng ở
đâu", rồi scale ngang nó. Mỗi nấc vẫn chỉ đổi đúng một workload input.

Bài học isolation-không-phải-capacity được lặp lại có chủ ý ở 6B trên
interaction plane, để người học nhận ra đây là một nguyên lý chứ không phải một
chi tiết của tầng media.

---

## 5. Persistent world

World được chia thành các region cố định:

```text
┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌──────────┐
│  SOURCE  │ → │  MEDIA CORE  │ → │  DELIVERY  │ → │ AUDIENCE │
└──────────┘   └──────────────┘   └────────────┘   └────┬─────┘
                                                       ├──↔ INTERACTION CORE
                                                       └──→ FINANCIAL CORE
```

### Subject

`Hero Live Room` là subject xuyên suốt câu chuyện. Viewer count là metric riêng
tăng từ 1 đến 2,1 triệu, không được nhúng vào room ID. Infrastructure đứng ở vị
trí cố định; camera pan có giới hạn giữa các region.

Media segment, comment và gift là các traffic class khác nhau trong cùng live
room. Không ép chúng thành cùng một token hoặc cùng một data path chỉ để giữ vẻ
ngoài “một flow”.

Lesson dùng hai scope có nhãn rõ ràng:

- **`hero-room`:** một room được theo dõi từ 1 đến peak 2,1 triệu Viewer.
  Stage 0–7 dùng scope này, liên tục và không gián đoạn.
- **`platform-fleet`:** cohort nhiều hot/cold room chỉ xuất hiện ở Stage 8 để
  giải thích resource admission. Hero room vẫn visible làm reference nhưng không
  được cộng vào fleet metric lần thứ hai.

Mọi HUD metric mang `scope` và `plane`. Không so sánh hoặc cộng `hero-room
viewers` với `platform-fleet activeRooms`. Plane chưa được pressure-test mang
verdict `UNTESTED`, không kế thừa `PASS` từ media plane.

### Component lifecycle

- World khai báo superset của kiến trúc ngay từ đầu.
- Mỗi component có lifecycle `inactive | active | retired | historical`;
  `hidden` chỉ là presentation flag.
- Component chưa dùng bắt đầu `inactive` và `hidden`. `show` bỏ presentation flag
  rồi chuyển nó sang `active`, vẫn giữ nguyên key ở các stage sau.
- Lifecycle còn được theo dõi theo responsibility. Một component vẫn `active`
  nếu còn giữ room-control/interaction dù media responsibility đã `historical`;
  capacity và flow chỉ tính các responsibility đang active.
- Khi mọi responsibility đã được tách, component chuyển `retired`; nếu vẫn được
  giữ visible/dimmed để so sánh lịch sử thì dùng lifecycle `historical` thay cho
  `retired`. Cả hai đều không còn active path hay capacity contribution.
- Không tạo `origin-v2`, `edge-new` hoặc một box mới để thay cho cùng một thứ.
- Scale-out instance là các “thing” thật khác nhau nên có thể có node riêng.
- Label chỉ mang `name + configuration`; issue/verdict dùng tone, badge, panel
  và HUD.

### Canonical component keys

Key là identity; label có thể đổi khi configuration/vai trò đổi. Hai chỗ dễ trôi
danh tính nhất được chốt ở đây:

| Key | Label theo media capability | Ghi chú identity |
|---|---|---|
| `origin` | `Media Relay/Origin` (fan-out, edge-scaled, global-cdn) → `Origin` (shielded trở đi) | Cùng một node, xuất hiện từ Stage 2. Đổi label khi Regional Shield Cache nhận phần relay; **không** tạo node mới |
| `edge-src` | `Delivery Edge Cluster\nN instances` | Aggregate cluster ở region gốc, xuất hiện từ Stage 3; model công khai cardinality và per-instance capacity |
| `edge-us`, `edge-eu` | `CDN Edge Cluster US/EU\nN PoPs` | Aggregate regional cluster **mới** ở Stage 4; mỗi cluster có nhiều Edge/PoP để Stage 5 có thể chứng minh `R < E` |
| `shield-*` | `Regional Shield Cache <region>` | Thêm ở Stage 5, giữ identity đến hết deck |
| `single-server` | `Single Livestream Server` | Không bao giờ bị xóa; các responsibility của nó chuyển `historical` riêng lẻ |

Stage 4 vì vậy là **replication**, không phải movement: `edge-src` vẫn phục vụ
Viewer ở region gốc trong khi `edge-us`/`edge-eu` được reveal cho audience đã
relocate. Các box Edge là aggregate component; label/HUD luôn nêu instance/PoP
count để không biến nhiều Edge thành một node giả.

### Canonical topology paths

Mỗi media capability có một active path duy nhất để panel, 3D flow và semantic
DOM cùng tham chiếu:

```text
MVP
  Streamer → Single Server → Viewer

Adaptive
  Streamer → Ingest role → Transcoder/Packager
           → Delivery role → Player-selected rendition

Isolated
  Streamer → Ingest → Transcoder/Packager
           → Media Relay/Origin → Viewer

Edge-scaled
  Streamer → Ingest → Transcoder/Packager
           → Media Relay/Origin → Delivery Edge → Viewer

Global
  Streamer → Ingest → Transcoder/Packager
           → Media Relay/Origin → CDN Edge → Viewer

Shielded media capability
  Streamer → Ingest → Transcoder/Packager
           → Origin → Regional Shield Cache → CDN Edge → Viewer
```

`Ingest role` và `Delivery role` ở Adaptive vẫn có thể cùng nằm trong Single
Server. Stage 2 đặt chúng vào deployment/resource boundary độc lập và công khai
capacity của từng boundary; đây là isolation, chưa phải horizontal scale. Stage
3 mới nhân bản tầng delivery thành nhiều node.

Interaction và money path là canonical path riêng, không nối vào media path.
Chúng cũng phải được panel, 3D flow và semantic DOM tham chiếu như nhau:

```text
Interaction plane — mvp đến shielded (`kind: metadata/control`)
  Viewer → Single Server.interaction → room subscribers

Interaction plane — isolated (`kind: metadata/control`)
  Viewer → Interaction Ingress → Per-room Partition/Queue
    → Naive Presentation Worker → Viewer

Interaction plane — split-plane (`kind: metadata/control`)
  Viewer → Interaction Ingress → Per-room Partition/Queue
    ├─ Comment decision + accepted-event audit → Selected Comments ┐
    └─ Windowed Like Aggregator → Counter Updates                  ├→ Regional
                                                                   │  Fan-out
                                                                   │  Gateways
                                                                   └→ Viewer
                                                                      presentation

Financial plane — naive (Stage 7A, `kind: money`)
  Viewer → Gift API → Coin Handler → Ledger
                                   └→ UI Gift Effect

Financial plane — idempotent command (`kind: money`)
  Viewer → Gift API
    → Operation [PENDING|COMMITTED|REJECTED] + Command Outbox (atomic)

Financial plane — ledger-safe (`kind: money`)
  Command Outbox → Durable Queue (at-least-once)
    → Consumer transaction [Inbox operationId unique + Ledger + Committed Result Outbox]
        └─ Ledger → Reconciliation

Financial plane — money-safe (`kind: money`)
  Committed Result Outbox → Operation/Read Model
    → Notification/Presentation with operationId → UI Gift Effect
```

Gift command, deduplication và Ledger không đi qua best-effort Viewer
presentation. Post-commit notification/UI effect có thể dùng presentation
transport best-effort hoặc at-least-once với operation ID để client deduplicate;
mất hoặc lặp UI pulse không đổi Ledger truth.

### Camera

- Stage 0–3 tập trung SOURCE và MEDIA CORE.
- Stage 4–5 mở rộng sang DELIVERY/AUDIENCE.
- Stage 6 pan xuống INTERACTION CORE. Stage 7 dùng preset riêng cho FINANCIAL
  CORE; media path vẫn nhìn thấy ở background nhưng money token không chạy trên
  metadata lane.
- Stage 8 dùng góc rộng để thấy nhiều room nhưng không render từng room.
- Camera dùng preset cố định theo chapter; orbit tự do không phải control mặc
  định. Latency waterfall, transaction trace và hysteresis graph dùng HTML/SVG
  overlay thay vì cố ép vào không gian 3D.

### Pressure rail (normative)

Mọi issue phase đều là "vặn một núm". Deck hiển thị một dãy núm cố định, luôn
nhìn thấy, để người học biết biến nào đang đổi và biến nào đứng yên:

| Núm | Stage | Giá trị chạy qua deck |
| --- | --- | --- |
| network | 1A | 6 Mbps source → 1,2 Mbps throughput |
| viewers | 2A, 3A | 1 → 25.000 → 2.100.000 |
| distribution | 4A | local → local + US + EU (total không đổi) |
| latency budget | 5A | 6,0 s segment → 0,2 s part |
| interaction rate | 6A | baseline → 40.000 attempted/s |
| retry | 7A | response mất sau commit → client gửi lại |
| rooms | 8A | → 40.000 concurrent cold room |

Núm đã vặn giữ nguyên giá trị ở các phase sau trừ khi phase công khai đổi nó.
Núm chưa vặn hiển thị rõ là chưa vặn — đó là cách deck nói "plane này vẫn
`UNTESTED`" mà không cần một câu giải thích.

### Trình bày issue và fix (normative)

- Issue phase: capacity container **tràn** vật lý (overflow visual), không chỉ
  đổi màu badge. Số vượt hiển thị dưới dạng bội số, không chỉ dấu đỏ.
- Fix phase: mặc định mở split-screen ghost — cùng camera, cùng `workloadId`,
  cột trái snapshot của issue phase, cột phải phase hiện tại. Người học không
  phải bật gì để so sánh.
- Fix phase nêu **invariant flip có tên**: `<invariantId> FAIL → PASS`. Invariant
  chưa giải quyết được ghi `FAIL → FAIL (chuyển sang <phase>)` chứ không biến
  mất khỏi HUD.
- Plane chip chỉ hiện những plane đang có ít nhất một verdict khác `UNTESTED`,
  hoặc khi từ hai plane trở lên đã sống. Ba chip `UNTESTED` cạnh nhau ở Stage 0
  chỉ là nhiễu.

### Scope transition ở Stage 8

Stage 8 là lần duy nhất forward navigation rời `hero-room`. Việc chuyển scope
phải hiển thị, không được ngầm:

- Vào Stage 8A, camera pull-back tường minh từ hero room ra fleet view; hero room
  vẫn visible và được đánh dấu là reference, không dimmed thành scenery vô danh.
- HUD đổi scope banner từ `SCOPE: hero-room` sang `SCOPE: platform-fleet` như một
  thay đổi rõ rệt, không phải một dòng phụ.
- Panel 8A mở bằng một câu nói thẳng rằng lesson rời hero room để nhìn cả nền
  tảng; panel 8C đóng deck ở scope này.
- Forward flow không tự push-in trở lại `hero-room`. Tuy nhiên Back từ 8A về 7D
  phải đảo transition, khôi phục camera, scope banner, metric và focus của
  `hero-room` một cách deterministic.

Semantic DOM phải phát ra transition này bằng text.

---

## 6. Model contract

Model là nguồn duy nhất của mọi domain value trong panel, label và HUD. Mỗi
snapshot được key theo `phaseId`, `workloadId` và hash của structured
`architecture`; không key theo một generation scalar. Issue/fix của cùng stage
phải dùng chung `workloadId`.

```js
const DEFAULT_CONFIG = Object.freeze({
  heroRoom: {
    averageBitrateMbps: 2,
    sourceBitrateMbps: 6,
    renditionLadderMbps: [6, 3, 1.5, 0.8],
    peakViewers: 2_100_000,
    durationSeconds: 3_600
  },
  networkProfiles: {
    good: { estimatedThroughputMbps: 12, rttMs: 30 },
    constrained: { estimatedThroughputMbps: 1.2, rttMs: 180 }
  },
  deliveryCostPerGBUsd: 0.01,
  // Capacity, cache, fleet, interaction và money inputs còn lại là
  // planning assumptions có provenance record; không phải production fact.
});
```

Con số minh họa trong config vẫn là planning assumption. Implementation có thể
chọn giá trị khác, nhưng phải giữ các quan hệ/invariant của lesson.

`simulate(config, phaseDefinitions)` trả về snapshot bất biến:

```js
{
  phases: [{
    phaseId,
    stageId,
    scope,              // hero-room | platform-fleet
    workloadId,
    architecture: {
      media,            // mvp | adaptive | isolated | edge-scaled | global-cdn | shielded
      interaction,      // mvp | isolated | split-plane
      financial,        // absent | naive | idempotent-command | ledger-safe | money-safe
      fleetPolicy       // transcode-all | per-rung-on-demand
    },
    testedPlanes,
    planeVerdicts: {    // UI renders status uppercase
      media: {status, testedScope, testedByWorkloadId, reason},
      interaction: {status, testedScope, testedByWorkloadId, reason},
      financial: {status, testedScope, testedByWorkloadId, reason},
      fleet: {status, testedScope, testedByWorkloadId, reason}
    },                  // status: pass | fail | untested
    replayOfPhaseId,    // fix phase points to its issue phase
    causalContract: {
      primaryClaim,
      changedInput,     // exactly one in an issue phase
      heldConstantInputs,
      affectedPlane,
      capacityBoundary,
      latencyTarget,
      consistencyRequirement,
      failureAssumptions,
      invariantIds
    },
    canonicalPaths,
    visibleKeys,
    componentLifecycle,
    metrics,
    requirementsByPlane,
    invariantResults,
    bottlenecksByPlane,
    provenanceIds
  }],
  provenance: [{
    id,
    value,
    unit,
    evidenceClass,      // observed | unverified-source-note | estimated | illustrative
    derivationClass,    // input | derived
    sourceRef,          // heading/URL or input id
    formula,
    inputProvenanceIds
  }]
}
```

### Workload schedule và invariant

| Stage | Scope/workload | Issue thay đổi | Fix phải replay và chứng minh |
|---|---|---|---|
| 0 | `hero-happy-path` | Không có pressure | Uplink, join/downlink và interaction đúng lane/chiều |
| 1 | `hero-constrained-network` | Chỉ đổi network profile | Player chọn rendition có headroom; buffer occupancy phục hồi |
| 2 | `hero-growing-audience` | Chỉ tăng Viewer đến `growthViewers` | Publisher uplinks vẫn `1`; role được đặt vào resource boundary độc lập có capacity công khai; shared-resource interference biến mất nhưng chưa claim horizontal scale |
| 3 | `hero-peak-fanout` | Chỉ tăng Viewer đến peak 2,1 triệu | Ingest/transcode không đổi theo viewer count; delivery scale ngang, egress/edge trong capacity |
| 4 | `hero-global-audience` | Chỉ đổi audience distribution | Total Viewer/bitrate giữ nguyên; viewer-to-serving-edge path ngắn hơn |
| 5 | `hero-latency-budget` | Chỉ đổi segment/part cadence | Origin fetch rate tỉ lệ nghịch với cadence; shield coalesce theo region để giữ latency đã mua mà không vượt origin capacity |
| 6 | `hero-interaction-fanout` | Chỉ tăng attempted event rate; accepted/rate-limited là derived | Presentation demand và accepted-event audit trong capacity, queue age phục hồi, room-control/media không đổi |
| 7 | `hero-donation-retry` | Chỉ retry cùng idempotency key | Delivery có thể at-least-once; ledger effect commit đúng một lần |
| 8 | `fleet-room-mix` | Chỉ thêm cold-room cohort vào transcode-all | Per-rung admission giữ target-profile baseline, warm theo demand/headroom và drain an toàn khi demote |

Stage 2 và Stage 3 là hai workload khác nhau nên **không** so sánh chéo. Mỗi
stage chỉ replay đúng workload của issue phase trong nó. Stage 2B reveal hai
single-instance deployment boundary với capacity budget/provenance riêng. Ở
workload Stage 2, delivery **vẫn** vượt budget (50 > 40 Gbps) nên `media` giữ
`FAIL`; chỉ `interaction` (room control) flip sang `PASS` vì nó đã rời khỏi
node quá tải. Badge ghi `ISOLATED · SINGLE INSTANCE · DELIVERY CAPACITY
UNRESOLVED`, và flag `deliveryEgressWithinCapacity` được chuyển sang Stage 3 —
đó là chỗ duy nhất sở hữu horizontal scale.

Stage 1 tách `networkQueueDelay`, `playbackBufferSeconds` và
`stallDurationSeconds`.

Stage 3 phải phát ra `aggregateBandwidthMbps`, `transferredGB` và
`estimatedDeliveryCostUsd` như derived record, dùng chung ở cả issue và fix
snapshot. Đây là nơi lesson **giới thiệu** phép tính `viewers × averageBitrate`;
không để công thức chỉ tồn tại trong report. Đặt ở Stage 3 vì đây là lúc hero
room chạm peak, nên con số minh họa khớp với planning table. Các stage sau tái
sử dụng chính ba record đó khi unit price hoặc topology đổi.

Mọi giá trị illustrative phải được chốt thành số cụ thể trong world, không để ở
dạng ký hiệu `E`, `V`, `I` trong copy mà người học nhìn thấy. Chuỗi số xuyên
suốt deck: source bitrate 6 Mbps · ladder `[6 · 3 · 1,5 · 0,8]` Mbps · node
egress 40 Gbps · connection 60.000 · average delivered 2 Mbps · viewers
1 → 25.000 → 2,1 triệu · 120 edge · 3 shield region · origin fetch capacity
1.500/s · accepted interaction 2.000/s · gift 500 coin · 40.000 room.

Stage 4 dùng cùng key `viewerToServingEdgeRttMs` trước/sau, đồng thời tách
`timeToFirstFrameMs`, `rebufferRatio` và `steadyStateGlassToGlassLatencyMs`; RTT
không được dùng thay cho playback latency. Model phát hai ordered timestamp
trace:

```text
joinRequestedAt <= manifestReceivedAt <= firstSegmentDownloadedAt
  <= firstFrameRenderedAt

capturedAt <= encodedAt <= packagedAt <= originReadyAt
  <= edgeReadyAt <= downloadedAt <= renderedAt

timeToFirstFrameMs = firstFrameRenderedAt - joinRequestedAt
steadyStateGlassToGlassLatencyMs = renderedAt - capturedAt
```

Cả 4A và 4B hiển thị cùng waterfall với cache state được giữ cố định; 4C mới đổi
riêng cold/warm. Model từ chối timestamp đảo thứ tự và chỉ cho phép fix thay đổi
đoạn path mà nearest-edge routing/cache state thực sự tác động. Không cộng nguyên
GOP/segment duration như các bước chắc chắn tuần tự; không mặc định upstream
propagation giảm.

Stage 5 tính request rate theo active rendition/cache key:

```text
originFetchRate = Σ edgesRequesting(key) / cadence(key)
shieldedFetchRate = Σ shieldsRequesting(key) / cadence(key)
```

Nếu choreography theo đúng một key thì HUD và verdict phải ghi `per-key`; không
được suy capacity toàn Origin từ per-key rate của một key.

Stage 5 phải phát biểu cache miss như **bản chất của live**, không phải sự cố
được dàn dựng: mọi segment vừa sinh ra đều cold ở mọi Edge và không bao giờ được
xin lại. Biến duy nhất Stage 5A vặn là `segmentDurationSec`/part cadence, và
deck phải hiển thị đồng thời hai chiều của trade — glass-to-glass giảm, origin
fetch rate tăng theo đúng tỉ lệ nghịch. Không được trình bày rút ngắn latency
như một cải thiện thuần lợi.

Stage 6 tách `attemptedEventsPerSecond`, `acceptedEventsPerSecond` và
`rateLimitedEventsPerSecond`, rồi tách accepted ingress với
`outboundDeliveriesAttemptedPerSecond` và `outboundDeliveriesDeliveredPerSecond`.
Fix Stage 6 chỉ pass khi accepted-event `auditAppendRate <= auditCapacity`, presentation demand
không vượt regional gateway capacity, queue age trở lại SLO và quality floor cho
selected Comment/counter freshness vẫn đạt.
Stage 7 tách `deliveryAttempts` với `committedLedgerEffects`.

Stage 2–5 chỉ pressure-test media plane. Interaction/financial verdict ở các
stage đó là `UNTESTED`, dù media `PASS`. Stage 6 công khai interaction event rate
là workload mới; không mô tả đây là overall bottleneck vừa xuất hiện sau khi cả
hệ thống đã được chứng minh healthy.

Khoảng lặng đó phải **nhìn thấy được**, không phải im lặng. Từ 3B trở đi, mỗi
khi media scale thêm một bậc, deck nhắc lại rằng tầng connection/control vẫn nằm
trên đúng một node với toàn bộ audience treo trên đó và vẫn `UNTESTED`. 6A mở
bằng chính khoản nợ này. Người học không được phép suy ra "scale media xong là
scale cả hệ thống".

Stage 8 đổi scope sang `platform-fleet`, nên media/interaction/financial ở current
scope trở lại `UNTESTED`; các `PASS` của `hero-room` chỉ hiện trong reference
column kèm `testedScope/testedByWorkloadId`, không được dùng làm fleet verdict.

### Provenance

Provenance dùng hai taxonomy độc lập:

- **`evidenceClass`:** `observed`, `unverified-source-note`, `estimated` hoặc
  `illustrative`.
- **`derivationClass`:** `input` hoặc `derived`.

Record `observed` phải trỏ URL/timecode hoặc evidence tương đương. Input phục vụ
lesson như capacity, threshold, bitrate, RTT, cache hit ratio và price hiện badge
`ASSUMPTION` nếu chưa observed. Record `derived` phải có formula và
`inputProvenanceIds`; không giấu rate hay benchmark trong choreography.

Các record tối thiểu của v1:

| id | value | evidenceClass | derivationClass | sourceRef |
|---|---:|---|---|---|
| `hero-peak-viewers` | 2.100.000 Viewer | `unverified-source-note` | `input` | `livestream-architecture.md#5-planning-estimate-cho-21-trieu-viewer` |
| `average-delivered-bitrate` | 2 Mbps/Viewer | `illustrative` | `input` | cùng planning table; chưa có production telemetry |
| `delivery-rate` | USD 0,01/GB | `illustrative` | `input` | cùng planning table; chưa có provider/date |
| `aggregate-bandwidth` | 4,2 Tbps | `illustrative` | `derived` | formula và hai input provenance IDs |

Không ghi claim của source note thành production fact nếu chưa có provenance
xác minh. Khi source và lesson clarification khác nhau, panel dùng clarification
và giữ source claim trong note provenance.

### Công thức planning

Với giả định trung bình `2 Mbps/viewer`:

```text
aggregate bandwidth
  = 2,100,000 × 2 Mbps
  = 4,200,000 Mbps
  = 4.2 Tbps

data per hour
  = 4.2 Tbps × 3,600 seconds ÷ 8
  ≈ 1.89 million GB (decimal)

delivery cost at $0.01/GB
  ≈ $18,900/hour
```

Đây là planning model, không phải giá TikTok hoặc benchmark production đã được
xác minh. Bitrate, overhead, cache efficiency và commercial pricing đều có thể
làm kết quả thực tế thay đổi.

Không suy ra “hàng tỷ request mỗi giây” chỉ từ 2,1 triệu viewer. Interaction
load phải được tính từ một input riêng như `eventsPerViewerPerSecond`.

---

## 7. HUD và feedback

HUD mặc định chỉ hiện ba hàng để người học nhìn issue mà không phải đọc dashboard:

1. `CHANGED` — input vừa thay đổi.
2. `BOUNDARY` — capacity/SLO/invariant boundary đang xét.
3. `RESULT` — plane verdict hoặc before/after khi replay.

Các metric chi tiết nằm trong disclosure `Why?`, vẫn dùng cùng vocabulary:

| Nhóm | Metric |
|---|---|
| Audience | concurrent viewers, regions, network class |
| Media | selected rendition, aggregate bandwidth, dropped segments |
| Origin | capacity utilization, upstream fetches per segment |
| Transcoding | worker utilization, active rendition ladders |
| Interaction | ingress events/s, fan-out amplification, selected/delivered ratio |
| Money | queue deliveries, duplicate attempts, committed business effects |
| Cost | aggregate bandwidth, transferred GB và estimated delivery cost |
| Latency trace | captured, encoded, packaged, origin-ready, edge-ready, downloaded, rendered |

**Cost** được giới thiệu ở Stage 3 (3A và 3B) rồi mở lại ở mọi phase mà kiến
trúc đổi giá: 4B (CDN đắt hơn egress tự vận hành), 5B (thêm shield tier) và
Stage 8 (encoder pool). Cost không bị khóa riêng cho một stage — mỗi fix có hóa
đơn của nó và deck phải cho thấy. **Latency trace** xuất hiện ở Stage 4 (4A, 4B
và 4C) và Stage 5A khi cadence đổi. Cả hai luôn mang badge `ASSUMPTION` vì mọi
input đều là planning assumption.

Scoreboard ba số — viewers (hoặc rooms ở `platform-fleet`), cost/h và worst
plane verdict — hiển thị liên tục ở mọi phase, kể cả khi giá trị không đổi.
Người học phải luôn đọc được "đang ở đâu, tốn bao nhiêu, cái gì đang hỏng" mà
không mở panel nào.

Mỗi issue phase chỉ highlight metric gây ra verdict. HUD luôn cho biết `scope`,
`plane`, `workloadId`, SLO đang xét và provenance badge. Mọi giá trị hiển thị
phải trỏ được về một `provenanceId` trong cùng snapshot. Fix phase hiển thị delta
với issue snapshot cùng workload, không so sánh hai workload khác nhau.

Visual vocabulary giữ nguyên xuyên suốt deck:

| Meaning | Visual |
|---|---|
| Media | Ribbon liên tục; source không biến mất khi fan-out |
| Control | Hollow pulse one-shot |
| Comment/Like | Dot bundle có `×N`; hai event dùng shape khác nhau |
| Money | Token có operation ID/fingerprint; retry thêm attempt number |
| Ledger commit | Một immutable seal độc lập với UI pulse |
| Capacity | Viền container + demand/capacity gauge |
| Aggregate | Nhiều token co thành bundle có ratio |
| Before/after | Ghost overlay cùng camera, workload và unit |
| Assumption | Text badge + provenance; không chỉ màu |

---

## 8. Tương tác và phạm vi v1

### V1

- Next, Back và Replay.
- Persistent architecture và bốn capability rail được reveal theo phase.
- Tone/badge chỉ ra bottleneck và verdict.
- Một Predict cho mỗi issue Stage 1–8 và một recap ở cuối bốn chapter; không có
  Inspect/Explain gate lặp lại ở mọi stage.
- HUD cho before/after comparison cùng workload/SLO.
- Focus/click mở giải thích vai trò component; hover chỉ là enhancement.
- Deterministic state khi đi Next/Back.
- Chapter/phase nav dùng `aria-current="step"`; URL hash deep-link phase hiện tại
  và Back/Forward browser khôi phục cùng snapshot/camera.
- Semantic DOM luôn tồn tại và đồng bộ, không chỉ xuất hiện khi WebGL lỗi. Nó
  hiển thị canonical path, state change, metric/SLO, verdict và cùng checkpoint
  như 3D path; canvas là progressive enhancement.

### Stretch goal

- Network-quality selector.
- Viewer/load dial.
- Per-rung demand/device/network/QoE presets và encoder-headroom control.
- Event-rate control cho comment và internal coin gift.
- Multi-run compare cho các workload do người học tự chỉnh.

Không đưa slider tự do vào v1. Nó làm tăng đáng kể số tổ hợp state, yêu cầu
recompute model, replay choreography và regression tests.

### Ngoài phạm vi

- Chi tiết codec/encoding profile.
- DRM, recording và video-on-demand.
- Multi-CDN routing strategy.
- Chi tiết autoscaling implementation.
- Redundancy, failover và hành vi khi một region, queue consumer hoặc ledger
  dependency không khả dụng.
- N+1 capacity planning, target utilization headroom và geographic skew.
- Data residency và compliance routing.
- Moderation model và blacklist implementation.
- Billing hoặc wallet schema hoàn chỉnh.
- Mô phỏng hàng triệu particle/viewer thật.

DRM, recording/VOD và multi-CDN phụ thuộc product/topology, không phải yêu cầu
phổ quát. Các khoảng trống production quan trọng của deck là redundancy,
failover/recovery, N+1 headroom, target utilization, geographic skew và data
residency. Kiến trúc cuối deck là kết quả của một chuỗi bài học, **không** phải
thiết kế production-ready. Stage 7D nêu giới hạn money invariant; Stage 8C đóng
toàn deck bằng giới hạn overall readiness.

---

## 9. Accessibility và performance

- Tôn trọng `prefers-reduced-motion`; trạng thái cuối và explanation vẫn đầy đủ.
- Next/Back/Replay phải dùng được bằng keyboard.
- Panel thay đổi được thông báo bằng `aria-live` phù hợp, không đọc lại toàn bộ
  world.
- Tone không phải tín hiệu duy nhất; luôn có badge/text verdict.
- Predict/Chapter recap dùng native form controls, có label, focus order và
  feedback text. Không bắt buộc hover
  hay chọn object 3D.
- Semantic DOM luôn present và liệt kê active canonical path theo thứ tự,
  component lifecycle, changed input, SLO và invariant result. Nó là lesson
  path đầy đủ, không phải fallback chỉ mount khi WebGL lỗi.
- Không render một node cho mỗi viewer, room hoặc comment.
- Dùng audience cluster, event bundle và HUD để biểu diễn scale.
- Chỉ focus các component liên quan đến phase hiện tại để tránh spaghetti
  diagram và caption quá nhỏ.
- Flow animation chạy one-shot khi phase bắt đầu; không auto-loop gây phân tâm.
  Replay là thao tác chủ động. Ordered trace dài hơn 600 ms có Play/Pause,
  Previous/Next beat, Replay và Skip.

---

## 10. Success criteria

Concept được xem là truyền đạt thành công khi người học có thể:

1. Mô tả được happy path của một Streamer, một Livestream Server và một Viewer,
   bao gồm media uplink, media downlink, join và interaction event.
2. Giải thích vì sao transcoding và CDN giải quyết hai vấn đề khác nhau.
3. Giải thích vì sao tách Ingest khỏi delivery cho phép scale delivery độc lập
   trong khi publisher uplink vẫn giữ đúng một, và vì sao tách role thôi chưa đủ
   nếu tầng delivery chưa được nhân bản.
4. Nhận ra CDN có thể chuyển bottleneck về Origin nếu thiếu shield/cache
   coalescing.
5. Giải thích vì sao luôn transcode mọi cold stream là lãng phí.
6. Phân biệt media plane, best-effort interaction và money-safe event path.
7. Tính được aggregate bandwidth từ viewer count và average bitrate.
8. Nhận ra mọi số capacity/cost trong lesson là assumption của model, không phải
   production fact mặc định.
9. Phân biệt `PASS`, `FAIL` và `UNTESTED` theo plane; media healthy không có
   nghĩa toàn hệ thống production-ready.

### Learning validation

- Mỗi Stage 1–8 có đúng một Predict ở issue phase. Chỉ 1B, 5B, 7D và 8C có thêm
  một chapter recap; toàn deck có đúng 12 prompt. Stage 0 không có prompt.
- Câu trả lời sai vẫn cho phép tiếp tục sau khi hiện rationale; lesson không
  biến thành bài thi.
- Khi Back/Replay, cùng input sinh cùng prompt order, selected state, metric và
  rationale.
- Một lượt moderated smoke test đạt khi người học có thể dùng before/after evidence
  để giải thích đúng invariant của từng stage, không chỉ nhắc lại tên component.
- 3D path, reduced-motion path và semantic DOM phải đưa tới cùng verdict và
  cùng câu trả lời giải thích.

### Validation cho implementation tương lai

- Tất cả 24 phase chạy được bằng Next/Back/Replay mà không lỗi console.
- Storyboard có 9 stage/24 phase; mỗi Next đúng một causal claim. Ordered beat
  bên trong phase chỉ là evidence của claim đó và có playback controls khi dài
  hơn 600 ms.
- World không bị teardown giữa các stage.
- Component giữ nguyên identity khi kiến trúc tiến hóa.
- Component `historical` không có active flow và không được tính vào capacity.
- Mọi số trong panel, label và HUD lấy từ cùng model result.
- Mọi metric hiển thị trong HUD trỏ được về một `provenanceId` trong cùng
  snapshot; không có giá trị nào không có provenance record.
- Component key không đổi khi label đổi; `origin` và `edge-src` giữ nguyên key
  qua mọi media capability, `edge-us`/`edge-eu` là node mới chứ không phải `edge-src`
  được move.
- Forward scope chỉ đổi ở Stage 8A; Back về 7D đảo transition và khôi phục
  `hero-room` deterministic.
- Latency timestamp của Stage 4 giữ đúng thứ tự ở 4A/4B/4C; derived durations lấy
  từ timestamp, không cộng hard-code GOP/segment/RTT.
- Stage 3 hiển thị `aggregateBandwidthMbps` cùng derived cost, có formula và
  `inputProvenanceIds`; tổng aggregate bandwidth không đổi giữa 3A và 3B.
- Issue và fix không nằm trong cùng một phase.
- Mọi issue/fix pair dùng cùng `workloadId`; diff chỉ đến từ đúng capability
  trong structured `architecture` và các derived state liên quan.
- Reduced-motion path vẫn truyền đạt đủ issue, fix và verdict.
- Semantic DOM hoàn thành được toàn bộ Predict/recap bằng keyboard và luôn có
  mặt dù WebGL hoạt động.
- Media, metadata và money event không bị mô tả sai thành cùng một transport.
- Best-effort delivery không được mô tả là exactly-once; money-safe path chỉ cam
  kết exactly-once effect tại ledger boundary.
- Plane chưa được pressure-test giữ `UNTESTED`; overall readiness không vượt quá
  evidence của từng plane.
- Stage 5 tính origin/shield fetch rate trên active rendition keys hoặc ghi rõ
  verdict chỉ là per-key.
- Stage 8 admission theo từng rendition rung; không đồng nhất room popularity
  với nhu cầu mọi rung hay baseline với compatibility phổ quát.

---

## 11. File architecture dự kiến

Nếu concept được chuyển thành implementation, deck mới có thể dùng cấu trúc:

```text
livestream-flow-3d/
├── livestream-flow-3d.html
├── livestream-flow-3d-deck.js
├── livestream-flow-3d-layout.js
├── livestream-flow-3d-scenarios-index.js
├── livestream-flow-3d-scenario-evolution-model.js
├── livestream-flow-3d-scenario-evolution-world.js
├── livestream-flow-3d-scenario-evolution-steps-media.js
├── livestream-flow-3d-scenario-evolution-steps-fleet.js
├── livestream-flow-3d-scenario-evolution-steps-interaction-money.js
└── livestream-flow-3d-scenario-evolution.js
```

Chỉ có một scenario `evolution`. Steps được tách theo arc ngay từ đầu — 24 phase
trong một file chắc chắn vượt giới hạn 200 dòng:

| File | Phase |
|---|---|
| `steps-media` | 0A–5B, gồm 0C và 4C |
| `steps-interaction-money` | 6A–7D |
| `steps-fleet` | 8A–8C |

Model cũng nên tách nếu vượt 200 dòng (ví dụ `-model-media`, `-model-fleet`,
`-model-interaction-money` cùng một `simulate()` entry point). Không tách thành
nhiều scenario chỉ vì có nhiều stage.

---

## 12. Next step

Sau khi report được duyệt:

1. Chốt wording và planning assumptions của model.
2. Vẽ world layout với vị trí/key cụ thể cho từng component.
3. Viết implementation plan theo từng file.
4. Chỉ sau đó mới triển khai HTML/JS và QA toàn bộ 24 phase.
