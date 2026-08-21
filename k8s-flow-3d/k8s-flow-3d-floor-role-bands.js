/* ══════════════════════════════════════════════
   K8S DECK — BĂNG VAI TRÒ IN XUỐNG SÀN

   `k8s-flow-3d-layout.js` có Luật 1 (trục X = giai đoạn của luồng) và mọi
   kịch bản đều tuân thủ — nhưng NGƯỜI XEM KHÔNG NHÌN THẤY LUẬT ĐÓ. Họ thấy
   một biển sàn đều tăm tắp với các hộp rải trên đó, và phải tự suy ra rằng
   trái→phải là đường đi của một request. Mỗi lần đổi kịch bản là một lần suy
   lại.

   File này in luật lên chính cái sàn: mỗi cột của `L.X` được một dải sáng rất
   mờ chạy suốt chiều sâu, tô bằng đúng `TONE` của loại component đứng trong
   cột đó, kèm một dòng chữ mono ở mép gần người xem. Sàn trở thành legend
   sống: khung hình có nhịp ngang rõ ràng, và tên cột luôn nằm ngay dưới chân
   thứ nó gọi tên.

   Ranh giới giữa hai dải là trung điểm giữa hai cột, nên dải nào cũng ôm đúng
   vùng ảnh hưởng của cột đó — không phải một con số chọn bằng mắt.

   Chạy sau `flow3d-engine-environment.js` (cần `scene` và phải nằm trên lớp
   sàn), dùng `K8S_LAYOUT` + `SCENE_KIT.TONE`.
══════════════════════════════════════════════ */

