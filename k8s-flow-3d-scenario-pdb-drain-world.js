/* PDB + DRAIN — persistent world. Components are Kubernetes actors/objects,
   not explanatory stand-ins. Pods move or change state; they are never cloned. */
(function() {
const KIT = window.SCENE_KIT;
window.PDB_DRAIN_POS = {
  api0: [5, -0.5, 6.9], api1: [11, -0.5, 6.9], api2: [7, -0.5, 0.1],
  replacementPending: [-4, 2.0, 6.4], replacementRunning: [7, -0.5, -6.7]
};
window.createPdbDrainWorld = function(run) { return function(raw) {
  const w = KIT.world(raw), p = window.PDB_DRAIN_POS;
  w.node('kubectl', {label: 'kubectl\ndrain', pos: [-16, 0, 0], size: [3.8, 4.6, 3], tone: 'subject', order: 0, hover: 'Client that cordons then calls the Eviction subresource'});
  w.node('apiserver', {label: 'API Server', pos: [-10, 0, 0], size: [4.1, 5, 3], tone: 'core', order: 1, hover: 'Accepts Eviction requests and writes Pod/Node objects'});
  w.node('pdb', {label: 'PDB\nminAvailable ' + run.minAvailable, pos: [-10, 0, -6], size: [4.4, 3.5, 2.6], tone: 'gate', order: 2, hover: 'policy/v1 PodDisruptionBudget selected by the Deployment Pod labels'});
  w.node('disruption-controller', {label: 'disruption controller\nkube-controller-manager', pos: [-4, 0, -6], size: [5, 3.5, 2.7], tone: 'system', order: 2, hover: 'Maintains PDB status such as currentHealthy and disruptionsAllowed'});
  w.node('deployment-controller', {label: 'Deployment controller\nkube-controller-manager', pos: [-4, 0, 0], size: [5, 3.5, 2.7], tone: 'system', order: 2, hover: 'Creates a replacement Pod after its managed Pod starts terminating'});
  w.node('scheduler', {label: 'kube-scheduler', pos: [-4, 0, 6], size: [4.5, 3.5, 2.7], tone: 'system', order: 2, hover: 'Binds the replacement only to a schedulable worker'});
  w.node('worker-a', {label: 'Worker A\nschedulable', pos: [8, -1.6, 7], size: [12, .6, 5.5], tone: 'surface', order: 3, hover: 'Drain target; cordon changes spec.unschedulable before evictions'});
  w.node('worker-b', {label: 'Worker B\nschedulable', pos: [8, -1.6, 0], size: [12, .6, 5.5], tone: 'surface', order: 3, hover: 'A remaining healthy replica node'});
  w.node('worker-c', {label: 'Worker C\nschedulable', pos: [8, -1.6, -7], size: [12, .6, 5.5], tone: 'surface', order: 3, hover: 'A remaining node where the replacement can be bound'});
  w.node('pod-api-0', {label: run.target.name + '\nReady', pos: p.api0, size: [3.4, 1.3, 2], tone: 'live', order: 4, hover: 'Deployment Pod selected by this PDB; on the drain target'});
  w.node('pod-api-1', {label: 'api-1\nReady', pos: p.api1, size: [3.4, 1.3, 2], tone: 'live', order: 4, hover: 'Selected by the same PDB; its eviction is initially refused'});
  w.node('pod-api-2', {label: 'api-2\nReady', pos: p.api2, size: [3.4, 1.3, 2], tone: 'live', order: 4, hover: 'Selected by the same PDB; remains available'});
  w.node('pod-api-3', {label: run.replacement.name + '\nPending', pos: p.replacementPending, size: [3.4, 1.3, 2], tone: 'peer', order: 4, hidden: true, hover: 'New Pod object with a new UID, created by the Deployment controller'});
  w.node('kubelet-a', {label: 'kubelet A', pos: [15, 0, 7], size: [3.5, 3, 2.4], tone: 'engine', order: 5, hover: 'Observes the terminating Pod and asks CRI to stop its containers'});
  w.node('runtime-a', {label: 'CRI runtime A', pos: [15, 0, 4.1], size: [3.7, 2.4, 2.3], tone: 'engine', order: 5, hover: 'Stops the terminating Pod containers gracefully'});
  w.node('kubelet-c', {label: 'kubelet C', pos: [15, 0, -7], size: [3.5, 3, 2.4], tone: 'engine', order: 5, hover: 'Starts the bound replacement Pod through CRI'});
  w.node('runtime-c', {label: 'CRI runtime C', pos: [15, 0, -4.1], size: [3.7, 2.4, 2.3], tone: 'engine', order: 5, hover: 'Creates the replacement containers'});
  w.region('CONTROL PLANE', -7, 0, 10); w.region('WORKERS', 9, 0, 10);
  w.cam([0, 0, 1], 43);
}; };
})();
