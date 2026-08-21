/* ══════════════════════════════════════════════
   LABEL PROJECTION — update each frame
══════════════════════════════════════════════ */
const _v3 = new THREE.Vector3();
const _labelOffset = new THREE.Vector3();
// Two labels can project to (near-)identical screen points — e.g. two pods on
// the same node both flip to "Terminating" in the same beat, or a state badge
// lands right where a lingering flow-line caption sits. Projection alone has
// no notion of the other labels on screen, so it stacks them illegibly.
// This is a cheap decluttering pass: place labels in order, and any label
// whose box would overlap an already-placed one gets nudged clear of it.
// O(n²) but n is a handful of labels per scene.
const _placedLabels = [];

// A label the focus system has dimmed (an off-topic component's persistent
// name caption) is not competing for the viewer's attention this phase — it
// must not be allowed to shove aside a badge or caption that is. Skipping it
// from the collision set entirely lets it sit under/behind whatever matters.
const DIM_OPACITY_THRESHOLD = 0.5;
function isDimmed(div) {
  const o = parseFloat(div.style.opacity);
  return !isNaN(o) && o < DIM_OPACITY_THRESHOLD;
}

// After this many stacked pushes at one spot, keep alternating sideways
// instead of marching a column of badges off the bottom of the viewport.
const STACK_BEFORE_SIDESTEP = 3;

/* Ai được giữ chỗ, ai phải né. Bubble là lời giải thích đang được đọc nên đặt
   trước tất cả và không bao giờ bị đẩy; status chip phải dính vào nóc của
   đúng component nó mô tả — bị đẩy đi là nó thành nhãn của thằng bên cạnh, nên
   cũng không đẩy. Hai loại đó vẫn chiếm chỗ trong _placedLabels, phần còn lại
   (badge, caption, caption của mũi tên) tự né chúng. */
const LABEL_ORDER = ['fl-bubble', 'node-status', 'state-badge'];
const LABEL_PINNED = ['fl-bubble', 'node-status'];
function labelRank(div) {
  for (let i = 0; i < LABEL_ORDER.length; i++) {
    if (div.classList.contains(LABEL_ORDER[i])) return i;
  }
  return LABEL_ORDER.length;
}
function isPinned(div) {
  return LABEL_PINNED.some(function(cls) { return div.classList.contains(cls); });
}
const _ordered = [];

// How far past the frustum edge a label may sit before it stops being drawn.
const NDC_MARGIN = 1.06;
// The pipeline strip owns the bottom of the viewport; a label clamped into that
// band gets sliced by it. Keep labels above the strip while it is on screen.
const HUD_RESERVE = 64;

function updateLabels() {
  // #labels overlays the canvas, so project into canvas-local coordinates.
  const W = cvs.clientWidth, H = cvs.clientHeight;
  const bottomLimit = H - (pipelineUI.classList.contains('show') ? HUD_RESERVE : 0);
  _placedLabels.length = 0;
  _ordered.length = 0;
  labelEls.forEach(function(item) { _ordered.push(item); });
  _ordered.sort(function(a, b) { return labelRank(a.div) - labelRank(b.div); });
  _ordered.forEach(function(item) {
    _v3.setFromMatrixPosition(item.obj.matrixWorld);
    if (item.offset) _v3.add(_labelOffset.set(item.offset[0], item.offset[1], item.offset[2]));
    _v3.project(camera);
    // Depth alone is not visibility: a node off the left/right edge still
    // projects with z < 1, and the clamp below would then pin its caption to
    // the frame edge — a column of text from components that are not even on
    // screen, sitting on top of whatever is. Anything past the frustum sides
    // (with a small margin so a label straddling the edge still shows) is
    // simply not drawn.
    const visible = _v3.z < 1
      && Math.abs(_v3.x) <= NDC_MARGIN && Math.abs(_v3.y) <= NDC_MARGIN;
    let sx = (_v3.x * 0.5 + 0.5) * W;
    let sy = (-_v3.y * 0.5 + 0.5) * H;

    if (visible && !isDimmed(item.div)) {
      const w = item.div.offsetWidth || 90, h = item.div.offsetHeight || 20;
      let dir = 1, pushes = 0;
      const pinned = isPinned(item.div);
      for (let i = 0; !pinned && i < _placedLabels.length; i++) {
        const p = _placedLabels[i];
        if (Math.abs(sx - p.sx) < (w + p.w) / 2 && Math.abs(sy - p.sy) < (h + p.h) / 2) {
          pushes++;
          if (pushes > STACK_BEFORE_SIDESTEP) {
            sx = p.sx + dir * ((w + p.w) / 2 + 3);
            dir = -dir;
          } else {
            sy = p.sy + (h + p.h) / 2 + 2;
          }
        }
      }
      sx = Math.max(w / 2, Math.min(W - w / 2, sx));
      sy = Math.max(h / 2, Math.min(bottomLimit - h / 2, sy));
      _placedLabels.push({sx, sy, w, h});
    }

    item.div.style.left = sx + 'px';
    item.div.style.top  = sy + 'px';
    // '' chứ không phải 'block': status chip là flex và một node chưa có status
    // tự đánh dấu `is-empty` — cả hai đều do CSS quyết, không được ghi đè.
    item.div.style.display = (visible && !item.div.classList.contains('is-empty')) ? '' : 'none';
  });
}

