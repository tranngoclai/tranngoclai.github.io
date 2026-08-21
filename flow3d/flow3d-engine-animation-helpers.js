/* ══════════════════════════════════════════════
   ANIMATION SYSTEM
══════════════════════════════════════════════ */
let camTween = null;
function startCamTween(target, dist) {
  camTween = {from: controls.target.clone(), to: new THREE.Vector3(...target), t: 0};
  // Optional dolly: keep the current viewing angle, change only the distance.
  if (dist) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    camTween.camFrom = camera.position.clone();
    camTween.camTo = camTween.to.clone().add(dir.multiplyScalar(dist));
  }
}

/* ─ Build target ─
   Objects are added to whichever group the engine is currently building into.
   `buildPersistent` tags queue entries so world objects survive a step change. */
let buildGroup = null;
let buildPersistent = false;
function setBuildTarget(group, persistent) {
  buildGroup = group || null;
  buildPersistent = !!persistent;
}
function buildAdd(obj) { (buildGroup || sceneGroup).add(obj); }

let animQueue = [];
let arrowQueue = [];
let particleQueue = [];  // for data-flow particles along arrows
let heroMesh = null;     // the highlighted "hero" mesh
let heroGlow = 0;        // pulsing glow value
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ─ Label overlay ─ */
const labelsDiv = document.getElementById('labels');
let labelEls = [];

function clearLabels() {
  removeLabels(labelEls);
  labelEls = [];
}

/* Drop only step-scoped labels; persistent world labels stay on screen. */
function clearTransientLabels() {
  const doomed = labelEls.filter(l => !l.persistent);
  removeLabels(doomed);
  labelEls = labelEls.filter(l => l.persistent);
}

function removeLabels(list) {
  list.forEach(l => { l.div.classList.remove('visible'); });
  const old = list.slice();
  setTimeout(() => old.forEach(l => l.div.remove()), 400);
}

/* Retires a single label div immediately — used when a fresher badge on the
   same component replaces it mid-phase, so the two don't sit stacked. */
function fadeLabel(div) {
  div.classList.remove('visible');
  div.style.opacity = '0';
  labelEls = labelEls.filter(l => l.div !== div);
  setTimeout(() => div.remove(), 400);
}

function addLabel(text, x, y, z, color, delay, isHero, cls) {
  const obj = new THREE.Object3D();
  obj.position.set(x, y, z);
  buildAdd(obj);
  const div = document.createElement('div');
  div.className = 'fl-label' + (isHero ? ' hero-label' : '') + (cls ? ' ' + cls : '');
  div.innerHTML = text;
  div.style.color = color || 'rgba(192,208,232,.75)';
  labelsDiv.appendChild(div);
  setTimeout(() => div.classList.add('visible'), (delay || 0) * 1000 + 200);
  labelEls.push({div, obj, persistent: buildPersistent});
  // The anchor is exposed so a component that moves can carry its caption along.
  div._anchor = obj;
  return div;
}

/* An arrow caption's opacity is driven per-frame by updateFlows() to track
   the line's own draw/hold/fade curve (see makeFlowLine), so it starts
   invisible with no CSS transition fighting the frame-by-frame writes. */
function addFlowLabel(text, x, y, z, color) {
  const obj = new THREE.Object3D();
  obj.position.set(x, y, z);
  buildAdd(obj);
  const div = document.createElement('div');
  div.className = 'fl-label flow-caption';
  div.innerHTML = text;
  div.style.color = color || 'rgba(192,208,232,.75)';
  div.style.opacity = '0';
  labelsDiv.appendChild(div);
  labelEls.push({div, obj, persistent: buildPersistent});
  div._anchor = obj;
  return div;
}

/* Bubble anchors reuse the live caption object, so orbiting the camera and
   moving a component keep the explanation attached to its actor. */
function addBubble(text, anchorKey, opts) {
  opts = opts || {};
  const n = worldNodes[anchorKey];
  if (!n || !n.labelObj) return null;
  const div = document.createElement('div');
  div.className = 'fl-label fl-bubble';
  div.textContent = text;
  div.style.setProperty('--bubble-ink', window.SCENE_KIT.ink(opts.tone || 'accent'));
  labelsDiv.appendChild(div);
  const at = opts.at || 0;
  const dur = opts.dur === undefined ? 3 : opts.dur;
  labelEls.push({
    div: div, obj: n.labelObj, persistent: false,
    offset: [opts.dx || 0, opts.dy === undefined ? 2.4 : opts.dy, opts.dz || 0]
  });
  if (prefersReducedMotion) {
    div.classList.add('visible');
    return div;
  }
  scheduleTransition(function() { div.classList.add('visible'); }, at * 1000 + 120, transitionGeneration);
  scheduleTransition(function() { fadeLabel(div); }, (at + dur) * 1000 + 120, transitionGeneration);
  return div;
}

