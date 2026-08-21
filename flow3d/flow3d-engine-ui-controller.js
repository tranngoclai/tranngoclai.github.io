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
const stepIntro = document.getElementById('step-intro');
const introTitle = document.getElementById('intro-title');
const introDesc = document.getElementById('intro-desc');
const introSkip = document.getElementById('intro-skip');
const navProgress = document.getElementById('nav-progress');
let introDismiss = null;
let pipelineIntroToken = 0;   // invalidates queued intro spotlight hops on skip

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
  dismissIntro(true);
}

function dismissIntro(immediate) {
  if (!stepIntro) return;
  const dismiss = introDismiss;
  introDismiss = null;
  if (dismiss && !immediate) dismiss();
  stepIntro.classList.remove('show', 'exit', 'pipeline-mode');
  stepIntro.setAttribute('aria-hidden', 'true');
  introSkip.classList.remove('show');
  document.removeEventListener('keydown', skipIntroKey);
}

function skipIntroKey(event) {
  if (event.key !== ' ' && event.key !== 'Enter' && event.key !== 'Escape') return;
  event.preventDefault();
  if (introDismiss) introDismiss();
}

/* Intro là một cổng chờ, không phải một slide chạy theo giờ: nó đứng yên cho
   tới khi người xem bấm Next (hoặc Space/Enter/Escape). Không có timer tự tắt,
   nên cảnh phía sau cũng không tự bắt đầu — `done` chỉ chạy sau thao tác tay. */
function showIntro(title, desc, generation, done) {
  if (prefersReducedMotion) { if (done) done(); return; }
  introTitle.textContent = title;
  introDesc.textContent = desc || '';
  stepIntro.classList.remove('exit');
  stepIntro.classList.add('show');
  stepIntro.setAttribute('aria-hidden', 'false');
  let dismissed = false;
  introDismiss = function() {
    if (dismissed || !isFlowGenerationCurrent(generation)) return;
    dismissed = true;
    stepIntro.classList.add('exit');
    scheduleTransition(function() {
      if (!isFlowGenerationCurrent(generation)) return;
      stepIntro.classList.remove('show', 'exit', 'pipeline-mode');
      stepIntro.setAttribute('aria-hidden', 'true');
      introDismiss = null;
      introSkip.classList.remove('show');
      if (done) done();
    }, 350, generation);
  };
  introSkip.onclick = introDismiss;
  introSkip.classList.add('show');
  document.addEventListener('keydown', skipIntroKey);
}

/* `stepNo` là 1-based, chuỗi glyph là 0-based — trừ 1. Kịch bản dài hơn bộ
   glyph thì rơi về số thường thay vì in ra `undefined`. */
const STEP_GLYPHS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮';
function stepGlyph(stepNo) {
  return STEP_GLYPHS[stepNo - 1] || String(stepNo);
}

/* Card mở step chỉ mang tiêu đề + MỘT câu hook. Toàn bộ phần thân thuộc về
   explain beats — kể lại nguyên đoạn văn ở đây là bắt người xem đọc hai lần
   và spoil luôn nhịp beat. `.lead` của KIT.desc chính là câu hook đó. */
function stepIntroHook(step) {
  if (!step.desc) return '';
  const frag = document.createRange().createContextualFragment(step.desc);
  const lead = frag.querySelector('.lead');
  return (lead ? lead.textContent : frag.textContent).trim();
}

function showStepIntro(step, generation, done) {
  showIntro(stepGlyph(step.stepNo) + ' ' + step.title, stepIntroHook(step), generation, done);
}

/* The opening is the simulation, not a text panel. `sc.world(ctx)` already
   ends on its own `w.cam(...)` — a deliberate wide shot of the WHOLE
   architecture (every Node lane, both region bands), tuned by whoever laid
   out the world — and that tween is already rolling by the time this runs
   (buildPersistentWorld calls sc.world() just before). So this function must
   NOT start a second camTween: doing so cuts that establishing shot off
   before it's ever seen and reframes on just the happy-path cast, hiding the
   other Nodes. It only reveals the cast and lets short name-only badges pop
   in turn while the world's own wide shot holds. `done()` (step ①'s own
   frameFocus) then dollies the camera in — the zoom-out/zoom-in *is* the
   explanation, so the title stays to one short line and pipeline-mode keeps
   the scrim out of the way. */
