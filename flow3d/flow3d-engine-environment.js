/* ══════════════════════════════════════════════
   ENGINE — ENVIRONMENT (bầu trời · sàn · sương · ánh sáng môi trường)

   Trước đây nền cảnh là ba dòng trong scene-setup: `background` một màu phẳng,
   một tấm sàn CÙNG MÀU với nền, và một GridHelper mờ. Ba thứ đó cộng lại cho
   một hư vô đen — không chân trời, không chất liệu, không có gì để mắt bám vào,
   nên mọi component đều như đang trôi.

   File này thay bằng một môi trường thật sự, dựng hoàn toàn bằng code (không
   tải asset ngoài, giữ nguyên tính chất "mở file là chạy" của deck):

     1. SKY DOME — một quả cầu BackSide phủ texture equirect vẽ bằng canvas:
        gradient thiên đỉnh → chân trời, quầng sáng chân trời, vài cột sáng mờ
        ở xa (đọc như dàn đèn cuối một hall máy), và nhiễu dither để dải màu
        không bị banding trên màn hình 8-bit.

     2. IBL — chính texture đó đi qua PMREMGenerator thành `scene.environment`.
        Đây là thứ tạo ra "thực tế hơn": mặt hộp `MeshStandardMaterial` bắt đầu
        PHẢN CHIẾU bầu trời thay vì chỉ nhận một ambient phẳng, nên mặt hướng
        lên sáng hơn mặt hướng xuống — khối có thể tích thay vì là hình bẹt.

     3. SÀN RAISED-FLOOR — texture canvas vẽ sàn nâng của phòng máy: từng tấm
        60×60, đường ron, vát sáng cạnh trên-trái, bốn con vít ở góc, và một số
        tấm có lỗ thông gió. Đây là nguồn "chi tiết" chính của khung hình; ron
        tấm cũng thay luôn vai trò của GridHelper cũ (mipmap khử răng cưa ở xa
        tốt hơn line grid rất nhiều).

     4. FOG — cùng màu chân trời, nên mép sàn và vật ở xa tan vào trời thay vì
        cắt cụt. Đây là thứ tạo chiều sâu, không phải phối cảnh.

     5. QUẦNG SÁNG SÀN — một đĩa additive rất mờ dưới tâm cảnh, đọc như ánh
        sáng của chính cảnh hắt xuống sàn.

   Chạy sau `flow3d-engine-scene-setup.js` (dùng `scene`, `renderer`, `camera`
   từ global scope của nó) và trước mọi thứ dựng world.
══════════════════════════════════════════════ */

(function() {

/* Bảng màu môi trường. Chân trời là màu neo: fog, mép sàn và đáy dome đều lấy
   theo nó, nên mọi thứ ở xa hội tụ về đúng một màu. */
const ENV = {
  zenith:  '#02050b',
  upper:   '#060d19',
  mid:     '#0d1a2e',
  horizon: '#1d3452',
  under:   '#0a1220',   // ngay dưới đường chân trời — vùng sàn phủ lên
  nadir:   '#04070d',
  glow:    'rgba(74,124,196,',   // quầng chân trời, alpha nối sau
  floor:   '#0b111d'
};
/* Fog TỐI HƠN chân trời một bậc: nó là màu mà mọi thứ ở xa hội tụ về, nên nếu
   để sáng bằng chân trời thì cả nửa trên khung hình biến thành một mảng xanh
   đều — đúng cái phẳng lì mà môi trường này sinh ra để phá. */
const FOG_COLOR = 0x070e1a;

/* ── 1 · Texture bầu trời (equirect) ──
   1024×512: v=0 là thiên đỉnh, v=0.5 là đường chân trời, v=1 là nadir. */
function skyTexture() {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, ENV.zenith);
  grad.addColorStop(0.28, ENV.upper);
  grad.addColorStop(0.44, ENV.mid);
  grad.addColorStop(0.50, ENV.horizon);
  grad.addColorStop(0.53, ENV.under);
  grad.addColorStop(1.00, ENV.nadir);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);

  /* Cột sáng mờ ở xa — dàn đèn của một gian phòng lớn. Đủ nhạt để không thành
     hoạ tiết, đủ để chân trời không phẳng lì một dải. */
  const columns = [0.06, 0.19, 0.33, 0.52, 0.68, 0.81, 0.94];
  columns.forEach(function(u, i) {
    const x = u * 1024;
    const w = 26 + (i % 3) * 14;
    const col = g.createLinearGradient(0, 200, 0, 262);
    col.addColorStop(0, 'rgba(96,150,224,0)');
    col.addColorStop(1, 'rgba(96,150,224,' + (0.05 + (i % 2) * 0.03).toFixed(3) + ')');
    g.fillStyle = col;
    g.fillRect(x - w / 2, 200, w, 62);
  });

  /* Quầng chân trời: sáng nhất ngay tại v=0.5 rồi tắt dần lên trên. */
  const halo = g.createLinearGradient(0, 232, 0, 258);
  halo.addColorStop(0, ENV.glow + '0)');
  halo.addColorStop(1, ENV.glow + '0.16)');
  g.fillStyle = halo;
  g.fillRect(0, 232, 1024, 26);

  /* Dither ±3 — gradient tối rất dễ bị banding thành từng vòng trên dome. */
  const img = g.getImageData(0, 0, 1024, 512);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() * 6 - 3) | 0;
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