/* ─ Solid helper ─
   Builds any shape from `SCENE_KIT.SHAPE` as one mesh + one edge overlay +
   an optional top strip + an optional state overlay (fill/count/open — see
   the shape registry proposal, §3d). Geometry is cached per shape+size so
   repeated nodes of the same silhouette share triangles.

   `makeBox` stays as a thin wrapper so `ctx.box()` (build-api.js) and every
   existing scenario file that never declares a `shape` keep working
   unchanged — the default shape is `'box'`, which is exactly the geometry
   this helper used to build inline. */
const solidGeoCache = {};

function getShapeDef(shapeId) {
  return (window.SCENE_KIT && SCENE_KIT.SHAPE && SCENE_KIT.SHAPE[shapeId]) || SCENE_KIT.SHAPE.box;
}

function getSolidGeometry(shapeId, w, h, d, def) {
  const key = shapeId + '|' + w + '|' + h + '|' + d;
  let entry = solidGeoCache[key];
  if (!entry) {
    const parts = def.geo(w, h, d);
    const geo = parts.length > 1 ? SCENE_KIT.mergeGeometries(parts) : parts[0];
    entry = {geo, edgeGeo: new THREE.EdgesGeometry(geo, def.edgeAngle || 1)};
    solidGeoCache[key] = entry;
  }
  return entry;
}

/* A rising column overlay for `fill`/`count` state, or a hinged bar for
   `open` state — see setNodeLook()'s fill/count/open handling in
   flow3d-engine-persistent-world.js. Built once at the node's max state and
   scaled/rotated afterwards; never rebuilt, so it stays replay-safe. */
function buildStateOverlay(shapeId, def, w, h, d) {
  if (!def.state) return null;
  const mat = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0});

  if (def.state === 'open') {
    const barW = Math.min(w, d) * 0.7;
    const geo = boxGeoForOverlay(barW, h * 0.14, 0.05);
    geo.translate(barW / 2, 0, 0); // hinge at local origin, bar extends outward
    const bar = new THREE.Mesh(geo, mat);
    const hinge = new THREE.Group();
    hinge.position.set(-barW / 2, 0, d / 2 * 0.5);
    hinge.add(bar);
    return {kind: 'open', mat, group: hinge};
  }

  // fill (0..1) or count (0..stateMax): a column that grows from the base.
  const max = def.state === 'count' ? (def.stateMax || 1) : 1;
  const levelH = h * 0.82;
  const levelGeo = shapeId === 'cylinder'
    ? new THREE.CylinderGeometry(Math.min(w, d) * 0.22, Math.min(w, d) * 0.22, levelH, 14)
    : boxGeoForOverlay(w * 0.34, levelH, d * 0.34);
  levelGeo.translate(0, levelH / 2, 0); // pivot at its own base
  const level = new THREE.Mesh(levelGeo, mat);
  const group = new THREE.Group();
  group.position.y = -h / 2;
  group.scale.y = 0.001;
  group.add(level);
  return {kind: def.state, mat, group, max};
}
function boxGeoForOverlay(w, h, d) { return new THREE.BoxGeometry(w, h, d); }

