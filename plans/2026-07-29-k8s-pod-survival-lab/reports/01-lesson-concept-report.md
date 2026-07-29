# UI/UX concept report — Kubernetes Pod Survival Lab

**Status:** Enhanced — animation-first direction + selective Three.js evaluation
**Source:** `k8s-pod-evaluation.md`  
**Target:** Một HTML experience có thể chơi, không phải bản render lại report  
**Recommended direction:** Playable incident control room  
**Working title:** **One Pod, Three Judges**

## 1. Executive decision

Không hiển thị tuần tự toàn bộ 13 mục kiến thức và không tổ chức lesson như một bài đọc có thêm widget.

Experience sẽ mở bằng một Pod biến mất, sau đó để người học **điều khiển, gây sự cố, xem hậu quả, tua lại và thử phương án khác**. Kiến thức chỉ xuất hiện sau hành động để giải thích điều vừa xảy ra.

> **Animation là kênh giải thích chính. Interaction là cách học chính. Text chỉ là lớp hỗ trợ.**

Người học theo một **Pod capsule** xuyên suốt bốn playable scene:

1. Decision Switchboard — xác định engine đang cầm quyền.
2. Scheduler Run — filter, score và preemption trong cùng một đường chạy.
3. Memory Survival Arena — node pressure và OOM trong một sandbox liên tục.
4. Protection Run + DOKS Finale — thử shield, cấu hình cluster và xem incident replay.

Three.js không trở thành renderer mặc định cho toàn lesson. Đề xuất dùng một **progressive 3D layer có chủ đích** ở Memory Survival Arena, nơi chiều sâu giúp nhìn rõ process nằm trong container cgroup, các container được nhóm logic thành Pod và tất cả cùng nằm trên node; DOKS Finale chỉ tái sử dụng renderer này nếu performance spike đạt budget. Pod phải được ghi rõ là grouping/lifecycle unit trong visualization này, không bị vẽ như một OOM enforcement boundary riêng. Scheduler rail, switchboard, comparator trace và protection routing vẫn dùng HTML + inline SVG vì chúng cần đọc chính xác, scrub dễ và có keyboard path mạnh hơn.

Thông điệp duy nhất xuyên suốt:

> **One Pod. Three judges. Different rulebooks.**

Đây phải là một simulation có nhịp, phản hồi tức thì và khoảnh khắc “à, ra vậy”; không phải một technical report được làm đẹp.

## 2. Experience priority và content budget

Mọi quyết định thiết kế được xếp theo thứ tự:

1. **Direct interaction** — người học chạm vào hệ thống và thay đổi outcome.
2. **Causal animation** — UI biểu diễn rõ input nào dẫn tới quyết định nào.
3. **Immediate feedback** — outcome, comparator và sai lầm được phản hồi tại chỗ.
4. **Replay và comparison** — cho phép thử lại để thấy khác biệt giữa hai cấu hình.
5. **Knowledge on demand** — giải thích, edge case và citation chỉ mở khi cần.

Ngân sách trải nghiệm mục tiêu:

| Thành phần | Tỷ trọng thời gian | Quy tắc |
|---|---:|---|
| Manipulate + predict | 35–45% | Scene không được chạy nếu người học chưa đưa ra lựa chọn hoặc thay đổi input |
| Observe + replay | 30–40% | Mỗi outcome quan trọng phải có animation nguyên nhân–kết quả |
| Feedback ngắn | 10–15% | Tối đa 1 takeaway và 1 comparator trace trên viewport |
| Đọc sâu | ≤ 10% core path | Đặt trong drawer/reference console, không chặn tiến trình |

Content ceiling cho mỗi scene:

- Người học phải thực hiện action đầu tiên trong vòng 15 giây.
- Không có đoạn mở đầu dài hơn 60 từ.
- Không dạy quá 1 mental model chính trong một round.
- Không hiển thị quá 2–3 hot control cùng lúc; control còn lại dùng preset hoặc unlock theo round.
- Không mở sẵn bảng kiến thức lớn.
- Mỗi đoạn giải thích phải trả lời trực tiếp câu hỏi: **“Tại sao animation vừa chọn outcome này?”**

Interaction KPI cho core run:

- Mỗi round kéo dài khoảng 20–45 giây trước khi replay hoặc chuyển round.
- Mỗi scene có ít nhất một failure branch và một counterfactual `change one variable`.
- Undo/reset phản hồi ngay, không reload page.
- Core path có ít nhất 12 thao tác tạo hậu quả rõ ràng, không tính scroll hoặc mở drawer.

## 3. Learning outcomes theo hành vi

Sau lesson, người học phải có thể thực hiện được bốn hành động quan sát được:

- Nhìn symptom và route Pod tới đúng decision engine.
- Thay đổi một input để cố ý làm Pod chuyển từ `Pending` sang `Scheduled`, từ `Survive` sang `Evicted`, hoặc từ `Running` sang `OOMKilled`.
- Dự đoán victim trước khi chạy simulation và giải thích outcome bằng comparator trace.
- Tạo một cấu hình cluster cân bằng placement, pressure survival, OOM resilience và maintenance safety.

Không yêu cầu người học nhớ toàn bộ plugin, threshold hoặc edge case. Những phần đó là reference có thể mở lại sau.

## 4. Audience, prerequisite và session length

**Audience:** DevOps, SRE, platform engineer đã biết Pod, node, request và limit ở mức cơ bản.

**Không yêu cầu:** scheduler plugin internals hoặc Linux OOM scoring chi tiết.

**Thời lượng mục tiêu:**

- Core run: 12–16 phút; dùng một run bắt buộc mỗi scene và một counterfactual tại Memory Arena.
- Full run với alternate outcome, retry và reference drawer: 22–30 phút.
- Một scene có thể replay độc lập trong 2–4 phút.

## 5. Bold visual direction

### Industrial arcade control room

Giữ visual identity hiện có của site — nền kỹ thuật tối/sáng, acid green, cyan, orange, red, line grid — nhưng tăng cảm giác **tactile control panel**:

- Pod capsule là actor chính, luôn có quán tính và trạng thái vật lý rõ.
- Rail, gate, gauge, radar và shield tạo thành một sân khấu schematic duy nhất.
- Control có cảm giác nhấn, gạt, kéo và khóa; không dùng card dashboard chung chung.
- Typography ít nhưng có tương phản lớn: nhãn mono kỹ thuật + headline display mạnh.
- Không dùng emoji làm icon; dùng một bộ inline SVG nhất quán.
- Không dùng claymorphism trẻ em, font hoạt hình hoặc purple gradient mặc định dù đây là sản phẩm giáo dục; audience là kỹ sư và site đã có ngôn ngữ industrial riêng.

### Visual memory

Người học cần nhớ một hình ảnh sau khi rời bài:

