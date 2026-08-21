# K8s Flow 3D — Đề xuất nâng cấp thị giác cảnh 3D

Ngày: 2026-08-15 · Phạm vi đọc: `k8s-flow-3d/*`, `flow3d/*` (kit dùng chung cho 4 deck: k8s, flow3d gallery, ecommerce-cache, livestream)

> **Cảnh báo phạm vi:** mọi thay đổi trong `flow3d/` ăn sang cả 4 deck. Đề xuất bên dưới cố ý giữ ở tầng kit (nhất quán toàn bộ) trừ mục §6 (chỉ deck k8s).

---

> **Cập nhật 2026-08-15 (lần 1):** Tier 1 + nền/sàn/trời ĐÃ triển khai (`flow3d/flow3d-engine-environment.js` mới, sửa `flow3d-engine-scene-setup.js`, `flow3d-engine-animation-helpers.js`, `flow3d.css`, 3 file html deck). §3.1 băng vai trò, §3.4 bloom và §4 chrome/legend vẫn còn nguyên.
>
> **Cập nhật 2026-08-15 (lần 2) — phần còn lại đã làm xong:**
> - §3.1 băng vai trò → `k8s-flow-3d/k8s-flow-3d-floor-role-bands.js` (mới). 6 dải additive theo `L.X`, ranh giới = trung điểm hai cột, caption mono trên mặt phẳng riêng ở mép gần (dải mờ .30, caption .92 — chung một texture thì chữ mờ theo dải).
> - §3.3 flow glow → hạt cầu thành sprite radial-gradient additive; đường liền chuyển `AdditiveBlending`. Đường đứt nét GIỮ nguyên (additive xoá mất nhịp đứt). Không thêm "hào quang" line thứ hai: WebGL không hỗ trợ `linewidth`, line dày là bất khả thi bằng `LineBasicMaterial`.
> - §3.4 bloom → `flow3d/flow3d-engine-postprocessing.js` (mới) + 7 thẻ script example three r134 trong 3 deck html. `strength .55 · radius .35 · threshold .82`. Tự xuống THẤP khi `prefers-reduced-motion`, khi pixel thật > 4.2M, hoặc khi thiếu script example (CDN chặn → render thẳng, không lỗi). Lựa chọn tay nhớ trong `localStorage`.
> - §3.5 bụi nền → 400 `Points` additive trong `flow3d-engine-environment.js`, render-loop quay chậm.
> - §3.6 camera drift → `controls.autoRotate` sau 6s không tương tác, tắt ngay khi có input hoặc khi đang tween camera; bỏ qua nếu reduced-motion.
> - §4 chrome → `flow3d/flow3d-engine-chrome-controls.js` (mới): nút `? Chú giải` (popover đọc thẳng từ `SCENE_KIT.TONE`) + nút `Hiệu ứng: Cao/Thấp`. CSS: `.pip-lbl` lên `rgba(150,172,204,.85)`, region caption 3D lên `rgba(140,168,204,.8)`, progress bar 3px + track, viền panel gradient xanh→tím, và `#panel-title` được gỡ khỏi danh sách ẩn.
>
> **Cố ý KHÔNG làm:**
> - §3.2 contact shadow giả — shadow map đã bật thật (`sun.castShadow`, `mesh.castShadow/receiveShadow`, sàn `receiveShadow`), thêm sprite bóng nữa là chồng hai lớp bóng lên nhau.
> - §2.3 emissive + §2.4 nâng `TONE.col` — bản triển khai Tier 1 chọn hướng khác (IBL + `envMapIntensity .35`) và ghi rõ lý do trong `makeSolid()`: giữ ngôn ngữ "fill tối · viền mang màu vai trò". Đảo lại sẽ mâu thuẫn với quyết định đó ở cả 4 deck.
>
> Đã kiểm tra chạy thật (localhost, Chrome): cả 3 deck load sạch console, bloom bật/tắt được, băng + caption đọc được ở khung camera mặc định.

## 1. Vì sao cảnh "tối và nhàm chán" — 6 nguyên nhân đo được

