/* ══════════════════════════════════════════════
   FLOW LINES & ELEMENT STATE CHANGES

   Packet flow is drawn as an *arrow line*: a tube that grows from source to
   target with a bright leading pulse and an arrow tip, instead of a container
   token travelling through space.

   Element state changes are first-class: a step declares `set` entries with an
   `at` (seconds) and the engine plays a ring burst + emissive flash + badge on
   the component at that exact moment, then commits the new look.
══════════════════════════════════════════════ */

let flowQueue  = [];   // arrow lines for the current step
let stateQueue = [];   // scheduled element state changes / reveals

const FLOW_TUBULAR = 110;                   // segments along the path
const FLOW_RADIAL  = 8;                     // segments around the tube
const FLOW_HEAD    = 12;                    // length of the bright leading pulse
const FLOW_IDX_SEG = FLOW_RADIAL * 6;       // index count per tubular segment

/* ─────────────────────────────────────────────
   ARROW LINE
   makeFlowLine([[x,y,z], ...], color, {at, dur, hold, loop, width})
   `at` is the offset inside the shared `loop`, so several lines in one step
   replay their sequence in sync instead of drifting apart.
───────────────────────────────────────────── */
function makeFlowLine(points, color, opts) {
  if (!points || points.length < 2) return;
  opts = opts || {};

  const curve = new THREE.CatmullRomCurve3(
    points.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const col = new THREE.Color(color || '#3a7fff');
  const radius = opts.width || 0.055;

  // Dim full-length track that the pulse leaves behind.
  const trackGeo = new THREE.TubeGeometry(curve, FLOW_TUBULAR, radius, FLOW_RADIAL, false);
  const trackMat = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0, depthWrite: false});
  const track = new THREE.Mesh(trackGeo, trackMat);

  // Bright leading pulse — same geometry, its own draw window.
  const headGeo = trackGeo.clone();
  const headMat = new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const head = new THREE.Mesh(headGeo, headMat);

  // Arrow tip riding at the front of the pulse.
  const tipMat = new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0, depthWrite: false});
  const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.6, radius * 9, 10), tipMat);

  buildAdd(track); buildAdd(head); buildAdd(tip);

  const draw = opts.dur || 1.4;
  const hold = opts.hold === undefined ? 0.6 : opts.hold;
  const fade = 0.45;

  const entry = {
    curve, trackGeo, trackMat, headGeo, headMat, tip, tipMat,
    at: opts.at || 0,
    draw, hold, fade,
    loop: opts.loop || (draw + hold + fade + 0.7),
    t: 0,
    up: new THREE.Vector3(0, 1, 0),
    persistent: buildPersistent
  };

  if (prefersReducedMotion) {
    // No travelling pulse: show the finished arrow immediately.
    trackMat.opacity = 0.5;
    headMat.opacity = 0;
    tipMat.opacity = 0.85;
    tip.position.copy(curve.getPoint(1));
    tip.quaternion.setFromUnitVectors(entry.up, curve.getTangent(1).normalize());
    return;
  }

  flowQueue.push(entry);
}

function updateFlows(dt) {
  for (let i = 0; i < flowQueue.length; i++) {
    const a = flowQueue[i];
    a.t += dt;

    let lt = (a.t - a.at) % a.loop;
    if (lt < 0) lt += a.loop;

    let p, alpha;
    if (lt < a.draw) {
      p = easeInOutCubic(lt / a.draw);
      alpha = Math.min(lt / 0.18, 1);
    } else if (lt < a.draw + a.hold) {
      p = 1; alpha = 1;
    } else if (lt < a.draw + a.hold + a.fade) {
      p = 1; alpha = 1 - (lt - a.draw - a.hold) / a.fade;
    } else {
      a.trackMat.opacity = 0; a.headMat.opacity = 0; a.tipMat.opacity = 0;
      continue;
    }

    const segs = Math.max(1, Math.round(p * FLOW_TUBULAR));
    const headStart = Math.max(0, segs - FLOW_HEAD);
    a.trackGeo.setDrawRange(0, segs * FLOW_IDX_SEG);
    a.headGeo.setDrawRange(headStart * FLOW_IDX_SEG, (segs - headStart) * FLOW_IDX_SEG);

    // Once parked at the target the pulse breathes instead of sitting flat.
    const breathe = lt < a.draw ? 1 : 0.72 + Math.sin(lt * 6) * 0.28;
    a.trackMat.opacity = alpha * 0.4;
    a.headMat.opacity  = alpha * 0.95 * breathe;

    // TubeGeometry frames sample with getPoint(), so match it for the tip.
    const tp = segs / FLOW_TUBULAR;
    a.tip.position.copy(a.curve.getPoint(tp));
    a.tip.quaternion.setFromUnitVectors(a.up, a.curve.getTangent(tp).normalize());
    a.tipMat.opacity = alpha * 0.9;
  }
}