> Một Pod capsule chạy qua ba cỗ máy; mỗi máy bật một rulebook khác và làm các thuộc tính không liên quan tối đi.

### Decision-path identity

| Engine | Màu + shape | Chuyển động đặc trưng | Quyết định |
|---|---|---|---|
| Scheduler | Cyan, gate vuông, đường blueprint | Scan → gate close/open → rail switch | Place / Pending / Preempt |
| Kubelet eviction | Orange, gauge và heat band | Pressure rise → reclaim pulse → candidate sort | Reclaim / Evict |
| Kernel/cgroup OOM | Red, radar tròn và clamp | Allocation pulse → score lock → hard cut | Kill process |
| Protection routes | Acid green, shield và route | Shield intercept hoặc bị xuyên qua | Block / tolerate / terminate |

`Protection routes` là supporting scene, **không phải judge thứ tư**. Nó gom các hazard để luyện chọn protection, nhưng animation phải luôn ghi rõ decision path thật sự như Eviction API, taint manager, kubelet probe hoặc deletion lifecycle; không được mô tả tất cả như một engine chung.

Màu không được là tín hiệu duy nhất. Mỗi engine luôn có label, icon SVG, shape và trạng thái bằng chữ.

### Token và typography contract

- Giữ palette hiện có nhưng dùng semantic token: `surface`, `surface-raised`, `text`, `text-muted`, `border`, `focus`, `interactive` và `status-*`; không tham chiếu raw cyan/orange/red rải rác trong component.
- Mỗi engine có bộ `fill`, `on-fill`, `border`, `muted` riêng để đồng bộ HTML, SVG và Three.js material trong cả dark/light mode.
- Contrast target: text thường ≥ 4.5:1; focus ring, boundary, selected state và meaningful graphic ≥ 3:1. `--dim` không dùng cho text thiết yếu ở light mode nếu chưa tăng contrast.
- Sans display/body giữ identity của site; mono chỉ dùng cho label, event, comparator và numeric readout. Prose giữ 65–75 ký tự mỗi dòng; số dùng `font-variant-numeric: tabular-nums` để gauge không nhảy layout.
- Document dùng `lang="vi"`; câu/nhãn tiếng Anh dài hoặc signature line dùng `lang="en"`. PDB, QoS và DOKS được mở rộng ở lần xuất hiện đầu hoặc link tới glossary.
- Icon UI dùng cùng một bộ inline SVG. Theme icon dạng ký tự `☀/☾` trong shared asset nên được thay bằng SVG ở lesson mới hoặc ghi rõ là ngoại lệ tương thích cũ.

## 6. Narrative structure — four playable scenes

### Prologue — The Pod disappeared

Không mở bằng explanation. Hero hiển thị Pod đang chạy, alarm xuất hiện, sau đó capsule biến mất khỏi rail.

Incident dossier:

```text
database-api
Priority: 10,000
Request: 1 GiB
Usage: 3 GiB
QoS: Burstable
PDB: minAvailable 1
Outcome: Pod disappeared
```

Người học chọn giả thuyết đầu tiên:

- Scheduler preemption.
- Node-pressure eviction.
- Container/node OOM.
- Planned drain.

Lựa chọn được đóng dấu vào incident tape. Chưa công bố đáp án; tape sẽ chạy lại ở finale.

Ngay sau lựa chọn, một replay 10–15 giây đưa ra evidence đầu tiên và phản hồi `possible`, `unlikely` hoặc `impossible` cho giả thuyết — đủ để tạo tò mò nhưng chưa tiết lộ thủ phạm.

Primary CTA: **Enter the control room**. Không có prose giải thích dài trước CTA.

### Scene 1 — Decision Switchboard

Mục tiêu duy nhất: cảm nhận rằng nhiều engine độc lập có thể thay đổi số phận Pod.

Các symptom chip xuất hiện như event packet:

```text
Pending
Evicted + MemoryPressure
OOMKilled
Drain blocked
Unreachable
```

Người học route từng packet vào console bằng click/select; drag-and-drop chỉ là progressive enhancement.

Khi thả đúng hoặc sai:

1. Packet chạy trên wire tới console đã chọn.
2. Console bật rulebook.
3. Các thuộc tính Pod có tham gia quyết định sáng lên.
4. Thuộc tính không tham gia bị dim và gắn nhãn `ignored here`.
5. Một câu feedback xuất hiện, sau đó nhường chỗ cho packet tiếp theo.

Signature moment: chuyển từ `Pending` sang `OOMKilled` làm toàn bộ console Scheduler tắt, còn radar Kernel bật đỏ. Người học thấy **cùng một Pod nhưng đổi người phán xử** mà không cần đọc bảng dài.

### Scene 2 — Scheduler Run

Gộp Scheduler Gate và Preemption Arena thành một đường chạy liên tục để tránh hai lab cùng dạy một engine.

Stage có incoming Pod, ba node và một rail gồm:

```text
Queue → Filter → Score → Bind
                 ↘ Preemption loop khi không fit
```

Control bank của toàn scene có năm biến:

- Memory request.
- Taint/toleration.
- Required/preferred affinity mode.
- PriorityClass.
- `preemptionPolicy`.

Đây là control bank toàn scene, không hiển thị đồng thời. Mỗi round chỉ mở 2–3 control liên quan; các biến còn lại nằm trong preset có tên rõ như `Hard constraint failure` hoặc `Preemption candidate`.

Interaction loop:

1. **Predict:** chọn node hoặc `Pending`.
2. **Run:** kéo cần `Schedule Pod`.
3. Pod capsule đi qua từng gate; gate fail đóng ngay với reason chip.
4. Node hợp lệ được score bằng bar animation.
5. Nếu không fit, rail tự chuyển vào preemption loop.
6. Người học chọn victim set, sau đó chạy comparator.
7. Timeline dừng ở khoảnh khắc quyết định để người học scrub và inspect.

Hai experiment bắt buộc:

- **Set priority = 100,000** trong khi hard filter vẫn fail.
- Chuyển required affinity thành preferred rồi replay.

Visual lesson: priority knob phát sáng nhưng dây điều khiển không nối vào hard-filter gate. Khi tăng priority, gate vẫn đóng.

Takeaway chỉ unlock sau hai run có outcome khác nhau:

> Priority giúp Pod được xét sớm và preempt workload thấp hơn; nó không phá hard constraint.

### Scene 3 — Memory Survival Arena

Đây là interaction trung tâm và chiếm nhiều polish nhất. Node pressure và OOM nằm trong cùng một node cutaway để người học thấy hai cơ chế khác nhau, không phải hai trang lý thuyết.

Pod set mặc định:

