/* ══════════════════════════════════════════════
   DEV-ONLY MODEL SMOKE HARNESS — not loaded by k8s-flow-3d.html.

   The authoring guide requires every model to be runnable under plain `node`
   for regression assertions, and this repo has no test runner and no build
   step. This file is that harness.

     node k8s-flow-3d/dev-model-check.js

   Exits 0 when every assertion holds, 1 on the first failure.
   Add a block per scale model as each phase lands.
══════════════════════════════════════════════ */
let failures = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log('  ok   ' + label); return; }
  failures++;
  console.log('  FAIL ' + label + '\n         expected ' + e + '\n         actual   ' + a);
}

function throws(label, fn, kind) {
  try { fn(); } catch (err) {
    if (err instanceof kind) { console.log('  ok   ' + label); return; }
    failures++;
    console.log('  FAIL ' + label + ' — threw ' + err.constructor.name + ', wanted ' + kind.name);
    return;
  }
  failures++;
  console.log('  FAIL ' + label + ' — did not throw');
}

/* ── manual scale ────────────────────────────── */
console.log('manual-scale model');
const MS = require('./k8s-flow-3d-scenario-manual-scale-model.js');
const run = MS.simulate(MS.DEFAULT_CONFIG);

check('replica arc', [run.initial, run.scaleUp, run.scaleDown], [3, 5, 2]);
check('HUD denominator is the peak, not the current count', run.maxReplicas, 5);
check('scale-up creates two Pods', run.created.map(function(p) { return p.key; }), ['api-3', 'api-4']);

/* The teaching claim: victim order and the rule that decided each one. */
check('victim order', run.victims.map(function(v) { return v.key; }), ['api-4', 'api-3', 'api-2']);
check('deciding rules', run.victims.map(function(v) { return v.rule; }),
  ['ready', 'readySeconds', 'newest']);
check('survivors are the two oldest, most-proven Pods',
  run.survivors.map(function(p) { return p.key; }), ['api-0', 'api-1']);

/* Victims must span both Workers — otherwise the scenario reads as
   "scale-down drains a Node", which is not what it teaches. */
check('victims span both Workers',
  run.victims.map(function(v) { return v.node; }).sort().filter(function(n, i, a) { return a.indexOf(n) === i; }),
  ['worker-a', 'worker-b']);

/* Exactly three rules may be claimed as acting; the other three are greyed. */
check('rules that fire', run.firingRules.map(function(r) { return r.id; }),
  ['ready', 'readySeconds', 'newest']);
check('rules that are no-ops',
  run.ladder.filter(function(r) { return !r.fires; }).map(function(r) { return r.id; }),
  ['unassigned', 'phase', 'restarts']);

/* Provenance must survive into every victim — the ordering is a heuristic. */
check('victim ordering is classified, not asserted',
  run.victims[0].provenance.evidenceClass, 'unverified-source-note');

/* Causal contract feeds the aria-live announcement. */
check('scale-up changed input', run.contract.up.changedInput, 'spec.replicas 3 → 5');
check('scale-down changed input', run.contract.down.changedInput, 'spec.replicas 5 → 2');

/* Validation surfaces bad arithmetic at load time, not as a wrong badge later. */
throws('rejects scaleUp below initial', function() {
  MS.simulate(Object.assign({}, MS.DEFAULT_CONFIG, {scaleUp: 2}));
}, RangeError);
throws('rejects non-finite replica count', function() {
  MS.simulate(Object.assign({}, MS.DEFAULT_CONFIG, {initial: NaN}));
}, TypeError);
throws('rejects deleting more Pods than exist', function() {
  MS.scaleDownOrder(MS.DEFAULT_CONFIG.pods, 99);
}, RangeError);

/* ── result ──────────────────────────────────── */
console.log(failures === 0 ? '\nall model assertions passed' : '\n' + failures + ' assertion(s) failed');
process.exit(failures === 0 ? 0 : 1);