/* ── 3 · Texture sàn nâng phòng máy ──
   Một ô texture = 4×4 tấm sàn. `repeat` bên dưới quy đổi thành 5 world-unit
   mỗi tấm, nên một tấm Node (rộng 19) nằm gọn trên ~4 tấm sàn. */
function floorTexture() {
  const S = 1024, N = 4, P = S / N;   // 256px một tấm
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');

  g.fillStyle = ENV.floor;
  g.fillRect(0, 0, S, S);

  /* Nhiễu ổn định theo chỉ số tấm — cùng một ô texture luôn vẽ ra như nhau,
     nhưng các tấm không giống hệt nhau. */
  function hash(i, j) {
    const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return v - Math.floor(v);
  }

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = i * P, y = j * P, h = hash(i, j);

      /* Mặt tấm, sáng tối lệch nhau chút một. Nền phải TỐI HƠN HẲN component:
         sàn là bối cảnh, không phải nhân vật — nếu nó sáng bằng hộp thì mắt
         không biết nhìn đâu và mọi thứ trôi về giữa dải xám. */
      const lift = Math.floor(h * 7);
      g.fillStyle = 'rgb(' + (10 + lift) + ',' + (15 + lift) + ',' + (25 + lift) + ')';
      g.fillRect(x + 2, y + 2, P - 4, P - 4);

      // Vát sáng cạnh trên-trái, đổ bóng cạnh dưới-phải → tấm nổi lên
      g.fillStyle = 'rgba(150,185,235,.10)';
      g.fillRect(x + 2, y + 2, P - 4, 2);
      g.fillRect(x + 2, y + 2, 2, P - 4);
      g.fillStyle = 'rgba(0,0,0,.72)';
      g.fillRect(x + 2, y + P - 5, P - 4, 3);
      g.fillRect(x + P - 5, y + 2, 3, P - 4);

      // Bốn con vít góc
      g.fillStyle = 'rgba(0,0,0,.5)';
      [[18, 18], [P - 18, 18], [18, P - 18], [P - 18, P - 18]].forEach(function(p) {
        g.beginPath(); g.arc(x + p[0], y + p[1], 3.4, 0, Math.PI * 2); g.fill();
      });
      g.fillStyle = 'rgba(160,190,230,.10)';
      [[18, 18], [P - 18, 18], [18, P - 18], [P - 18, P - 18]].forEach(function(p) {
        g.beginPath(); g.arc(x + p[0] - 0.8, y + p[1] - 0.8, 2.1, 0, Math.PI * 2); g.fill();
      });

      // Một phần tấm là tấm thông gió đục lỗ — thưa, để nó là chi tiết chứ
      // không thành hoạ tiết chấm bi trải khắp sàn.
      if (h > 0.80) {
        g.fillStyle = 'rgba(0,0,0,.3)';
        for (let a = 0; a < 7; a++) {
          for (let b = 0; b < 7; b++) {
            g.beginPath();
            g.arc(x + 52 + a * 25, y + 52 + b * 25, 3.6, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
  }

  // Hạt bụi/xước nhẹ để bề mặt không phẳng như nhựa
  const img = g.getImageData(0, 0, S, S);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() * 9 - 4.5) | 0;
    px[i] += n; px[i + 1] += n; px[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(25, 25);           // 400 world units / 25 = 16 → tấm 4 unit
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/* ── 4b · Lớp tan của sàn ──
   Sàn cần tắt NHANH về màu sương (nếu không, nửa trên khung hình là một mảng
   xanh đều), còn component thì KHÔNG — deck livestream trải component ra tới
   ~96 unit, một lớp fog đủ gắt để dìm sàn sẽ xoá luôn các component ngoài rìa.
   Nên fog để nhẹ (lo vật thể), còn việc dìm sàn giao cho tấm này: trong suốt ở
   giữa, đặc dần thành đúng màu sương ở vành. Bán kính hết trong suốt ≈56 unit,
   tan hoàn toàn ≈100 unit — không phụ thuộc camera đứng đâu. */
function groundFadeTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  const c = new THREE.Color(FOG_COLOR);
  const rgb = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)].join(',');
  const rg = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  rg.addColorStop(0.00, 'rgba(' + rgb + ',0)');
  rg.addColorStop(0.28, 'rgba(' + rgb + ',0)');
  rg.addColorStop(0.62, 'rgba(' + rgb + ',.82)');
  rg.addColorStop(1.00, 'rgba(' + rgb + ',1)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(cv);
}

/* ── 5 · Đĩa sáng dưới tâm cảnh ── */
function spillTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0.0, 'rgba(72,126,210,.30)');
  rg.addColorStop(0.45, 'rgba(52,96,170,.12)');
  rg.addColorStop(1.0, 'rgba(40,70,130,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

/* ── Lắp ráp ── */
const sky = skyTexture();

const dome = new THREE.Mesh(
  new THREE.SphereGeometry(340, 48, 32),
  new THREE.MeshBasicMaterial({map: sky, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false})
);
dome.renderOrder = -1;
scene.add(dome);

// IBL: chính bầu trời trên kia là nguồn phản chiếu, nên vật và nền luôn khớp.
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromEquirectangular(sky).texture;
pmrem.dispose();

// Nhẹ tay: chỉ đủ để hàng Node phía sau lùi lại, không đủ để xoá component ở
// rìa các world rộng (livestream Stage 0 trải source → audience gần 100 unit).
scene.fog = new THREE.Fog(FOG_COLOR, 70, 260);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({
    map: floorTexture(),
    roughness: 0.82,
    metalness: 0.45,      // đủ để bắt phản chiếu bầu trời, chưa thành gương
    envMapIntensity: 0.30
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -3.6;
floor.receiveShadow = true;
scene.add(floor);

const groundFade = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshBasicMaterial({map: groundFadeTexture(), transparent: true, depthWrite: false, fog: false})
);
groundFade.rotation.x = -Math.PI / 2;
groundFade.position.y = -3.54;
groundFade.renderOrder = 1;
scene.add(groundFade);

const spill = new THREE.Mesh(
  new THREE.PlaneGeometry(190, 190),
  new THREE.MeshBasicMaterial({map: spillTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false})
);
spill.rotation.x = -Math.PI / 2;
spill.position.y = -3.52;   // trên lớp tan, nếu không sẽ bị nó phủ mất
spill.renderOrder = 2;
scene.add(spill);

/* ── 6 · Bụi lơ lửng ──
   Khoảng không giữa sàn và dome vẫn là hư vô: camera xoay mà không có gì ở
   tầng giữa thì mắt không nhận ra mình đang xoay. 400 hạt rất mờ, trải trong
   khối 200×46×200 và quay cực chậm, cho thị sai một thứ để bám. Một Points
   duy nhất, additive, không nhận sáng — chi phí gần bằng không. */
const DUST_N = 400;
const dustPos = new Float32Array(DUST_N * 3);
for (let i = 0; i < DUST_N; i++) {
  dustPos[i * 3]     = (Math.random() - 0.5) * 200;
  dustPos[i * 3 + 1] = Math.random() * 46 - 2;
  dustPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0x8fb6e6, size: 0.32, sizeAttenuation: true,
  transparent: true, opacity: 0.18, depthWrite: false,
  blending: THREE.AdditiveBlending, fog: false
}));
scene.add(dust);
// Render-loop nhặt cái này lên để quay; để đây thay vì tự đăng ký animation
// giúp môi trường không cần biết gì về vòng lặp.
window.FLOW3D = window.FLOW3D || {};
window.FLOW3D.dust = dust;

})();
