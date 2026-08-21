# Scheduler Pipeline — Walkthrough & UX/UI Audit

Ngày: 2026-08-14 · Chạy: `k8s-flow-3d.html` → kịch bản "Scheduler Pipeline"
Đã chạy hết 24 runtime phase + ~21 explain beat (9 authored step).

Working tree đang giữa refactor: panel chữ bị ẩn bằng CSS, lời giải thích chuyển
vào cảnh dạng "explain beats" (`flow3d-engine-explain-beats.js`, chưa commit).
Hầu hết phát hiện dưới đây là hệ quả của việc refactor mới đi được một nửa.

---

## A. Bug (có file:line, sửa được ngay)

### A1. `undefined` trong tiêu đề step cuối — off-by-one
`flow3d/flow3d-engine-ui-controller.js:109`
```js
showIntro('①②③④⑤⑥⑦⑧⑨'[step.stepNo] + ' ' + step.title, ...)
```
`stepNo` là 1-based (`flow3d-engine-scenario-registry.js:141` → `si + 1`), index
chuỗi là 0-based. Hệ quả:
- step 1 hiện ②, step 2 hiện ③ … lệch 1 suốt kịch bản
- step 9 → `'…⑨'[9]` = `undefined` → **"undefined Pod Running — cả cluster biết tin"**

Fix: `[step.stepNo - 1]`. Kèm theo: mọi cross-reference viết tay trong desc
("bước ③", "bước ⑤", "bước ⑦–⑧") đang so với con số SAI đang hiển thị — sau khi
fix off-by-one phải rà lại toàn bộ. Chuỗi glyph cũng nên nới hoặc fallback số
thường khi `stepCount > 9`.

### A2. Chữ dính liền trong step-intro card
`flow3d/flow3d-kit-panel-and-hud.js:50` (`KIT.desc`) sinh
`<span class="lead">…</span>` + body + `<span class="why">…</span>`, nhưng
`flow3d.css:164-169` chỉ style `.lead` / `.why` **trong phạm vi `.e-desc`**.
`#intro-desc` không có class đó → span thành inline → mất xuống dòng:

> "…nguồn sự thật duy nhất của cluster.**Hai** field quyết định…"
> "…scheduler dùng ở bước ③, chỉ khác bộ lọc.**Cùng** mô hình Watch…"
> "…NodeAffinity ✓.**NodeResourcesFit** so với requests…"

Xuất hiện ở mọi step-intro có `why` (step 2,4,5,6,7,8,9).
Fix: bỏ scope `.e-desc` khỏi `.lead`/`.why`, hoặc thêm `#intro-desc` vào selector.

### A3. Label ngoài khung bị KẸP vào mép thay vì ẩn
`flow3d/flow3d-engine-render-loop.js:58,78-79`
```js
const visible = _v3.z < 1;          // chỉ kiểm tra depth, không kiểm tra x/y
sx = Math.max(w/2, Math.min(W - w/2, sx));
sy = Math.max(h/2, Math.min(H - h/2, sy));
```
Node nằm ngoài frustum trái/phải vẫn `visible === true`, rồi bị clamp về mép.
Kết quả quan sát được: caption Worker B/C ("Gần kín CPU — trượt NodeResourcesFit",
"Rỗng nhất cluster — nhưng mang taint…") xếp thành cột chữ hẹp **đè lên panel
KỊCH BẢN** ở góc phải, kéo dài qua ~8 phase liên tiếp. Tương tự ở mép dưới-trái
("④ 4 Node → 2 Node qua được Filter" bị cắt tại x=0) và mép trên.

Fix: thêm điều kiện `Math.abs(_v3.x) <= 1 && Math.abs(_v3.y) <= 1` vào `visible`
(có margin), hoặc fade-out theo khoảng cách ra mép thay vì clamp cứng.

### A4. Hai bubble mâu thuẫn cùng lúc
Ở phase sandbox (step ⑨) có đồng thời:
- explain beat: "Sandbox là một pause container tí hon…"
- componentIntro bubble: "Đây là workload process thực sự được cgroups/namespaces cô lập."

`componentIntro` (`…-scheduler-pipeline.js:78-87`) vẫn còn hoạt động song song
với hệ beat mới. Hai hệ giải thích chưa được hoà giải. Ngoài ra beat bubble neo
vào node `sandbox` khi node đó chưa hiện → mũi tên chỉ vào khoảng trống.

