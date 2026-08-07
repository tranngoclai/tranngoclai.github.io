/* ══════════════════════════════════════════════
   STEP / PHASE NAVIGATION

   The pipeline strip and the metric HUD live in
   k8s-flow-3d-engine-hud-controller.js — this file drives step transitions,
   announcements and the explain panel.
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   STEP ANNOUNCEMENT
══════════════════════════════════════════════ */
const stepAnnounce = document.getElementById('step-announce');
const saNum = document.getElementById('sa-num');
const saTitle = document.getElementById('sa-title');
const phaseAnnounce = document.getElementById('phase-announce');
const paNum = document.getElementById('pa-num');
const paTitle = document.getElementById('pa-title');

/* How long a step's opening intro owns the screen: the title holds centered,
   then slides to the top. The step's choreography waits this out. */
const STEP_HOLD_MS = 2000;
const STEP_SLIDE_MS = 300;   // must match #step-announce.fly-up in the CSS
const STEP_INTRO_MS = STEP_HOLD_MS + STEP_SLIDE_MS;

// Rapid Next/Prev clicks can fire a new announce before the previous one's
// timers finish — always clear the old ones first so they can't reach in and
// hide/animate an announcement that belongs to the step after them.
let phaseTimer = null;
let flyTimer = null;
let stepActionTimer = null;

function clearAnnounceTimers() {
  if (phaseTimer) { clearTimeout(phaseTimer); phaseTimer = null; }
  if (flyTimer) { clearTimeout(flyTimer); flyTimer = null; }
}

// Snaps an announce element back to its centered, invisible resting state
// with transitions off, so the next title pops straight into place instead
// of animating in from wherever the previous one left it.
function resetAnnounce(el) {
  el.classList.add('no-anim');
  el.classList.remove('fly-up', 'show');
  void el.offsetWidth; // force reflow so the reset actually applies
  el.classList.remove('no-anim');
}

/* Fires on the first phase of a step (announcing the step), and — for
   scenarios whose steps are split into phases (Scheduler Pipeline,
   Preemption) — on every later phase too, announcing that phase's own title.
   Centered, fades back out on its own — independent of the pinned step
   title, which lives in #step-announce. */
function announcePhase(sc, step) {
  const split = step.phaseCount > 1;
  resetAnnounce(phaseAnnounce);
  // The step number/name is already pinned at the top, so the phase card
  // only carries its own position within that step.
  paNum.textContent = split ? 'PHASE ' + step.phaseNo + ' / ' + step.phaseCount : sc.tag;
  paTitle.textContent = step.phaseTitle;
  phaseAnnounce.classList.add('show');
  phaseTimer = setTimeout(() => {
    phaseAnnounce.classList.remove('show');
    phaseTimer = null;
  }, 2600);
}

function setStepText(sc, step) {
  saNum.textContent = 'STEP ' + step.stepNo + ' OF ' + (sc.stepCount || sc.steps.length) + '  ·  ' + sc.tag;
  saTitle.textContent = step.title;
}

/* Puts the step title straight at its pinned top position, no animation.
   Used when we arrive mid-step (a later phase, or a fast click that cut the
   centered dwell short) — the title belongs at the top, and leaving it in
   the center would collide with the phase title landing there. */
function pinStepTitleNow(sc, step) {
  setStepText(sc, step);
  stepAnnounce.classList.add('no-anim');
  stepAnnounce.classList.add('show', 'fly-up');
  void stepAnnounce.offsetWidth;
  stepAnnounce.classList.remove('no-anim');
}

function showStepAnnounce(sc, step) {
  clearAnnounceTimers();
  // Whatever was mid-flight belongs to the step we just left.
  phaseAnnounce.classList.remove('show');

  // Flat scenarios (no phases): just the phase announcer, no pinned
  // step title.
  if (!sc.hasPhases) {
    stepAnnounce.classList.remove('show', 'fly-up');
    announcePhase(sc, step);
    return;
  }
  if (!step.firstPhase) {
    // Arriving at a later phase — the step title sits at the top already (or
    // must be snapped there if a fast click interrupted its centered dwell).
    pinStepTitleNow(sc, step);
    announcePhase(sc, step);
    return;
  }

  // Phased scenarios: the step title appears centered first, fully
  // visible, then lifts to the top of the screen and stays pinned there —
  // no fade-out — for the rest of the step. The phase announcer then takes
  // over the freed-up center spot.
  resetAnnounce(stepAnnounce);
  setStepText(sc, step);
  stepAnnounce.classList.add('show');

  // 2s centered, then a fast slide to the top. The first phase title waits
  // for that slide to actually finish (transitionend, not a guessed delay)
  // so the two are never on screen mid-move together.
  flyTimer = setTimeout(() => {
    flyTimer = null;

    const onLanded = function(ev) {
      if (ev.target !== stepAnnounce || ev.propertyName !== 'top') return;
      stepAnnounce.removeEventListener('transitionend', onLanded);
      if (phaseTimer) { clearTimeout(phaseTimer); }
      announcePhase(sc, step); // reassigns phaseTimer to its own hide timer
    };
    stepAnnounce.addEventListener('transitionend', onLanded);

    // Fallback: if the transition never fires (tab backgrounded, reduced
    // motion), show the phase anyway just past the slide's duration.
    phaseTimer = setTimeout(() => {
      stepAnnounce.removeEventListener('transitionend', onLanded);
      announcePhase(sc, step);
    }, 400);

    stepAnnounce.classList.add('fly-up');
  }, STEP_HOLD_MS);
}