| Pod | Priority | Request | Usage |
|---|---:|---:|---:|
| A | 100 | 4 GiB | 3 GiB |
| B | 200 | 1 GiB | 2 GiB |
| C | 10,000 | 1 GiB | 3 GiB |

Người học điều khiển:

- Available memory.
- Request và usage của từng Pod.
- Priority của từng Pod.
- Soft/hard threshold preset.
- Mode: `Node pressure`, `Container limit OOM`, `Node OOM`.

Các control được chia theo round. Không cho người học chỉnh toàn bộ Pod và node cùng lúc: mỗi round chỉ mở một hot variable chính và tối đa hai biến hỗ trợ; phần còn lại dùng preset.

Interaction cụ thể: người học chọn một Pod trên stage, sau đó chỉ chỉnh một attribute của Pod đó (`request`, `usage` hoặc `priority`) cùng một node lever (`available memory` hoặc threshold preset). Chuyển Pod sẽ đóng editor cũ và cập nhật readout, tránh render 9 input song song.

#### Round A — Trigger pressure

1. Người học chọn Pod sẽ rời node trước.
2. Kéo memory gauge xuống threshold.
3. Node heat tăng; reclaim pulse chạy qua filesystem/cache layer.
4. Nếu vẫn thiếu memory, Pod tách thành hai lane: `usage > request` và `usage ≤ request`.
5. Trong lane, candidate tự sắp theo priority rồi excess usage.
6. Victim mất saturation, rail tách khỏi node và event `Evicted` xuất hiện.

Comparator trace có thể scrub:

```text
usage > request? → lower priority? → larger excess usage?
```

#### Round B — Request vs Priority showdown

Hai nút experiment đặt cạnh nhau:

- **Raise request to working set**.
- **Raise priority only**.

Người học chạy A/B comparison. Stage split-screen trong 2 giây cuối, đồng bộ hai timeline và highlight bước comparator nơi outcome tách nhau.

#### Round C — Cross the red line

Chuyển mode nhưng giữ nguyên Pod/node để nhấn mạnh engine đã đổi:

- Container limit OOM: allocation bar chạm limit, cgroup clamp đóng và container bị kill.
- Node OOM: process radar khóa vào effective badness cao nhất rồi phát hard-cut animation.

PriorityClass và PDB bị gạch khỏi decision panel trong OOM mode. Thay đổi chúng tạo `no effect` pulse thay vì im lặng, giúp người học thấy input không nối vào engine này.

Takeaway:

> Node pressure và OOM có thể cùng bắt đầu từ thiếu RAM, nhưng comparator và protection khác nhau.

#### Three.js signature moment — Node cutaway

Đây là vị trí duy nhất Three.js có thể tăng trực tiếp chất lượng mental model, thay vì chỉ tăng độ bóng bẩy:

- Node là một cutaway volume cố định; process nằm trong container cgroup, container được gom dưới Pod frame và toàn bộ Pod nằm trên node. Pod frame dùng nét/label `logical grouping`, trong khi cgroup clamp và node boundary dùng shape khác để chỉ nơi enforcement thực sự xảy ra.
- Khi chuyển `Node pressure → Container limit OOM → Node OOM`, geometry giữ nguyên nhưng camera anchor, clipping plane, light và decision overlay đổi lớp đang được xét. Người học thấy cùng một memory shortage nhưng boundary và judge thay đổi.
- Memory allocation được biểu diễn bằng volume fill có scale định lượng, không dùng particle ngẫu nhiên. Reclaim làm volume cache co lại; cgroup OOM làm clamp đóng tại container boundary; node OOM làm radar chọn process trên toàn node.
- Camera là guided camera với 3–4 anchor định trước; không dùng free-orbit trong core path. Click/tap một Pod hoặc process chỉ chọn object, còn mọi chỉnh sửa vẫn nằm trong HTML control bank.
- A/B request-versus-priority vẫn dùng split timeline 2D phủ trên stage; không dựng hai scene WebGL đồng thời.

Three.js không được dùng nếu prototype không chứng minh người học phân biệt boundary tốt hơn bản SVG cutaway. Tiêu chí giữ 3D là người học có thể chỉ ra **OOM xảy ra ở boundary nào và engine nào chọn victim** sau một replay, không phải chỉ đánh giá scene “đẹp hơn”.

Learning gate dùng paired, counterbalanced usability test với 8–12 người thuộc audience mục tiêu. Mỗi người giải cùng ba scenario boundary/engine bằng cả SVG và 3D theo thứ tự đảo; giữ 3D khi accuracy tăng ít nhất 15 điểm phần trăm **hoặc** median time-to-correct-boundary giảm ít nhất 20% mà accuracy không giảm. Ghi riêng motion discomfort, navigation error và preference; preference đơn thuần không đủ để pass gate.

### Scene 4 — Protection Run + DOKS Finale

Phần đầu là một fast-paced routing run. Pod capsule tiến về một loạt hazard:

- Planned drain.
- Memory pressure.
- Node OOM.
- Unreachable taint.
- Probe failure.
- Graceful delete.
- Disk pressure.

Người học chọn shield trước khi capsule chạm hazard:

| Shield | Hazard phù hợp |
|---|---|
| PDB | Planned drain / Eviction API |
| Request + Priority + headroom | Node pressure |
| QoS/request/limit + headroom | Node OOM |
| `NoExecute tolerationSeconds` | Unreachable taint |
| Probe configuration | Probe failure |
| `terminationGracePeriodSeconds` | Graceful delete |
| Ephemeral request/limit + headroom | Disk pressure |

Bảng trên là **solution model cho author/implementation**, không hiển thị trước challenge. Trong lesson, từng mapping chỉ unlock sau attempt đầu tiên và được lưu vào Reference Console.

Default mode không có time pressure: capsule dừng tại `ARM SHIELD`, chờ người học chọn rồi mới cho phép chạy tới impact. Arcade auto-run có thể là enhancement opt-in, không dùng trong core path, keyboard path hoặc reduced-motion mode.

Sai lựa chọn không chỉ báo đỏ. Capsule va vào hazard, shield bật nhưng bị xuyên qua, sau đó UI freeze-frame đúng vị trí rulebook bỏ qua shield đó.

#### DOKS Finale — Build a survivable cluster

Cluster state:

- RAM khan hiếm.
- CPU còn dư.
- Có database, ingress, DNS, API, worker và batch.

Người học phân bổ một budget hữu hạn cho:

- Memory requests.
- Memory limits.
- Priority tiers.
- PDB.
- Node headroom/eviction threshold preset.

Nhấn **Run incident night** để chạy ba wave: placement spike → memory pressure → maintenance drain. Trước mỗi wave, người học có budget token và chỉ được thay tối đa hai cấu hình. Sau mỗi wave, timeline freeze-frame failure chain, cho một lần intervention/retry rồi mới chuyển tiếp. Pod capsule và workload khác di chuyển đồng thời; score cập nhật sau từng biến cố:

