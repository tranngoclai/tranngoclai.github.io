# Scheduler Pipeline — fix theo UX audit 260814

Ngày: 2026-08-14 · Nguồn: `reviewer-260814-scheduler-pipeline-ux-audit.md`
Spec nền: `proposal-260812-scheduler-pipeline-animation-types.md` (5 yêu cầu đã
implement từ trước; phần việc còn lại là làm chúng chạy đúng).

Quyết định thiết kế của user áp dụng trong lần này:
- Xoá hẳn `componentIntro` — explain beats là kênh giải thích duy nhất.
- Step-intro card = tiêu đề + 1 câu hook (≤25 từ), thân bài thuộc về beats.

---

## Đã sửa

| # | Vấn đề | Sửa ở |
|---|---|---|
| A1 | `undefined` ở tiêu đề step ⑨, lệch glyph toàn kịch bản | `flow3d-engine-ui-controller.js` — `stepGlyph()`, `[stepNo-1]`, fallback số thường khi `stepCount` > bộ glyph |
| A2 | Chữ dính liền trong intro card | Hết vì B1: `#intro-desc` giờ nhận plain text (`stepIntroHook`), không còn span inline |
| A3 | Label ngoài frustum bị clamp vào mép, đè panel | `flow3d-engine-render-loop.js` — `visible` kiểm tra cả `x`/`y` NDC (`NDC_MARGIN`) |
| A4 | Hai hệ giải thích chồng nhau | Xoá `KIT.componentIntro`, `queueComponentIntro`, registry `componentIntro` và 4 call-site |
| A5 | CRI không có stage riêng | Thêm `KIT.stage('📦','CRI')`; ⑧ → `pipelineStep 6`, ⑨ → `7` |
| A6 | Bubble pipelineIntro chồng nhau | `labelFocusOnly = true` trong `startPipelineIntro` — mỗi lượt spotlight chỉ để lại một tên |
| B1 | Intro card kể lại nguyên nội dung beats | `stepIntroHook()` chỉ lấy `.lead`; đo được 16–24 từ / 9 step |
| B2 | Không có tín hiệu tiến trình | `#nav-progress` (3 deck html + CSS) — `Step 5/9 · nhịp 2/4`, đếm cả beat |
| B3 | Prev không lùi được beat | `playPrevBeat()`; `prev()` thử beat trước rồi mới sang phase; `btn-prev` mở khi còn beat đã đọc |
| B4 | Camera nhảy giữa các beat cùng chủ thể | `beatFramedKeys` — bỏ re-frame khi `of` không đổi |
| B5 | Zoom một-node phá bố cục với shape cao | `frameNodeKeys` tính cả chiều cao bbox (`(hi[1]-lo[1]) * 1.9`) |
| B7 | Pipeline HUD cắt label đáy cảnh | `HUD_RESERVE` — clamp `sy` trên thanh pipeline khi nó đang hiện |
| C1 | Winner đổi về xanh đúng lúc công bố | Step ⑤ p3: `KIT.mark('crown', …)` + `status:'winner'` |
| C2 | Badge kết quả biến mất | `KIT.beat` truyền `status`; Filter set `passed`/`rejected` — chip được replay nên sống qua step |
| C5 | pipelineIntro card canh trái, lệch step-intro | CSS: `justify-content:flex-start` thay `align-items:flex-start` |

Cross-reference viết tay trong `desc` (`bước ③`, `⑤`, `⑦–⑧`) và glyph mở đầu mọi
`KIT.note` đã rà lại: chúng vốn đúng, chỉ phần hiển thị lệch. Không sửa nội dung.

## Verify đã chạy

`k8s-flow-3d.html` qua HTTP, Chrome:
- 9 intro title: `① … ⑨`, không còn `undefined`; hook 16–24 từ.
- Pipeline 8 stage; map step→stage đúng (⑧ CRI, ⑨ Running).
- `componentIntro` = `undefined` cả ở scenario lẫn `SCENE_KIT`.
- Sau Bind (step ⑥): `★Winner` vàng `#fbbf24` trên Worker A, `✓Pass` (D),
  `✕Fail` (B, C) — cả 4 verdict còn nguyên.
- Prev: `nhịp 2/3 → 1/3` trong cùng phase, rồi mới rơi sang phase trước.
- etcd (cylinder) lọt hết khung ở beat step ②.
- `ecommerce-cache-flow-3d` và `livestream-flow-3d` load bình thường; deck không
  có beat thì `#nav-progress` chỉ hiện `Step 1/5`.
- `node --check` sạch trên toàn bộ `flow3d/*.js`, `k8s-flow-3d/*.js`.

Không chạy được: click-through toàn bộ 24 phase. Timer/rAF của Chrome bị throttle
nặng khi cửa sổ không ở foreground (một tick 150ms mất ~5s), nên phải verify bằng
jump trực tiếp (`loadStep`) + đọc state thay vì bấm Next tuần tự.

## Chưa sửa (ngoài phạm vi đã chốt)

| # | Vấn đề | Vì sao để lại |
|---|---|---|
| B6 | Bubble che caption của chính chủ thể | Đỡ hơn nhờ A3/B5 nhưng chưa có logic né sang bên; cần quy tắc đặt bubble theo vị trí node trong khung |
| B8 | Có cú Next không đổi gì (phase queue) | Cần soát nội dung từng phase, không phải một fix engine |
| C3 | Score HUD spoil điểm trước beat, lệch token với `#flow-panel` | Cần reveal từng dòng theo beat — đụng vào hợp đồng `scoreMode`/`queueScoreHud` |
| C4 | Beat Raft nói leader/follower/quorum, cảnh chỉ có một trụ etcd | Là câu hỏi mở #4 của audit: dựng thêm etcd member vào world, hay viết lại lời cho một-node |
| C6 | Next tồn tại hai chỗ (card giữa màn + panel) | Cần quyết định: card giữ nút riêng hay chỉ dựa vào panel |

## Câu hỏi chưa giải quyết

1. C4: thêm 2 etcd member vào `scheduler-world` hay sửa lời beat Raft cho khớp
   một node? (Ảnh hưởng cả layout Control Plane.)
2. `flow3d.css:346` ẩn panel chữ ghi "TẠM THỜI" — ẩn vĩnh viễn? Nếu bật lại thì
   `#nav-progress` trùng vai với `#panel-position`, nên bỏ một trong hai.
3. C6: bỏ `#intro-skip` và để panel Next gánh, hay giữ hai nút?
