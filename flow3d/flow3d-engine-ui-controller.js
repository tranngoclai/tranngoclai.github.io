/* Stable-id scenario selection and scenario-local phase navigation. */
let curSc = 0;
let curSt = 0;
let activeScenarioId = null;
let transitionGeneration = 0;
let transitionTimers = [];
let activeSlot = 'a';

const fadeOverlay = document.getElementById('fade-overlay');
const dirFlash = document.getElementById('dir-flash');
const progressBar = document.getElementById('progress-bar');
const scenarioSelect = document.getElementById('scenario-select');
const explainBody = document.getElementById('explain-body');
const explainToggle = document.getElementById('explain-toggle');

function isFlowGenerationCurrent(generation) {
  return generation === transitionGeneration;
}

function scheduleTransition(callback, delay, generation) {
  const timer = setTimeout(function() {
    transitionTimers = transitionTimers.filter(function(item) { return item !== timer; });
    if (!isFlowGenerationCurrent(generation)) return;
    callback();
  }, delay);
  transitionTimers.push(timer);
  return timer;
}

function cancelTransitionWork() {
  transitionTimers.forEach(clearTimeout);
  transitionTimers = [];
  // A persistent node whose entrance tween is cancelled must be snapped to
  // its usable end state; otherwise a rapid click can strand it at scale 0.
  animQueue.forEach(function(entry) {
    if (!entry.node || !entry.node.managed) return;
    entry.node.entrance = 1;
    entry.group.scale.y = 1;
    entry.group.position.y = entry.node.baseY;
  });
  animQueue = [];
  arrowQueue = [];
  particleQueue = [];
  moveTweens = [];
  clearFlowState();
  hideScoreHud();
  camTween = null;
  fadeOverlay.classList.remove('out');
  dirFlash.classList.remove('show');
}

function disposeMaterial(material) {
  if (!material) return;
  Object.keys(material).forEach(function(key) {
    const value = material[key];
    if (value && value.isTexture && typeof value.dispose === 'function') value.dispose();
  });
  if (typeof material.dispose === 'function') material.dispose();
}

function disposeOwnedGroup(group) {
  if (!group) return;
  group.traverse(function(object) {
    if (object.geometry && typeof object.geometry.dispose === 'function') object.geometry.dispose();
    if (Array.isArray(object.material)) object.material.forEach(disposeMaterial);
    else disposeMaterial(object.material);
  });
  group.clear();
}

/* Only the scenario-owned subtree is disposed. Lights, ground, grid, camera,
   renderer and controls remain global scene resources. */
function wipeScene() {
  cancelTransitionWork();
  heroMesh = null;
  heroRingObj = null;
  currentBoxMeshes = [];
  disposeOwnedGroup(sceneGroup);
  clearLabels();
  hovMeshes = [];
  resetPersistentWorld();
  pipelineStages = null;
  pipelineUI.classList.remove('show');
  pipelineUI.innerHTML = '';
}

function getSlot(slot) {
  return {
    desc: document.getElementById(slot === 'a' ? 'e-desc' : 'e-desc-b'),
    el: document.getElementById(slot === 'a' ? 'slot-a' : 'slot-b')
  };
}

function renderExplanation(step) {
  const nextName = activeSlot === 'a' ? 'b' : 'a';
  const current = getSlot(activeSlot);
  const nextSlot = getSlot(nextName);
  nextSlot.desc.innerHTML = step.desc;
  nextSlot.el.scrollTop = 0;
  current.el.classList.remove('visible');
  current.el.classList.add('hidden');
  nextSlot.el.classList.remove('hidden');
  nextSlot.el.classList.add('visible');
  activeSlot = nextName;
}