- Placement reliability.
- Pressure survival.
- OOM resilience.
- Maintenance safety.

Không thể đặt priority cực cao cho mọi workload. Tăng request giảm schedulable capacity; PDB quá chặt có thể khóa drain; headroom có cost.

#### Finale scoring contract

Finale dùng **12 budget token** cho toàn incident night. Mỗi wave chỉ mở các configuration card liên quan và cho thay tối đa hai card:

| Configuration card | Cost | Tác động mô phỏng |
|---|---:|---|
| Raise request to working set | 2 / workload | Tăng requested capacity; cải thiện pressure ordering nhưng giảm placement headroom |
| Assign critical priority tier | 1 / workload | Thay queue/preemption/eviction ordering; không đổi OOM badness trực tiếp |
| Add safe memory limit headroom | 1 / workload | Giảm container-limit OOM nhưng cho phép usage cao hơn |
| Add maintenance-safe PDB | 1 / workload | Bảo vệ Eviction API trong phạm vi vẫn cho phép một disruption |
| Reserve node headroom | 3 / cluster | Giảm pressure/OOM risk nhưng giảm usable capacity |
| Correct event-specific protection | 1 / workload | Sửa toleration/probe/grace/disk protection trong wave tương ứng |

Mỗi wave trả về trace deterministic gồm event, checks, affected workloads và score delta. Bốn score bắt đầu ở 100; mỗi failed invariant trừ điểm theo severity đã định trong scenario data, không dùng random:

```js
scoreDelta = {
  placement: criticalPending * -30 + unnecessaryPreemption * -15,
  pressure: criticalEviction * -35 + avoidableEviction * -15,
  oom: criticalOom * -40 + restartLoop * -20,
  maintenance: blockedDrain * -30 + availabilityBreach * -40
}
```

Scenario test phải chứng minh cùng input luôn tạo cùng trace/score, tổng token không âm, và không có cấu hình nào tối đa hóa cả bốn score mà không có trade-off.

#### Three.js secondary use — Incident night topology

Finale có thể tái sử dụng Pod/node geometry và material từ Memory Arena để tạo một isometric cluster tabletop:

- Ba wave đi qua topology bằng camera anchor cố định; placement đổi rail, pressure làm node volume nóng lên và drain làm node chuyển sang maintenance state.
- Pod duplicate dùng instancing; không load GLTF, environment map hoặc asset 3D ngoài nếu primitive geometry đã đủ diễn đạt.
- 3D chỉ là spatial overview. Configuration card, budget, score delta, timeline và intervention vẫn là HTML để đọc và thao tác chính xác.
- Đây là **should-have sau Memory Arena**, không phải dependency để finale hoạt động. Fallback SVG topology phải dùng cùng scenario state và cho cùng trace/score.

Final replay quay lại incident mở đầu. Người học có thể giữ hoặc đổi chẩn đoán; timeline mở đúng engine và rule đã làm Pod biến mất.

## 7. Core interaction loop

Mọi scene dùng cùng một nhịp để giảm cognitive load:

1. **Predict** — commit một dự đoán trước khi chạy.
2. **Manipulate** — thay đổi tối đa 2–5 input có liên quan trực tiếp.
3. **Run** — animation phát theo chuỗi causal, không nhảy thẳng tới kết quả.
4. **Inspect** — timeline tự pause tại decision frame quan trọng.
5. **Replay / Compare** — tua lại, scrub hoặc chạy alternate setup.
6. **Explain** — rulebook xuất hiện sau outcome.
7. **Lock it in** — một takeaway ngắn hoặc một hành động sửa cấu hình.

Không dùng quiz dài ở cuối. Prediction và correction được phân bổ trong mọi scene.

Khi replay counterfactual, giữ một `ghost outcome` của lần chạy trước trên rail/timeline để sự khác biệt nhìn thấy trực tiếp, không chỉ được mô tả bằng text.

## 8. Motion grammar

Motion phải có từ vựng nhất quán để người học đọc được hệ thống như đọc diagram.

| Ý nghĩa | Motion token | Biểu hiện |
|---|---|---|
| Engine nhận quyền quyết định | `activate` | Console wake-up, line sáng từ symptom tới engine |
| Input được xét | `scan` | Highlight chạy từ field tới comparator |
| Constraint fail | `reject` | Gate đóng, capsule dừng, reason chip trượt ra |
| Candidate được so sánh | `rank` | Card đổi lane và settle theo thứ tự |
| Victim được chọn | `lock` | Outline siết lại, các candidate khác giảm opacity |
| Pod bị loại | `exit` | Saturation giảm, capsule rời rail theo hướng engine |
| Input không có tác dụng | `no-effect` | Control pulse nhưng connection line không sáng |
| Protection hoạt động | `intercept` | Shield nhận impact rồi đẩy event lệch route |
| Rulebook đổi | `handover` | Scene giữ nguyên object nhưng camera/lighting chuyển console |

Không dùng motion ngẫu nhiên như bounce liên tục, particle nền dày, parallax hoặc scroll-jacking. Trong một decision frame chỉ có 1–2 focal motion.

## 9. Choreography và timing

### Timing scale

- Press/hover/focus feedback: 150–220ms.
- Panel reveal và lane reorder: 220–360ms.
- Comparator step: 350–550ms mỗi bước.
- Full decision sequence: 900–1800ms tùy số comparator.
- Scene handover: 400–700ms.

Entering dùng ease-out; exiting dùng ease-in. Chuyển động position/scale chỉ dùng `transform`; fade dùng `opacity`. Không animate layout property gây reflow nếu có thể tránh.

### Playback control bắt buộc

Mọi causal animation dài hơn 600ms phải có:

- Play / Pause.
- Previous step / Next step.
- Replay.
- Skip to outcome.
- Timeline scrubber khi có từ 3 decision step trở lên.
- Speed `0.75× / 1× / 1.5×` là should-have, không phải must-have.
- Reset/undo về state trước run.

Khi người học thay control giữa lúc animation đang chạy, scene dừng tại frame hiện tại và yêu cầu **Run again**; không âm thầm đổi outcome giữa sequence.

### Orchestrated moments

Chỉ có ba khoảnh khắc cinematic lớn:

1. Pod biến mất ở prologue.
2. Pressure comparator split-screen khi so sánh request với priority.
3. Incident night chạy xuyên cluster ở finale.

Các phần còn lại ưu tiên motion chức năng, nhanh và có thể điều khiển.

## 10. Interaction model

### Direct manipulation

