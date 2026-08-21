# Đề xuất cải thiện kịch bản Scheduler Pipeline — 4 loại animation

**Ngày:** 2026-08-12
**Scope:** `k8s-flow-3d/k8s-flow-3d-scenario-scheduler-pipeline*.js` + Flow3D engine (`flow3d/`)
**Mục tiêu:** Thêm 4 loại animation rõ ràng theo vai trò của từng phase, thay vì mọi phase cùng dùng chung một kiểu trình bày.

---

## Bối cảnh

Kịch bản Scheduler Pipeline gồm 9 steps, ~22 phases, chia thành hai file:
- `k8s-flow-3d-scenario-scheduler-pipeline-control-plane.js` (steps ①–⑤)
- `k8s-flow-3d-scenario-scheduler-pipeline-node.js` (steps ⑥–⑨)

Mỗi phase hiện tại dùng chung mô hình: `desc` (panel text) + `set` (state change) + `scene` (flow arrow / note). Vấn đề: mọi phase trông giống nhau dù vai trò khác nhau — phase giới thiệu component, phase có action mũi tên, phase đổi trạng thái đều render cùng cách.

---

## Yêu cầu 1 · Label mũi tên ghi action

### Hiện trạng: ✅ Đã hỗ trợ

`KIT.link()` nhận param `label` và engine render nó tại midpoint của arc. Opacity đồng bộ frame-by-frame với draw/hold/fade cycle của arrow line (`addFlowLabel()` + `updateFlows()`).

**Đã có label tại các phase chính:**

| Step | Phase | Arrow label |
|------|-------|-------------|
| ① | kubectl → authn | `POST deployments` |
| ① | authn → admission | `authorize · RBAC` |
| ① | admission → apiserver | `admit request` |
| ② | apiserver → etcd | `PUT Pod · Pending` |
| ② | apiserver → client | `201 Created` |
| ③ | apiserver → scheduler | `watch event` |
| ③ | scheduler → queue | `push to ActiveQ` |
| ③ | etcd → queue | `enqueue by priority` |
| ④ | scheduler → node-* | `Filter pass` / `<plugin> fail` |
| ⑤ | scheduler → node-d/a | `score 71` / `score 94` |
| ⑥ | scheduler → apiserver | `POST .../binding` |
| ⑥ | apiserver → etcd | `PUT nodeName ← worker-a` |
| ⑦ | apiserver → kubelet | `WATCH spec.nodeName` |
| ⑦ | queue → pod | `pop from ActiveQ` |
| ⑧ | kubelet → containerd | `CRI PullImage` |
| ⑧ | containerd → sandbox | `RunPodSandbox` |
| ⑧ | sandbox → container | `CreateContainer + StartContainer` |
| ⑨ | kubelet → apiserver | `PATCH pods/status` |
| ⑨ | apiserver → etcd | `PUT status: Running` |
| ⑨ | apiserver → ctrlmgr | `watch replica count` |
| ⑨ | apiserver → kubeproxy | `watch EndpointSlice` |

### Điểm cần cải thiện nhỏ

Một số phase dùng `KIT.note()` riêng biệt thay vì gắn label trực tiếp lên mũi tên. Ví dụ step ③ phase 1:
```js
// Hiện tại: note đứng riêng, không gắn vào arrow
KIT.note(a, 'WATCH pods?fieldSelector=spec.nodeName=', 'scheduler', 'accent', 0.2);
```
Nên chuyển text action vào `label` param của `KIT.link()` cho thống nhất.

### Kết luận

Effort: ~5 LOC review/fix. Priority: **Thấp** — cơ bản đã đủ.

---

## Yêu cầu 2 · Bong bóng chat giới thiệu component

### Hiện trạng: ❌ Chưa có primitive

Engine chỉ có:
- `KIT.note()` → caption tĩnh, font nhỏ, không có tail pointing xuống component
- `KIT.pulse()` → flash + badge ngắn trên component
- Panel text (desc) → nằm ngoài scene, ở aside panel

Những phase "giới thiệu" (ví dụ step ⑨ phase cuối giải thích kube-proxy, step ② phase 2 giải thích Raft consensus) chỉ có desc text ở panel — 3D scene không có gì đáng kể ngoài `KIT.note` hoặc `KIT.pulse`.

### Đề xuất: Thêm primitive `KIT.bubble()`

