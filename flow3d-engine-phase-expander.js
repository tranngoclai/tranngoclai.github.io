/* ══════════════════════════════════════════════
   PHASE EXPANDER

   A step may be split into `phases` — small, self-contained beats that each
   carry their own explanation *and* their own bit of choreography:

     { title, desc, focus, cam, dist, set, show, hide, showAt, hideAt, scene }

   Nothing in the rendering engine knows about phases. This module flattens
   `phases[]` into ordinary steps before anything else runs, so a phase is
   driven by exactly the machinery a step always used — including
   applyPersistentStep()'s replay-from-zero, which keeps forward and backward
   navigation identical no matter how finely a step is subdivided.

   Result: one Next click = one phase = one action. The viewer reads the
   explanation for a single beat, and only that beat's flows and state changes
   play. Steps without `phases` pass through untouched.
══════════════════════════════════════════════ */

(function expandAllScenarioPhases() {
  (window.SCENARIOS || []).forEach(function(sc) {
    const flat = [];

    sc.steps.forEach(function(step, si) {
      // No `phases` → the step is its own single phase, and every lookup below
      // resolves to the step's own fields.
      const phases = step.phases || [step];
      const split  = !!step.phases;

      phases.forEach(function(ph, pi) {
        const pick = function(field) {
          return ph[field] !== undefined ? ph[field] : step[field];
        };

        flat.push({
          /* ─ identity: where this phase sits in the authored structure ─ */
          title:      step.title,                 // parent step, shown as context
          phaseTitle: ph.title || step.title,     // this beat's own heading
          stepNo:     si + 1,
          stepCount:  sc.steps.length,
          phaseNo:    pi + 1,
          phaseCount: phases.length,
          firstPhase: pi === 0,

          desc: pick('desc'),

          /* ─ 3D directives: the phase wins, the step is the fallback ─ */
          focus:        pick('focus') || [],
          // Which components keep their caption when the scenario sets
          // `focusLabels` — defaults to the focus set.
          labels:       pick('labels') || [],
          cam:          pick('cam'),
          dist:         pick('dist'),
          pipelineStep: pick('pipelineStep'),

          /* Cumulative world mutations are per-phase only — inheriting a
             step's `set` into every phase would replay it N times. */
          set:    ph.set    || {},
          show:   ph.show   || [],
          hide:   ph.hide   || [],
          showAt: ph.showAt || {},
          hideAt: ph.hideAt || {},
          scene:  ph.scene,

          /* HUD/scene hooks: a split step must opt in per phase, otherwise the
             score HUD would re-animate on every beat of the step. */
          scoreMode:  ph.scoreMode !== undefined ? ph.scoreMode : (split ? undefined : step.scoreMode),
          scores:     ph.scores || step.scores,
          scoreTitle: ph.scoreTitle || step.scoreTitle,
          build:     step.build   // non-persistent scenarios build from scratch
        });
      });
    });

    // Sidebar and the "STEP n OF m" label count authored steps, not phases.
    sc.stepCount = sc.steps.length;
    sc.steps = flat;

    // Drives the step-title/phase-title announcement style. A scenario that
    // subdivides its steps needs the step title pinned at the top while each
    // phase announces itself underneath; a flat scenario just announces steps.
    // Kept separate from `showPipeline` — that flag is only about the pipeline
    // strip, and a phased scenario may or may not want it.
    sc.hasPhases = flat.some(function(s) { return s.phaseCount > 1; });
  });
})();