/* ─────────────────────────────────────────────
   ELEMENT STATE CHANGE
   scheduleStateChange(node, look) where look = {label, col, edge, hover,
   at, badge, flash, dy, reveal, conceal}
───────────────────────────────────────────── */
function scheduleStateChange(n, look) {
  const flashCol = look.flash || look.edge || '#3a7fff';
  const col = new THREE.Color(flashCol);
  const at = look.at || 0;

  // A component that also moves in this state change gets its ring and badge at
  // the destination — that is where the eye will be when the change lands.
  const px = look.pos ? look.pos[0] : n.x;
  const py = look.pos ? look.pos[1] + n.h / 2 : n.y;
  const pz = look.pos ? look.pos[2] : n.z;

  const size = new THREE.Box3().setFromObject(n.mesh).getSize(new THREE.Vector3());
  // Capped: a Node platform is metres wide, and a ring that tracked its full
  // width would sweep across half the cluster instead of pointing at it.
  const r = Math.min(3.4, Math.max(0.9, Math.max(size.x, size.z) * 0.66));
  const ringMat = new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, Math.max(0.035, r * 0.03), 6, 44), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(px, py + 0.08, pz);
  buildAdd(ring);

  const badgeDiv = look.badge
    ? addLabel(look.badge, px, py + (look.dy === undefined ? 1.25 : look.dy), pz,
        flashCol, at, false, 'state-badge')
    : null;

  stateQueue.push({n, look, col, ring, ringMat, badgeDiv, t: -at, dur: 1.15, applied: false});
}

function updateStates(dt) {
  for (let i = stateQueue.length - 1; i >= 0; i--) {
    const s = stateQueue[i];
    s.t += dt;
    if (s.t < 0) continue;

    if (!s.applied) {
      s.applied = true;
      if (s.look.reveal)  revealNode(s.n);
      if (s.look.conceal) concealNode(s.n);
      setNodeLook(s.n, s.look, true);
    }

    const p = Math.min(s.t / s.dur, 1);
    s.ring.scale.setScalar(0.72 + p * 1.55);
    s.ringMat.opacity = (1 - p) * 0.6;

    // Fast attack, slow release — reads as "this element just changed".
    const f = p < 0.14 ? p / 0.14 : 1 - (p - 0.14) / 0.86;
    setNodeFlash(s.n, Math.max(0, f), s.col);

    if (p >= 1) {
      setNodeFlash(s.n, 0, s.col);
      s.ring.visible = false;
      stateQueue.splice(i, 1);
    }
  }
}

function setNodeFlash(n, f, col) {
  n.flash = f;
  if (!n.mat.emissive) return;
  if (f > 0) {
    n.mat.emissive.copy(col);
    n.mat.emissiveIntensity = f * 0.8;
  } else {
    // Back to the material's factory state — no glow left behind.
    n.mat.emissive.setHex(0x000000);
    n.mat.emissiveIntensity = 1;
  }
}

/* ─ Teardown ─ */
function clearFlowState() {
  flowQueue = flowQueue.filter(f => f.persistent);
  // A half-played flash must not be left burned into the component; the look
  // itself is re-derived from scratch by applyPersistentStep().
  stateQueue.forEach(s => setNodeFlash(s.n, 0, s.col));
  stateQueue = [];
}