| # | Nguyên nhân | Bằng chứng trong code |
|---|---|---|
| 1 | **Nền và sàn cùng một màu** → không có đường chân trời, khối trôi trong hư vô | `scene.background = 0x080d14` và ground plane `color:0x080d14` (`flow3d-engine-scene-setup.js:13,45`) |
| 2 | **Toàn bộ fill của component là gần-đen** (luminance 3–8%), chỉ có `edge` mang màu | `TONE.*.col`: `#0d1520`, `#0a1428`, `#0a1830`… (`flow3d-kit-design-tokens.js:35-64`) |
| 3 | **Không có emissive, không bloom** → không gì "phát sáng", edge chỉ là line 1px | `MeshStandardMaterial({roughness:.65, metalness:.15})`, không `emissive` (`flow3d-engine-animation-helpers.js:200`) |
| 4 | **Không có fog, không gradient trời** → mất chiều sâu, cảnh dẹt | không có `scene.fog` ở bất kỳ đâu |
| 5 | **Không tone mapping / color space** → màu bệt, highlight không nở | renderer không set `toneMapping`/`outputEncoding` (`flow3d-engine-scene-setup.js:7`) |
| 6 | **Ánh sáng phẳng**: 1 ambient xanh xám + 1 sun + 1 fill yếu, không rim light | `AmbientLight(0x182035, 4.5)` chiếm gần hết ngân sách sáng (`scene-setup.js:33-42`) |

Hệ quả: hình khối chỉ đọc được nhờ **viền**, còn mặt hộp thì hoà vào nền. Đó chính là cảm giác "tối, nhàm".

---

## 2. Tier 1 — Rẻ, tác động lớn nhất (nên làm trước)

Ước tính: ~60 dòng sửa, không đụng scenario nào.

### 2.1 Tone mapping + color space (`flow3d-engine-scene-setup.js`)
```js
renderer.outputEncoding = THREE.sRGBEncoding;      // r134 dùng outputEncoding
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
```
Riêng dòng này đã kéo dải tối giãn ra, viền sáng nở mềm thay vì bệt.

### 2.2 Trời gradient + fog (thay `background` phẳng)
```js
scene.background = new THREE.Color(0x0b1524);       // hơi sáng hơn sàn
scene.fog = new THREE.Fog(0x0b1524, 55, 130);       // trùng màu nền → tan mượt ở xa
```
Fog làm hàng Node ở xa lùi lại → **chiều sâu tự xuất hiện** mà không phải thêm hình gì.

### 2.3 Emissive theo `edge` — thứ "bật đèn" cho mọi hộp
`makeSolid()` (`flow3d-engine-animation-helpers.js:200`):
```js
const mat = new THREE.MeshStandardMaterial({
  color: new THREE.Color(colStr),
  emissive: new THREE.Color(edgeStr),   // hộp tự phát sáng theo màu vai trò
  emissiveIntensity: 0.28,
  roughness: 0.55, metalness: 0.2,
  transparent: true, opacity: 0
});
```
Hero/focus có thể nâng lên `0.6` trong `updateWorldNodes()` — component đang được kể chuyện sẽ **thực sự sáng lên**, không chỉ đổi opacity như hiện tại (`persistent-world.js:408-421`).

### 2.4 Nâng nền `TONE.col` (`flow3d-kit-design-tokens.js`)
Giữ nguyên hue, chỉ nâng luminance ~2× (vẫn là dark theme, nhưng hộp tách khỏi nền):

| token | hiện tại | đề xuất |
|---|---|---|
| `surface` | `#0d1520` | `#152136` |
| `core` | `#0a1830` | `#12294f` |
| `system` | `#0a1428` | `#132340` |
| `gate` | `#0a2040` | `#12305e` |
| `store` | `#1a1200` | `#2b2005` |
| `queue` | `#101a38` | `#1a2a55` |
| `engine` | `#1a1000` | `#2b1c05` |
| `subject` | `#1e1a40` | `#2e2764` |
| `live`/`ok` | `#0a2418`/`#0a2014` | `#0f3b26`/`#0f3520` |
| `danger`/`doomed` | `#200d10`/`#2a0808` | `#3a161b`/`#450e0e` |