/* ══════════════════════════════════════════════
   STEP SYSTEM
══════════════════════════════════════════════ */
let curSc = 0, curSt = 0;
let isTransitioning = false;
let activeSlot = 'a';

const fadeOverlay = document.getElementById('fade-overlay');
const dirFlash = document.getElementById('dir-flash');
const progressBar = document.getElementById('progress-bar');
const slotA = document.getElementById('slot-a');
const slotB = document.getElementById('slot-b');

function getSlotEls(slot) {
  const sfx = slot === 'a' ? '' : '-b';
  return {
    label:  document.getElementById('e-label' + sfx),
    parent: document.getElementById('e-parent' + sfx),
    title:  document.getElementById('e-title' + sfx),
    desc:   document.getElementById('e-desc' + sfx),
    el:     slot === 'a' ? slotA : slotB
  };
}

function crossfadeExplain(sc, step) {
  const nextSlot = activeSlot === 'a' ? 'b' : 'a';
  const next = getSlotEls(nextSlot);
  const s = sc.steps[step];
  const split = s.phaseCount > 1;

  next.label.textContent = 'STEP ' + s.stepNo + ' OF ' + (sc.stepCount || sc.steps.length)
    + (split ? '  ·  PHASE ' + s.phaseNo + '/' + s.phaseCount : '')
    + '  ·  ' + sc.tag;

  // On a split step the parent title stays on screen so the phase heading is
  // always read in the context of the step it belongs to.
  next.parent.textContent   = split ? s.title : '';
  next.parent.style.display = split ? '' : 'none';

  next.title.textContent = s.phaseTitle;
  next.desc.innerHTML    = s.desc;

  // Each phase is a fresh read — never inherit the previous one's scroll.
  next.el.scrollTop = 0;

  const cur = getSlotEls(activeSlot);
  cur.el.classList.remove('visible');
  cur.el.classList.add('hidden');

  next.el.classList.remove('hidden');
  next.el.classList.add('visible');

  activeSlot = nextSlot;
}

function updateProgressBar(si, step) {
  const sc = SCENARIOS[si];
  const total = SCENARIOS.reduce((acc, s) => acc + s.steps.length, 0);
  let done = 0;
  for (let i = 0; i < si; i++) done += SCENARIOS[i].steps.length;
  done += step + 1;
  progressBar.style.width = (done / total * 100) + '%';
}

/* Full teardown — used when leaving a scenario or for non-persistent ones. */
function wipeScene() {
  animQueue = [];
  arrowQueue = [];
  particleQueue = [];
  clearFlowState();
  heroMesh = null;
  heroRingObj = null;
  currentBoxMeshes = [];

  sceneGroup.clear();
  clearLabels();
  hovMeshes = [];
  resetPersistentWorld();
}