- Slider phải cập nhật preview/readout ngay khi kéo, nhưng outcome chỉ commit khi nhấn Run.
- Node, Pod và shield có thể click để inspect hoặc select.
- Drag-and-drop có visual affordance rõ, nhưng luôn có click/select fallback.
- Click vào comparator step làm timeline seek tới frame tương ứng.
- Click/focus/tap thuộc tính bị dim mở popover ngắn: `Not used by kubelet eviction`; không để knowledge chỉ tồn tại ở hover tooltip.
- SVG chỉ là visual surface khi đã có HTML control tương đương. Pod/node/shield selection dùng native button/list nằm đồng bộ với SVG; nếu một SVG element thật sự interactive thì phải focusable, có accessible name, keyboard activation và trạng thái selected rõ.

### Keyboard và focus contract

- Prediction, shield và preset dùng native radio trong `fieldset` + `legend`; `Tab` di chuyển giữa group, Arrow key di chuyển trong group.
- Scene navigator dùng `<nav><ol>` và `aria-current="step"`; đây là journey navigation, không giả làm Tabs.
- `Enter`/`Space` chọn Pod, node, packet hoặc shield. Nếu dùng roving tabindex, hỗ trợ thêm `Home`/`End` và giữ visual order trùng DOM order.
- Drag fallback là một flow đầy đủ: **Select packet → Choose console → Confirm route**, không chỉ một nút phụ khó thấy.
- Khi người học chủ động đổi scene, focus chuyển tới heading của scene mới. Replay, autoplay, outcome hoặc animation không tự chuyển focus.
- Có skip link tới main content, simulation stage và playback deck. Focused control không bị sticky topbar hoặc bottom deck che.
- Selected, disabled, busy, invalid và `no-effect` đều có text/icon/border + semantic state; không biểu diễn chỉ bằng opacity hoặc màu.

### Feedback states

Mọi action có đủ trạng thái:

```text
idle → armed → running → decision → explained → replayable
```

Không dùng toast cho kiến thức quan trọng. Feedback phải nằm sát stage hoặc control gây ra outcome.

Trong lúc chạy, stage dùng `aria-busy="true"`. Một outcome node nhỏ dùng `role="status"` để announce khi run commit, pause tại decision step hoặc outcome đổi. Comparator step list là persistent DOM **không live** để người dùng tự đọc/scrub; không announce mỗi animation frame, mỗi pixel slider hoặc mỗi tick scrubber.

### Failure as content

Sai dự đoán không bị phạt bằng màn hình đỏ. System ghi:

- Dự đoán của người học.
- Outcome thực tế.
- Comparator step đầu tiên nơi hai hướng tách nhau.
- Một CTA cụ thể: `Change request`, `Switch engine`, hoặc `Replay from step 2`.

## 11. Progressive disclosure

Core path chỉ giữ quy tắc cần để thao tác scene hiện tại.

Đặt trong `details/summary`, popover hoặc reference drawer:

- Effective request của init container và Pod overhead.
- Scheduler plugin weights.
- Hard/soft eviction thresholds.
- PID/inode không có request tương ứng.
- `MergeDefaultEvictionSettings`.
- Ephemeral-storage edge cases.
- Citation đến Kubernetes upstream.

Bảng tổng hợp lớn ở report gốc chỉ xuất hiện cuối bài dưới dạng **Reference Console Unlocked**. Drawer phải nhớ tab đang mở nhưng không tự mở khi chuyển scene.

## 12. Content transformation map

| Report gốc | Playable scene | Cách chuyển đổi |
|---|---|---|
| Kết luận cốt lõi | Prologue + Switchboard | Incident prediction, engine handover animation |
| Mục 1–3 | Scheduler Run | Gate scan, node score và replay |
| Mục 4 | Scheduler Run round 2 | Victim-set selection trong preemption loop |
| Mục 5–6 | Memory Arena rounds A–B | Pressure gauge, lane sort, A/B timeline |
| Mục 7 | Memory Arena round C | Cgroup clamp và node OOM radar |
| Mục 8–11 | Protection Run | Shield routing và failure freeze-frame |
| Mục 12 | Reference Console | Filter theo engine/event, không show table ngay |
| Mục 13 | DOKS Finale | Budget allocation + incident night simulation |
| Sources | Evidence drawer | Citation theo decision step |

## 13. Screen and component system

### Global shell

- Shared `video-generation-design-system.css` và `video-generation-theme.js`.
- Sticky topbar, semantic reading/play progress và scene navigator.
- Main stage ưu tiên chiều cao viewport; prose không được đẩy stage xuống dưới fold trên desktop.
- Mobile có compact status strip và scene drawer thay vì ẩn navigation.

### Persistent Pod dossier

Desktop có panel sticky hiển thị:

```text
Priority · Request · Limit · Usage · QoS · PDB · Phase
```

Thuộc tính thay đổi live theo control. Khi engine đổi, connection line và opacity cho biết field nào được đọc. Mobile chuyển thành compact strip; tap mở drawer có focus management và nút Close rõ.

### Simulation stage

```text
┌───────────────────────────────────────┐
│ Stage: Pod, node, rail, gate, hazard │
│ Decision timeline + step markers      │
├───────────────────────┬───────────────┤
│ Prediction / controls │ Outcome trace │
└───────────────────────┴───────────────┘
```

Stage là thành phần lớn nhất; controls và explanation không được chiếm nhiều diện tích hơn stage trên desktop.

### Playback deck

Dùng native `button`, `input[type="range"]`, `output`, `fieldset` và `legend`, styled theo visual system hiện có. Các primitive tương đương shadcn/Radix về semantics nhưng không thêm React hoặc dependency.

Các control icon-only cần `aria-label`; toggle có label ổn định như `Step mode` hoặc `Show ghost outcome` dùng `aria-pressed`. Nút Play/Pause đổi accessible label theo action hiện tại, không dùng `aria-pressed` để thay thế tên hành động. Timeline cần tên step bằng text, không chỉ chấm màu; scrubber cung cấp `aria-valuetext`, ví dụ `Step 2 of 5: Filter nodes`.

### Recommended visual primitives

- Inline SVG cho topology, rails, gates, connector và radar.
- CSS custom properties cho design/motion tokens.
- CSS transitions/animations hoặc Web Animations API cho sequence có thể pause/seek.
- Canvas chỉ dùng khi có nhiều process/particle cần redraw liên tục; luôn có text fallback.
- Three.js/WebGL chỉ dùng cho Node cutaway ở Memory Arena sau capability/performance spike; không dùng làm page background hoặc renderer cho control UI.
- Không dùng generated raster asset hoặc animation library nặng trong v1 core.

### Renderer decision matrix