/* ══════════════════════════════════════════════
   RESIZE + RENDER LOOP
══════════════════════════════════════════════ */
function resize() {
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  resizePost(W, H);
  cvs.style.width  = W + 'px';
  cvs.style.height = H + 'px';
}
new ResizeObserver(resize).observe(wrap);
resize();

let frame = 0;
const clock = { last: 0, dt: 0 };

function floatChildren(group) {
  group.children.forEach(function(ch, i) {
    if (ch.isGroup && !ch.userData.noFloat && ch.scale.y > 0.99) {
      ch.position.y += Math.sin(frame * 0.016 + i * 1.2) * 0.0012;
    }
  });
}

/* ── Trôi camera khi không ai chạm vào ──
   Một cảnh 3D đứng hình tuyệt đối trông y hệt một tấm ảnh: mất luôn tín hiệu
   "cái này xoay được". Sau 6 giây không tương tác, camera tự quay rất chậm để
   thị sai nói giùm rằng đây là không gian; chạm vào là dừng ngay lập tức và
   con số 6 giây được đếm lại. Tôn trọng prefers-reduced-motion. */
const IDLE_BEFORE_DRIFT = 6;
let idleTime = 0;
controls.autoRotateSpeed = 0.25;

function noteInteraction() { idleTime = 0; controls.autoRotate = false; }
controls.addEventListener('start', noteInteraction);
['pointerdown', 'wheel', 'keydown'].forEach(function(ev) {
  window.addEventListener(ev, noteInteraction, {passive: true});
});

