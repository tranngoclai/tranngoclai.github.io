/* ══════════════════════════════════════════════
   PERSISTENT WORLD
   A scenario may declare `world(w)` instead of building its scene from
   scratch on every step. The world is built once when the scenario is
   entered; each step then only reveals, recolours, focuses, moves and
   animates flows over the components that are already standing.

   Because the world is persistent, a scenario should never draw the same
   real-world thing twice. A subject that travels from a store to a queue to
   a worker is ONE component with `set: { key: { pos: [x,y,z] } }` at each leg
   — not three look-alike boxes taking turns. A component's status belongs on
   the component itself (`label` / `col` / `badge`), not on a separate status
   chip beside it.
══════════════════════════════════════════════ */

let worldGroup = null;      // persistent components (survive step changes)
let stepGroup  = null;      // arrows / pods / notes for the current step only
let worldNodes = {};        // key → node record
let worldHov   = [];        // hover entries for persistent components
let stepHov    = [];        // hover entries for the current step layer
let worldScenarioId = null; // stable id of the scenario owning this world

function resetPersistentWorld() {
  worldGroup = null;
  stepGroup = null;
  worldNodes = {};
  worldHov = [];
  stepHov = [];
  worldScenarioId = null;
}

/* ─ Build the world once ─ */
function buildPersistentWorld(sc, scenarioId) {
  worldNodes = {};
  worldHov = [];

  worldGroup = new THREE.Group();
  worldGroup.userData.noFloat = true;
  stepGroup = new THREE.Group();
  stepGroup.userData.noFloat = true;
  sceneGroup.add(worldGroup, stepGroup);

  setBuildTarget(worldGroup, true);
  sc.world(makeWorldCtx());
  setBuildTarget(null, false);

  worldScenarioId = scenarioId;
}

function makeWorldCtx() {
  return {
    /* node('store', {label, pos:[x,y,z], size:[w,h,d], col, edge, order, hidden, labelPos, hover})
       `pos` here is only the component's home; steps can relocate it with
       set:{key:{pos}} and it will travel there rather than jump. */
    node(key, o) {
      const [x, y, z] = o.pos;
      const [w, h, d] = o.size;
      // `labelPos` moves the caption off the box — used for the wide node
      // platforms whose components would otherwise sit on top of their label.
      const n = addBox(o.labelPos ? '' : (o.label || ''), x, y, z, w, h, d, o.col, o.edge, o.order || 0, o.shape);
      if (o.labelPos) {
        n.labelDiv = addLabel(captionHtml(o.label), o.labelPos[0], o.labelPos[1], o.labelPos[2],
          'rgba(192,208,232,.7)', (o.order || 0) * 0.09 + 0.3);
        n.labelObj = n.labelDiv._anchor;
      }
      n.key = key;
      n.managed = true;
      n.baseCol = o.col;
      n.baseEdge = o.edge;
      n.basePos = [x, y, z];
      // Kept so the engine can frame a step around the components it focuses
      // (see frameFocus) without the scenario re-typing any coordinates.
      n.size = [w, h, d];
      // Caption offset relative to the box, kept constant while the box moves.
      n.labelOff = n.labelObj
        ? [n.labelObj.position.x - x, n.labelObj.position.y - y, n.labelObj.position.z - z]
        : null;
      n.baseLabel = o.label || '';
      n.baseHover = o.hover || o.label || '';
      // Status khởi điểm của component (nếu có) — xem flow3d-engine-node-status-label.js.
      n.baseStatus = o.status || '';
      createNodeStatus(n, n.baseStatus);
      // Shape state — see setNodeLook()'s fill/count/open handling below.
      // Absolute values only (never a delta): applyPersistentStep() resets
      // every node to these before replaying steps 0..stepIdx, so a value
      // that depended on "current" would read differently tuning forward
      // vs. rewinding.
      n.baseFill = o.fill;
      n.baseCount = o.count;
      n.baseOpen = o.open;
      n.hiddenByDefault = !!o.hidden;
      n.visible = !o.hidden;
      n.cur = o.hidden ? 0 : 1;
      if (o.hidden) n.g.visible = false;
      worldNodes[key] = n;
      worldHov.push({mesh: n.mesh, text: o.hover || o.label || '', node: n});
      return n;
    },
    /* Static caption that belongs to the world, not to a single step. */
    txt(text, x, y, z, color, order) {
      addLabel(text, x, y, z, color || 'rgba(140,164,196,.55)', (order || 0) * 0.09);
    },
    cam(target, dist) { startCamTween(target, dist); }
  };
}