function makeSolid(shapeId, w, h, d, colStr, edgeStr) {
  const def = getShapeDef(shapeId || 'box');
  const {geo, edgeGeo} = getSolidGeometry(shapeId || 'box', w, h, d, def);

  /* `envMapIntensity` thấp là có chủ ý: `scene.environment` (bầu trời) cho mặt
     hộp một lớp sheen theo hướng — thứ làm khối có thể tích — nhưng để mức 1.0
     thì bầu trời dìm luôn `col` của token và mọi hộp trôi về cùng một màu xanh
     pastel. 0.35 giữ nguyên ngôn ngữ "fill tối · viền mang màu vai trò". */
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colStr),
    roughness: 0.58, metalness: 0.22, envMapIntensity: 0.35,
    transparent: true, opacity: 0
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const edgeMat = new THREE.LineBasicMaterial({color: new THREE.Color(edgeStr), transparent: true, opacity: 0});
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);

  const g = new THREE.Group();
  g.add(mesh, edges);

  let stripMat = null;
  const stripW = def.strip ? def.strip(w, h, d) : null;
  if (stripW) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(stripW, 0.04),
      new THREE.MeshBasicMaterial({color: new THREE.Color(edgeStr), transparent: true, opacity: 0})
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.y = (def.top ? def.top(w, h, d) : h / 2) + 0.001;
    g.add(strip);
    stripMat = strip.material;
  }

  const stateOverlay = buildStateOverlay(shapeId || 'box', def, w, h, d);
  if (stateOverlay) g.add(stateOverlay.group);

  return {
    g, mesh, mat, edgeMat, stripMat, h,
    anchorY: def.top ? def.top(w, h, d) : h / 2,
    kind: def.kind || '',
    stateOverlay
  };
}

function makeBox(w, h, d, colStr, edgeStr) {
  return makeSolid('box', w, h, d, colStr, edgeStr);
}

/* ─ Arrow helper ─ */
function makeArrow(x1,y1,z1, x2,y2,z2, color, dashed) {
  const pts = [new THREE.Vector3(x1,y1,z1), new THREE.Vector3(x2,y2,z2)];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  /* Cộng sáng cho đường liền: một flow là năng lượng đang chạy giữa hai
     component, nên nó phải CỘNG vào nền chứ không phủ lên nền. Kèm bloom, đây
     là thứ biến nét 1px thành một sợi sáng có quầng. Đường đứt nét thì không —
     nó nói "quan hệ", không nói "có gì đang chạy", và additive làm nó nhoè mất
     nhịp đứt. */
  const mat = dashed
    ? new THREE.LineDashedMaterial({color: new THREE.Color(color), dashSize:0.35, gapSize:0.2, transparent:true, opacity:0.55})
    : new THREE.LineBasicMaterial({color: new THREE.Color(color), transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false});
  const line = new THREE.Line(geo, mat);
  if (dashed) line.computeLineDistances();
  const dir = new THREE.Vector3(x2-x1, y2-y1, z2-z1).normalize();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.4, 8),
    new THREE.MeshBasicMaterial({color: new THREE.Color(color), transparent:true, opacity:0})
  );
  cone.position.set(x2, y2, z2);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
  // store endpoints for particle use
  line.userData.p1 = new THREE.Vector3(x1,y1,z1);
  line.userData.p2 = new THREE.Vector3(x2,y2,z2);
  return [line, cone];
}

/* ─ Particle along arrow ─
   Trước đây là một quả cầu 0.08 tô màu phẳng: đúng vị trí, đúng màu, nhưng đọc
   như hạt nhựa trôi chứ không như năng lượng đang chạy. Sprite radial-gradient
   cộng sáng thì có lõi trắng và quầng tắt dần — cùng số hạt, nhưng thành dòng
   sáng. Texture dựng một lần rồi dùng chung cho mọi hạt. */
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0.00, 'rgba(255,255,255,1)');
  rg.addColorStop(0.28, 'rgba(255,255,255,.55)');
  rg.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(cv);
  _glowTex.userData.shared = true;   // wipeScene không được dispose nó
  return _glowTex;
}

function makeParticle(p1, p2, color, delay) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color: new THREE.Color(color),
    transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false
  });
  const mesh = new THREE.Sprite(mat);
  mesh.scale.set(0.44, 0.44, 1);
  buildAdd(mesh);
  particleQueue.push({mesh, mat, p1: p1.clone(), p2: p2.clone(), t: -delay, delay, duration: 1.2, loop: true, persistent: buildPersistent});
}

/* ─ Hero ring ─ */
function makeHeroRing(mesh) {
  // A torus ring orbiting the hero mesh
  const bb = new THREE.Box3().setFromObject(mesh);
  const size = bb.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.z) * 0.7;
  const geo = new THREE.TorusGeometry(r, 0.04, 8, 48);
  const mat = new THREE.MeshBasicMaterial({color: 0x3a7fff, transparent: true, opacity: 0.6});
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  // Position at mesh world position
  const wp = new THREE.Vector3();
  mesh.getWorldPosition(wp);
  ring.position.copy(wp);
  buildAdd(ring);
  return {ring, mat, phase: 0};
}
