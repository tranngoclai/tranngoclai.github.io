/* ══════════════════════════════════════════════
   PREEMPTION — DETERMINISTIC TEACHING MODEL

   Owns every number the Preemption scenario shows, on the same contract as
   k8s-flow-3d-scenario-kubelet-eviction-model.js: pure functions, frozen
   defaults, no Three.js and no DOM.

   ── Why this one matters most ──
   The scenario's central claim is step ③: *"tập victim tối thiểu — xoá từ dưới
   lên, dừng ngay khi vừa đủ"*. Until now that was asserted in prose and drawn
   by hand; nothing computed it, so the deck could not actually demonstrate the
   rule it was teaching. `findVictimSet` computes it, and the steps read the
   result — including the fact that `payments` is never touched, which is the
   whole lesson.

   The other two Nodes are not decoration either. Worker B shows preemption
   failing because every Pod on it outranks the incoming one; Worker C shows it
   failing because a taint is not something eviction can fix. Both fall out of
   the same function rather than being separately asserted.

   Memory is in Gi throughout.
══════════════════════════════════════════════ */
(function() {

  function nonNegative(value, label) {
    if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite');
    if (value < 0) throw new RangeError(label + ' must be non-negative');
    return value;
  }

  function fmtGi(value) {
    return value + 'Gi';
  }

  /* `11/12Gi` — one formatting, shared by the world label, the hover, the HUD
     gauge and the panel copy. */
  function fmtNodeMem(node) {
    return node.memUsed + '/' + node.memTotal + 'Gi';
  }

  function memUsed(pods) {
    return pods.reduce(function(sum, pod) { return sum + pod.memGi; }, 0);
  }

  function memFree(node) {
    return node.memTotal - node.memUsed;
  }

  /* ── Filter ──
     Same binary question as the scheduler model, but memory-based and with the
     rejection reason carrying one extra bit: whether removing Pods could
     conceivably help. A taint survives eviction, so a Node rejected for a taint
     is permanently out — that distinction is what makes PostFilter skip it. */
  function evaluateNode(node, pod) {
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
        // Eviction frees memory. It does not remove taints.
        fixableByPreemption: false,
        taints: blocking
      };
    }
    if (memFree(node) < pod.memGi) {
      return {
        key: node.key, name: node.name, node: node,
        passed: false,
        plugin: 'NodeResourcesFit',
        badge: 'Insufficient memory',
        reason: 'insufficient-memory',
        shortfallGi: pod.memGi - memFree(node),
        fixableByPreemption: true
      };
    }
    return {
      key: node.key, name: node.name, node: node,
      passed: true, plugin: 'NodeResourcesFit', badge: 'fits', reason: 'fits',
      fixableByPreemption: false
    };
  }

  function runFilter(nodes, pod) {
    const evaluated = nodes.map(function(node) { return evaluateNode(node, pod); });
    return {
      evaluated: evaluated,
      passed: evaluated.filter(function(e) { return e.passed; }),
      rejected: evaluated.filter(function(e) { return !e.passed; }),
      // PostFilter runs only when Filter found nothing at all.
      allRejected: evaluated.every(function(e) { return !e.passed; })
    };
  }

  /* ── The minimal victim set ──
     Candidates are Pods on this Node with LOWER priority than the incoming Pod;
     equal priority is not enough, which is why Worker B's `P=2000` Pods are
     untouchable by a `P=1000` Pod.

     Victims are taken in ascending priority — cheapest sacrifice first — and
     the loop STOPS the instant the Pod fits. That early exit is the behaviour
     step ③ is about: `payments` (P=300) is a legal victim and is still spared,
     because by the time it is considered the Pod already has room. */
  function findVictimSet(node, pod) {
    const free = memFree(node);
    const needed = pod.memGi - free;

    if (needed <= 0) {
      return {nodeKey: node.key, feasible: true, victims: [], neededGi: 0, freedGi: 0, spared: node.pods.slice()};
    }

    const candidates = node.pods
      .filter(function(p) { return p.priority < pod.priority; })
      .sort(function(a, b) { return a.priority - b.priority; });

    const victims = [];
    let freed = 0;
    for (let i = 0; i < candidates.length && freed < needed; i++) {
      victims.push(candidates[i]);
      freed += candidates[i].memGi;
    }

    const feasible = freed >= needed;
    const victimKeys = victims.map(function(v) { return v.key; });

    return {
      nodeKey: node.key,
      feasible: feasible,
      neededGi: needed,
      freedGi: freed,
      victims: feasible ? victims : [],
      // Everything the eviction leaves alone, victims included when infeasible.
      spared: node.pods.filter(function(p) {
        return !feasible || victimKeys.indexOf(p.key) === -1;
      }),
      reason: feasible ? 'victim-set-found'
            : (candidates.length ? 'not-enough-lower-priority-memory' : 'no-lower-priority-pods')
    };
  }

  /* PostFilter across the cluster: only Nodes whose rejection preemption could
     actually repair are simulated at all. */
  function runPostFilter(filter, pod) {
    const simulated = filter.rejected.map(function(entry) {
      if (!entry.fixableByPreemption) {
        return {
          nodeKey: entry.key, name: entry.name, feasible: false,
          victims: [], reason: 'rejection-not-fixable-by-preemption', skipped: true
        };
      }
      const plan = findVictimSet(entry.node, pod);
      return Object.assign({name: entry.name, skipped: false}, plan);
    });
    const feasible = simulated.filter(function(s) { return s.feasible; });
    return {
      simulated: simulated,
      feasible: feasible,
      // The scenario has exactly one feasible Node by construction. Real
      // PostFilter would pick the cheapest; with one candidate there is nothing
      // to choose between, so this does not pretend to model that.
      chosen: feasible[0] || null
    };
  }

  /* The Node as it stands once the victims terminate — this is what step ⑤
     relabels Worker A to. Derived, so `7/12Gi` can never disagree with the
     victim list that produced it. */
  function applyEviction(node, victims) {
    const keys = victims.map(function(v) { return v.key; });
    const remaining = node.pods.filter(function(p) { return keys.indexOf(p.key) === -1; });
    return Object.assign({}, node, {
      pods: remaining,
      memUsed: memUsed(remaining)
    });
  }

  function simulate(config) {
    const pod = config.pod;
    // memUsed is derived from the Pods, never stated twice.
    const nodes = config.nodes.map(function(node) {
      return Object.assign({}, node, {memUsed: memUsed(node.pods)});
    });

    const filter = runFilter(nodes, pod);
    const postFilter = runPostFilter(filter, pod);
    const chosen = postFilter.chosen;
    const targetNode = chosen ? nodes.filter(function(n) { return n.key === chosen.nodeKey; })[0] : null;
    const afterEviction = targetNode ? applyEviction(targetNode, chosen.victims) : null;

    return {
      pod: pod,
      nodes: nodes,
      byKey: function(key) { return nodes.filter(function(n) { return n.key === key; })[0]; },
      filter: filter,
      postFilter: postFilter,
      victims: chosen ? chosen.victims : [],
      nominatedNodeKey: chosen ? chosen.nodeKey : null,
      afterEviction: afterEviction,
      shouldPreempt: !!chosen
    };
  }

  /* Facts taken from what the scenario shows today. Node memory totals are
     stated; usage is summed from the Pods, so the two cannot disagree. */
  const DEFAULT_CONFIG = Object.freeze({
    pod: Object.freeze({
      key: 'pod-checkout', name: 'checkout', priority: 1000, memGi: 4,
      tolerations: Object.freeze([])
    }),
    nodes: Object.freeze([
      Object.freeze({
        key: 'node-a', name: 'Worker A', memTotal: 12, taints: Object.freeze([]),
        pods: Object.freeze([
          Object.freeze({key: 'pod-a1', name: 'batch-job', priority: 50,  memGi: 1}),
          Object.freeze({key: 'pod-a2', name: 'log-agent', priority: 150, memGi: 3}),
          Object.freeze({key: 'pod-a3', name: 'payments',  priority: 300, memGi: 7})
        ])
      }),
      Object.freeze({
        key: 'node-b', name: 'Worker B', memTotal: 16, taints: Object.freeze([]),
        pods: Object.freeze([
          Object.freeze({key: 'pod-b1', name: 'ingress-ctrl', priority: 2000, memGi: 8}),
          Object.freeze({key: 'pod-b2', name: 'core-dns',     priority: 2000, memGi: 8})
        ])
      }),
      Object.freeze({
        key: 'node-c', name: 'Worker C', memTotal: 16,
        taints: Object.freeze(['gpu=true:NoSchedule']),
        pods: Object.freeze([
          Object.freeze({key: 'pod-c1', name: 'gpu-train', priority: 100, memGi: 6})
        ])
      })
    ])
  });

  const API = {
    fmtGi, fmtNodeMem, memFree, runFilter, findVictimSet, runPostFilter,
    applyEviction, simulate, DEFAULT_CONFIG
  };

  if (typeof window !== 'undefined') window.PREEMPTION_MODEL = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
