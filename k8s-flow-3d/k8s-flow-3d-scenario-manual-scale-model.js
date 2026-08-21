/* ══════════════════════════════════════════════
   MANUAL SCALE (`kubectl scale`) — deterministic teaching model.

   One Deployment `api`: 3 replicas → 5 → 2.

   The payload of this scenario is not the arithmetic (5 - 3 = 2). It is
   **which** Pods a scale-down picks. That order is the ReplicaSet controller's
   `ActivePods` sort, and it is deliberately NOT random, NOT PriorityClass, and
   NOT the order the Pods appear in `kubectl get pods`.

   PROVENANCE — read this before changing the ladder below.
   The ordering is an implementation detail of the ReplicaSet controller
   (`pkg/controller/controller_utils.go`, `ActivePodsWithRanks`). It has changed
   between releases and carries no API guarantee. Every rule therefore ships
   with `evidenceClass: 'unverified-source-note'` so the panel renders it as a
   current upstream heuristic rather than a contract.
══════════════════════════════════════════════ */
(function() {

function finite(name, value) {
  if (!Number.isFinite(value)) throw new TypeError(name + ' must be finite');
  if (value < 0) throw new RangeError(name + ' must not be negative');
}

/* Provenance shared by every rule in the ladder — the whole ladder comes from
   one source read on one date, so it is stated once. */
const ORDERING_PROVENANCE = Object.freeze({
  evidenceClass: 'unverified-source-note',
  derivationClass: 'input',
  sourceRef: 'kubernetes/pkg/controller/controller_utils.go · ActivePodsWithRanks',
  asOf: '2026-08-14',
  confidence: 'medium',
  assumption: 'current upstream heuristic; not an API guarantee, shifts between releases'
});

/* ── The comparator ladder ──
   Ordered exactly as the controller applies it. `test` returns the rank value
   for one Pod: LOWER rank = deleted EARLIER. `fires` is computed per workload,
   not hardcoded — a rule that cannot separate this particular set of Pods is
   reported as a no-op so the steps can grey it out instead of claiming it acted. */
const RULES = Object.freeze([
  Object.freeze({
    id: 'unassigned', short: 'unassigned', name: 'unassigned first',
    field: 'node', why: 'a Pod with no Node costs nothing to drop',
    rank: function(p) { return p.node ? 1 : 0; },
    read: function(p) { return p.node || '<none>'; }
  }),
  Object.freeze({
    id: 'phase', short: 'Pending first', name: 'Pending before Running',
    field: 'phase', why: 'a Pod that never served traffic is the cheapest to lose',
    rank: function(p) { return p.phase === 'Pending' ? 0 : 1; },
    read: function(p) { return p.phase; }
  }),
  Object.freeze({
    id: 'ready', short: 'not-Ready', name: 'not-Ready before Ready',
    field: 'ready', why: 'a Pod failing its readiness probe is already not serving',
    rank: function(p) { return p.ready ? 1 : 0; },
    read: function(p) { return p.ready ? 'Ready' : 'not Ready'; }
  }),
  Object.freeze({
    id: 'readySeconds', short: 'shorter Ready', name: 'shorter Ready duration first',
    field: 'readySeconds', why: 'the least-proven Pod is the least missed',
    rank: function(p) { return p.readySeconds; },
    read: function(p) { return p.readySeconds + 's Ready'; }
  }),
  Object.freeze({
    id: 'restarts', short: 'more restarts', name: 'more restarts first',
    field: 'restarts', why: 'a flapping Pod is the weaker replica',
    rank: function(p) { return -p.restarts; },
    read: function(p) { return p.restarts + ' restarts'; }
  }),
  Object.freeze({
    id: 'newest', short: 'newest', name: 'newer creationTimestamp first',
    field: 'createdAt', why: 'the oldest surviving Pod is the most proven one',
    rank: function(p) { return -p.createdAt; },
    read: function(p) { return 't+' + p.createdAt + 's'; }
  })
]);

/* ── The workload this scenario teaches ──
   Chosen so exactly three rules can separate the set: `ready`, `readySeconds`
   and `newest`. api-0/1/2 are the original rollout — identical readiness and
   identical restart counts — so the ladder is forced all the way down to
   creationTimestamp to break them apart. That is the surprising result. */
const DEFAULT_CONFIG = Object.freeze({
  initial: 3,
  scaleUp: 5,
  scaleDown: 2,
  pods: Object.freeze([
    /* the original three — created together, Ready together, never restarted */
    Object.freeze({key: 'api-0', name: 'api-0', node: 'worker-a', wave: 'initial',
      phase: 'Running', ready: true, readySeconds: 3600, restarts: 0, createdAt: 0}),
    Object.freeze({key: 'api-1', name: 'api-1', node: 'worker-a', wave: 'initial',
      phase: 'Running', ready: true, readySeconds: 3600, restarts: 0, createdAt: 60}),
    Object.freeze({key: 'api-2', name: 'api-2', node: 'worker-b', wave: 'initial',
      phase: 'Running', ready: true, readySeconds: 3600, restarts: 0, createdAt: 120}),
    /* the two the scale-up created — one settled, one still failing readiness */
    Object.freeze({key: 'api-3', name: 'api-3', node: 'worker-b', wave: 'scaleUp',
      phase: 'Running', ready: true, readySeconds: 40, restarts: 0, createdAt: 5400}),
    Object.freeze({key: 'api-4', name: 'api-4', node: 'worker-a', wave: 'scaleUp',
      phase: 'Running', ready: false, readySeconds: 0, restarts: 0, createdAt: 5405})
  ])
});

/* Does this rule separate any pair in the set? A rule whose rank is constant
   across every candidate never influences the order — say so, do not imply it. */
function ruleFires(rule, pods) {
  const first = rule.rank(pods[0]);
  return pods.some(function(p) { return rule.rank(p) !== first; });
}

/* ── scaleDownOrder ──
   Returns the victim list, earliest-deleted first, each carrying the rule that
   actually decided it. "Decided" = the first rule in the ladder whose rank
   separates this Pod from the Pod ranked immediately after it. */
function scaleDownOrder(pods, count) {
  finite('count', count);
  if (count > pods.length) throw new RangeError('cannot delete more Pods than exist');

  const ranked = pods.slice().sort(function(a, b) {
    for (let i = 0; i < RULES.length; i++) {
      const d = RULES[i].rank(a) - RULES[i].rank(b);
      if (d !== 0) return d;
    }
    return 0;
  });

  return ranked.slice(0, count).map(function(pod, i) {
    const next = ranked[i + 1];
    /* the rule that put this Pod ahead of the one behind it */
    let decided = null;
    if (next) {
      for (let r = 0; r < RULES.length; r++) {
        if (RULES[r].rank(pod) !== RULES[r].rank(next)) { decided = RULES[r]; break; }
      }
    }
    const rule = decided || RULES[RULES.length - 1];
    return Object.freeze({
      key: pod.key, name: pod.name, node: pod.node, order: i + 1,
      rule: rule.id, ruleName: rule.name, ruleShort: rule.short, field: rule.field,
      detail: rule.read(pod), why: rule.why,
      provenance: ORDERING_PROVENANCE
    });
  });
}

function simulate(config) {
  const c = config || DEFAULT_CONFIG;
  finite('initial', c.initial); finite('scaleUp', c.scaleUp); finite('scaleDown', c.scaleDown);
  if (!(c.scaleDown <= c.initial && c.initial <= c.scaleUp)) {
    throw new RangeError('this scenario requires scaleDown <= initial <= scaleUp');
  }
  if (!Array.isArray(c.pods) || c.pods.length !== c.scaleUp) {
    throw new RangeError('pods must be declared for the peak replica count');
  }

  const created = c.pods.filter(function(p) { return p.wave === 'scaleUp'; });
  if (created.length !== c.scaleUp - c.initial) {
    throw new RangeError('scaleUp wave must hold exactly scaleUp - initial Pods');
  }

  const victims = scaleDownOrder(c.pods, c.scaleUp - c.scaleDown);
  const victimKeys = victims.map(function(v) { return v.key; });
  const survivors = c.pods.filter(function(p) { return victimKeys.indexOf(p.key) < 0; });

  /* Which rules the panel may claim acted, and which it must grey out. */
  const ladder = RULES.map(function(r) {
    const fires = ruleFires(r, c.pods);
    return Object.freeze({
      id: r.id, short: r.short, name: r.name, field: r.field, why: r.why, fires: fires,
      note: fires ? null : 'not applicable — every Pod scores the same here',
      provenance: ORDERING_PROVENANCE
    });
  });

  /* Per-phase causal contract. This triple is exactly what the semantic
     surface announces via aria-live, so it lives in the model, not the prose. */
  const contract = Object.freeze({
    up: Object.freeze({
      changedInput: 'spec.replicas ' + c.initial + ' → ' + c.scaleUp,
      heldConstant: Object.freeze(['pod template', 'resource requests', 'Node count', 'PDB']),
      result: c.scaleUp - c.initial + ' Pods created, then bound and started'
    }),
    down: Object.freeze({
      changedInput: 'spec.replicas ' + c.scaleUp + ' → ' + c.scaleDown,
      heldConstant: Object.freeze(['pod template', 'resource requests', 'Node count', 'PDB']),
      result: victims.length + ' Pods deleted by DELETE, chosen by the ActivePods sort'
    })
  });

  return Object.freeze({
    initial: c.initial, scaleUp: c.scaleUp, scaleDown: c.scaleDown,
    /* every HUD row divides by this, on every phase — a denominator that moved
       with the numerator would render 3/3, 5/5 and 2/2 as identical full bars */
    maxReplicas: c.scaleUp,
    pods: c.pods, created: created,
    victims: victims, survivors: survivors,
    ladder: ladder,
    firingRules: ladder.filter(function(r) { return r.fires; }),
    contract: contract,
    deleteVerb: 'DELETE',
    provenance: ORDERING_PROVENANCE
  });
}

const API = {
  DEFAULT_CONFIG: DEFAULT_CONFIG, RULES: RULES,
  simulate: simulate, scaleDownOrder: scaleDownOrder
};

/* Browser deck and the plain-node smoke harness share one module. */
if (typeof window !== 'undefined') window.MANUAL_SCALE_MODEL = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