/* ─ Per-step layer ─ */
function clearStepLayer() {
  animQueue     = animQueue.filter(a => a.persistent);
  arrowQueue    = arrowQueue.filter(a => a.persistent);
  particleQueue = particleQueue.filter(a => a.persistent);
  clearFlowState();
  if (stepGroup) disposeOwnedGroup(stepGroup);
  clearTransientLabels();
}

function buildStepLayer(step) {
  const ctx = makeCtx();
  setBuildTarget(stepGroup, false);
  if (step.scene) step.scene(ctx);
  setBuildTarget(null, false);
  stepHov = ctx._hov;
}

/* Only components currently on screen should answer the hover raycast. */
function refreshHover() {
  hovMeshes = worldHov.filter(h => h.node.visible).concat(stepHov);
}

/* ─ Apply cumulative state up to `stepIdx`, then focus ─
   Replaying from step 0 keeps forward and backward navigation identical.
   Steps before the current one snap to their final look; the current step's
   changes are *played* — each component lights up at the moment its state
   actually changes (`at`, in seconds), so the viewer watches the transition. */
function applyPersistentStep(sc, stepIdx) {
  moveTweens = [];
  Object.keys(worldNodes).forEach(function(key) {
    const n = worldNodes[key];
    n.visible = !n.hiddenByDefault;
    n.flash = 0;
    setNodePos(n, n.basePos, false);
    setNodeLook(n, {label: n.baseLabel, col: n.baseCol, edge: n.baseEdge, hover: n.baseHover,
      status: n.baseStatus, fill: n.baseFill, count: n.baseCount, open: n.baseOpen});
  });

  for (let i = 0; i < stepIdx; i++) applyStepLook(sc.steps[i]);

  const step = sc.steps[stepIdx];
  // State bursts belong to the step layer so they are torn down with it.
  setBuildTarget(stepGroup, false);
  applyStepLook(step, true);
  setBuildTarget(null, false);

  labelFocusOnly = !!sc.focusLabels;
  applyFocus(step.focus || [], step.labels || []);
  refreshHover();

  if (step.cam) startCamTween(step.cam, step.dist);
  else frameFocus(step);
}

/* ─ Auto-frame ─
   A step that does not name a camera gets one derived from the components it
   focuses. Cameras then belong to the same regime as captions and arrows: the
   world file owns every coordinate, and moving a component re-aims every shot
   of it instead of leaving a hand-typed number pointing at empty floor.

   A component that this step is about to move is framed at its DESTINATION —
   the viewer should be looking at where the action lands, not where it left. */
function frameFocus(step) {
  frameNodeKeys(step.focus || [], step.set || {});
}

function frameNodeKeys(keys, set) {
  let lo = null, hi = null;

  keys.forEach(function(k) {
    const n = worldNodes[k];
    if (!n || !n.visible) return;
    const p = (set[k] && set[k].pos) || [n.g.position.x, n.baseY, n.g.position.z];
    const s = n.size || [1, 1, 1];
    if (!lo) { lo = [Infinity, Infinity, Infinity]; hi = [-Infinity, -Infinity, -Infinity]; }
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], p[i] - s[i] / 2);
      hi[i] = Math.max(hi[i], p[i] + s[i] / 2);
    }
  });
  if (!lo) return;

  // Enough distance to hold the focused span plus room for its captions and
  // the arrows arcing above it, clamped so no shot goes claustrophobic or
  // zooms out past the point where labels are readable.
  //
  // Height counts as much as footprint. A single tall component (etcd is a
  // cylinder several units high) has almost no horizontal span, so a
  // width-only measure pushes the shot to the bottom of the clamp and the
  // silhouette then overflows the viewport — the viewer sees a wall, not a
  // shape. Weighted below the ground span because the frame is wider than
  // it is tall.
  const span = Math.max(hi[0] - lo[0], hi[2] - lo[2], (hi[1] - lo[1]) * 1.9);
  const dist = Math.max(24, Math.min(58, span * 1.55 + 14));
  startCamTween([(lo[0] + hi[0]) / 2, 0, (lo[2] + hi[2]) / 2], dist);
}

/* `played` = this is the current step, so timed entries animate instead of
   snapping. Timing comes from `showAt` / `hideAt` and from `set[key].at`. */
