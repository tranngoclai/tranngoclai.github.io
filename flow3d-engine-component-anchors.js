/* ══════════════════════════════════════════════
   COMPONENT ANCHORS

   Where a flow line is allowed to start and stop.

   Flow lines used to be authored as three hand-typed coordinates. That works
   right up until a component is resized, moved, or relocated by a step — and
   then the arrow points at empty air next to the box it is supposed to be
   about. Worse, every author picked a slightly different convention: some
   lines left from a box's side face, some from its top, some from a point
   floating above it, so two arrows in the same scene never agreed on what
   "leaves this component" looked like.

   One rule, applied everywhere:

     **An arrow leaves and arrives dead-centre on a component's top face.**

   `componentAnchor(key, t)` derives that point from the component's own
   geometry: its x/z centre, its top face (`pos.y + height/2`), plus a hair of
   clearance so the tube rests ON the surface instead of sinking into it. No
   scenario ever types an endpoint again, and a box that is resized or moved
   drags its arrows along with it.

   ── Why `t` ──
   A component can *travel* during the step the flow is drawn in (Pod leaves
   the queue and lands on a Node). The anchor therefore resolves against the
   world as it stands at a given moment: the source is read at the instant the
   line departs, the target at the instant it arrives. A line to a Pod that
   lands mid-step ends where the Pod will be when the line gets there.

   Position is replayed from the scenario data (`basePos` + each step's
   `set[key].pos`) rather than read off the live object, because the live
   object is still mid-tween — and because the step layer is built before the
   step's own state changes are applied.
══════════════════════════════════════════════ */

let anchorScenario = null;   // scenario whose step layer is being built
let anchorStepIdx  = 0;      // index of that step within scenario.steps

/* Clearance above the top face: slightly more than a flow tube's radius, so
   the line sits on the surface without z-fighting it. */
const ANCHOR_CLEARANCE = 0.09;

/* Arc height as a fraction of span, clamped at both ends — a two-metre hop
   should not loop through the ceiling, and a cross-cluster line should not
   read as a flat ruler laid over the scene. */
const ARC_RATE = 0.16;
const ARC_MIN  = 0.85;
const ARC_MAX  = 2.80;

const anchorMisses = {};     // keys already warned about, so a looping phase
                             // reports a typo once instead of every frame

function setAnchorContext(sc, stepIdx) {
  anchorScenario = sc || null;
  anchorStepIdx  = stepIdx || 0;
}

/* Where a component's box sits at time `t` of the current step.
   Steps before this one have committed their moves; this step's own move
   counts only once its `at` has passed. */
function resolveComponentPos(key, t) {
  const n = worldNodes[key];
  if (!n) return null;

  let pos = n.basePos;
  const steps = anchorScenario && anchorScenario.steps;
  if (!steps) return pos;

  for (let i = 0; i < anchorStepIdx && i < steps.length; i++) {
    const look = steps[i].set && steps[i].set[key];
    if (look && look.pos) pos = look.pos;
  }

  const cur = steps[anchorStepIdx] && steps[anchorStepIdx].set && steps[anchorStepIdx].set[key];
  if (cur && cur.pos && (cur.at === undefined || cur.at <= t)) pos = cur.pos;

  return pos;
}

/* `ref` is a component key, or a raw [x,y,z] for the rare line that genuinely
   points at a place rather than at a thing. */
function componentAnchor(ref, t) {
  if (Array.isArray(ref)) return ref.slice();

  const n = worldNodes[ref];
  if (!n) {
    if (!anchorMisses[ref]) {
      anchorMisses[ref] = true;
      console.warn('[flow3d] no component named "' + ref + '" — flow line skipped');
    }
    return null;
  }

  const pos = resolveComponentPos(ref, t === undefined ? 0 : t);
  return [pos[0], pos[1] + n.h / 2 + ANCHOR_CLEARANCE, pos[2]];
}

/* Control point that turns two anchors into a thrown arc rather than a chord
   drawn through whatever stands between them. Lifted above the *higher* of the
   two ends so the line always clears both components. */
function componentArc(p1, p2, extra) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1], dz = p2[2] - p1[2];
  const span = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const lift = Math.min(ARC_MAX, Math.max(ARC_MIN, span * ARC_RATE)) + (extra || 0);
  return [
    (p1[0] + p2[0]) / 2,
    Math.max(p1[1], p2[1]) + lift,
    (p1[2] + p2[2]) / 2
  ];
}
