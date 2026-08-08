/* ══════════════════════════════════════════════
   DECK SHELL — CHROME AROUND THE SCENARIOS

   Everything on the page that is *not* a scenario: the splash, the topbar
   brand, the splash's scenario-nav heading, the document language and title.
   None of it is
   about Kubernetes, or about any other subject — so none of it belongs in the
   HTML, where it had to be hand-edited to build a second deck.

   A deck declares its chrome once:

     FLOW3D.deck({
       lang:  'vi',
       title: 'Kubernetes – 3D Scenarios',
       brand: '⎈ k8s-sim',
       sidebarTitle: 'Scenarios',     // heading above the splash's scenario nav
       canvasLabel: '…',              // aria-label on the 3D canvas
       intro: {eyebrow: '…', title: '…', sub: '…', cta: 'Bắt đầu →'}
     });

   `canvasLabel` is not optional in spirit: the canvas is `role="img"`, so it is
   the only thing a screen reader has for the whole visualiser. It should name
   the subject and point at the explain panel, which carries the real content.

   ── Why the chips are not declarable ──
   The splash lists the scenarios the deck contains. That list was previously
   typed by hand into the HTML, which meant adding a scenario left the splash
   quietly advertising the old set. It is now rendered from `SCENARIOS[].name`,
   so it cannot be wrong. This is the same rule the kit applies to the 3D
   world: one fact, one place, everything else derives.

   ── Why every field is optional ──
   A deck under construction should still run. A missing field empties its
   element instead of throwing, so you can bring a new deck up scenario-first
   and write the splash copy last.

   ── Timing ──
   Application is deferred to DOMContentLoaded rather than running inline.
   This file loads with the kit, *before* the scenario files, so at parse time
   `SCENARIOS` is still empty and the chips would render as nothing. Every
   script on the page is a classic tag at the end of <body>, so DOMContentLoaded
   is guaranteed to fire after the last of them has executed and every scenario
   has registered itself.

   `intro.title` and `intro.sub` are written as HTML — decks use <br> to control
   line breaks in the headline. They are deck-authored constants, never user
   input.
══════════════════════════════════════════════ */

window.FLOW3D = window.FLOW3D || {};

(function() {

/* Text into an element, if both exist. A deck that omits a field leaves the
   element empty rather than showing the previous deck's copy. */
function text(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

/* Same, for the two fields that carry authored markup (<br> in headlines). */
function html(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value || '';
}

/* The scenario nav on the splash — derived, never declared. Each card jumps
   straight into that scenario's first step (this used to be the sidebar's
   job, before the sidebar moved here). */
function renderScenarioTags() {
  const wrap = document.getElementById('intro-scenarios');
  if (!wrap) return;
  wrap.innerHTML = '';
  (window.SCENARIOS || []).forEach(function(sc, si) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'intro-tag';

    const name = document.createElement('div');
    name.className = 'intro-tag-name';
    name.textContent = sc.name;
    btn.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'intro-tag-meta';
    meta.textContent = sc.tag + ' · ' + (sc.stepCount || sc.steps.length) + ' steps';
    btn.appendChild(meta);

    btn.addEventListener('click', function() {
      if (typeof window.loadStep === 'function') window.loadStep(si, 0);
      startApp();
    });
    wrap.appendChild(btn);
  });
}

/* Dismisses the splash. Guarded so a double trigger — click plus keypress —
   cannot restart the transition halfway through it. */
function startApp() {
  const splash = document.getElementById('intro-splash');
  if (!splash || splash.classList.contains('hiding') || splash.classList.contains('hidden')) return;
  splash.classList.add('hiding');
  setTimeout(function() {
    splash.classList.add('hidden');
    // Draw the eye to the control that advances the deck — a viewer who has
    // just dismissed the splash has not yet been told how to move.
    const btnNext = document.getElementById('btn-next');
    if (btnNext) {
      btnNext.classList.add('hint-pulse');
      setTimeout(function() { btnNext.classList.remove('hint-pulse'); }, 5000);
    }
  }, 700);
}
FLOW3D.startApp = startApp;

function applyDeck(def) {
  const intro = def.intro || {};

  if (def.lang) document.documentElement.lang = def.lang;
  if (def.title) document.title = def.title;

  text('brand', def.brand);
  text('intro-scenarios-hd', def.sidebarTitle);

  const canvas = document.getElementById('canvas');
  if (canvas && def.canvasLabel) canvas.setAttribute('aria-label', def.canvasLabel);

  text('intro-eyebrow', intro.eyebrow);
  html('intro-title', intro.title);
  html('intro-sub', intro.sub);
  text('intro-start-btn', intro.cta);

  renderScenarioTags();

  const btn = document.getElementById('intro-start-btn');
  if (btn) btn.addEventListener('click', startApp);

  // Enter/Space dismisses too, so the splash is not a mouse-only gate.
  document.addEventListener('keydown', function(e) {
    const splash = document.getElementById('intro-splash');
    if (!splash || splash.classList.contains('hidden')) return;
    if (e.key === 'Enter' || e.key === ' ') startApp();
  });
}

FLOW3D.deck = function(def) {
  const apply = function() { applyDeck(def || {}); };
  // `loading` is the normal case — this file runs while the parser is still
  // working through the scripts at the end of <body>.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
};

})();