**API:**
```
KIT.bubble(a, componentKey, text, {at, dur, tone, tail})
```

| Param | Mô tả |
|---|---|
| `componentKey` | Node key trong world — bubble gắn vào component đó |
| `text` | Nội dung ngắn (1–2 dòng) |
| `at` | Delay trước khi hiện (giây) |
| `dur` | Thời gian hiện (giây), sau đó fade out |
| `tone` | Màu viền/nền theo design token |
| `tail` | Hướng tail (`'bottom'` mặc định — pointing xuống component) |

**Triển khai chi tiết:**

1. **HTML overlay** — cùng hệ thống label hiện tại (`#labels` container), dùng class `fl-bubble` thay vì `fl-label`.

2. **CSS:**
```css
.fl-bubble {
  position: absolute;
  background: rgba(22, 30, 50, 0.88);
  border: 1px solid rgba(58, 127, 255, 0.35);
  border-radius: 10px;
  padding: 6px 12px;
  font-size: 13px;
  color: rgba(210, 224, 245, 0.92);
  max-width: 180px;
  text-align: center;
  pointer-events: none;
  opacity: 0;
  transform: scale(0.85) translateY(6px);
  transition: opacity 0.25s, transform 0.25s ease-out;
}
.fl-bubble.visible {
  opacity: 1;
  transform: scale(1) translateY(0);
}
.fl-bubble::after {
  content: '';
  position: absolute;
  bottom: -7px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 7px solid rgba(58, 127, 255, 0.35);
}
```

3. **Engine — bubble queue (thêm vào `flow3d-engine-animation-helpers.js`):**
```js
function addBubble(text, anchorKey, opts) {
  const node = worldNodes[anchorKey];
  if (!node || !node.labelObj) return;

  const div = document.createElement('div');
  div.className = 'fl-label fl-bubble';
  div.innerHTML = text;
  div.style.setProperty('--bubble-ink', SCENE_KIT.ink(opts.tone || 'accent'));
  labelsDiv.appendChild(div);

  const at = opts.at || 0;
  const dur = opts.dur || 3;
  // Timers thuộc transition generation để rapid Next/Prev không để lại DOM cũ.
  scheduleTransition(() => div.classList.add('visible'), at * 1000 + 200, transitionGeneration);
  scheduleTransition(() => fadeLabel(div), (at + dur) * 1000 + 200, transitionGeneration);
  // Reuse the node caption's live anchor. updateLabels() applies `offset`,
  // so camera orbit *and* node movement keep the bubble attached.
  labelEls.push({
    div, obj: node.labelObj, persistent: buildPersistent,
    offset: [0, opts.dy === undefined ? 2.4 : opts.dy, 0]
  });
}
```

`updateLabels()` cộng `item.offset` (nếu có) sau `setFromMatrixPosition()` trước khi project. Đây là phần bắt buộc; không tạo `Object3D` đứng yên trong `stepGroup`, vì cách đó không theo được component đang tween vị trí.

4. **KIT wrapper (`flow3d-kit-state-marks.js`):**
```js
KIT.bubble = function(a, key, text, o) {
  o = o || {};
  addBubble(text, key, {
    at: o.at || 0,
    dur: o.dur || 3,
    dy: o.dy,
    tone: o.tone || 'accent'
  });
};
```

`a` được giữ trong API để call-site đồng nhất với `KIT.link()`/`KIT.note()`; bubble là overlay nên không cần gọi build method của context.

**Hỗ trợ nhiều bubble cùng lúc:** mỗi bubble có `at` riêng, stagger entrance. Khác với badge (1 per node), bubbles cho phép đồng thời trên nhiều component.

**Ví dụ sử dụng trong kịch bản:**

Step ② phase 2 (giải thích Raft — phase giới thiệu thuần tuý):
```js
scene(a) {
  KIT.bubble(a, 'etcd', 'leader → followers', {at: 0.3, dur: 3});
  KIT.bubble(a, 'etcd', 'quorum ✓', {at: 1.5, dur: 2.5, tone: 'ok'});
}
```

Step ⑨ phase cuối (kube-proxy nhận EndpointSlice):
```js
scene(a) {
  KIT.link(a, 'apiserver', 'kubeproxy', 'info', {...});
  KIT.bubble(a, 'kubeproxy', 'iptables/ipvs synced', {at: 0.5, dur: 4});
  KIT.bubble(a, 'pod', 'nhận traffic!', {at: 1.2, dur: 3.5, tone: 'ok'});
}
```

