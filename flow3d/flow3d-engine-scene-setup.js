/* ══════════════════════════════════════════════
   THREE.JS SETUP
══════════════════════════════════════════════ */
const wrap = document.getElementById('scene-wrap');
const cvs  = document.getElementById('canvas');

const renderer = new THREE.WebGLRenderer({canvas: cvs, antialias: true, alpha: false});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080d14);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
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
scene.add(new THREE.AmbientLight(0x182035, 4.5));
const sun = new THREE.DirectionalLight(0xd0e8ff, 2.5);
sun.position.set(10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, {left:-30, right:30, top:18, bottom:-18});
scene.add(sun);
const fillLight = new THREE.DirectionalLight(0x2244aa, 0.5);
fillLight.position.set(-8, 4, -10);
scene.add(fillLight);

// Ground
const gnd = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({color:0x080d14, roughness:1}));
gnd.rotation.x = -Math.PI/2; gnd.position.y = -3.6; gnd.receiveShadow = true;
scene.add(gnd);
const grid = new THREE.GridHelper(120, 80, 0x141e30, 0x0e1625);
grid.position.y = -3.58;
scene.add(grid);

/* ─ Scene group ─ */
let sceneGroup = new THREE.Group();
scene.add(sceneGroup);