(function() {
const L = window.K8S_LAYOUT;
const TONE = window.SCENE_KIT.TONE;
if (!L || !TONE) return;

/* Cột → nhãn + token màu. Nhãn giữ nguyên thuật ngữ Kubernetes (`api-server`,
   `nodes`): đây là những từ người xem sẽ gõ vào `kubectl`, dịch ra tiếng Việt
   là bắt họ học một cái tên thứ hai không dùng được ở đâu. */
const BANDS = [
  {label: 'actor',      center: L.X.actor,                        tone: 'peer'},
  {label: 'gate',       center: (L.X.gate1 + L.X.gate2) / 2,      tone: 'gate'},
  {label: 'api-server', center: L.X.core,                         tone: 'core'},
  {label: 'control',    center: L.X.control,                      tone: 'system'},
  {label: 'queue',      center: L.X.queue,                        tone: 'queue'},
  {label: 'nodes',      center: L.X.node,                         tone: 'surface'}
];

/* Chiều sâu dải: ôm trọn dãy tấm Node sâu nhất (node "mổ xẻ" sâu 12.5, xếp
   thành nhiều làn) và cả băng `store` ở z=-9. */
const DEPTH = 30;
const Z_CENTER = -2;
/* Ngay trên đĩa sáng của môi trường (y=-3.52) và dưới mọi thứ được dựng. */
const Y = -3.50;
const EDGE_PAD = 4;   // dải ngoài cùng thò ra khỏi cột bao nhiêu

/* Ranh giới trái/phải = trung điểm với cột hàng xóm. */
function bounds(i) {
  const c = BANDS[i].center;
  const left  = i === 0 ? c - EDGE_PAD : (BANDS[i - 1].center + c) / 2;
  const right = i === BANDS.length - 1 ? c + EDGE_PAD : (BANDS[i + 1].center + c) / 2;
  return {left, right};
}

/* Texture một dải: tô nền mờ dần về hai mép (để dải không có cạnh cứng cắt
   ngang sàn) + dòng chữ ở mép GẦN người xem.
   Plane xoay -90° quanh X nên đỉnh canvas ứng với z xa; chữ vẽ đúng chiều
   trong canvas sẽ đọc được từ camera mặc định (đứng phía +z nhìn về gốc). */
function bandTexture(label, edgeHex, worldW) {
  const W = 256, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  const c = new THREE.Color(edgeHex);
  const rgb = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)].join(',');

  // Mờ dần theo chiều ngang: đậm nhất ở tim dải
  /* Có mặt bằng ở giữa chứ không nhọn tại tim: gradient nhọn cho ra một CỘT
     SÁNG (mắt đọc là đèn rọi), còn dải phải đọc là một VÙNG có mép mềm. */
  const across = g.createLinearGradient(0, 0, W, 0);
  across.addColorStop(0.00, 'rgba(' + rgb + ',0)');
  across.addColorStop(0.26, 'rgba(' + rgb + ',.92)');
  across.addColorStop(0.50, 'rgba(' + rgb + ',1)');
  across.addColorStop(0.74, 'rgba(' + rgb + ',.92)');
  across.addColorStop(1.00, 'rgba(' + rgb + ',0)');
  g.fillStyle = across;
  g.fillRect(0, 0, W, H);

  // …và mờ dần theo chiều sâu, để dải tan ở đầu xa thay vì cụt ngang
  g.globalCompositeOperation = 'destination-in';
  const along = g.createLinearGradient(0, 0, 0, H);
  along.addColorStop(0.00, 'rgba(0,0,0,0)');
  along.addColorStop(0.34, 'rgba(0,0,0,.85)');
  along.addColorStop(0.86, 'rgba(0,0,0,1)');
  along.addColorStop(1.00, 'rgba(0,0,0,.15)');
  g.fillStyle = along;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

/* Caption đi trên MẶT PHẲNG RIÊNG chứ không vẽ chung vào texture dải: dải cố ý
   rất mờ (opacity .30) — chữ nằm chung sẽ mờ theo và thành không đọc được, mà
   nâng dải lên cho chữ sáng thì cả sàn loè. Tách ra thì mỗi thứ giữ đúng độ
   sáng nó cần.
   Ô caption phủ `worldW × CAPTION_D`, nên pixel ngang và pixel dọc không bằng
   nhau ngoài world; `kx` bù lại để chữ không bị bóp dẹt, và bóp khác nhau ở
   mỗi dải (dải rộng hẹp khác nhau). Cỡ chữ tính ngược từ chiều cao world nên
   mọi dải cho ra chữ CÙNG một cỡ thật. */
const CAPTION_D = 3.2;
function captionTexture(label, edgeHex, worldW) {
  const W = 512, H = 96;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  const c = new THREE.Color(edgeHex);
  const rgb = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)].join(',');

  const TEXT_WORLD_H = 1.05;
  const px = TEXT_WORLD_H * H / CAPTION_D;
  const kx = (CAPTION_D / H) / (worldW / W);
  g.translate(W / 2, H * 0.62);
  g.scale(kx, 1);
  g.font = '600 ' + px.toFixed(1) + 'px "IBM Plex Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(' + rgb + ',1)';
  g.shadowColor = 'rgba(' + rgb + ',.85)';
  g.shadowBlur = 10;
  g.fillText(label, 0, 0);
  // Vạch chân: mép gần của dải, giúp mắt bắt được nhịp cột
  const rule = g.measureText(label).width * 0.6;
  g.shadowBlur = 5;
  g.fillRect(-rule, px * 0.34, rule * 2, Math.max(2, px * 0.06));

  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

const bandGroup = new THREE.Group();
bandGroup.renderOrder = 3;   // trên đĩa sáng và lớp tan của môi trường

BANDS.forEach(function(b, i) {
  const {left, right} = bounds(i);
  const w = right - left;
  const cx = (left + right) / 2;
  const edge = TONE[b.tone].edge;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, DEPTH),
    new THREE.MeshBasicMaterial({
      map: bandTexture(b.label, edge, w), transparent: true, opacity: 0.30,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx, Y, Z_CENTER);
  mesh.renderOrder = 3;
  bandGroup.add(mesh);

  /* Caption ở mép GẦN người xem — đứng TRƯỚC hàng component gần nhất (băng
     `sched` ở z=9 và hàng Pod xếp trước nó), nếu không thì scheduler/ActiveQ
     che mất đúng cái tên gọi chúng. */
  const cap = new THREE.Mesh(
    new THREE.PlaneGeometry(w, CAPTION_D),
    new THREE.MeshBasicMaterial({
      map: captionTexture(b.label, edge, w), transparent: true, opacity: 0.92,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true
    })
  );
  cap.rotation.x = -Math.PI / 2;
  cap.position.set(cx, Y + 0.01, Z_CENTER + DEPTH / 2 - CAPTION_D / 2 - 1.0);
  cap.renderOrder = 4;
  bandGroup.add(cap);
});

scene.add(bandGroup);
})();