Step ⑧ phase 4 (probes — giới thiệu ba loại probe):
```js
scene(a) {
  KIT.bubble(a, 'container', 'Startup ✓', {at: 0.3, dur: 2.5});
  KIT.bubble(a, 'container', 'Liveness ✓', {at: 1.0, dur: 2.5, tone: 'ok'});
  KIT.bubble(a, 'kubelet', 'Readiness ✓ → traffic', {at: 1.7, dur: 2.5, tone: 'ok'});
}
```

### Effort

~120 LOC: ~25 LOC KIT helper, ~55 LOC helper/lifecycle, ~40 LOC CSS. Bubble tái sử dụng `labelEls`, `updateLabels()`, `scheduleTransition()` và `clearTransientLabels()`; không tạo queue/teardown song song.

### Priority: **Cao**

Nhiều phase giới thiệu hiện tại "trống" về mặt 3D — chỉ có panel text mà scene không diễn gì đáng kể.

---

## Yêu cầu 3 · Đổi trạng thái → Hiển thị label cũ trước, rồi animate đổi text

### Hiện trạng: ❌ Label nhảy ngay, không thấy trạng thái cũ

Khi `KIT.mark()` đổi trạng thái, engine:
1. Flash ring burst quanh component
2. Badge mới xuất hiện ngay (badge cũ bị `fadeLabel()` nếu có)
3. `setNodeLook()` đổi label ngay qua `n.labelDiv.innerHTML = look.label`

Người xem **không thấy trạng thái cũ** để so sánh "trước/sau".

### Đề xuất: "Ghost label" animation tại thời điểm `scheduleStateChange()` commit state

**Luồng mới khi label thay đổi với `animate = true`:**

```
T+0.0s  ┌─────────────────┐
        │  nodeName: ""    │  ← label cũ vẫn hiển thị
        │  (strikethrough) │  ← style muted + gạch ngang
        └─────────────────┘

T+0.4s  ┌─────────────────┐  ← ghost slide up + fade out
        │  ̶n̶o̶d̶e̶N̶a̶m̶e̶:̶ ̶"̶"̶   │
        ├─────────────────┤
        │  nodeName:       │  ← label mới slide in từ dưới
        │  "worker-a"      │
        └─────────────────┘

T+0.8s  ┌─────────────────┐
        │  nodeName:       │  ← chỉ còn label mới
        │  "worker-a"      │
        └─────────────────┘
        ● ring burst       ← flash như cũ
```

`setNodeLook()` còn giữ vai trò apply state thuần túy. Không đặt animation ở đây: engine dùng nó để replay các phase quá khứ với `animate = false`; animation ở layer này có thể để lại ghost khi người xem Next/Prev nhanh.

**Triển khai — thêm helper vào `flow3d-engine-flow-state.js`, gọi duy nhất khi timed state của phase hiện tại được commit:**

```js
function animateLabelTransition(n, newLabel) {
  if (prefersReducedMotion || !n.labelDiv || newLabel === n.label) {
    n.labelDiv.innerHTML = newLabel;
    n.label = newLabel;
    return;
  }

  const ghost = n.labelDiv.cloneNode(true);
  ghost.classList.add('state-ghost');
  ghost.classList.remove('hero-label');
  ghost.style.opacity = '';
  n.labelDiv.parentElement.appendChild(ghost);
  labelEls.push({div: ghost, obj: n.labelObj, persistent: false});

  // Label mới commit ngay lúc state change; ghost cung cấp mốc "trước".
  n.labelDiv.innerHTML = newLabel;
  n.label = newLabel;
  n.labelDiv.classList.add('state-enter');

  scheduleTransition(function() {
    ghost.classList.add('ghost-exit');
  }, 280, transitionGeneration);
  scheduleTransition(function() {
    fadeLabel(ghost);
    n.labelDiv.classList.remove('state-enter');
  }, 680, transitionGeneration);
}

// Trong updateStates(), lúc timed state của phase hiện tại bắt đầu:
if (!s.applied) {
  s.applied = true;
  if (s.look.reveal) revealNode(s.n);
  if (s.look.conceal) concealNode(s.n);
  if (s.look.label !== undefined && s.look.label !== s.n.label) {
    const lookWithoutLabel = Object.assign({}, s.look);
    delete lookWithoutLabel.label;
    setNodeLook(s.n, lookWithoutLabel, true);
    animateLabelTransition(s.n, s.look.label);
  } else {
    setNodeLook(s.n, s.look, true);
  }
}
```