| Scene / surface | Renderer đề xuất | Quyết định | Lý do |
|---|---|---|---|
| Prologue Pod disappearance | SVG + CSS/WAAPI | Không cần Three.js | Một causal beat ngắn; 3D không thêm rule hoặc boundary mới |
| Decision Switchboard | HTML + SVG wires | Không dùng Three.js | Routing, labels và `ignored here` cần rõ, focusable và dễ scan |
| Scheduler Run | SVG rail/gates + HTML controls | Không dùng Three.js | Filter/score/preemption là sequence tuyến tính; perspective có thể làm comparator khó đọc |
| Memory Arena node cutaway | Three.js + HTML/SVG overlay | **Dùng có điều kiện** | Nested spatial boundary và engine handover hưởng lợi rõ từ chiều sâu, clipping và guided camera |
| Pressure/OOM comparator trace | HTML/SVG overlay | Không render text trong WebGL | Text, scrubber và step focus cần sharp, selectable và accessible |
| Protection Run | SVG rail + HTML shield picker | Không dùng Three.js | Fast routing cần phản hồi chính xác; 3D collision dễ biến thành game timing |
| DOKS incident night | Reuse Three.js hoặc SVG fallback | Có thể dùng | Cluster topology và simultaneous workload movement sinh động hơn, nhưng không được chặn core finale |
| Reference Console | Native HTML primitives | Không dùng Three.js | Search, filter, citation và table là information UI |

### UI component contract

Không import React/shadcn vào static lesson, nhưng dùng cùng accessibility contract:

| Need | Primitive triển khai | Contract |
|---|---|---|
| Scene/round selection | `nav > ol` + buttons/links | Journey step dùng `aria-current="step"`; round control bên trong scene mới dùng radio hoặc tabs khi thật sự là related panels |
| Hot variable | Native range/input + `output` | Label rõ, `inputmode="numeric"` khi phù hợp, preview live nhưng outcome chỉ commit khi Run |
| Mode switch | Radio group hoặc toggle group | Không dùng ba button rời không có group semantics |
| Renderer preference | `2D / 3D enhanced` segmented radio | Luôn cho phép quay về 2D; lựa chọn không làm reset scenario hoặc mất timeline |
| Pod/process selection | HTML listbox/radio cards đồng bộ raycast | Canvas không phải keyboard target duy nhất; selected state hiện ở cả stage và control |
| Explanation/reference | Non-modal drawer hoặc dialog | Trap focus nếu modal, Escape đóng, trả focus về trigger |
| Outcome/comparator | Outcome status + persistent step list | Chỉ outcome node dùng `aria-live="polite"`; comparator list không live; không dùng toast cho kiến thức chính |
| Playback | Native buttons + range scrubber | Icon có accessible name, trạng thái Play/Pause không mơ hồ, touch target ≥ 44px |

## 14. Accessibility và reduced motion

- Toàn bộ lesson hoàn thành được bằng keyboard.
- Touch target tối thiểu 44×44px.
- Focus ring luôn thấy rõ trong dark và light mode.
- Outcome summary dùng một `aria-live="polite"`/`aria-atomic="true"` region riêng; comparator trace là non-live list có heading và step label rõ.
- Lesson progress và playback progress là hai region có accessible name riêng; không dùng một progress bar mơ hồ cho cả hai.
- Animation không được tự chuyển focus hoặc auto-scroll.
- Drag-and-drop có click/select fallback.
- SVG có title/description hoặc bảng trạng thái tương đương.
- Canvas có fallback text mô tả state hiện tại.
- WebGL canvas là `aria-hidden="true"` khi toàn bộ object/state đã được phản chiếu bằng HTML; nếu canvas mang thông tin độc nhất thì concept không đạt.
- Raycast selection luôn đồng bộ với native Pod/process selector; keyboard và switch-control không phải giả lập pointer trong canvas.
- Khi `forced-colors: active`, mặc định dùng SVG/high-contrast renderer; không dựa vào WebGL material vì chúng không kế thừa system colors.
- Color contrast tối thiểu WCAG AA; color không phải tín hiệu duy nhất.
- Drawer/dialog trap focus, đóng bằng Escape và trả focus về trigger.
- Stage vẫn có nghĩa khi zoom 200%.

### Reduced-motion mode không chỉ là tắt animation

Khi `prefers-reduced-motion: reduce`:

- Không autoplay.
- Thay travel animation bằng state dissolve hoặc immediate state change.
- Comparator hiển thị từng snapshot khi bấm Next.
- Timeline, labels và outcome vẫn đầy đủ.
- Không parallax, shake, zoom camera hoặc flashing pulse.
- Three.js chuyển sang fixed camera + discrete snapshots; clipping plane và volume fill nhảy theo step thay vì tween liên tục.
- State machine không phụ thuộc `animationend` hoặc WAAPI `.finished`: shared reduced-motion CSS hiện rút duration về gần 0, nên controller phải branch trực tiếp tới snapshot kế tiếp nhưng vẫn cập nhật trace/state.
- Không có flash quá 3 lần/giây. Step mode được lưu độc lập với theme và được test cả qua system preference lẫn toggle trong lesson.

Người học có thể bật **Step mode** độc lập với system preference.

## 15. Responsive behavior

### Desktop ≥ 1024px

- Stage chiếm khoảng 65–72% vùng lab.
- Pod dossier sticky; controls và outcome nằm cạnh hoặc dưới stage.
- Timeline luôn thấy trong viewport lab.

### Tablet 768–1023px

- Dossier thành horizontal panel.
- Stage full width; controls dùng hai cột khi mỗi cột còn tối thiểu 300px.
- Không giảm text hoặc touch target để cố giữ desktop layout.

### Mobile 320–767px

- Single column, stage trước controls.
- Stage chuyển từ rail ngang sang rail dọc hoặc snap theo từng decision frame.
- Event sorter dùng tap/select, không yêu cầu drag.
- Playback deck sticky dưới viewport nhưng không che nội dung/focus.
- Bottom deck chừa `env(safe-area-inset-bottom)` và content có padding tương ứng; kiểm tra cả mobile landscape và viewport chiều cao thấp.
- Tables chuyển thành card list hoặc region có label rõ.
- Không có horizontal page overflow.
- Không bỏ animation; dùng choreography ngắn hơn và ít object hơn.
- Với 3D cutaway, dùng fixed isometric camera, tối đa một layer inspect tại một thời điểm và DPR thấp hơn; nếu canvas không giữ frame budget thì tự chuyển sang SVG snapshot mà không mất control hoặc outcome.
- Layout lab ưu tiên container query theo chiều rộng thực của stage/control region; viewport breakpoint chỉ là fallback.

## 16. Technical direction

Khuyến nghị bám kiến trúc lesson hiện có:

- Một file HTML lesson độc lập.
- Shared CSS/theme assets từ repo.
- Vanilla JavaScript.
- Inline SVG và data-driven scenario objects.
- V1 core không thêm dependency hoặc build step; Three.js là lazy-loaded progressive module chỉ được đưa vào sau spike và phải có SVG fallback.

