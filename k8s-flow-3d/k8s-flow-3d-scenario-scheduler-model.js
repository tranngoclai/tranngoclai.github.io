/* ══════════════════════════════════════════════
   SCHEDULER PIPELINE — DETERMINISTIC TEACHING MODEL

   Owns every number the Scheduler Pipeline scenario shows. The world labels,
   the Filter verdicts, the badge text, the Score HUD rows and the figures
   quoted in the panel copy all read from here, so they cannot drift apart.
   Before this module existed, `cpu 4/16` was typed independently in the world
   label, the hover text and the Filter explanation — three places, no link.

   Same contract as k8s-flow-3d-scenario-kubelet-eviction-model.js: pure
   functions, frozen defaults, no Three.js and no DOM, so the arithmetic can be
   checked by plain `node` (see plans/…/model-assertions.js).

   ── Scope ──
   This is NOT kube-scheduler. It reproduces exactly the two Filter plugins and
   the four Score plugins the scenario teaches, over the four Nodes it shows.
   A plugin with no on-screen consequence does not belong here.
══════════════════════════════════════════════ */
(function() {

  function number(value, label) {
    if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite');
    return value;
  }

  function nonNegative(value, label) {
    const result = number(value, label);
    if (result < 0) throw new RangeError(label + ' must be non-negative');
    return result;
  }

  /* The one place `4/16` is turned into a string, so the world label, the hover
     and the panel copy cannot format it three different ways. */
  function fmtCpu(node) {
    return node.cpuUsed + '/' + node.cpuTotal;
  }

  function cpuFree(node) {
    return node.cpuTotal - node.cpuUsed;
  }

  /* ── Filter ──
     A binary question per Node, evaluated by every plugin, and the FIRST
     rejection wins: the scenario's own copy makes the point that Filter logic
     is an absolute AND, so a Node that fails one plugin is out regardless of
     how it scores anywhere else. Returning the rejecting plugin by name is what
     lets a step badge say `Insufficient cpu` without re-deriving why.

     `NodeResourcesFit` compares against REQUESTS, never live usage — the
     distinction the step ④ copy is built around. */
  function evaluateNode(node, pod) {
    const requested = nonNegative(pod.cpuRequest, 'pod.cpuRequest');

    if (node.cpuUsed + requested > node.cpuTotal) {
      return {
        key: node.key, name: node.name, node: node,
        passed: false,
        plugin: 'NodeResourcesFit',
        badge: 'Insufficient cpu',
        reason: 'insufficient-cpu'
      };
    }

    // A taint blocks unless the Pod carries a matching toleration. Note this
    // runs AFTER the resource check only because the scenario shows a Node
    // (Worker C) that is resource-rich and still rejected — the ordering is
    // presentational, not a claim about kube-scheduler's plugin order.
    const blocking = (node.taints || []).filter(function(taint) {
      return (pod.tolerations || []).indexOf(taint) === -1;
    });
    if (blocking.length) {
      return {
        key: node.key, name: node.name, node: node,
        passed: false,
        plugin: 'TaintToleration',
        badge: 'untolerated taint',
        reason: 'untolerated-taint',
        taints: blocking
      };
    }

    return {
      key: node.key, name: node.name, node: node,
      passed: true,
      plugin: 'NodeResourcesFit',
      badge: 'NodeResourcesFit ✓',
      reason: 'fits'
    };
  }

  function runFilter(nodes, pod) {
    const evaluated = nodes.map(function(node) { return evaluateNode(node, pod); });
    return {
      evaluated: evaluated,
      passed: evaluated.filter(function(e) { return e.passed; }),
      rejected: evaluated.filter(function(e) { return !e.passed; })
    };
  }

  /* ── Score ──
     Each plugin rates a Node 0–100; the final score is the weighted mean.

     ⚠ THE WEIGHTS BELOW ARE ILLUSTRATIVE, NOT KUBE-SCHEDULER DEFAULTS.
     They were chosen so the arithmetic lands on the two figures the scenario's
     copy already commits to — Worker A = 94, Worker D = 71 — because those
     numbers appear in learner-facing prose that this refactor was not meant to
     rewrite. Do not cite them as real kube-scheduler configuration. What IS
     faithful is the shape: 0–100 per plugin, weighted sum, LeastAllocated
     driven by free capacity, and ImageLocality rewarding a cached image.

     Only LeastAllocated is derived from Node facts. The other three are
     per-Node inputs, because the scenario states their outcomes as given
     (Worker D has not cached the image) rather than deriving them from
     anything on screen. */
  const SCORE_WEIGHTS = Object.freeze({
    leastAllocated: 6,
    imageLocality: 3,
    podTopologySpread: 8,
    interPodAffinity: 8
  });

  /* Node still trending toward "more free capacity scores higher" — the
     default spreading behaviour the copy contrasts with MostAllocated. */
  function leastAllocatedPoints(node) {
    return Math.round(cpuFree(node) / node.cpuTotal * 100);
  }

  function scoreNode(node) {
    const points = {
      leastAllocated: leastAllocatedPoints(node),
      imageLocality: nonNegative(node.imageLocalityPoints, node.key + '.imageLocalityPoints'),
      podTopologySpread: nonNegative(node.topologySpreadPoints, node.key + '.topologySpreadPoints'),
      interPodAffinity: nonNegative(node.interPodAffinityPoints, node.key + '.interPodAffinityPoints')
    };

    let weighted = 0, totalWeight = 0;
    const breakdown = Object.keys(SCORE_WEIGHTS).map(function(plugin) {
      const weight = SCORE_WEIGHTS[plugin];
      weighted += points[plugin] * weight;
      totalWeight += weight;
      return {plugin: plugin, weight: weight, points: points[plugin]};
    });

    return {
      key: node.key,
      name: node.name,
      node: node,
      score: Math.round(weighted / totalWeight),
      breakdown: breakdown
    };
  }

  /* Highest score wins. Real kube-scheduler picks at random among ties to avoid
     packing one Node; the scenario has no tie, so this keeps a stable order
     rather than pretending to model that. */
  function scoreNodes(passed) {
    return passed
      .map(function(entry) { return scoreNode(entry.node); })
      .sort(function(a, b) { return b.score - a.score; });
  }

  function simulate(config) {
    const pod = config.pod;
    const filter = runFilter(config.nodes, pod);
    const scored = scoreNodes(filter.passed);
    const winner = scored[0] || null;

    return {
      pod: pod,
      nodes: config.nodes,
      filter: filter,
      scored: scored,
      winner: winner,
      // Marks the winning row in the Score HUD without a step re-deciding it.
      isWinner: function(key) { return !!winner && winner.key === key; }
    };
  }

  /* Facts taken from what the scenario shows today, so the derived output must
     reproduce the current screen. `cpuRequest: 2` is the value implied by the
     Nodes: Worker D (11/16) must fit and Worker B (15/16) must not. */
  const DEFAULT_CONFIG = Object.freeze({
    pod: Object.freeze({
      key: 'pod', name: 'Pod', priority: 500, cpuRequest: 2, tolerations: Object.freeze([])
    }),
    /* The Pod already waiting in ActiveQ. It is never scheduled in this
       scenario — it exists so step ③ can show that ActiveQ orders by priority
       rather than arrival, so the only fact that matters is that its priority
       is below the subject's. */
    queuePeer: Object.freeze({key: 'q-pod-lo', name: 'batch', priority: 200}),
    nodes: Object.freeze([
      Object.freeze({
        key: 'node-a', name: 'Worker A', cpuUsed: 4, cpuTotal: 16, taints: Object.freeze([]),
        imageLocalityPoints: 100, topologySpreadPoints: 100, interPodAffinityPoints: 100
      }),
      Object.freeze({
        key: 'node-d', name: 'Worker D', cpuUsed: 11, cpuTotal: 16, taints: Object.freeze([]),
        // Image not cached here — the one thing that separates D from A beyond
        // raw capacity, and the reason its score falls as far as it does.
        imageLocalityPoints: 0, topologySpreadPoints: 100, interPodAffinityPoints: 100
      }),
      Object.freeze({
        key: 'node-b', name: 'Worker B', cpuUsed: 15, cpuTotal: 16, taints: Object.freeze([]),
        imageLocalityPoints: 100, topologySpreadPoints: 100, interPodAffinityPoints: 100
      }),
      Object.freeze({
        key: 'node-c', name: 'Worker C', cpuUsed: 2, cpuTotal: 16,
        taints: Object.freeze(['node-role.kubernetes.io/control-plane:NoSchedule']),
        imageLocalityPoints: 100, topologySpreadPoints: 100, interPodAffinityPoints: 100
      })
    ])
  });

  const API = {
    fmtCpu, cpuFree, runFilter, scoreNodes, simulate,
    SCORE_WEIGHTS, DEFAULT_CONFIG
  };

  // Browser deck and the node-run assertion harness share one definition.
  if (typeof window !== 'undefined') window.SCHEDULER_MODEL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