function idleDrift(dt) {
  if (prefersReducedMotion) return;
  // Một cú tween camera đang chạy là "đang có chuyện xảy ra": để autoRotate
  // chen vào thì bước đó trượt khỏi khung ngắm mà nó vừa bay tới.
  if (camTween) { idleTime = 0; controls.autoRotate = false; return; }
  idleTime += dt;
  if (idleTime > IDLE_BEFORE_DRIFT) controls.autoRotate = true;
}

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - clock.last) / 1000, 0.05);
  clock.last = now;
  frame++;
  controls.update();
  updateLabelDetail(camera, controls);

  // cam tween
  if (camTween) {
    camTween.t = Math.min(camTween.t + dt * 1.6, 1);
    const e = easeInOutCubic(camTween.t);
    controls.target.lerpVectors(camTween.from, camTween.to, e);
    if (camTween.camTo) camera.position.lerpVectors(camTween.camFrom, camTween.camTo, e);
    if (camTween.t >= 1) camTween = null;
  }

  // Box entrance animations
  for (let i = animQueue.length - 1; i >= 0; i--) {
    const a = animQueue[i];
    a.t += dt;
    if (a.t < 0) continue;
    const p = Math.min(a.t / a.duration, 1);
    const e = easeOutBack(p);

    // A managed node can be travelling while it pops in, so its live baseY
    // wins over the one captured when the animation was queued.
    const baseY = (a.node && a.node.managed) ? a.node.baseY : a.baseY;
    a.group.scale.y = Math.max(0.001, e);
    a.group.position.y = baseY + a.h / 2 * (e - 1);

    const opacity = easeOutCubic(p);
    if (a.node && a.node.managed) {
      // Persistent world nodes get their final opacity from updateWorldNodes().
      a.node.entrance = opacity;
    } else {
      if (a.mat)      a.mat.opacity      = opacity;
      if (a.edgeMat)  a.edgeMat.opacity  = opacity * 0.75;
      if (a.stripMat) a.stripMat.opacity = opacity * 0.75;
    }

    if (p >= 1) {
      a.group.position.y = baseY;
      animQueue.splice(i, 1);
    }
  }

  // Arrow draw animations
  for (let i = arrowQueue.length - 1; i >= 0; i--) {
    const a = arrowQueue[i];
    a.t += dt;
    if (a.t < 0) continue;
    const p = Math.min(a.t / a.duration, 1);
    const e = easeOutCubic(p);

    const posCount = a.line.geometry.attributes.position.count;
    a.line.geometry.setDrawRange(0, Math.floor(e * posCount));
    a.line.material.opacity = e * (a.dashed ? 0.55 : 0.65);

    const cs = e;
    a.cone.scale.set(cs, cs, cs);
    a.cone.material.opacity = e * 0.7;

    if (p >= 1) {
      a.line.geometry.setDrawRange(0, Infinity);
      arrowQueue.splice(i, 1);
    }
  }

  // Particle animations (loop)
  for (let i = 0; i < particleQueue.length; i++) {
    const a = particleQueue[i];
    a.t += dt;
    if (a.t < 0) continue;
    const raw = (a.t / a.duration) % 1;
    const p = easeInOutCubic(raw);
    a.mesh.position.lerpVectors(a.p1, a.p2, p);
    // Fade in at start, fade out at end
    const fadeIn = Math.min(raw * 8, 1);
    const fadeOut = Math.min((1 - raw) * 8, 1);
    a.mat.opacity = Math.min(fadeIn, fadeOut) * 0.85;
  }

  // Packet flow arrow lines + scheduled element state changes
  updateFlows(dt);
  updateStates(dt);

  // Persistent world opacity (focus / dim / reveal) and component travel
  updateWorldNodes(dt);
  updateMoveTweens(dt);

  // Hero emissive pulse
  if (heroMesh && heroMesh.mat) {
    heroGlow += dt * 2.5;
    const pulse = (Math.sin(heroGlow) * 0.5 + 0.5);
    // Pulse edge opacity
    if (heroMesh.edgeMat) {
      heroMesh.edgeMat.opacity = 0.75 + pulse * 0.25;
    }
    // Scale XZ very slightly for breathing effect
    if (heroMesh.g) {
      const breathe = 1 + pulse * 0.012;
      heroMesh.g.scale.x = breathe;
      heroMesh.g.scale.z = breathe;
    }
  }

  // Subtle float for fully-animated groups
  floatChildren(sceneGroup);
  if (worldGroup) floatChildren(worldGroup);
  if (stepGroup)  floatChildren(stepGroup);

  idleDrift(dt);
  if (window.FLOW3D.dust) window.FLOW3D.dust.rotation.y += dt * 0.006;
  updateLabels();
  renderFrame();
}

/* ── Controls ── */
document.getElementById('btn-next').addEventListener('click', next);
document.getElementById('btn-prev').addEventListener('click', prev);
window.addEventListener('keydown', function(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const target = e.target;
  if (target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(target.tagName))) return;
  if (e.key === 'ArrowRight' && next()) e.preventDefault();
  if (e.key === 'ArrowLeft' && prev()) e.preventDefault();
});

/* ── Init ── */
const firstScenarioId = window.FLOW3D.registry.ids()[0];
if (!firstScenarioId) throw new Error('[Flow3D] no scenarios registered');
selectScenario(firstScenarioId);
requestAnimationFrame(tick);
