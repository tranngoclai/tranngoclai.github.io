/* ══════════════════════════════════════════════
   PHASE EXPANDER

   A step may be split into `phases` — small, self-contained beats that each
   carry their own explanation *and* their own bit of choreography:

     { title, desc, focus, cam, dist, set, show, hide, showAt, hideAt, scene }

   The scenario registry owns the pure authored-step → runtime-phase compile.
   This load-order boundary finalizes and validates the complete registry
   before scene setup, so invalid content cannot partially render.

   Result: one Next click = one phase = one action. The viewer reads the
   explanation for a single beat, and only that beat's flows and state changes
   play. Steps without `phases` pass through untouched.
══════════════════════════════════════════════ */

(function compileAndValidateScenarioRegistry() {
  if (!window.FLOW3D || !window.FLOW3D.registry) {
    throw new Error('[Flow3D] scenario registry must load before the compiler');
  }
  window.FLOW3D.registry.finalize();
})();