### A5. Pipeline bar không bao giờ chạm RUNNING đúng lúc
Suốt toàn bộ step ⑨ (containerd/CRI/probes) HUD vẫn sáng ở `KUBELET`;
`RUNNING` chỉ bật ở beat cuối cùng. Đồng thời **CRI không có stage riêng** trong
`pipeline[]` (7 stage: Client, etcd, Queue, Filter/Score, Bind, kubelet, Running)
dù nó là step nặng nhất, dài nhất. Người xem mất la bàn ở đúng đoạn dài nhất.

### A6. Bubble intro của pipelineIntro chồng nhau
`pipelineIntro.bubbles` đặt `dur: 0.6` với khoảng cách `at` 0.8s — comment trong
`…-scheduler-pipeline.js:66-68` nói rõ "keep `dur` under the gap or two badges end
up on screen at once". Thực tế quan sát: Pod + Scheduler + kubelet hiện đồng thời
ở giây ~4. Bubble không tắt đúng `dur`.

---

## B. UX — vấn đề trải nghiệm

### B1. Hai hệ giải thích cạnh tranh, cùng nội dung
Mỗi step mở bằng **full-screen intro card** (làm tối toàn cảnh, ~130 từ), rồi
lập tức kể LẠI cùng nội dung đó bằng 2–5 explain beat trong cảnh. Người xem đọc
hai lần cùng một đoạn văn. Card step ④ và step ⑨ dài tới mức phải cuộn mắt.

**Đề xuất:** intro card chỉ giữ **tiêu đề + 1 câu hook** (≤25 từ). Toàn bộ body
thuộc về beats — đó chính là lý do beats tồn tại. Card dài như hiện tại vừa
spoil vừa làm nhịp beat thành thừa.

### B2. Không có tín hiệu tiến trình
- `#panel-position` ("Step 1/9") bị ẩn ở `flow3d.css:346`
- Chỉ còn `.dots` — vài chấm 3px, gần như vô hình, và **không đếm beat**
- Người xem không biết còn 3 hay 30 cú Next nữa

**Đề xuất:** một thanh mảnh trên `#explain-nav`: `Step 5/9 · nhịp 2/4`, hoặc
segmented progress hiển thị đủ 24 phase với vị trí hiện tại. Rẻ, giải quyết được
cảm giác "bấm Next vô định" — vấn đề lớn nhất của bản build này.

### B3. Prev không lùi được beat
`Prev` disabled trong toàn bộ step 1 và chỉ nhảy theo phase, không lùi theo beat.
Lỡ tay Next là mất một lời giải thích, không lấy lại được. Beats là đơn vị điều
hướng chính thì Prev phải đối xứng với Next.

### B4. Camera nhảy giữa các beat cùng một chủ thể
`playNextBeat` gọi `frameNodeKeys` mỗi nhịp, kể cả khi `of` không đổi (3 beat liên
tiếp về `etcd`, 4 beat về `apiserver`). Khung hình trôi nhẹ mỗi lần Next mà không
mang thông tin gì → cảm giác lag, mắt phải bắt lại.

**Đề xuất:** bỏ qua re-frame nếu `keys` giống hệt beat trước.

### B5. Zoom một-node phá bố cục với shape cao
Cự ly bị kẹp ở đáy dải (24) nên etcd (cylinder cao) biến thành cột trong suốt
tràn hết chiều cao viewport, không đọc được hình dạng. `frameNodeKeys` cần tính
theo bounding-box (kể cả chiều cao) chứ không chỉ span ngang.

### B6. Bubble che đúng chủ thể nó đang nói
Bubble neo `offset y = 2.4` treo ngay trên đầu node và **đè lên caption của node
đó** (Authn·Authr, Admission, leader·followers đều bị che). Nên né sang bên khi
node nằm giữa khung, hoặc đẩy cao hơn khi node thấp.

### B7. Pipeline HUD che đáy cảnh
Ở phase Filter, label "Worker A" bị thanh pipeline (`bottom:18px`, cao 41px) cắt
mất. Cần padding đáy cho camera framing hoặc `labelEls` tránh vùng HUD.