### Single source of truth

```js
lessonState = {
  scene,
  round,
  playback: { status, step, speed, reducedMotion },
  activeEngine,
  selectedPodId,
  selectedNodeId,
  pods: {},
  nodes: {},
  processes: {},
  hazards: [],
  budget: { total: 12, remaining: 12, allocations: [] },
  prediction: null,
  decisionTrace: [],
  runHistory: [],
  checkpoints: {},
  finaleScore: {}
}
```

Mỗi scenario hydrate state bằng ID ổn định. Pod dossier là derived view của `pods[selectedPodId]`; không giữ bản copy riêng dễ stale. `runHistory` lưu input snapshot + trace để ghost replay và counterfactual comparison deterministic.

### Logic tách khỏi choreography

Comparator functions phải pure:

```js
filterNodes(pod, nodes)
rankPreemptionVictims(incomingPod, runningPods)
rankEvictionCandidates(signal, pods)
rankOomProcesses(processes)
evaluateProtection(event, protection)
```

Mỗi function trả về cả outcome và trace:

```js
{
  outcome: 'pod-b',
  steps: [
    { rule: 'usage > request', candidates: ['pod-b', 'pod-c'] },
    { rule: 'priority ascending', candidates: ['pod-b', 'pod-c'] },
    { rule: 'winner', candidates: ['pod-b'] }
  ]
}
```

Motion controller chỉ render `steps`, nhờ đó Play/Pause/Next/Replay và reduced-motion dùng cùng một dữ liệu.

### Progressive renderer architecture

Renderer không được sở hữu simulation logic:

```text
pure scenario functions → decision trace → scene controller
                                      ↘ SVG/DOM renderer
                                      ↘ Three.js renderer (capability-gated)
                                      ↘ text/live-region renderer
```

- Cả SVG và Three.js đọc cùng `lessonState` + `decisionTrace`; không có comparator riêng trong scene graph.
- WebGL capability check chạy trước khi load module. `prefers-reduced-motion`, `Save-Data`, device memory thấp hoặc renderer init failure có thể chọn SVG path ngay.
- Three.js được pin version và self-host dưới dạng ES module nếu được duyệt; không phụ thuộc CDN runtime.
- Scene lifecycle có `mount`, `renderState`, `pause`, `resume`, `dispose`; chuyển scene phải dispose geometry, material, texture, render target và event listener.
- `webglcontextlost` phải pause playback, giữ nguyên `lessonState`, thông báo chuyển renderer và phục hồi bằng SVG thay vì để stage trắng.
- HTML overlay dùng CSS tokens giống material palette để engine color/shape không lệch giữa 2D và 3D.

### Performance budget

- Chỉ animate `transform` và `opacity` trong hot path.
- Tối đa 1–2 focal animation cùng lúc.
- Pause timer/animation khi tab hidden.
- Không tạo animation loop khi scene off-screen.
- SVG DOM giữ gọn; canvas chỉ redraw khi state thay đổi.
- Tránh layout shift khi outcome hoặc drawer xuất hiện.
- Performance target là 60fps desktop và 45fps mobile tầm trung trong playback; minimum trước fallback là 55fps desktop và 30fps mobile. Nếu không giữ target, giảm object/effect trước khi giảm accessibility.
- Three.js chunk lazy-load mục tiêu ≤ 250 KiB gzip; không nằm trên critical path tới action đầu tiên.
- 3D scene ưu tiên primitive geometry, shared material và `InstancedMesh`; mục tiêu ≤ 80 draw calls, ≤ 120k visible triangles và tối đa 2 dynamic lights.
- Cap `devicePixelRatio` ở 1.5 desktop và 1.0–1.25 mobile; không dùng real-time shadow, bloom, SSAO hoặc transparency layer dày trong core mode.
- Đo incident wave trong hai run 10 giây trên ít nhất một laptop 4-core dùng integrated GPU ở 1440×900 và một Android tầm trung ở 390×844, browser stable hiện hành. Nếu median FPS dưới minimum trong hai run liên tiếp hoặc input latency vượt 100ms, mặc định dùng SVG fallback trên device class đó.
- Initial lesson shell và first interaction không chờ Three.js; module chỉ prefetch sau khi người học vào control room hoặc khi browser idle.

## 17. Existing lesson patterns to reuse

Codebase evidence:

- `video-generation-part-1-lesson-1.html`: range-driven lab, step/autoplay controls, immediate explanation và checkpoint.
- `video-generation-part-1-lesson-2.html`: slider cập nhật calculated output live.
- `video-generation-part-1-lesson-5.html`: computed visual thay vì decorative animation.
- `video-generation-part-1-lesson-6.html`: deterministic previous/next/play/replay state transitions.
- `video-generation-design-system.css`: color token, sticky topbar, button, focus treatment và reduced-motion baseline.
- `video-generation-theme.js`: persisted dark/light theme.

Patterns to preserve:

- Native controls và semantic output.
- Deterministic state transition.
- `aria-live` feedback.
- Vanilla JavaScript và no-build delivery.
- Shared visual identity.

Patterns to improve:

- Chuyển từ section-heavy page sang stage-led scene.
- Không dùng inline `onclick`; chỉ dùng `addEventListener`.
- Progress bar có `role="progressbar"` và `aria-valuenow`.
- Play/Pause có accessible label theo action hiện tại; toggle state ổn định mới dùng `aria-pressed`; animation luôn có Pause/Skip.
- Mobile giữ scene navigation và status.
- Prediction xuất hiện trước simulation, không gom quiz ở cuối.
- Explanation chỉ xuất hiện sau action, không đặt prose dài trước lab.

## 18. Options considered

### A. Four-scene playable incident — Recommended

**Ưu:** tập trung ngân sách vào animation chất lượng; có replay và comparison; core path ngắn; mỗi scene tạo một memory rõ.  
**Nhược:** state machine, timeline và accessibility phức tạp hơn.

### B. Six independent labs

**Ưu:** ánh xạ 1:1 với cấu trúc report; dễ chia code theo section.  
**Nhược:** lặp interaction pattern, dàn trải polish, dễ trở thành lesson nhiều widget.

### C. Scrollytelling infographic

**Ưu:** đẹp và tuyến tính, ít control state.  
**Nhược:** người học thụ động; motion dễ thành trang trí và khó tạo alternate outcome.

### D. Interactive dashboard

**Ưu:** data-dense, dễ so sánh parameter.  
**Nhược:** giống công cụ vận hành hơn experience; không có narrative pacing hoặc signature animation.

