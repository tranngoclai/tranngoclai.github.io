/* PDB + DRAIN — deterministic teaching model.
   This is one Deployment with 3 intended replicas and minAvailable: 2. */
(function() {
  function finite(name, value) {
    if (!Number.isFinite(value)) throw new TypeError(name + ' must be finite');
    if (value < 0) throw new RangeError(name + ' must not be negative');
  }
  const DEFAULT_CONFIG = Object.freeze({
    replicas: 3,
    minAvailable: 2,
    targetNode: 'worker-a',
    pods: Object.freeze([
      Object.freeze({key: 'api-0', name: 'api-0', node: 'worker-a'}),
      Object.freeze({key: 'api-1', name: 'api-1', node: 'worker-a'}),
      Object.freeze({key: 'api-2', name: 'api-2', node: 'worker-b'})
    ]),
    replacement: Object.freeze({key: 'api-3', name: 'api-3', node: 'worker-c'})
  });
  function simulate(config) {
    const c = config || DEFAULT_CONFIG;
    finite('replicas', c.replicas); finite('minAvailable', c.minAvailable);
    if (!Array.isArray(c.pods) || c.pods.length !== c.replicas) throw new RangeError('pods must match replicas');
    if (c.minAvailable > c.replicas) throw new RangeError('minAvailable cannot exceed replicas');
    const target = c.pods.filter(function(pod) { return pod.node === c.targetNode; })[0];
    if (!target) throw new RangeError('target node needs one application Pod');
    const initialAllowed = c.replicas - c.minAvailable;
    const afterFirstHealthy = c.replicas - 1;
    return Object.freeze({
      replicas: c.replicas, minAvailable: c.minAvailable, target: target,
      replacement: c.replacement, initialHealthy: c.replicas,
      initialAllowed: initialAllowed, afterFirstHealthy: afterFirstHealthy,
      blockedAllowed: Math.max(0, afterFirstHealthy - c.minAvailable),
      restoredHealthy: c.replicas, restoredAllowed: initialAllowed,
      evictionReason: 'EvictionByEvictionAPI'
    });
  }
  window.PDB_DRAIN_MODEL = {DEFAULT_CONFIG: DEFAULT_CONFIG, simulate: simulate};
})();