**CSS additions:**
```css
.state-ghost {
  opacity: 0.45 !important;
  text-decoration: line-through;
  transform: translate(-50%,-50%) translateY(0);
  transition: transform 0.4s ease-out, opacity 0.4s;
  color: rgba(255, 120, 100, 0.7) !important;
}
.ghost-exit {
  transform: translate(-50%,-50%) translateY(-14px);
  opacity: 0 !important;
}
.state-enter {
  animation: label-slide-up 0.35s ease-out;
}
@keyframes label-slide-up {
  from { transform: translate(-50%,-50%) translateY(10px); opacity: 0; }
  to   { transform: translate(-50%,-50%) translateY(0);    opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .state-ghost { transition: none; }
  .state-enter { animation: none; }
}
```

### Các phase được hưởng lợi

| Phase | Label cũ (ghost) | Label mới |
|---|---|---|
| ② phase 1 — Pod xuất hiện | _(component mới, không ghost)_ | `Pod · P=1000 · nodeName: "" · Pending` |
| ⑥ phase 3 — Bind ghi nodeName | `Pod · P=1000\nnodeName: ""` | `Pod · P=1000\nnodeName: "worker-a"` |
| ⑦ phase 2 — kubelet nhận Pod | `kubelet` | `kubelet\n✓ pod assigned` |
| ⑦ phase 3 — chuẩn bị deps | _(Pod mark)_ | `ContainerCreating` |
| ⑧ phase 1 — containerd pull | `containerd\n(CRI)` | `containerd\n▶ pull image` |
| ⑨ phase 3 — Running | `Pod · P=1000\nnodeName: "worker-a"` | `Pod · P=1000\nworker-a · Running ✓` |

### Effort

~70 LOC engine (`scheduleStateChange()` + helper) + ~30 LOC CSS.

### Priority: **Cao**

Đây là impact lớn nhất — hiện tại người xem không thấy "trước/sau" ở những khoảnh khắc quan trọng nhất (`Pending→Running`, `nodeName: ""→"worker-a"`).

---

## Yêu cầu 4 · Mỗi step hiển thị title + description ở center → animate lên top

### Hiện trạng: ❌ Chỉ có side panel cố định

Title + description nằm cố định tại `#flow-panel` (aside bên phải). Không có center overlay, không có animation chuyển vị trí khi đổi step.

### Đề xuất: "Step intro overlay"

Khi chuyển sang step MỚI (khác `stepNo`, không phải chỉ phase mới trong cùng step):

**Sequence:**
```
T+0.0s  ┌─────────────────────────────────────┐
        │                                     │
        │       ① Client → API Server         │  ← title lớn, center
        │       Bạn gửi Pod đi — API Server   │  ← desc lead, muted
        │       gác 3 cửa                     │
        │                                     │
        │     (dark overlay trên 3D scene)     │
        └─────────────────────────────────────┘

T+1.2s  ┌─────────────────────────────────────┐
(hoặc   │       ① Client → API Server         │  ← title fade + scale down
 click) │                                     │     (panel title đã hiện riêng)
        │          (3D scene hiện ra)          │
        │                                     │
        └─────────────────────────────────────┘

T+1.55s Panel title bình thường take over, overlay biến mất.
```

### Triển khai chi tiết

**HTML — thêm overlay vào `k8s-flow-3d.html`:**
```html
<div id="step-intro" class="step-intro" aria-hidden="true">
  <h2 id="intro-title"></h2>
  <p id="intro-desc"></p>
</div>
```