## 19. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Animation đẹp nhưng không dạy causality | Người học nhớ hiệu ứng, quên rule | Mỗi motion token ánh xạ một decision semantics; trace phải khớp comparator output |
| Quá nhiều scene/object cùng chuyển động | Nhiễu và motion sickness | 1–2 focal motion/frame; three cinematic moments only; Step mode |
| Simulation đơn giản hóa sai Kubernetes | Dạy sai mental model | Pure comparator functions + scenario tests từ report |
| Replay/state bị lệch | Outcome và animation mâu thuẫn | Trace data là source duy nhất cho renderer và text feedback |
| Drag không accessible | Không dùng được keyboard/mobile | Click/select fallback bắt buộc |
| Một file HTML quá lớn | Khó bảo trì | Data-driven scene, motion token và component factory có section rõ |
| Mobile animation quá chật | Mất tính trực quan | Rail dọc/snapshot mode, giảm object chứ không ẩn outcome |
| Finale có “đáp án tuyệt đối” | Che giấu trade-off | Multi-score và alternate replay, không pass/fail đơn giản |
| Three.js biến lesson thành tech demo | Tốn scope nhưng không tăng learning | Chỉ giữ Node cutaway khi usability test chứng minh boundary comprehension tốt hơn SVG |
| WebGL fail hoặc GPU yếu | Scene trắng/mất core path | Capability gate, lazy load, init timeout và SVG fallback dùng cùng trace |
| Canvas interaction loại trừ keyboard/screen reader | Không hoàn thành được lesson | HTML controls là source tương tác; raycast chỉ là pointer enhancement và canvas không chứa thông tin độc nhất |

## 20. Acceptance criteria cho concept

Concept chỉ được duyệt nếu:

- [ ] Animation và interaction là nội dung chính; prose không dẫn dắt core path.
- [ ] Core experience có 4 playable scene, không phải 6 widget độc lập.
- [ ] Action đầu tiên xảy ra trong 15 giây; mỗi round chỉ có 2–3 hot control.
- [ ] Mỗi scene bắt đầu bằng prediction hoặc manipulation.
- [ ] Mỗi decision quan trọng có causal animation và textual trace tương đương.
- [ ] Mọi sequence dài hơn 600ms có Play/Pause, Previous/Next, Replay, Skip và Reset/Undo.
- [ ] Sequence có từ 3 decision step trở lên có timeline scrubber với text label cho từng step.
- [ ] Memory Arena có A/B comparison giữa request và priority.
- [ ] Input không liên quan tạo feedback `no effect`, không im lặng.
- [ ] “Three judges” chỉ gồm Scheduler, Kubelet eviction và Kernel/cgroup OOM; Protection Run luôn ghi đúng decision path thật.
- [ ] Finale chạy một incident timeline và cập nhật multi-score theo từng event.
- [ ] Finale dùng budget/scoring deterministic; cùng input luôn cho cùng trace và score.
- [ ] Explanation xuất hiện sau outcome; advanced knowledge nằm trong drawer.
- [ ] Counterfactual replay giữ ghost outcome của lần chạy trước.
- [ ] Mỗi scene có failure branch, counterfactual và reset tức thì không reload page.
- [ ] Core path có ít nhất 12 action tạo hậu quả; mỗi round hoàn tất hoặc tới replay point trong khoảng 20–45 giây.
- [ ] Toàn bộ core interaction dùng được bằng keyboard, touch và reduced-motion Step mode.
- [ ] Protection Run mặc định pause trước hazard; core path không yêu cầu phản ứng theo thời gian.
- [ ] Pod/node/shield có native HTML control đồng bộ hoặc SVG semantics/keyboard behavior tương đương.
- [ ] Stage có ý nghĩa ở 320px, 375px, 768px, 1024px và 1440px, zoom 200% và mobile landscape, không horizontal overflow.
- [ ] Motion dùng transform/opacity trong hot path và pause khi tab hidden.
- [ ] Shared visual identity của site được giữ.
- [ ] Renderer decision matrix được giữ: Three.js chỉ có quyền sở hữu Node cutaway và optional finale topology, không sở hữu controls/text/comparator.
- [ ] Memory Arena có SVG fallback dùng cùng state/trace và cho outcome giống Three.js.
- [ ] WebGL canvas không chứa control hoặc thông tin độc nhất; keyboard/touch/reduced-motion path hoàn thành được toàn lesson.
- [ ] Three.js không nằm trên critical path tới action đầu tiên và đạt performance budget trước khi bật mặc định.
- [ ] Không thêm framework, animation dependency hoặc build step trong v1 core.
- [ ] Manual accessibility pass hoàn tất bằng keyboard-only, VoiceOver + Safari, NVDA + Firefox/Chrome, touch/coarse pointer, reduced motion và forced colors; axe chỉ là baseline.

## 21. Recommended implementation boundary

### Must have

- Prologue incident prediction.
- Decision Switchboard.
- Scheduler Run có filter + score + một preemption round.
- Memory Survival Arena có pressure + request/priority A/B + một OOM round.
- Protection Run với tối thiểu bốn hazard cốt lõi.
- DOKS finale ba wave, có một intervention/retry mỗi wave + incident replay.
- Playback deck: Play/Pause/Previous/Next/Replay/Skip.
- Timeline scrubber cho sequence có từ 3 decision step.
- Responsive, dark/light, reduced motion và keyboard support.

### Should have

- Persistent Pod dossier với engine-aware field highlighting.
- Speed control.
- Full seven-hazard Protection Run.
- Reference console và citations theo decision step.
- Three.js Node cutaway spike với guided camera, nested boundary và SVG parity test.

### Could have

- Save lesson progress trong `localStorage`.
- Shareable finale score.
- Subtle sound design có opt-in.
- Optional haptic confirmation trên thiết bị hỗ trợ.
- Reuse Three.js renderer cho DOKS incident-night topology sau khi Memory Arena đạt learning/performance gate.

Không triển khai sound, haptic, progress persistence hoặc shareable score ở phiên bản đầu nếu chưa có yêu cầu riêng.

## 22. Decisions before implementation

Đề xuất chốt mặc định:

1. Dùng **4 playable scene**; các topic nhỏ trở thành round hoặc reference drawer.
2. Finale dùng **DOKS scenario** từ report để giữ tính thực tế; scenario data tách riêng để có thể generic hóa sau.
3. Tên hiển thị: **One Pod, Three Judges**; subtitle: **Kubernetes Pod Survival Lab**.
4. V1 core dùng **CSS + Web Animations API + inline SVG**, không thêm animation library.
5. Thực hiện một spike riêng cho **Three.js Node cutaway**. Chỉ merge vào core experience khi đạt SVG parity, accessibility fallback, performance budget và learning gate; DOKS 3D đứng sau quyết định này.

Chỉ cần thay đổi các mặc định trên nếu scope sản phẩm yêu cầu khác; concept đã đủ cụ thể để chuyển sang interaction storyboard và implementation plan.