function applyStepLook(st, played) {
  const showAt = st.showAt || {}, hideAt = st.hideAt || {};
  const set = st.set || {};
  const timed = {};   // key → look played on a timer

  if (played) {
    Object.keys(set).forEach(function(k) {
      if (worldNodes[k] && set[k].at !== undefined) timed[k] = Object.assign({}, set[k]);
    });
    Object.keys(showAt).forEach(function(k) {
      if (!worldNodes[k]) return;
      timed[k] = Object.assign({at: showAt[k]}, set[k] || {}, {at: showAt[k], reveal: true});
    });
    Object.keys(hideAt).forEach(function(k) {
      if (!worldNodes[k]) return;
      timed[k] = Object.assign({at: hideAt[k]}, set[k] || {}, {at: hideAt[k], conceal: true});
    });
  }

  (st.show || []).forEach(function(k) {
    if (worldNodes[k] && !(timed[k] && timed[k].reveal)) worldNodes[k].visible = true;
  });
  (st.hide || []).forEach(function(k) {
    if (worldNodes[k] && !(timed[k] && timed[k].conceal)) worldNodes[k].visible = false;
  });
  Object.keys(set).forEach(function(k) {
    if (worldNodes[k] && !timed[k]) setNodeLook(worldNodes[k], set[k], played);
  });

  Object.keys(timed).forEach(function(k) { scheduleStateChange(worldNodes[k], timed[k]); });
}

/* A component that changes place does it by tweening, not by teleporting —
   so the viewer follows the same box instead of losing it and finding a
   look-alike somewhere else. */
let moveTweens = [];

function setNodePos(n, pos, animate) {
  moveTweens = moveTweens.filter(m => m.n !== n);
  const from = [n.g.position.x, n.g.position.y, n.g.position.z];
  const apply = (x, y, z) => {
    n.g.position.set(x, y, z);
    n.x = x; n.y = y + n.h / 2; n.z = z; n.baseY = y;
    n.g.userData._baseY = y;
    if (n.labelObj && n.labelOff) {
      n.labelObj.position.set(x + n.labelOff[0], y + n.labelOff[1], z + n.labelOff[2]);
    }
    moveNodeStatus(n, x, y, z);
  };
  if (!animate || prefersReducedMotion) { apply(pos[0], pos[1], pos[2]); return; }
  moveTweens.push({n, from, to: pos.slice(), t: 0, dur: 0.9, apply});
}

function updateMoveTweens(dt) {
  for (let i = moveTweens.length - 1; i >= 0; i--) {
    const m = moveTweens[i];
    m.t += dt;
    const p = easeInOutCubic(Math.min(m.t / m.dur, 1));
    // Slight arc so the move reads as travel rather than a slide.
    const lift = Math.sin(p * Math.PI) * 1.1;
    m.apply(
      m.from[0] + (m.to[0] - m.from[0]) * p,
      m.from[1] + (m.to[1] - m.from[1]) * p + lift,
      m.from[2] + (m.to[2] - m.from[2]) * p
    );
    if (p >= 1) { m.apply(m.to[0], m.to[1], m.to[2]); moveTweens.splice(i, 1); }
  }
}

/* `animate` is false when a past step is being snapped back into place on
   replay — only the step the viewer is watching gets to move. */
function setNodeLook(n, look, animate) {
  if (look.pos) setNodePos(n, look.pos, !!animate);
  if (look.label !== undefined && n.labelDiv) {
    // Chi tiết (dòng 2 trở đi) bọc trong <span class="detail"> để CSS giấu đi
    // ở shot rộng — xem flow3d-engine-label-zoom-detail.js.
    n.labelDiv.innerHTML = captionHtml(look.label);
    n.label = look.label;
  }
  if (look.status !== undefined) setNodeStatus(n, look.status);
  if (look.col)  n.mat.color.set(look.col);
  if (look.edge) {
    n.edgeMat.color.set(look.edge);
    if (n.stripMat) n.stripMat.color.set(look.edge);
  }
  if (look.hover !== undefined) {
    const hov = worldHov.find(h => h.mesh === n.mesh);
    if (hov) hov.text = look.hover;
  }
  if (look.fill !== undefined || look.count !== undefined || look.open !== undefined) {
    applyShapeState(n, look);
  }
}

/* Mutates the shape's state overlay (built once at max state in
   makeSolid/buildStateOverlay — flow3d-engine-animation-helpers.js) rather
   than touching `geometry`, so geometry caching and hover stay untouched.
   Only the param the shape actually declared (`SHAPE[shape].state`) does
   anything — a `fill` on a shape with no fill overlay is silently ignored. */
function applyShapeState(n, look) {
  const ov = n.stateOverlay;
  if (!ov) return;
  if (ov.kind === 'fill' && look.fill !== undefined) {
    n.fill = look.fill;
    ov.group.scale.y = Math.max(0.001, Math.min(1, look.fill));
  } else if (ov.kind === 'count' && look.count !== undefined) {
    n.count = look.count;
    ov.group.scale.y = Math.max(0.001, Math.min(1, look.count / ov.max));
  } else if (ov.kind === 'open' && look.open !== undefined) {
    n.open = look.open;
    ov.group.rotation.y = look.open ? -Math.PI / 2 : 0;
  }
}