**CSS:**
```css
.step-intro {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: radial-gradient(
    ellipse at center,
    rgba(10, 14, 24, 0.92),
    rgba(10, 14, 24, 0.65)
  );
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s;
}
.step-intro.show {
  opacity: 1;
  pointer-events: auto;
}

#intro-title {
  font-size: 26px;
  font-weight: 700;
  color: rgba(210, 224, 245, 0.95);
  text-align: center;
  margin: 0;
  transition: transform 0.35s ease-out, opacity 0.35s ease-out;
}
#intro-desc {
  font-size: 15px;
  color: rgba(160, 180, 210, 0.75);
  text-align: center;
  max-width: 520px;
  margin-top: 12px;
  transition: opacity 0.3s;
}

.step-intro.exit #intro-title {
  transform: scale(0.82) translateY(-18px);
  opacity: 0;
}
.step-intro.exit #intro-desc {
  opacity: 0;
}
.step-intro.exit {
  background: transparent;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .step-intro { transition: none; }
  #intro-title { transition: none; }
  #intro-desc { transition: none; }
}
```

**Engine — tích hợp vào transition lifecycle trong `flow3d-engine-ui-controller.js`:**

```js
function showStepIntro(step, generation) {
  var el = document.getElementById('step-intro');
  var titleEl = document.getElementById('intro-title');
  var descEl = document.getElementById('intro-desc');

  // Step number prefix + title
  titleEl.textContent = '⓪①②③④⑤⑥⑦⑧⑨'[step.stepNo] + ' ' + step.title;

  // Desc là authored HTML, chỉ lấy nội dung plain-text của lead.
  var leadMatch = step.desc ? step.desc.match(/<span class="lead">(.*?)<\/span>/) : null;
  descEl.textContent = leadMatch ? leadMatch[1].replace(/<[^>]+>/g, '') : '';

  el.classList.remove('exit');
  el.classList.add('show');

  var dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    if (!isFlowGenerationCurrent(generation)) return;
    el.classList.add('exit');
    scheduleTransition(function() {
      el.classList.remove('show', 'exit');
    }, 350, generation);
  }

  // Auto-dismiss after 1.2s; all timers are cancellable by rapid navigation.
  scheduleTransition(dismiss, 1200, generation);

  // Click or key to skip
  el.onclick = dismiss;
  function keySkip(e) {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      dismiss();
    }
  }
  function clearKeySkip() { document.removeEventListener('keydown', keySkip); }
  document.addEventListener('keydown', keySkip);
  scheduleTransition(clearKeySkip, 1550, generation);
}

// Trong loadRuntime(), render và build vẫn chạy theo lifecycle cũ.
// Intro chỉ phủ lên scene trong thời gian ngắn, không trì hoãn buildRuntime().
function loadRuntime(sc, runtimeIndex, direction, options) {
  var step = sc.runtimePhases[runtimeIndex];
  renderPanel(sc, runtimeIndex, !!options.announceSelection);

  if (step.firstPhase && !prefersReducedMotion && direction !== undefined) {
    showStepIntro(step, generation);
  }
  // ... existing direction flash, fade và scheduled build logic không đổi ...
}
```

`cancelTransitionWork()` phải thêm `stepIntro.classList.remove('show', 'exit')` để navigation mới luôn xoá overlay cũ. `step.firstPhase` đã do registry compile sẵn, nên không cần mutable `lastStepNo`.

**Khi nào kích hoạt:** Chỉ với `step.firstPhase` và đang navigate (có `direction`). Không kích hoạt khi:
- Chỉ chuyển phase trong cùng step
- Load lần đầu (scenario select)
- `prefers-reduced-motion`

### Effort

~90 LOC JS + ~45 LOC CSS + ~5 LOC HTML.

### Priority: **Trung bình**

Cải thiện flow tổng thể khi chuyển step. Auto-delay 1.2s, click/Space/Enter/Escape để skip; một lượt không skip thêm tối đa ~11s trên 9 steps.

---

## Yêu cầu 5 · Mở đầu có bản đồ nhân vật; component phụ chỉ được giới thiệu sau action đầu tiên

### Mục tiêu UX mới

Người học phải có một bản đồ tối giản trước khi pipeline bắt đầu, rồi chỉ học thêm một component khi nó thực sự tham gia câu chuyện. Tránh hai cực đoan:

- Không đưa tất cả component lên màn hình đầu tiên: người học chưa có ngữ cảnh để nhớ `Admission`, `ActiveQ`, `containerd` hay `kube-proxy`.
- Không để một component xuất hiện lần đầu giữa một action mà không biết nó là ai.

**Quy tắc kể chuyện:** action luôn xảy ra trước. Nếu action đó là lần đầu component phụ tham gia, mũi tên/state change chạy xong, camera mới zoom vào component ấy và bubble mới nói nó là ai, làm gì. Như vậy câu hỏi tự nhiên của người học là “cái mới vừa phản ứng kia là gì?” — và bubble trả lời đúng lúc.

