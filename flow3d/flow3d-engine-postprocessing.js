/* ══════════════════════════════════════════════
   ENGINE — POST-PROCESSING (bloom) + CỔNG CHẤT LƯỢNG

   Cảnh này kể chuyện bằng ÁNH SÁNG: viền mang màu vai trò, flash lúc đổi
   trạng thái, hạt chạy dọc đường flow. Không có bloom thì tất cả đều là điểm
   ảnh 1px — đúng cường độ nhưng không có "quầng", nên mắt không đọc chúng là
   nguồn sáng mà chỉ là nét vẽ. Bloom kéo phần sáng vượt ngưỡng nở ra ngoài
   silhouette; đó là toàn bộ khác biệt giữa "hình vẽ tối" và "cảnh có đèn".

   Ngưỡng để CAO (0.82): fill của component nằm ở luminance 3–8%, edge và flash
   thì gần 1.0 — nên chỉ edge/flash/particle vượt ngưỡng. Nếu hạ ngưỡng xuống
   nữa thì cả sàn cũng nở và khung hình biến thành sương mù.

   ── Vì sao có cổng chất lượng ──
   Bloom là pass toàn màn hình ×2 buffer ở độ phân giải thật; trên màn Retina
   một cảnh 3000px ngang phải trả giá gấp đôi. Nên:
     · `prefers-reduced-motion` → THẤP (bloom cũng là chuyển động thị giác)
     · số pixel thật > ~4.2 triệu → THẤP mặc định
     · người xem chọn tay → lựa chọn đó thắng, và được nhớ trong localStorage
   Khi THẤP, hàm render rơi về `renderer.render` thẳng — không tạo composer,
   không tốn buffer.

   Chạy sau scene-setup/environment, trước render-loop. Các script example của
   three (EffectComposer/UnrealBloomPass) là tuỳ chọn: thiếu thì file này tự
   khoá ở mức THẤP thay vì ném lỗi.
══════════════════════════════════════════════ */

const POST_HAS_LIB = typeof THREE.EffectComposer === 'function'
  && typeof THREE.UnrealBloomPass === 'function'
  && typeof THREE.RenderPass === 'function';

const POST_PIXEL_BUDGET = 4.2e6;

function postAutoQuality() {
  if (!POST_HAS_LIB) return 'low';
  if (prefersReducedMotion) return 'low';
  const dpr = Math.min(devicePixelRatio, 2);
  if (innerWidth * innerHeight * dpr * dpr > POST_PIXEL_BUDGET) return 'low';
  return 'high';
}

function postStoredQuality() {
  try { return localStorage.getItem('flow3d-quality'); } catch (e) { return null; }
}

let renderQuality = postStoredQuality() === 'high' || postStoredQuality() === 'low'
  ? postStoredQuality()
  : postAutoQuality();
if (!POST_HAS_LIB) renderQuality = 'low';

let composer = null;
let bloomPass = null;

function buildComposer() {
  if (composer || !POST_HAS_LIB) return;
  composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(cvs.clientWidth || 1, cvs.clientHeight || 1),
    0.55,   // strength — đủ để edge nở, chưa đủ để nuốt chữ trên hộp
    0.35,   // radius
    0.82    // threshold
  );
  composer.addPass(bloomPass);
  composer.setSize(cvs.clientWidth || 1, cvs.clientHeight || 1);
}

/* Render-loop gọi hàm này thay cho `renderer.render`. */
function renderFrame() {
  if (renderQuality === 'high') {
    buildComposer();
    if (composer) { composer.render(); return; }
  }
  renderer.render(scene, camera);
}

function resizePost(W, H) {
  if (composer) composer.setSize(W, H);
}

function setRenderQuality(q) {
  renderQuality = (q === 'high' && POST_HAS_LIB) ? 'high' : 'low';
  try { localStorage.setItem('flow3d-quality', renderQuality); } catch (e) {}
  return renderQuality;
}

window.FLOW3D = window.FLOW3D || {};
window.FLOW3D.render = {
  available: POST_HAS_LIB,
  get: function() { return renderQuality; },
  set: setRenderQuality
};