function loadStep(si, step, direction) {
  if (isTransitioning) return;
  isTransitioning = true;

  const sc = SCENARIOS[si];
  const s  = sc.steps[step];

  // A queued step action belongs to the step we're leaving — drop it before
  // it can build a layer over the one we're about to load.
  if (stepActionTimer) { clearTimeout(stepActionTimer); stepActionTimer = null; }

  hideScoreHud();

  // Direction flash
  if (direction !== undefined) {
    dirFlash.style.background = direction > 0
      ? 'linear-gradient(90deg, transparent 40%, rgba(58,127,255,.04) 100%)'
      : 'linear-gradient(270deg, transparent 40%, rgba(58,127,255,.04) 100%)';
    dirFlash.classList.add('show');
    setTimeout(() => dirFlash.classList.remove('show'), 600);
  }

  // Persistent scenarios keep their components on screen — a full fade would
  // hide exactly the continuity we want the viewer to see.
  const keepWorld = !!sc.world && worldScenarioIdx === si;
  if (!keepWorld) fadeOverlay.classList.add('out');

  // Crossfade explain panel
  crossfadeExplain(sc, step);

  // Step number animation — the step number stays put across its phases, the
  // sub-counter underneath tracks progress inside the step.
  const stepNumEl = document.getElementById('step-num');
  const stepPhaseEl = document.getElementById('step-phase');
  stepNumEl.classList.add('fade');
  setTimeout(() => {
    stepNumEl.textContent = String(s.stepNo).padStart(2,'0');
    stepPhaseEl.textContent = s.phaseCount > 1 ? s.phaseNo + '/' + s.phaseCount : '';
    stepNumEl.classList.remove('fade');
  }, 200);

  // After fade-out, rebuild scene
  setTimeout(() => {
    if (sc.world) {
      if (!keepWorld) {
        wipeScene();
        buildPersistentWorld(sc, si);
      }

      // The step layer holds this phase's choreography. On a step's opening
      // phase the step title owns the screen first, so the action waits for
      // that intro to finish instead of playing behind it.
      const runStepAction = function() {
        stepActionTimer = null;
        clearStepLayer();
        buildStepLayer(s);
        applyPersistentStep(sc, step);
        queueScoreHud(s);
      };
      const lead = (sc.hasPhases && s.firstPhase) ? STEP_INTRO_MS : 0;
      if (lead) stepActionTimer = setTimeout(runStepAction, lead);
      else runStepAction();
    } else {
      wipeScene();
      const ctx = makeCtx();
      s.build(ctx);
      hovMeshes = ctx._hov;

      // Set up hero highlight after scene builds
      const heroIdx = ctx._heroIdx();
      const bms = ctx._boxMeshes();
      if (heroIdx >= 0 && bms[heroIdx]) {
        heroMesh = bms[heroIdx];
      }
      // Score HUD rides with the step layer for world scenarios (handled in
      // runStepAction above); here it follows the freshly built scene.
      queueScoreHud(s);
    }

    // Announce the step on its opening phase; phased scenarios also announce
    // every later phase.
    if (s.firstPhase || sc.hasPhases) showStepAnnounce(sc, s);

    // Fade overlay out
    fadeOverlay.classList.remove('out');
    isTransitioning = false;
  }, keepWorld ? 120 : 340);

  // Update UI
  document.getElementById('bc-sc').textContent = sc.name;
  const bcSt = document.getElementById('bc-st');
  bcSt.style.opacity = '0';
  setTimeout(() => {
    bcSt.textContent = s.phaseCount > 1 ? s.title + '  ›  ' + s.phaseTitle : s.title;
    bcSt.style.opacity = '1';
  }, 180);

  document.getElementById('btn-prev').disabled = si === 0 && step === 0;
  document.getElementById('btn-next').disabled = si === SCENARIOS.length-1 && step === sc.steps.length-1;

  // Dots track phases within the current step (a scenario can now run to 30+
  // phases — one dot each would be unreadable). Global position is the bar.
  const dotsEl = document.getElementById('dots');
  let dotHtml = '';
  for (let i = 0; i < s.phaseCount; i++) {
    dotHtml += '<div class="dot' + (i === s.phaseNo - 1 ? ' on' : (i < s.phaseNo - 1 ? ' done' : '')) + '"></div>';
  }
  dotsEl.innerHTML = dotHtml;

  document.querySelectorAll('.sc-item').forEach(function(el,i) {
    el.classList.toggle('active', i===si);
  });

  updatePipelineUI(sc, step);
  updateProgressBar(si, step);
  curSc = si; curSt = step;
}

function next() {
  const sc = SCENARIOS[curSc];
  if (curSt < sc.steps.length-1) loadStep(curSc, curSt+1, 1);
  else if (curSc < SCENARIOS.length-1) loadStep(curSc+1, 0, 1);
}
function prev() {
  if (curSt > 0) loadStep(curSc, curSt-1, -1);
  else if (curSc > 0) { const ps = SCENARIOS[curSc-1]; loadStep(curSc-1, ps.steps.length-1, -1); }
}

/* ── Sidebar ── */
const scList = document.getElementById('sc-list');
SCENARIOS.forEach(function(sc, si) {
  const el = document.createElement('div');
  el.className = 'sc-item';
  el.innerHTML = '<div class="sc-name">' + sc.name + '</div><div class="sc-tag">' + sc.tag + ' · ' + (sc.stepCount || sc.steps.length) + ' steps</div>';
  el.addEventListener('click', function() { loadStep(si, 0); });
  scList.appendChild(el);
});