### 5.1 Mở đầu: chỉ giới thiệu 6 thành phần chính

Ngay sau khi chọn Scheduler Pipeline, trước Step ① Phase 1, hiển thị một **Pipeline map intro** riêng. Đây không phải một phase kỹ thuật và không thay đổi state của kịch bản.

| Thứ tự | Component chính | Bubble ngắn | Vai trò xuyên suốt |
|---|---|---|---|
| 1 | `client` / kubectl | `Bạn gửi desired state từ đây.` | Điểm khởi phát request |
| 2 | `apiserver` | `Cửa API duy nhất của cluster.` | Nhận, kiểm tra và công bố state |
| 3 | `etcd` | `Nguồn dữ liệu bền vững của cluster.` | Lưu desired/observed state |
| 4 | `scheduler` | `Chọn Node cho Pod Pending.` | Quyết định placement, không chạy container |
| 5 | `node-a` + `kubelet` | `Nơi Pod được hiện thực hoá.` | Kubelet phản ứng với Pod đã bind |
| 6 | `pod` | `Một workload đi suốt câu chuyện.` | Giữ cùng identity từ Pending đến Running |

**Choreography (khoảng 5.0–5.5s, có Skip):**

```text
T+0.0  Title + một câu premise ở center
T+0.3  Camera whole-cluster; client và apiserver sáng lên, 2 bubble đồng thời
T+1.2  etcd và scheduler sáng lên, 2 bubble đồng thời
T+2.1  Camera pan/zoom tới Worker A; node-a, kubelet và pod sáng lên, 2 bubble đồng thời
T+3.4  Bubbles mờ đi, camera trả về framing của Step ①
T+4.0  Step ① intro hiện như Yêu cầu 4, rồi action đầu tiên bắt đầu
```

Các bubble trong intro có thể đồng thời trong cùng một cụm vì chúng chỉ gắn các component chính đã được người học nhìn thấy. Không dùng arrow giả hay pulse có nghĩa nghiệp vụ: đây là **orienting overlay**, không phải một event Kubernetes.

**Copy đề xuất:** title `6 nhân vật, một vòng đời Pod`; premise `Theo một Pod từ lệnh kubectl đến khi cluster sẵn sàng nhận traffic.`

### 5.2 Component phụ: action → zoom → bubble

Mỗi component ngoài 6 component chính có một entry trong registry `componentIntro`. Registry là source of truth cho: component đã được giới thiệu chưa, action nào kích hoạt nó lần đầu, framing nào cần dùng và copy bubble. Không suy ra bằng title hoặc thứ tự phase — scenario có thể thay đổi/generate phase Filter sau này.

```js
const componentIntro = {
  authn: {
    after: {step: 1, phase: 1},
    focus: ['authn'],
    bubble: 'Authentication xác định bạn là ai.\nSai token/cert → 401.',
    tone: 'core'
  },
  admission: {
    after: {step: 1, phase: 3},
    focus: ['admission'],
    bubble: 'Admission mutate rồi validate request\ntrước khi API Server nhận.',
    tone: 'ok'
  },
  queue: {
    after: {step: 3, phase: 2},
    focus: ['scheduler', 'queue', 'pod'],
    bubble: 'ActiveQ là hàng chờ nội bộ\ncủa scheduler, không phải etcd.',
    tone: 'queue'
  },
  containerd: {
    after: {step: 8, phase: 1},
    focus: ['node-a', 'kubelet', 'containerd'],
    bubble: 'Container runtime nhận lệnh CRI\ntừ kubelet để dựng container.',
    tone: 'warn'
  },
  sandbox: {
    after: {step: 8, phase: 2},
    focus: ['sandbox', 'containerd'],
    bubble: 'Pod sandbox giữ network namespace\nvà IP cho các container trong Pod.',
    tone: 'ok'
  },
  container: {
    after: {step: 8, phase: 3},
    focus: ['container', 'sandbox'],
    bubble: 'Đây là workload process thực sự\nđược cgroups/namespaces cô lập.',
    tone: 'ok'
  },
  ctrlmgr: {
    after: {step: 9, phase: 4},
    focus: ['ctrlmgr', 'apiserver'],
    bubble: 'Controller Manager liên tục đối chiếu\nactual state với desired replicas.',
    tone: 'pass'
  },
  kubeproxy: {
    after: {step: 9, phase: 5},
    focus: ['node-a', 'kubeproxy', 'pod'],
    bubble: 'kube-proxy biến EndpointSlice\nthành rule route traffic tới Pod.',
    tone: 'info'
  }
};
```