function renderPanel(sc, runtimeIndex, announceSelection) {
  const step = sc.runtimePhases[runtimeIndex];
  const split = step.phaseCount > 1;
  document.getElementById('panel-scenario-name').textContent = sc.name;
  document.getElementById('panel-scenario-tag').textContent = sc.tag;
  document.getElementById('panel-position').textContent =
    'Step ' + step.stepNo + '/' + sc.stepCount + (split ? ' · Phase ' + step.phaseNo + '/' + step.phaseCount : '');
  const parent = document.getElementById('panel-parent');
  parent.textContent = split ? step.title : '';
  parent.hidden = !split;
  document.getElementById('panel-title').textContent = step.phaseTitle;
  renderExplanation(step);

  document.getElementById('btn-prev').disabled = runtimeIndex === 0;
  document.getElementById('btn-next').disabled = runtimeIndex === sc.runtimePhases.length - 1;

  let dots = '';
  for (let i = 0; i < step.phaseCount; i++) {
    dots += '<span class="dot' + (i === step.phaseNo - 1 ? ' on' : (i < step.phaseNo - 1 ? ' done' : '')) + '"></span>';
  }
  document.getElementById('dots').innerHTML = dots;
  progressBar.style.width = ((runtimeIndex + 1) / sc.runtimePhases.length * 100) + '%';
  scenarioSelect.value = sc.id;

  const status = document.getElementById('scenario-status');
  status.textContent = (announceSelection ? 'Đã chọn ' + sc.name + '. ' : '')
    + 'Step ' + step.stepNo + ' trên ' + sc.stepCount
    + (split ? ', phase ' + step.phaseNo + ' trên ' + step.phaseCount : '')
    + ': ' + step.phaseTitle;
}

function buildRuntime(sc, runtimeIndex, generation, forceWorldRebuild) {
  if (!isFlowGenerationCurrent(generation)) return;
  const step = sc.runtimePhases[runtimeIndex];
  const keepWorld = !forceWorldRebuild && !!sc.world && worldScenarioId === sc.id;

  if (sc.world) {
    if (!keepWorld) {
      wipeScene();
      // wipeScene cancels queues but the selected generation remains current.
      transitionGeneration = generation;
      buildPersistentWorld(sc, sc.id);
    }
    clearStepLayer();
    setAnchorContext(sc, runtimeIndex);
    buildStepLayer(step);
    applyPersistentStep(sc, runtimeIndex);
    queueScoreHud(step, generation);
  } else {
    wipeScene();
    transitionGeneration = generation;
    const ctx = makeCtx();
    step.build(ctx);
    hovMeshes = ctx._hov;
    const heroIndex = ctx._heroIdx();
    const meshes = ctx._boxMeshes();
    if (heroIndex >= 0 && meshes[heroIndex]) heroMesh = meshes[heroIndex];
    queueScoreHud(step, generation);
  }
  updatePipelineUI(sc, runtimeIndex);
  fadeOverlay.classList.remove('out');
}

function loadRuntime(sc, runtimeIndex, direction, options) {
  options = options || {};
  const generation = options.generation || ++transitionGeneration;
  cancelTransitionWork();
  transitionGeneration = generation;
  curSc = window.FLOW3D.registry.indexOf(sc.id);
  curSt = runtimeIndex;
  activeScenarioId = sc.id;
  renderPanel(sc, runtimeIndex, !!options.announceSelection);

  if (direction !== undefined && !prefersReducedMotion) {
    dirFlash.style.background = direction > 0
      ? 'linear-gradient(90deg, transparent 40%, rgba(58,127,255,.04) 100%)'
      : 'linear-gradient(270deg, transparent 40%, rgba(58,127,255,.04) 100%)';
    dirFlash.classList.add('show');
    scheduleTransition(function() { dirFlash.classList.remove('show'); }, 420, generation);
  }

  const keepWorld = !options.forceWorldRebuild && worldScenarioId === sc.id;
  if (!keepWorld && !prefersReducedMotion) fadeOverlay.classList.add('out');
  scheduleTransition(function() {
    buildRuntime(sc, runtimeIndex, generation, !!options.forceWorldRebuild);
  }, prefersReducedMotion ? 0 : (keepWorld ? 80 : 180), generation);
}

