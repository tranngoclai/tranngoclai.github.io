/* Linux OOM KILLER — deterministic teaching model.
   This scenario deliberately shows two distinct kernel paths: a container
   memory-cgroup limit and a node-wide (global) OOM. They share the kernel OOM
   killer, but do not share a victim set. */
(function() {
  function nonNegative(value, label) {
    if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite');
    if (value < 0) throw new RangeError(label + ' must be non-negative');
    return value;
  }
  function fmtMi(value) { return value >= 1024 && value % 1024 === 0 ? (value / 1024) + 'Gi' : value + 'Mi'; }
  function burstableAdj(requestMi, nodeCapacityMi) {
    return Math.min(999, Math.max(2, Math.floor(1000 - (1000 * requestMi / nodeCapacityMi))));
  }
  function simulate(config) {
    const nodeCapacityMi = nonNegative(config.nodeCapacityMi, 'nodeCapacityMi');
    const limitMi = nonNegative(config.limitMi, 'limitMi');
    const usedMi = nonNegative(config.usedMi, 'usedMi');
    const allocationMi = nonNegative(config.allocationMi, 'allocationMi');
    const requestMi = nonNegative(config.requestMi, 'requestMi');
    if (nodeCapacityMi === 0 || limitMi === 0) throw new RangeError('capacity and limit must be positive');
    const projectedMi = usedMi + allocationMi;
    return {
      nodeCapacityMi, limitMi, usedMi, allocationMi, requestMi, projectedMi,
      limitExceeded: projectedMi > limitMi,
      excessMi: Math.max(0, projectedMi - limitMi),
      burstableAdj: burstableAdj(requestMi, nodeCapacityMi),
      // Kubelet's current QoS policy uses QoS/request/node capacity here; an
      // ordinary Pod PriorityClass is not an input to this calculation.
      bestEffortAdj: 1000, guaranteedAdj: -997,
      cgroupVersion: config.cgroupVersion === 'v2' ? 'v2' : (function() { throw new TypeError('scenario teaches cgroup v2'); })(),
      singleProcessOOMKill: config.singleProcessOOMKill === true,
      globalAvailableMi: nonNegative(config.globalAvailableMi, 'globalAvailableMi'),
      globalRequestMi: nonNegative(config.globalRequestMi, 'globalRequestMi')
    };
  }
  const DEFAULT_CONFIG = Object.freeze({
    nodeCapacityMi: 8192, requestMi: 128, limitMi: 1024,
    usedMi: 960, allocationMi: 128,
    cgroupVersion: 'v2', singleProcessOOMKill: true,
    globalAvailableMi: 32, globalRequestMi: 256
  });
  window.OOM_KILLER_MODEL = {fmtMi, burstableAdj, simulate, DEFAULT_CONFIG};
})();
