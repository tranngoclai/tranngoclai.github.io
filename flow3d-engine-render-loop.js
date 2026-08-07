/* ══════════════════════════════════════════════
   LABEL PROJECTION — update each frame
══════════════════════════════════════════════ */
const _v3 = new THREE.Vector3();
function updateLabels() {
  // #labels overlays the canvas, so project into canvas-local coordinates.
  const W = cvs.clientWidth, H = cvs.clientHeight;
  labelEls.forEach(function(item) {
    _v3.setFromMatrixPosition(item.obj.matrixWorld);
    _v3.project(camera);
    const sx = (_v3.x * 0.5 + 0.5) * W;
    const sy = (-_v3.y * 0.5 + 0.5) * H;
    item.div.style.left = sx + 'px';
    item.div.style.top  = sy + 'px';
    item.div.style.display = _v3.z < 1 ? 'block' : 'none';
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

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - clock.last) / 1000, 0.05);
  clock.last = now;
  frame++;
  controls.update();

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

  updateLabels();
  renderer.render(scene, camera);
}

/* ── Controls ── */
document.getElementById('btn-next').addEventListener('click', next);
document.getElementById('btn-prev').addEventListener('click', prev);
window.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft')  prev();
});

/* ── Intro ── */
function startApp() {
  const splash = document.getElementById('intro-splash');
  if (!splash || splash.classList.contains('hiding') || splash.classList.contains('hidden')) return;
  splash.classList.add('hiding');
  setTimeout(() => {
    splash.classList.add('hidden');
    // Pulse Next button hint after intro
    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
      btnNext.classList.add('hint-pulse');
      setTimeout(() => btnNext.classList.remove('hint-pulse'), 5000);
    }
  }, 700);
}
document.getElementById('intro-start-btn').addEventListener('click', startApp);
// Also allow pressing Enter/Space on the button
document.addEventListener('keydown', function(e) {
  const splash = document.getElementById('intro-splash');
  if (splash && !splash.classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) {
    startApp();
  }
});

/* ── Init ── */
loadStep(0, 0);
requestAnimationFrame(tick);