`node-b`, `node-c`, `node-d` không cần bubble “component mới”: chúng là peer Node trong cùng vai trò đã được giới thiệu qua `node-a`. Khi Filter action tới từng peer, chỉ dùng verdict badge + arrow label; camera vẫn giữ framing nhiều Node để so sánh được.

| Lần đầu component phụ tham gia | Action phải hoàn tất trước | Zoom/bubble sau action |
|---|---|---|
| Authentication (① P1) | `client → authn` với `POST deployments` | Zoom `authn`; identity gate và 401 |
| Admission (① P3) | `authn → admission` với `authorize · RBAC` | Zoom `admission`; mutate + validate |
| ActiveQ (③ P2) | `scheduler → queue` với `push to ActiveQ` | Zoom `scheduler + queue + pod`; queue nội bộ |
| containerd (⑧ P1) | `kubelet → containerd` với `CRI PullImage` | Zoom node runtime boundary |
| sandbox (⑧ P2) | `containerd → sandbox` với `RunPodSandbox` | Zoom sandbox/network role |
| container (⑧ P3) | `sandbox → container` với `CreateContainer + StartContainer` | Zoom workload process |
| Controller Manager (⑨ P4) | `apiserver → ctrlmgr` với `watch replica count` | Zoom reconcile role |
| kube-proxy (⑨ P5) | `apiserver → kubeproxy` với `watch EndpointSlice` | Zoom service-routing role |

### 5.3 Runtime contract: không chặn action và không lặp introduction

`KIT.componentIntro()` là choreography overlay, tách khỏi `KIT.link()` và `KIT.mark()`. Action vẫn chạy theo timing authored của phase; engine chỉ schedule zoom/bubble **sau điểm kết thúc thực tế** của action (`at + dur`, hoặc `at` với pulse/mark). Không hard-code một delay chung 1.0s vì arrow durations khác nhau.

```js
// Chỉ call ở phase first appearance của component phụ.
scene(a) {
  KIT.link(a, 'kubelet', 'containerd', 'warn', {
    at: 0.30, dur: 0.85, loop: 3.4, label: 'CRI PullImage'
  });
  KIT.componentIntro(a, 'containerd', {after: 1.15, dur: 3.2});
}
```

Engine resolve entry theo `componentIntro[key]`, sau đó:

1. kiểm tra `introSeen[key]`; nếu đã giới thiệu ở current navigation generation thì no-op;
2. giữ framing của phase trong lúc mũi tên đang chạy;
3. khi action kết thúc, tween camera vào `entry.focus` (re-use phase `focus`, `cam`, `dist` resolver hiện có); 
4. tại lúc camera ổn định, gọi `KIT.bubble()` trên component mới;
5. hết `dur`, fade bubble và tween camera **trở lại framing authored của phase**; không tự nhảy Next và không đổi state.

`introSeen` thuộc transition generation/runtime replay, không phải một global “đã xem” vĩnh viễn. Vì vậy Prev → Next có thể xem lại introduction đúng ngữ cảnh; đổi scenario hoặc rapid Next/Prev không để camera/bubble cũ chạy lạc phase. Khi `prefers-reduced-motion`, bỏ tween và bubble animation: component vẫn nhận caption/accessibility text ở trạng thái cuối, action và controls không bị delay.

**Bắt buộc có Skip:** Pipeline map intro và mỗi component intro đều có click / Space / Enter / Escape để kết thúc overlay, dọn scheduled callbacks và khôi phục phase framing ngay. Một component intro không được làm Next/Prev vô hiệu quá thời gian cần thiết.

### 5.4 Thứ tự triển khai

Yêu cầu 2 (`KIT.bubble`) là nền tảng. Sau đó triển khai theo thứ tự:

