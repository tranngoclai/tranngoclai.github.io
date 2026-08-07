/* ══════════════════════════════════════════════
   HUD CONTROLLER — pipeline strip + metric HUD

   Two overlays that sit outside the 3D scene and tell the viewer *where in a
   mechanism* they are and *what the numbers are*. Both are driven by data on
   the scenario/step, so a new scenario never needs its own markup.

   ── Pipeline strip ──
   A scenario declares the stages it walks through:

     pipeline: [{icon:'📬', label:'Queue'}, {icon:'⚖️', label:'PostFilter', tone:'warn'}, …]

   and each step (or phase) points at one with `pipelineStep: <index>`.
   Omitting `pipeline` falls back to the kube-scheduler's own 7 stages, which
   is what the Scheduler Pipeline scenario walks. `tone` recolours the stage
   when it is the active one — a stage that destroys something should not look
   like a stage that creates something.

   Because `pipelineStep` is resolved per *phase*, the strip can advance inside
   a step, and can legitimately move backwards: a preemption retry really does
   re-enter Filter, and showing that is the point.

   ── Metric HUD ──
   The same rows serve two jobs, chosen by the data a step supplies:

     scoreMode: true,
     scoreTitle: 'memory đã cấp / allocatable',       // optional caption
     scores: [{name:'Worker A', v:92, txt:'11/12Gi', tone:'danger'},
              {name:'Worker D', v:71, win:true}]

   `v` (0–100) drives the bar. `txt` overrides the readout — with it the value
   is a measurement (`11/12Gi`), without it the value counts up to `v` like a
   score. `win` crowns the row. Rows are rendered from the list, so a step can
   compare any number of nodes.
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   PIPELINE UI
══════════════════════════════════════════════ */
const pipelineUI = document.getElementById('pipeline-ui');

/* Default stages: the kube-scheduler pipeline the main scenario narrates. */
const PIPELINE_DEFAULT = [
  {icon: '🖥️', label: 'Client'},
  {icon: '🗄️', label: 'etcd'},
  {icon: '📬', label: 'Queue'},
  {icon: '🔍', label: 'Filter/Score'},
  {icon: '🔗', label: 'Bind'},
  {icon: '⚙️', label: 'kubelet'},
  {icon: '🟢', label: 'Running'}
];

let pipelineStages = null;   // stage list currently rendered into the strip

function renderPipeline(stages) {
  if (pipelineStages === stages) return;   // same scenario — markup still valid
  pipelineStages = stages;
  pipelineUI.innerHTML = stages.map(function(s, i) {
    const arrow = i < stages.length - 1 ? '<div class="pip-arrow" id="pip-a' + i + '"></div>' : '';
    return '<div class="pip-step">'
         + '<div class="pip-node' + (s.tone ? ' tone-' + s.tone : '') + '" id="pip-' + i + '">'
         + '<div class="pip-icon">' + s.icon + '</div>'
         + '<div class="pip-lbl">' + s.label + '</div>'
         + '</div>' + arrow + '</div>';
  }).join('');
}

function updatePipelineUI(sc, stepIdx) {
  if (!sc.showPipeline) {
    pipelineUI.classList.remove('show');
    return;
  }
  const stages = sc.pipeline || PIPELINE_DEFAULT;
  renderPipeline(stages);
  pipelineUI.classList.add('show');

  const activeP = sc.steps[stepIdx].pipelineStep || 0;
  for (let i = 0; i < stages.length; i++) {
    const node = document.getElementById('pip-' + i);
    if (!node) continue;
    node.classList.remove('active', 'done');
    if (i < activeP) node.classList.add('done');
    else if (i === activeP) node.classList.add('active');

    const arr = document.getElementById('pip-a' + i);
    if (!arr) continue;
    arr.classList.remove('active-flow', 'done-flow');
    if (i < activeP) arr.classList.add('done-flow');
    else if (i === activeP) arr.classList.add('active-flow');
  }
}

/* ══════════════════════════════════════════════
   METRIC HUD  (scores · capacities)
══════════════════════════════════════════════ */
const scoreHud = document.getElementById('score-hud');
let scoreTimers = [];   // pending bar/counter timers, dropped when the HUD hides

function clearScoreTimers() {
  scoreTimers.forEach(clearTimeout);
  scoreTimers.forEach(clearInterval);
  scoreTimers = [];
}

function showScoreHud(list, title) {
  if (!list || !list.length) return;
  clearScoreTimers();

  scoreHud.innerHTML =
    (title ? '<div class="score-title">' + title + '</div>' : '')
    + list.map(function(e, i) {
        return '<div class="score-row' + (e.win ? ' winner' : '') + '">'
             + '<div class="score-node">' + e.name + '</div>'
             + '<div class="score-bar-wrap"><div class="score-bar'
             + (e.win ? ' winner-bar' : '') + (e.tone ? ' tone-' + e.tone : '')
             + '" id="sb-' + i + '"></div></div>'
             + '<div class="score-val' + (e.txt ? ' wide' : '') + '" id="sv-' + i + '">'
             + (e.txt ? '' : '0') + '</div>'
             + '<div class="score-crown">' + (e.win ? '👑' : '') + '</div>'
             + '</div>';
      }).join('');
  scoreHud.classList.add('show');

  list.forEach(function(entry, i) {
    const bar = document.getElementById('sb-' + i);
    const val = document.getElementById('sv-' + i);
    scoreTimers.push(setTimeout(function() {
      bar.style.width = entry.v + '%';
      // A measurement is read, not counted — only plain scores tick up.
      if (entry.txt) { val.textContent = entry.txt; return; }
      let cur = 0;
      const inc = entry.v / 40;
      const timer = setInterval(function() {
        cur = Math.min(cur + inc, entry.v);
        val.textContent = Math.floor(cur);
        if (cur >= entry.v) clearInterval(timer);
      }, 30);
      scoreTimers.push(timer);
    }, i * 180 + 400));
  });
}

function hideScoreHud() {
  clearScoreTimers();
  if (scoreShowTimer) { clearTimeout(scoreShowTimer); scoreShowTimer = null; }
  scoreHud.classList.remove('show');
  scoreHud.innerHTML = '';
}

/* The HUD lands a beat after the step's choreography starts. That wait belongs
   to the step that queued it — a fast Next must be able to cancel it, or the
   previous step's numbers appear over the new one. hideScoreHud() (called at
   the top of every step load) is what cancels it. */
let scoreShowTimer = null;

function queueScoreHud(step) {
  if (!step.scoreMode) return;
  scoreShowTimer = setTimeout(function() {
    scoreShowTimer = null;
    showScoreHud(step.scores, step.scoreTitle);
  }, 600);
}