function selectScenario(id, options) {
  const sc = window.FLOW3D.registry.get(id);
  if (!sc) throw new Error('[Flow3D] unknown scenario id "' + id + '"');
  const generation = ++transitionGeneration;
  cancelTransitionWork();
  wipeScene();
  transitionGeneration = generation;
  loadRuntime(sc, 0, undefined, {
    generation: generation,
    forceWorldRebuild: true,
    announceSelection: true
  });
  if (options && options.focus && scenarioSelect) scenarioSelect.focus({preventScroll: true});
}

function next() {
  const sc = window.FLOW3D.registry.get(activeScenarioId);
  if (!sc || curSt >= sc.runtimePhases.length - 1) return false;
  loadRuntime(sc, curSt + 1, 1);
  return true;
}

function prev() {
  const sc = window.FLOW3D.registry.get(activeScenarioId);
  if (!sc || curSt <= 0) return false;
  loadRuntime(sc, curSt - 1, -1);
  return true;
}

/* Temporary compatibility API for old callers. Cross-scenario calls are
   normalized through selectScenario so every transition follows one path. */
function loadStep(scenarioIndex, runtimeIndex, direction) {
  const sc = window.SCENARIOS[scenarioIndex];
  if (!sc) return;
  if (sc.id !== activeScenarioId) selectScenario(sc.id);
  else loadRuntime(sc, runtimeIndex, direction);
}

function populateScenarioSelect() {
  scenarioSelect.innerHTML = '';
  window.FLOW3D.registry.ids().forEach(function(id) {
    const sc = window.FLOW3D.registry.get(id);
    const option = document.createElement('option');
    option.value = id;
    option.textContent = sc.name;
    scenarioSelect.appendChild(option);
  });
}

scenarioSelect.addEventListener('change', function() { selectScenario(scenarioSelect.value, {focus: true}); });
explainToggle.addEventListener('click', function() {
  const expanded = explainToggle.getAttribute('aria-expanded') === 'true';
  explainToggle.setAttribute('aria-expanded', String(!expanded));
  explainToggle.textContent = expanded ? 'Chi tiết' : 'Thu gọn';
  explainBody.hidden = expanded;
  document.getElementById('flow-panel').classList.toggle('expanded', !expanded);
});
document.getElementById('flow-panel').addEventListener('keydown', function(event) {
  if (event.key !== 'Escape' || explainBody.hidden) return;
  explainBody.hidden = true;
  explainToggle.setAttribute('aria-expanded', 'false');
  explainToggle.textContent = 'Chi tiết';
  document.getElementById('flow-panel').classList.remove('expanded');
  explainToggle.focus({preventScroll: true});
  event.preventDefault();
});

window.selectScenario = selectScenario;
window.loadStep = loadStep;

populateScenarioSelect();

Object.defineProperty(window, '__FLOW3D_TEST__', {
  configurable: false,
  enumerable: false,
  value: Object.freeze({
    snapshot: function() {
      const sc = window.FLOW3D.registry.get(activeScenarioId);
      const step = sc && sc.runtimePhases[curSt];
      return Object.freeze({
        scenarioId: activeScenarioId,
        runtimeIndex: curSt,
        stepNo: step && step.stepNo,
        phaseNo: step && step.phaseNo,
        generation: transitionGeneration,
        scenarioIds: Object.freeze(window.FLOW3D.registry.ids()),
        componentKeys: Object.freeze(Object.keys(worldNodes).sort()),
        pending: Object.freeze({
          transitionTimers: transitionTimers.length,
          scoreTimers: scoreTimers.length + (scoreShowTimer ? 1 : 0),
          animations: animQueue.length,
          arrows: arrowQueue.length,
          particles: particleQueue.length,
          flows: flowQueue.length,
          states: stateQueue.length,
          moves: moveTweens.length
        }),
        rendererMemory: Object.freeze({
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures
        })
      });
    }
  })
});
