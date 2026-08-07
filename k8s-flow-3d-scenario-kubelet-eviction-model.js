/* ══════════════════════════════════════════════
   KUBELET EVICTION — DETERMINISTIC TEACHING MODEL

   This module owns the arithmetic used by both the lesson copy and the 3D
   states.  It deliberately scopes itself to node-pressure eviction caused by
   `memory.available`; disk/PID signals have different reclaim and ranking
   inputs and must not silently reuse this comparator.

   Node-condition, node-level reclaim and post-eviction placement live in
   k8s-flow-3d-scenario-kubelet-eviction-policy.js — they are decisions made by
   *other* actors (node lifecycle controller, image GC, kube-scheduler) and
   keeping them out of here stops the eviction comparator from growing into a
   god-object.

   Values are MiB and seconds.  The functions are pure so the scenario can be
   regression-tested without Three.js or a browser.
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

  /* Shared by every module and by the panel copy, so 1024 renders as "1Gi" in
     exactly one way across the scenario. */
  function fmtMi(value) {
    return value >= 1024 && value % 1024 === 0 ? (value / 1024) + 'Gi' : value + 'Mi';
  }

  /* kubelet does not read `free`. It derives the signal from the root cgroup's
     working set, which already excludes reclaimable page cache (inactive_file).
     Stating the subtraction is the point: a viewer who watches `free -m`
     instead will never reproduce the number kubelet acted on. */
  function deriveMemorySignal(source) {
    const capacityMi = nonNegative(source.capacityMi, 'capacityMi');
    const workingSetMi = nonNegative(source.workingSetMi, 'workingSetMi');
    const inactiveFileMi = nonNegative(source.inactiveFileMi ?? 0, 'inactiveFileMi');
    return {
      capacityMi,
      workingSetMi,
      inactiveFileMi,
      // Page cache that the kernel can drop is NOT counted as used.
      availableMi: Math.max(0, capacityMi - workingSetMi)
    };
  }

  function evaluateThreshold(signal) {
    if (signal.kind !== 'hard' && signal.kind !== 'soft') {
      throw new TypeError('kind must be hard or soft');
    }
    const availableMi = nonNegative(signal.availableMi, 'availableMi');
    const thresholdMi = nonNegative(signal.thresholdMi, 'thresholdMi');
    const observedForSeconds = nonNegative(signal.observedForSeconds ?? 0, 'observedForSeconds');
    const gracePeriodSeconds = nonNegative(signal.gracePeriodSeconds ?? 0, 'gracePeriodSeconds');
    const crossed = availableMi < thresholdMi;
    const graceSatisfied = signal.kind === 'hard' || observedForSeconds >= gracePeriodSeconds;

    return {
      signal: 'memory.available',
      kind: signal.kind,
      availableMi,
      thresholdMi,
      observedForSeconds,
      gracePeriodSeconds,
      // Hard eviction ignores the Pod's own terminationGracePeriodSeconds;
      // soft eviction honours it but caps it at evictionMaxPodGracePeriod.
      podGracePeriodSeconds: signal.kind === 'hard' ? 0 : nonNegative(signal.maxPodGracePeriodSeconds ?? 0, 'maxPodGracePeriodSeconds'),
      crossed,
      graceSatisfied,
      triggered: crossed && graceSatisfied
    };
  }

  function evictionFacts(pod) {
    if (!pod || !pod.key || !pod.name) throw new TypeError('pod key and name are required');
    const usageMi = nonNegative(pod.usageMi, pod.name + '.usageMi');
    const requestMi = nonNegative(pod.requestMi, pod.name + '.requestMi');
    const priority = number(pod.priority ?? 0, pod.name + '.priority');
    return Object.assign({}, pod, {
      usageMi,
      requestMi,
      priority,
      evictable: pod.evictable !== false,
      exceedsRequest: usageMi > requestMi,
      excessMi: usageMi - requestMi
    });
  }

  /* For memory pressure Kubernetes first separates Pods that exceed requests,
     then considers lower Priority, then the amount above requests.  Name is
     only a deterministic teaching tie-breaker; it is not a kubelet policy. */
  function compareMemoryVictims(a, b) {
    if (a.exceedsRequest !== b.exceedsRequest) return a.exceedsRequest ? -1 : 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.excessMi !== b.excessMi) return b.excessMi - a.excessMi;
    const aName = String(a.name), bName = String(b.name);
    return aName < bName ? -1 : (aName > bName ? 1 : 0);
  }

  /* Returns both halves of the split so the scenario can *show* who was
     removed from consideration instead of silently dropping the box. */
  function rankMemoryVictims(pods) {
    if (!Array.isArray(pods) || !pods.length) throw new TypeError('pods must be a non-empty array');
    const facts = pods.map(evictionFacts);
    // kubelet skips critical Pods: static Pods, mirror Pods, and anything at
    // system-cluster-critical priority or above. DaemonSet ownership alone is
    // NOT a shield — a DaemonSet Pod is ranked like any other.
    const excluded = facts.filter(function(pod) { return !pod.evictable; });
    const ranking = facts.filter(function(pod) { return pod.evictable; })
      .sort(compareMemoryVictims)
      .map(function(pod, index) { return Object.assign({}, pod, {rank: index + 1}); });
    return {ranking, excluded};
  }

  function simulate(config) {
    const measured = deriveMemorySignal(config.stats);
    const threshold = evaluateThreshold(Object.assign({availableMi: measured.availableMi}, config.signal));
    const minimumReclaimMi = nonNegative(config.minimumReclaimMi ?? 0, 'minimumReclaimMi');
    const targetMi = threshold.thresholdMi + minimumReclaimMi;
    const split = rankMemoryVictims(config.pods);
    const ranking = split.ranking;
    const victims = [];
    let projectedAvailableMi = threshold.availableMi;

    // A synchronization cycle selects at most one victim. Kubelet samples and
    // ranks again after termination; a second Pod cannot come from this stale
    // candidate snapshot.
    if (threshold.triggered && projectedAvailableMi < targetMi && ranking.length) {
      victims.push(ranking[0]);
      projectedAvailableMi += ranking[0].usageMi; // teaching projection only
    }

    let reason = 'threshold-not-crossed';
    if (threshold.crossed && !threshold.graceSatisfied) reason = 'soft-grace-waiting';
    else if (victims.length) reason = 'victim-selected';
    else if (threshold.triggered) reason = 'no-evictable-pods';

    return {
      measured,
      threshold,
      minimumReclaimMi,
      targetMi,
      ranking,
      excluded: split.excluded,
      victims,
      victim: victims[0] || null,
      projectedAvailableMi,
      needsAnotherCycleEstimate: victims.length > 0 && projectedAvailableMi < targetMi,
      shouldEvict: victims.length > 0,
      reason
    };
  }

  const DEFAULT_CONFIG = Object.freeze({
    // What the stats pipeline reports, not what `free -m` would print.
    stats: Object.freeze({capacityMi: 8192, workingSetMi: 7424, inactiveFileMi: 640}),
    signal: Object.freeze({
      kind: 'hard', thresholdMi: 1024,
      observedForSeconds: 1, gracePeriodSeconds: 0, maxPodGracePeriodSeconds: 0
    }),
    minimumReclaimMi: 512,
    monitoringPeriodSeconds: 10,
    pressureTransitionSeconds: 300,
    workerBFreeMi: 4096,
    pods: Object.freeze([
      Object.freeze({key: 'pod-a', name: 'Pod A', requestMi: 4096, usageMi: 3072, priority: 100}),
      Object.freeze({key: 'pod-b', name: 'Pod B', requestMi: 1024, usageMi: 2048, priority: 200}),
      Object.freeze({key: 'pod-c', name: 'Pod C', requestMi: 1024, usageMi: 3072, priority: 10000}),
      Object.freeze({
        key: 'pod-static', name: 'kube-proxy', requestMi: 128, usageMi: 96,
        priority: 2000000000, evictable: false, exclusionReason: 'static/critical Pod'
      })
    ])
  });

  window.KUBELET_EVICTION_MODEL = {
    fmtMi,
    deriveMemorySignal,
    evaluateThreshold,
    rankMemoryVictims,
    simulate,
    DEFAULT_CONFIG
  };
})();
