/* ══════════════════════════════════════════════
   THREE.JS SETUP
══════════════════════════════════════════════ */
const wrap = document.getElementById('scene-wrap');
const cvs  = document.getElementById('canvas');

const renderer = new THREE.WebGLRenderer({canvas: cvs, antialias: true, alpha: false});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Không gian này gần như toàn tông tối, nên nó sống chết ở phần đuôi tối của
// đường cong. ACES giãn dải đó ra (thay vì kẹp mọi thứ dưới 8% thành một khối
// đen bệt) và cho highlight nở mềm; sRGB để màu token hiện đúng như đã khai.
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;

const scene = new THREE.Scene();
// Trời, sàn, sương và IBL do flow3d-engine-environment.js dựng, ngay sau file này.

// `far` phải ôm được sky dome (bán kính 340) chứ không chỉ vùng có component.
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
// Raised elevation: the persistent scenarios lay components out across z,
// so a map-like angle keeps rows from occluding each other.
camera.position.set(0, 24, 22);

const controls = new THREE.OrbitControls(camera, cvs);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 8;
// Wide worlds ask for wide shots: a deck whose components span the full x map
// (livestream Stage 0 runs source → audience in one frame, and the e-commerce
// build-cache world asks for 96) needs headroom above the old 70 ceiling, which
// silently clamped those requests and cropped the outer components.
controls.maxDistance = 110;
controls.maxPolarAngle = Math.PI * 0.70;
controls.target.set(0, 1, 0);

// Lights
// Nền sáng chung giờ do IBL (scene.environment) lo, nên ambient phẳng hạ mạnh:
// một AmbientLight lớn dí đều mọi mặt của khối như nhau, đúng thứ làm hộp trông
// dẹt. Hemisphere thay vào đó cho mặt hướng lên/hướng xuống khác nhau.
scene.add(new THREE.HemisphereLight(0x2a4a7c, 0x05080e, 0.55));
scene.add(new THREE.AmbientLight(0x182035, 0.9));
const sun = new THREE.DirectionalLight(0xd8ecff, 2.3);
sun.position.set(10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0006;
Object.assign(sun.shadow.camera, {left:-40, right:40, top:26, bottom:-26});
scene.add(sun);
const fillLight = new THREE.DirectionalLight(0x2244aa, 0.5);
fillLight.position.set(-8, 4, -10);
scene.add(fillLight);
// Rim tím từ phía sau: tách silhouette khỏi nền tối — thứ duy nhất trước đây
// làm được việc đó là đường viền 1px.
const rimLight = new THREE.DirectionalLight(0x8b6cff, 0.85);
rimLight.position.set(-16, 9, -18);
scene.add(rimLight);

/* ─ Scene group ─ */
let sceneGroup = new THREE.Group();
scene.add(sceneGroup);