/* Focused components stay fully lit; everything else recedes but remains visible,
   so the viewer never loses the shape of the cluster.

   `focusLabels` on the scenario tightens that further: only the components this
   phase is actually talking about keep their caption (name + configuration).
   The dim boxes stay on screen — the cluster keeps its shape — but the text
   layer carries just the phase's subject instead of every number at once.
   Which components those are comes from the phase's `labels` list, falling back
   to `focus` — so a phase can light a whole region while captioning one box. */
let activeFocus = [];
let activeLabels = [];
let labelFocusOnly = false;

function applyFocus(focus, labels) {
  activeLabels = labels && labels.length ? labels : focus;
  activeFocus = focus;
  Object.keys(worldNodes).forEach(function(key) {
    const n = worldNodes[key];
    const wasVisible = n.g.visible;
    n.g.visible = n.visible;
    if (n.visible && !wasVisible) popNode(n);
    applyNodeFocus(n);
  });

  const heroNode = worldNodes[focus[0]];
  if (heroMesh && heroMesh !== heroNode && heroMesh.g) {
    heroMesh.g.scale.x = 1;
    heroMesh.g.scale.z = 1;
  }
  heroMesh = (heroNode && heroNode.visible) ? heroNode : null;
}

function applyNodeFocus(n) {
  const hasFocus = activeFocus.length > 0;
  if (!n.visible)                        n.cur = 0;
  else if (!hasFocus)                    n.cur = 1;
  else if (activeFocus.indexOf(n.key) >= 0) n.cur = 1;
  else                                   n.cur = 0.24;

  if (n.labelDiv) {
    // Caption follows the box's own visibility, unless the scenario asked for
    // labels to be scoped to the focus set — then off-topic captions go away
    // entirely rather than lingering as dim text.
    const offTopic = labelFocusOnly && activeLabels.length > 0 && activeLabels.indexOf(n.key) < 0;
    const showLabel = n.visible && !offTopic;
    n.labelDiv.style.opacity = showLabel ? String(Math.max(n.cur, 0.18)) : '0';
    n.labelDiv.classList.toggle('hero-label', showLabel && activeFocus[0] === n.key);
  }
  /* Status không bị `focusLabels` cắt như caption: nó là một hạt thông tin
     rất ngắn và người xem cần đọc được trạng thái của cả cụm cùng lúc — chỉ
     mờ theo box chứ không biến mất. */
  if (n.statusDiv) n.statusDiv.style.opacity = n.visible ? String(Math.max(n.cur, 0.3)) : '0';
}

/* Components whose reveal is timed to a flow arrival appear mid-step. */
function revealNode(n) {
  if (n.visible) return;
  n.visible = true;
  n.g.visible = true;
  n.shown = 0;
  popNode(n);
  applyNodeFocus(n);
  refreshHover();
}

function concealNode(n) {
  if (!n.visible) return;
  n.visible = false;
  n.g.visible = false;
  applyNodeFocus(n);
  refreshHover();
}

/* Small re-entrance pop when a component appears for the first time. */
function popNode(n) {
  n.entrance = 0;
  n.g.scale.set(1, 0.001, 1);
  animQueue.push({
    type: 'box',
    group: n.g, mat: n.mat, edgeMat: n.edgeMat, stripMat: n.stripMat,
    baseY: n.baseY, h: n.h,
    delay: 0, duration: 0.45, t: 0,
    persistent: true,
    node: n
  });
}

/* Drives opacity for world nodes: entrance progress × focus target. */
function updateWorldNodes(dt) {
  Object.keys(worldNodes).forEach(function(key) {
    const n = worldNodes[key];
    if (!n.g.visible) return;
    n.shown = n.shown === undefined ? n.cur : n.shown + (n.cur - n.shown) * Math.min(1, dt * 6);
    const o = n.entrance * n.shown;
    // `flash` is the state-change burst — it lifts the component out of the
    // dim layer for the moment its state actually changes.
    const f = n.flash || 0;
    n.mat.opacity = Math.min(1, o + f * 0.45);
    n.edgeMat.opacity = Math.min(1, o * (n === heroMesh ? 1 : 0.75) + f);
    if (n.stripMat) n.stripMat.opacity = Math.min(1, o * 0.75 + f);
    if (n.stateOverlay) n.stateOverlay.mat.opacity = o * 0.85;
  });
}