### 2.5 Ánh sáng 3 điểm thật sự
```js
scene.add(new THREE.HemisphereLight(0x2a4a80, 0x080d14, 1.2)); // thay ambient phẳng
scene.add(new THREE.AmbientLight(0x182035, 2.0));              // hạ từ 4.5
// rim light tím phía sau → viền silhouette tách khỏi nền
const rim = new THREE.DirectionalLight(0x8b6cff, 1.1);
rim.position.set(-14, 8, -16); scene.add(rim);
```

### 2.6 Sàn có "chân trời"
```js
const gnd = ... color:0x0a121e            // sáng hơn nền một chút
const grid = new THREE.GridHelper(140, 70, 0x24344f, 0x14203a);  // từ 0x141e30/0x0e1625
grid.material.transparent = true; grid.material.opacity = 0.55;
```

---

## 3. Tier 2 — Trang trí có ý nghĩa (không chỉ đẹp)

### 3.1 Băng vai trò in xuống sàn — *ưu tiên cao nhất về mặt sư phạm*
`k8s-flow-3d-layout.js` đã có sẵn Luật 1 (trục X = giai đoạn) và Luật 2 (trục Z = băng vai trò), nhưng **người xem không nhìn thấy luật đó**. Vẽ trực tiếp lên sàn:

- 6 dải chữ nhật mờ (`MeshBasicMaterial`, `opacity .06–.10`, additive) đặt dưới từng cột `L.X`: `actor · gate · api-server · control · queue · nodes`.
- Mỗi dải có caption mono nhỏ nằm trên mặt sàn (dùng `w.txt` sẵn có).
- Màu dải lấy đúng `TONE` của cột → sàn trở thành **legend sống**.

Kết quả: khung hình có cấu trúc ngang rõ ràng thay vì một biển lưới đều tăm tắp, và mỗi lần đổi scenario người xem không phải học lại bố cục.

### 3.2 Bóng tiếp đất giả (contact shadow)
Mỗi component thêm 1 sprite radial-gradient mờ đặt ngay dưới đáy (rẻ hơn shadow map, ăn ngay cả khi component nằm trên tấm Node). Khối lập tức "đứng" trên mặt phẳng thay vì lơ lửng.

### 3.3 Đường flow đẹp hơn
Hiện tại: `LineBasicMaterial` 1px + cone + particle cầu 0.08 (`animation-helpers.js:238-266`). Đề xuất:
- Line → `AdditiveBlending`, `opacity .8`, cộng thêm một line thứ hai dày hơn opacity thấp làm "hào quang".
- Particle → sprite glow (canvas radial-gradient texture) thay `SphereGeometry`, `AdditiveBlending`, size 0.22. Cùng số particle nhưng nhìn như dòng năng lượng chứ không phải hạt nhựa.

### 3.4 Bloom (chất lượng cao, có cổng tắt)
Thêm `EffectComposer` + `RenderPass` + `UnrealBloomPass` (r134 examples, thêm 5 thẻ `<script>` vào `k8s-flow-3d.html`). Cấu hình nhẹ: `strength .55, radius .35, threshold .82` — chỉ edge/emissive/flash vượt ngưỡng mới nở. **Bắt buộc**: tự tắt khi `prefers-reduced-motion` hoặc khi `devicePixelRatio * viewport` quá lớn, và có toggle "Hiệu ứng: Cao/Thấp" trong panel.

### 3.5 Bụi sao / hạt nền
Một `Points` 400 hạt, opacity .18, trải trong khối 160×40×160, xoay rất chậm. Biến "hư vô" thành không gian có chủ ý. Chi phí ~0.

### 3.6 Camera có sinh khí
Khi người xem không tương tác > 6s: `controls.autoRotate = true; autoRotateSpeed = 0.25`, tắt ngay khi có input. Kèm parallax rất nhẹ theo chuột (±0.4 world unit). Cảnh hết "đứng hình".