function startPipelineIntro(sc, generation, done) {
  const intro = sc.pipelineIntro;
  if (!intro || prefersReducedMotion) { done(); return; }
  (intro.nodes || []).forEach(function(key) { if (worldNodes[key]) revealNode(worldNodes[key]); });
  stepIntro.classList.add('pipeline-mode');
  /* Mỗi lượt spotlight chỉ được để lại MỘT cái tên trên màn hình. Không khoá
     caption theo focus thì caption của cả dàn diễn viên vẫn đứng đó và người
     xem thấy ba, bốn tên cùng lúc — đúng thứ mà nhịp giới thiệu tuần tự này
     sinh ra để tránh. applyPersistentStep() đặt lại cờ theo scenario khi step ①
     dựng xong, nên không cần khôi phục thủ công. */
  labelFocusOnly = true;

  /* The cast is introduced one at a time, not all at once: `applyFocus([key])`
     lights that one component and dims the rest to 0.24 without touching the
     camera, so the wide establishing shot holds while attention walks the flow
     in order. A final `applyFocus([])` brings the whole architecture back up to
     full for a closing beat — that's the overview — before step ① dollies in.
     Skipping runs `done()` immediately, so every scheduled hop checks `token`
     to avoid clobbering step ①'s own focus after the intro is over. */
  const token = ++pipelineIntroToken;
  const bubbles = intro.bubbles || [];
  let last = 0;
  bubbles.forEach(function(b) {
    last = Math.max(last, b.at || 0);
    scheduleTransition(function() {
      if (token !== pipelineIntroToken) return;
      applyFocus([b.key], [b.key]);
      addBubble(b.text, b.key, Object.assign({}, b, {at: 0}));
    }, (b.at || 0) * 1000, generation);
  });
  scheduleTransition(function() {
    if (token !== pipelineIntroToken) return;
    applyFocus([], []);
  }, (last + (intro.overviewAfter || 0.9)) * 1000, generation);

  showIntro(intro.title, intro.desc, generation, function() {
    pipelineIntroToken++;   // strand any hop still queued behind a skip
    done();
  });
}

