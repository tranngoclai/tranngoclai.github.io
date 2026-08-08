/* ══════════════════════════════════════════════
   KUBELET EVICTION — POLICY OF THE *OTHER* ACTORS

   Node-pressure eviction is not one component making one decision. Three more
   actors react to it, each on its own clock, and conflating them is the most
   common way the mechanism gets misexplained:

     image / container GC     kubelet reclaims NODE-level resources first —
                              but only for disk signals. For memory there is
                              nothing to reclaim, so Pods are next.
     node lifecycle controller  turns the kubelet-reported MemoryPressure
                              condition into a NoSchedule taint.
     kube-scheduler           places the ReplicaSet's replacement, and must
                              respect that taint.

   Pure functions, MiB and seconds, same contract as the model module.
══════════════════════════════════════════════ */
(function() {
  const MODEL = window.KUBELET_EVICTION_MODEL;

  function nonNegative(value, label) {
    if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite');
    if (value < 0) throw new RangeError(label + ' must be non-negative');
    return value;
  }

  /* ── Node-level reclaim ──
     Before evicting any Pod, kubelet asks whether the signal has a node-level
     reclaim function. `nodefs`/`imagefs` do — delete dead containers, then
     unused images. `memory.available` has none: the kernel already reclaimed
     everything reclaimable before the working set got this high. */
  const NODE_LEVEL_RECLAIM = Object.freeze({
    'memory.available': Object.freeze({available: false, actions: []}),
    'nodefs.available': Object.freeze({available: true, actions: ['dead container GC', 'unused image GC']}),
    'imagefs.available': Object.freeze({available: true, actions: ['unused image GC']})
  });

  function evaluateNodeLevelReclaim(signalName) {
    const policy = NODE_LEVEL_RECLAIM[signalName];
    if (!policy) throw new TypeError('unknown eviction signal: ' + signalName);
    return {
      signal: signalName,
      attempted: policy.available,
      actions: policy.actions.slice(),
      reclaimedMi: 0,
      // Only a reclaim that actually frees enough lets kubelet skip Pod
      // eviction. For memory it never runs, so the answer is always "no".
      sufficient: false,
      reason: policy.available ? 'reclaim-ran-but-insufficient' : 'no-node-level-reclaim-for-signal'
    };
  }

  /* ── Node condition + taint ──
     kubelet writes the condition; the node lifecycle controller in
     kube-controller-manager writes the taint. Two actors, one observable
     effect, and only the taint changes what the scheduler will do. */
  function evaluateNodeCondition(config) {
    const triggered = !!config.triggered;
    const transitionSeconds = nonNegative(config.pressureTransitionSeconds ?? 0, 'pressureTransitionSeconds');
    return {
      condition: 'MemoryPressure',
      status: triggered ? 'True' : 'False',
      taint: 'node.kubernetes.io/memory-pressure:NoSchedule',
      taintApplied: triggered,
      transitionSeconds,
      // Oscillation protection: once the signal recovers kubelet still holds
      // the condition for the transition period so the node does not flap
      // between schedulable and tainted every monitoring tick.
      clearsAfterSeconds: triggered ? transitionSeconds : 0,
      // The taint is NoSchedule, so it only blocks NEW Pods without a
      // toleration. Pods already running on the Node are not evicted by it.
      evictsRunningPods: false
    };
  }

  /* ── Replacement placement ──
     The tainted source Node is not a candidate, so the replacement can only
     land elsewhere. This is why eviction plus a single-node cluster leaves the
     replacement Pending forever. */
  function evaluateReplacementPlacement(config) {
    if (!config || !config.victim) {
      return {scheduled: false, nodeName: null, reason: 'no-victim', sourceNodeExcluded: false};
    }
    const freeMi = nonNegative(config.workerBFreeMi, 'workerBFreeMi');
    const requestMi = nonNegative(config.victim.requestMi, 'victim.requestMi');
    const sourceNodeExcluded = !!config.sourceNodeTainted;
    if (requestMi <= freeMi) {
      return {
        scheduled: true,
        nodeName: 'Worker B',
        reason: 'fits-worker-b',
        sourceNodeExcluded,
        remainingMi: freeMi - requestMi
      };
    }
    return {
      scheduled: false,
      nodeName: null,
      reason: 'insufficient-worker-b-memory',
      sourceNodeExcluded,
      shortfallMi: requestMi - freeMi
    };
  }

  /* ── Evicted Pod objects ──
     The container is gone but the Pod object stays in etcd as Failed/Evicted
     until the Pod GC controller trims terminated Pods past its threshold.
     That backlog is what people are actually looking at when they say
     "my cluster is full of evicted pods". */
  function evaluatePodGarbageCollection(config) {
    const threshold = nonNegative(config.terminatedPodThreshold ?? 12500, 'terminatedPodThreshold');
    return {
      controller: 'pod-garbage-collector',
      terminatedPodThreshold: threshold,
      retainedPhase: 'Failed',
      retainedReason: 'Evicted',
      collectedImmediately: false,
      manualCleanup: 'kubectl delete pod --field-selector status.phase=Failed'
    };
  }

  window.KUBELET_EVICTION_POLICY = {
    fmtMi: MODEL.fmtMi,
    evaluateNodeLevelReclaim,
    evaluateNodeCondition,
    evaluateReplacementPlacement,
    evaluatePodGarbageCollection
  };
})();