1. Dùng `focus`/camera resolver hiện có để làm `KIT.componentIntro()` + cleanup theo `transitionGeneration`.
2. Khai `componentIntro` cho 8 component phụ ở Scheduler Pipeline và đặt call-site ngay sau action first appearance.
3. Thêm Pipeline map intro cho 6 component chính trước Step ①; nó phải hoàn tất hoặc bị Skip trước Step intro/action đầu tiên.
4. Browser QA toàn bộ luồng (cả replay và reduced motion), rồi mới tinh chỉnh copy/timing.

### Priority: **Cao**

Đây là nhịp học tập chủ đạo kết nối Yêu cầu 2 và 4: panel giải thích lý thuyết, arrow chứng minh quan hệ nhân-quả, zoom đặt sự chú ý đúng chỗ, rồi bubble đặt tên/role cho “nhân vật” vừa hành động.

---

## Tổng kết ưu tiên

| # | Yêu cầu | Trạng thái | Effort | Priority | Giá trị |
|---|---------|-----------|--------|----------|---------|
| 3 | State transition ghost label | ❌ Chưa có | ~100 LOC | **Cao** | Người xem thấy trước/sau ở các khoảnh khắc then chốt |
| 2 | Speech bubbles giới thiệu | ❌ Chưa có | ~120 LOC | **Cao** | Phase giới thiệu không còn "trống" trên 3D scene |
| 4 | Step intro overlay center→panel | ❌ Chưa có | ~140 LOC | Trung bình | Nhấn mạnh ranh giới giữa các step |
| 5 | Pipeline map intro + action→zoom→component bubble | ❌ Chưa có | ~170 LOC | **Cao** | Giới thiệu đúng component, đúng lúc, không phá nhịp nhân-quả |
| 1 | Arrow label review | ✅ Cơ bản đủ | ~5 LOC | Thấp | Thống nhất vài chỗ note → link label |

**Thứ tự đề xuất triển khai:** 3 → 2 → 5 → 4 → 1

**Tổng effort ước tính:** ~535 LOC (JS + CSS + HTML + Scheduler call-sites), không đụng tới cấu trúc kịch bản hiện tại — mỗi yêu cầu là additive, không break backward compatibility.

---

## Dependency map

```
Yêu cầu 1 (arrow label) ──── không phụ thuộc ── triển khai độc lập
Yêu cầu 2 (bubbles)     ──── thêm engine + KIT ── dùng lại labelEls/updateLabels/lifecycle
Yêu cầu 3 (ghost label) ──── sửa scheduleStateChange() ── chỉ animate state của phase hiện tại
Yêu cầu 4 (step intro)  ──── sửa loadRuntime() ── dùng step.firstPhase + transitionGeneration
Yêu cầu 5 (progressive intro) ── cần Yêu cầu 2 + focus/camera resolver + transitionGeneration
```

Yêu cầu 1, 3, 4 độc lập. Yêu cầu 5 phụ thuộc `KIT.bubble` của Yêu cầu 2; phần Pipeline map intro có thể làm song song với ghost label.

---

## Verification bắt buộc

1. Registry vẫn compile toàn bộ scenario, và Scheduler Pipeline mở được bình thường.
2. Bubble: orbit camera trong lúc bubble hiện; chuyển Next/Prev nhanh; xác nhận bubble bám component, không còn `.fl-bubble` cũ sau đổi phase.
3. Ghost label: chạy qua bind và `Pending → Running`, rồi Prev/Next liên tục; ghost chỉ xuất hiện khi timed state của phase hiện tại commit và không tồn tại sau cleanup.
4. Step intro: chỉ hiện tại first phase của step khi navigate; không hiện lúc đổi scenario/load đầu; click, Space, Enter, Escape đều skip; rapid navigation không render callback của generation cũ.
5. Kiểm tra `prefers-reduced-motion`: không tạo ghost/bubble transition/step intro động; state cuối vẫn rõ ràng và controls vẫn hoạt động.
6. Pipeline map intro: chỉ giới thiệu đúng 6 component chính, không phát action Kubernetes giả; Skip đi thẳng sang Step ① mà không còn timer/overlay cũ.
7. Component phụ: với từng registry entry, quay lại phase first appearance và xác nhận action arrow/state hoàn tất **trước** camera zoom + bubble; Prev → Next cho phép replay, nhưng rapid navigation không để bubble hoặc camera tween cũ lọt sang phase khác.
8. Filter peer Nodes: `node-b/c/d` chỉ hiển thị verdict trong framing so sánh nhiều Node; không lặp bubble giới thiệu Node như một component mới.