function disposeMaterial(material) {
  if (!material) return;
  Object.keys(material).forEach(function(key) {
    const value = material[key];
    // Texture dùng chung (glow của hạt flow) sống lâu hơn một kịch bản: nó
    // được cấp phát một lần cho mọi hạt, nên xoá nó ở đây là xoá của cả các
    // kịch bản sau.
    if (value && value.isTexture && !value.userData.shared && typeof value.dispose === 'function') value.dispose();
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

  refreshNavState(sc);

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

  const step = sc.runtimePhases[runtimeIndex];
  // Nhịp giải thích của phase mới bắt đầu lại từ đầu — phải xong TRƯỚC
  // renderPanel để nút Next biết phase này còn gì để đọc hay không.
  resetExplainBeats(step);
  renderPanel(sc, runtimeIndex, !!options.announceSelection);

  const gateOnIntro = direction !== undefined && step.firstPhase && !prefersReducedMotion;

  if (direction !== undefined && !prefersReducedMotion) {
    dirFlash.style.background = direction > 0
      ? 'linear-gradient(90deg, transparent 40%, rgba(58,127,255,.04) 100%)'
      : 'linear-gradient(270deg, transparent 40%, rgba(58,127,255,.04) 100%)';
    dirFlash.classList.add('show');
    scheduleTransition(function() { dirFlash.classList.remove('show'); }, 420, generation);
  }

  const keepWorld = !options.forceWorldRebuild && worldScenarioId === sc.id;
  if (!keepWorld && !prefersReducedMotion) fadeOverlay.classList.add('out');
  /* Hoạt cảnh của step chỉ được dựng sau khi intro bị bấm Next — nếu chạy ngay
     thì nó diễn hết phía sau tấm scrim và người xem bỏ lỡ toàn bộ. */
  const startStep = function() { scheduleTransition(function() {
    if (!keepWorld && runtimeIndex === 0 && sc.pipelineIntro && !options.pipelineIntroDone) {
      buildPersistentWorld(sc, sc.id);
      // The intro IS the visual, so the scene has to be on screen for it. The
      // fade-out scrim added above is normally cleared by buildRuntime, but this
      // branch defers buildRuntime until the intro ends — leaving the opaque
      // overlay covering the establishing shot for its whole duration.
      fadeOverlay.classList.remove('out');
      startPipelineIntro(sc, generation, function() {
        if (!isFlowGenerationCurrent(generation)) return;
        buildRuntime(sc, runtimeIndex, generation, false);
      });
      return;
    }
    buildRuntime(sc, runtimeIndex, generation, !!options.forceWorldRebuild);
  }, prefersReducedMotion ? 0 : (keepWorld ? 80 : 180), generation); };

  if (gateOnIntro) showStepIntro(step, generation, startStep);
  else startStep();
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

/* Một cú Next = một nhịp giải thích, nếu phase còn nhịp chưa đọc; hết nhịp thì
   Next mới sang phase kế. Phase không khai `explain` đi thẳng như cũ. */
function next() {
  const sc = window.FLOW3D.registry.get(activeScenarioId);
  if (!sc) return false;
  // Intro đang chờ thì Next thuộc về nó: cảnh của phase còn chưa dựng, nhảy
  // tiếp là bỏ qua đúng cái vừa được mời xem. Điều kiện phải soi trạng thái
  // nhìn thấy được (nút Skip đang hiện) chứ không chỉ `introDismiss != null` —
  // một hàm còn sót lại sẽ âm thầm nuốt mọi cú Next về sau.
  if (introDismiss && introSkip.classList.contains('show')) { introDismiss(); return true; }
  if (playNextBeat(transitionGeneration)) { refreshNavState(sc); return true; }
  if (curSt >= sc.runtimePhases.length - 1) return false;
  loadRuntime(sc, curSt + 1, 1);
  return true;
}

/* Nút Next chỉ tắt khi đã ở phase cuối VÀ nhịp cuối — nếu không, phase cuối sẽ
   khoá nút trước khi người xem kịp đọc hết phần giải thích của chính nó. Prev
   đối xứng: còn nhịp đã đọc trong phase này thì vẫn lùi được dù đang ở phase 0. */
function refreshNavState(sc) {
  const step = sc.runtimePhases[curSt];
  document.getElementById('btn-next').disabled =
    curSt === sc.runtimePhases.length - 1 && !hasPendingBeat();
  document.getElementById('btn-prev').disabled = curSt === 0 && !hasPreviousBeat();
  if (!navProgress || !step) return;
  // Người xem cần biết còn bao nhiêu cú Next nữa: dots chỉ đếm phase trong step,
  // không đếm nhịp — mà nhịp mới là thứ Next tiêu thụ.
  // `playedBeatCount()` = số nhịp ĐÃ đọc, nên lúc phase vừa dựng nó là 0 và
  // hành động của phase đang chạy chứ chưa có lời nào. Đếm kiểu này đơn điệu
  // tăng theo đúng số cú Next còn lại.
  const beats = totalBeatCount();
  navProgress.textContent = 'Step ' + step.stepNo + '/' + sc.stepCount
    + (beats ? ' · nhịp ' + playedBeatCount() + '/' + beats : '');
}

function prev() {
  const sc = window.FLOW3D.registry.get(activeScenarioId);
  if (!sc) return false;
  if (playPrevBeat(transitionGeneration)) { refreshNavState(sc); return true; }
  if (curSt <= 0) return false;
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
