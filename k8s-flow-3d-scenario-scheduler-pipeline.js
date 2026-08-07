/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — SCENARIO ASSEMBLY

   The cluster itself lives in k8s-flow-3d-scenario-scheduler-world.js and is
   never torn down. The 9 steps are authored in two files, split where the
   story hands over from Control Plane to Node:

     …-control-plane.js  ①–⑤  request → etcd → queue → filter → score
     …-node.js           ⑥–⑨  bind → kubelet → CRI → running

   ── Authoring model ──
   A step is split into `phases`. One phase = one explanation + one action, so
   the viewer reads a single beat and only that beat's choreography plays.
   k8s-flow-3d-engine-phase-expander.js flattens phases into ordinary steps
   before the engine loads, so nothing downstream knows phases exist.

   A phase declares:
     title   – heading for this beat (the step title stays on screen above it)
     desc    – the explanation, shown before its action runs
     focus   – components lit up (everything else dims but stays visible)
     show    – components revealed from here on (cumulative)
     hide    – components removed from here on (cumulative)
     set     – label/colour changes from here on (cumulative). An entry with
               `at` (seconds) is *played*: the component flashes, a badge pops
               and the new look commits at that moment.
     showAt  – key → seconds; delays a reveal so it lands with its flow
     hideAt  – key → seconds; same for a removal
     scene   – arrow lines (`a.flow`) and captions (`a.note`) for this phase
     cam     – camera target + distance

   `focus` / `cam` / `dist` / `pipelineStep` fall through from the step when a
   phase does not override them.

   Timing convention: a phase holds one action, so offsets stay inside roughly
   0–1.5s and each flow uses a short `loop` — the single action it describes
   replays gently while the viewer reads, instead of a long sequence the
   viewer has to catch mid-flight.
══════════════════════════════════════════════ */
window.SCENARIOS = window.SCENARIOS || [];
window.SCENARIOS.push({
  name: 'Scheduler Pipeline',
  tag: 'SCHEDULER',
  showPipeline: true,
  world: window.SCHEDULER_WORLD,
  steps: window.SCHED_STEPS_CONTROL_PLANE.concat(window.SCHED_STEPS_NODE)
});
