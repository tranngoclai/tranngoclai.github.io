# UI/UX concept report — Kubernetes Pod Survival Lab

**Status:** Revised — animation-first direction  
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
- Click thuộc tính bị dim mở tooltip ngắn: `Not used by kubelet eviction`.
- SVG chỉ là visual surface khi đã có HTML control tương đương. Pod/node/shield selection dùng native button/list nằm đồng bộ với SVG; nếu một SVG element thật sự interactive thì phải focusable, có accessible name, keyboard activation và trạng thái selected rõ.

### Feedback states

Mọi action có đủ trạng thái:

```text
idle → armed → running → decision → explained → replayable
```

Không dùng toast cho kiến thức quan trọng. Feedback phải nằm sát stage hoặc control gây ra outcome.

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

Các control icon-only cần `aria-label`; nút toggle cần `aria-pressed`; timeline cần tên step bằng text, không chỉ chấm màu.

### Recommended visual primitives

- Inline SVG cho topology, rails, gates, connector và radar.
- CSS custom properties cho design/motion tokens.
- CSS transitions/animations hoặc Web Animations API cho sequence có thể pause/seek.
- Canvas chỉ dùng khi có nhiều process/particle cần redraw liên tục; luôn có text fallback.
- Không dùng WebGL, generated raster asset hoặc animation library nặng trong v1.

## 14. Accessibility và reduced motion

- Toàn bộ lesson hoàn thành được bằng keyboard.
- Touch target tối thiểu 44×44px.
- Focus ring luôn thấy rõ trong dark và light mode.
- Outcome/comparator update dùng `aria-live="polite"` và `aria-atomic="true"` khi phù hợp.
- Animation không được tự chuyển focus hoặc auto-scroll.
- Drag-and-drop có click/select fallback.
- SVG có title/description hoặc bảng trạng thái tương đương.
- Canvas có fallback text mô tả state hiện tại.
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

### Mobile 375–767px

- Single column, stage trước controls.
- Stage chuyển từ rail ngang sang rail dọc hoặc snap theo từng decision frame.
- Event sorter dùng tap/select, không yêu cầu drag.
- Playback deck sticky dưới viewport nhưng không che nội dung/focus.
- Tables chuyển thành card list hoặc region có label rõ.
- Không có horizontal page overflow.
- Không bỏ animation; dùng choreography ngắn hơn và ít object hơn.

## 16. Technical direction

Khuyến nghị bám kiến trúc lesson hiện có:

- Một file HTML lesson độc lập.
- Shared CSS/theme assets từ repo.
- Vanilla JavaScript.
- Inline SVG và data-driven scenario objects.
- Không thêm dependency hoặc build step.

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

### Performance budget

- Chỉ animate `transform` và `opacity` trong hot path.
- Tối đa 1–2 focal animation cùng lúc.
- Pause timer/animation khi tab hidden.
- Không tạo animation loop khi scene off-screen.
- SVG DOM giữ gọn; canvas chỉ redraw khi state thay đổi.
- Tránh layout shift khi outcome hoặc drawer xuất hiện.
- Target 60fps trên desktop phổ thông và mobile tầm trung; nếu không giữ được, giảm object trước khi giảm accessibility.

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
- Play button có `aria-pressed`; animation luôn có Pause/Skip.
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
- [ ] Stage có ý nghĩa ở 375px, 768px, 1024px và 1440px, không horizontal overflow.
- [ ] Motion dùng transform/opacity trong hot path và pause khi tab hidden.
- [ ] Shared visual identity của site được giữ.
- [ ] Không thêm framework, animation dependency hoặc build step trong v1.

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

### Could have

- Save lesson progress trong `localStorage`.
- Shareable finale score.
- Subtle sound design có opt-in.
- Optional haptic confirmation trên thiết bị hỗ trợ.

Không triển khai sound, haptic, progress persistence hoặc shareable score ở phiên bản đầu nếu chưa có yêu cầu riêng.

## 22. Decisions before implementation

Đề xuất chốt mặc định:

1. Dùng **4 playable scene**; các topic nhỏ trở thành round hoặc reference drawer.
2. Finale dùng **DOKS scenario** từ report để giữ tính thực tế; scenario data tách riêng để có thể generic hóa sau.
3. Tên hiển thị: **One Pod, Three Judges**; subtitle: **Kubernetes Pod Survival Lab**.
4. V1 dùng **CSS + Web Animations API + inline SVG**, không thêm animation library.

Chỉ cần thay đổi các mặc định trên nếu scope sản phẩm yêu cầu khác; concept đã đủ cụ thể để chuyển sang interaction storyboard và implementation plan.
