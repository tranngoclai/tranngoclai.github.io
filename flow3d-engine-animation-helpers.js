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

/* ─ Box helper ─ */
function makeBox(w, h, d, colStr, edgeStr) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({color: new THREE.Color(colStr), roughness: 0.65, metalness: 0.15, transparent: true, opacity: 0});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({color: new THREE.Color(edgeStr), transparent: true, opacity: 0});
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  // top highlight strip
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.88, 0.04),
    new THREE.MeshBasicMaterial({color: new THREE.Color(edgeStr), transparent: true, opacity: 0})
  );
  strip.rotation.x = -Math.PI/2;
  strip.position.y = h/2 + 0.001;
  const g = new THREE.Group();
  g.add(mesh, edges, strip);
  return {g, mesh, mat, edgeMat, stripMat: strip.material, h};
}

/* ─ Arrow helper ─ */
function makeArrow(x1,y1,z1, x2,y2,z2, color, dashed) {
  const pts = [new THREE.Vector3(x1,y1,z1), new THREE.Vector3(x2,y2,z2)];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = dashed
    ? new THREE.LineDashedMaterial({color: new THREE.Color(color), dashSize:0.35, gapSize:0.2, transparent:true, opacity:0.55})
    : new THREE.LineBasicMaterial({color: new THREE.Color(color), transparent:true, opacity:0});
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

/* ─ Particle along arrow ─ */
function makeParticle(p1, p2, color, delay) {
  const geo = new THREE.SphereGeometry(0.08, 6, 6);
  const mat = new THREE.MeshBasicMaterial({color: new THREE.Color(color), transparent:true, opacity:0});
  const mesh = new THREE.Mesh(geo, mat);
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