### B8. Bấm Next không đổi gì
Ít nhất 2 lần (phase queue) một cú Next chỉ dịch camera vài pixel, không có beat,
không có state change. Cú bấm chết làm người xem tưởng UI đơ.

---

## C. Consistency

### C1. Ngôn ngữ trực quan bị vỡ ở khoảnh khắc quan trọng nhất
Worker A: xanh (pass) → **vàng** (score 94 ★, winner) → **xanh lại** (selected node).
Đúng lúc công bố người thắng thì màu quay về giống hệt kẻ thua (Worker D cũng xanh).
Winner nên giữ vàng/gold từ lúc thắng đến hết kịch bản.

### C2. State badge biến mất không lý do
- `NodeResourcesFit ✓` trên Worker A mất khi chip xuất hiện trên Worker D
- `Insufficient cpu` (B) mất khi `untolerated taint` (C) hiện, dù B vẫn đỏ
- Sau Bind, TOÀN BỘ màu filter/score của 4 node biến mất → node trở về xám xanh

Filter/Score là kết luận của cả kịch bản. Xoá nó đi là xoá luôn bằng chứng.
**Đề xuất:** badge kết quả là `persistent`, chỉ mờ đi chứ không remove.

### C3. Score HUD spoil kết quả và lạc ngôn ngữ
`#score-hud` bật ngay khi vào step Score, hiện sẵn A=94 / D=71 **trước** khi beat
giải thích vì sao. Ngoài ra nó là panel 2D bar-chart góc trên-trái, không dùng
chung token/khoảng cách với `#flow-panel` (top-left 15px vs top-right 12px), và
biến mất im lặng ở step Bind.

**Đề xuất:** reveal từng dòng theo beat; thống nhất khung/spacing với `#flow-panel`.

### C4. Nội dung nói mà hình không có
- Beat Raft: "leader đề xuất write, gửi tới các member, chờ quá bán (quorum)" —
  cảnh chỉ có MỘT hình trụ etcd. Không có member, không có quorum.
- `componentIntro` khai `containerd`, `sandbox`, `container`, `ctrlmgr`,
  `kubeproxy` — phần lớn không bao giờ được trigger trong luồng chạy.

### C5. Vị trí/kích thước intro overlay
`pipelineIntro` card canh trái-giữa (`.pipeline-mode` → `align-items:flex-start`)
đè lên node Client trong cảnh, trong khi step-intro card canh giữa. Hai overlay
cùng vai trò, hai bố cục khác nhau.

### C6. Nút Next tồn tại hai chỗ
Next trong intro card (giữa màn) và Next trong panel (góc phải) cùng lúc, khác
kích thước, khác style. Trong lần chạy đầu tôi click nhầm vì card không tự đóng.

---

## D. Ưu tiên đề nghị

| # | Việc | Chi phí |
|---|------|---------|
| 1 | A1 off-by-one `stepNo` (+ rà cross-reference) | 1 dòng + soát text |
| 2 | A2 `.lead`/`.why` ngoài `.e-desc` | 1 dòng CSS |
| 3 | A3 frustum check cho label | ~3 dòng |
| 4 | B2 chỉ báo tiến trình step/beat | nhỏ |
| 5 | C1 + C2 giữ màu winner & badge kết quả | vừa |
| 6 | B1 cắt ngắn intro card còn tiêu đề + hook | soát nội dung 9 step |
| 7 | B3 Prev đối xứng với beat | vừa |
| 8 | A4 hoà giải componentIntro với explain beats | cần quyết định thiết kế |
| 9 | B4/B5 camera framing theo bbox, bỏ re-frame trùng | vừa |
| 10 | A5 thêm stage CRI vào pipeline | nhỏ |

---

## Câu hỏi chưa giải quyết

1. `componentIntro` có còn giữ không sau khi có explain beats, hay xoá hẳn?
2. Panel chữ bị ẩn (`flow3d.css:346` ghi "TẠM THỜI") — ẩn vĩnh viễn hay sẽ bật lại
   ở màn hình rộng? Ảnh hưởng tới việc có cần chỉ báo tiến trình riêng hay không.
3. Step-intro card giữ lại ở dạng nào — hook ngắn, hay bỏ hẳn để beats gánh?
4. Raft/quorum có định dựng thêm etcd member vào world không, hay viết lại lời cho
   khớp với một-node?