---

## 4. Tier 3 — Chrome/UI 2D

1. **Thiếu legend màu.** Kit tự nhận "người xem học ngôn ngữ màu trong phút đầu" (`design-tokens.js:14-16`) nhưng UI **không có bảng chú giải nào**. Đề xuất: nút `?` ở góc panel mở popover 10 dòng: `subject / core / gate / store / queue / live / warn / danger / doomed / crown`.
2. **Panel đang trống.** `flow3d.css:353` ẩn `panel-heading, panel-position, panel-title, explain-body` → panel chỉ còn select + nav, trông như chưa làm xong. Nên trả lại ít nhất tiêu đề step (`#panel-title`).
3. **Contrast lỗi ở chữ nhỏ:**
   - `.pip-lbl` `rgba(122,143,176,.5)` @7.5px → **≈2.3:1** (cần ≥4.5). Nâng lên `rgba(150,172,204,.85)`.
   - `w.txt` region caption `rgba(106,138,176,.5)` → tương tự, nâng alpha lên `.8`.
   - (`--text: #7a8fb0` trên nền là 5.8:1 — mục này **đạt**, không cần đổi.)
4. **Progress bar 2px** ở đỉnh gần như vô hình khi cảnh tối; thêm `height:3px` + track nền mờ để thấy được phần chưa đi.
5. **Panel viền gradient**: `border-image` xanh→tím rất nhạt thay viền xám phẳng, đồng bộ với `TONE.subject`.

---

## 5. Thứ tự thực hiện đề xuất

| Bước | Nội dung | File | Rủi ro |
|---|---|---|---|
| 1 | §2.1–2.2 tone mapping + fog | `scene-setup.js` | Rất thấp |
| 2 | §2.5–2.6 lights + sàn/grid | `scene-setup.js` | Rất thấp |
| 3 | §2.3 emissive + §2.4 nâng TONE | `animation-helpers.js`, `design-tokens.js` | Thấp — cần xem lại 4 deck |
| 4 | §3.1 băng vai trò dưới sàn | `k8s-flow-3d-layout.js` + world files | Trung bình (chỉ deck k8s) |
| 5 | §3.2–3.3 contact shadow + flow glow | `animation-helpers.js` | Thấp |
| 6 | §3.5–3.6 hạt nền + camera drift | `scene-setup.js`, `render-loop.js` | Thấp |
| 7 | §3.4 bloom + toggle chất lượng | `.html`, `render-loop.js`, `ui-controller.js` | Cao nhất (perf) |
| 8 | §4 legend + contrast + panel | `flow3d.css`, `ui-controller.js` | Thấp |

Bước 1–3 làm xong là đã giải quyết phần lớn "tối và nhàm" — chỉ ~60 dòng.

---

## 6. Ghi chú riêng deck k8s

- Đang có 17 file `k8s-flow-3d-*` bị sửa chưa commit + plan `260814-2308-k8s-flow3d-scenario-conformance/` đang mở. Nên **hoàn tất/commit nhánh conformance trước** rồi mới đụng tầng thị giác, tránh trộn hai loại thay đổi trong một diff.
- `k8s-flow-3d-scenario-oom-killer-model.js` đang 502 dòng, vượt hạn 200 dòng trong development rules — ứng viên tách module khi có dịp.

---

## Câu hỏi chưa giải quyết

1. Có được phép sửa `flow3d/` (kit dùng chung) không, hay chỉ giới hạn trong `k8s-flow-3d/`? Tier 1 gần như toàn bộ nằm ở kit.
2. Ngân sách hiệu năng: máy đích thấp nhất là gì? Quyết định có bật bloom mặc định hay không.
3. Nâng `TONE.col` sẽ đổi diện mạo cả 4 deck — chấp nhận, hay cần một biến thể palette riêng cho k8s?
4. Băng vai trò dưới sàn (§3.1) — chữ tiếng Việt hay tiếng Anh (`api-server` vs `máy chủ API`)?
