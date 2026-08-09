/* Linux OOM — resource-first deterministic teaching models.

   Every fact is declared before the journey runs:
   - resources: immutable Kubernetes/Linux configuration;
   - initialSnapshot: runtime state immediately before the allocation;
   - event: the allocation attempt and its owning process;
   - assumptions: kernel outcomes this lesson cannot truthfully derive from
     aggregate Mi arithmetic alone.

   World labels and steps consume the evaluated result. Actions never invent
   requests, limits, restart policy, cgroup mode, process role, or reclaim
   outcome after the fact. */
(function() {
  const OWN = Object.prototype.hasOwnProperty;

  function hasOwn(object, key) {
    return !!object && OWN.call(object, key);
  }

  function requiredObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(label + ' must be an object');
    }
    return value;
  }

  function requiredString(value, label) {
    if (typeof value !== 'string' || !value) throw new TypeError(label + ' must be a non-empty string');
    return value;
  }

  function finite(value, label) {
    if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite');
    return value;
  }

  function nonNegative(value, label) {
    finite(value, label);
    if (value < 0) throw new RangeError(label + ' must be non-negative');
    return value;
  }

  function positive(value, label) {
    nonNegative(value, label);
    if (value === 0) throw new RangeError(label + ' must be positive');
    return value;
  }

  function explicitQuantity(resourceList, key, label) {
    requiredObject(resourceList, label);
    if (!hasOwn(resourceList, key)) throw new TypeError(label + '.' + key + ' must be explicit');
    const value = resourceList[key];
    if (value === null) return null;
    return positive(value, label + '.' + key);
  }

  function fmtMi(value) {
    return value >= 1024 && value % 1024 === 0 ? (value / 1024) + 'Gi' : value + 'Mi';
  }

  function fmtCpu(value) {
    if (value === null) return 'none';
    return value % 1000 === 0 ? (value / 1000).toString() : value + 'm';
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function(key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function uniqueByKey(items, label) {
    if (!Array.isArray(items) || !items.length) throw new TypeError(label + ' must be a non-empty array');
    const byKey = {};
    items.forEach(function(item) {
      requiredObject(item, label + '[]');
      const key = requiredString(item.key, label + '[].key');
      if (byKey[key]) throw new TypeError(label + ' contains duplicate key ' + key);
      byKey[key] = item;
    });
    return byKey;
  }

  function validateContainerResources(container, label) {
    requiredString(container.key, label + '.key');
    const resources = requiredObject(container.resources, label + '.resources');
    const requests = requiredObject(resources.requests, label + '.resources.requests');
    const limits = requiredObject(resources.limits, label + '.resources.limits');
    return {
      requests: {
        cpuMilli: explicitQuantity(requests, 'cpuMilli', label + '.resources.requests'),
        memoryMi: explicitQuantity(requests, 'memoryMi', label + '.resources.requests')
      },
      limits: {
        cpuMilli: explicitQuantity(limits, 'cpuMilli', label + '.resources.limits'),
        memoryMi: explicitQuantity(limits, 'memoryMi', label + '.resources.limits')
      }
    };
  }

  function derivePodQos(pod) {
    requiredObject(pod, 'pod');
    requiredString(pod.key, 'pod.key');
    if (hasOwn(pod, 'qos') || hasOwn(pod, 'qosClass')) {
      throw new TypeError(pod.key + '.qos must be derived, not authored');
    }
    if (!Array.isArray(pod.containers) || !pod.containers.length) {
      throw new TypeError(pod.key + '.containers must be a non-empty array');
    }

    let anySpecified = false;
    let everyContainerGuaranteed = true;
    pod.containers.forEach(function(container, index) {
      const r = validateContainerResources(container, pod.key + '.containers[' + index + ']');
      const values = [r.requests.cpuMilli, r.requests.memoryMi, r.limits.cpuMilli, r.limits.memoryMi];
      if (values.some(function(value) { return value !== null; })) anySpecified = true;
      const guaranteed = values.every(function(value) { return value !== null; })
        && r.requests.cpuMilli === r.limits.cpuMilli
        && r.requests.memoryMi === r.limits.memoryMi;
      if (!guaranteed) everyContainerGuaranteed = false;
    });

    if (!anySpecified) return 'BestEffort';
    return everyContainerGuaranteed ? 'Guaranteed' : 'Burstable';
  }

  function burstableAdj(requestMi, nodeCapacityMi) {
    const request = requestMi === null ? 0 : nonNegative(requestMi, 'requestMi');
    return Math.min(999, Math.max(2, Math.floor(1000 - (1000 * request / positive(nodeCapacityMi, 'nodeCapacityMi')))));
  }

  function oomScoreAdj(qosClass, memoryRequestMi, nodeCapacityMi, systemCritical) {
    if (systemCritical === true || qosClass === 'Guaranteed') return -997;
    if (qosClass === 'BestEffort') return 1000;
    if (qosClass === 'Burstable') return burstableAdj(memoryRequestMi, nodeCapacityMi);
    throw new TypeError('qosClass must be derived before oom_score_adj');
  }

  function validateRestartPolicy(value, label) {
    if (value !== 'Always' && value !== 'OnFailure' && value !== 'Never') {
      throw new TypeError(label + ' must be Always, OnFailure, or Never');
    }
    return value;
  }

  function evaluateResources(resources) {
    requiredObject(resources, 'resources');
    const node = requiredObject(resources.node, 'resources.node');
    requiredString(node.key, 'resources.node.key');
    const nodeCapacityMi = positive(node.memoryCapacityMi, 'resources.node.memoryCapacityMi');
    if (node.cgroupVersion !== 'v2') throw new TypeError('resources.node.cgroupVersion must be v2');

    const podsByKey = uniqueByKey(resources.pods, 'resources.pods');
    const pods = resources.pods.map(function(pod) {
      requiredString(pod.name, pod.key + '.name');
      requiredString(pod.uid, pod.key + '.uid');
      const restartPolicy = validateRestartPolicy(pod.restartPolicy, pod.key + '.restartPolicy');
      const containersByKey = uniqueByKey(pod.containers, pod.key + '.containers');
      const containers = pod.containers.map(function(container, index) {
        const normalized = validateContainerResources(container, pod.key + '.containers[' + index + ']');
        requiredString(container.name, container.key + '.name');
        requiredString(container.cgroupKey, container.key + '.cgroupKey');
        return Object.assign({}, container, {resources: normalized});
      });
      return Object.assign({}, pod, {
        restartPolicy: restartPolicy,
        qosClass: derivePodQos(pod),
        containers: containers,
        containersByKey: containersByKey
      });
    });

    return {
      node: node,
      nodeCapacityMi: nodeCapacityMi,
      kubelet: resources.kubelet || null,
      pods: pods,
      podsByKey: podsByKey
    };
  }

  function processFootprint(process, label) {
    return nonNegative(process.rssMi, label + '.rssMi')
      + nonNegative(process.swapMi, label + '.swapMi')
      + nonNegative(process.pageTablesMi, label + '.pageTablesMi');
  }

  function findEvaluatedPod(evaluated, key) {
    return evaluated.pods.find(function(pod) { return pod.key === key; }) || null;
  }

  function findContainer(pod, key) {
    return pod && pod.containers.find(function(container) { return container.key === key; }) || null;
  }

  function validateOutcome(config, scope) {
    const assumptions = requiredObject(config.assumptions, 'assumptions');
    const outcome = requiredObject(assumptions.allocationOutcome, 'assumptions.allocationOutcome');
    if (typeof outcome.reclaimSatisfiedAllocation !== 'boolean') {
      throw new TypeError('assumptions.allocationOutcome.reclaimSatisfiedAllocation must be explicit');
    }
    if (typeof outcome.oomEntered !== 'boolean') {
      throw new TypeError('assumptions.allocationOutcome.oomEntered must be explicit');
    }
    if (outcome.oomScope !== scope) throw new TypeError('assumptions.allocationOutcome.oomScope must be ' + scope);
    if (outcome.reclaimSatisfiedAllocation && outcome.oomEntered) {
      throw new RangeError('OOM cannot be entered when reclaim satisfied the allocation');
    }
    return {assumptions: assumptions, outcome: outcome};
  }

  function restartDecision(containerTerminated, restartPolicy) {
    return containerTerminated && (restartPolicy === 'Always' || restartPolicy === 'OnFailure');
  }

  function simulateContainer(config) {
    const evaluated = evaluateResources(config.resources);
    if (evaluated.pods.length !== 1 || evaluated.pods[0].containers.length !== 1) {
      throw new TypeError('container OOM lesson requires exactly one Pod and one container');
    }
    const kubelet = requiredObject(evaluated.kubelet, 'resources.kubelet');
    if (typeof kubelet.singleProcessOOMKill !== 'boolean') {
      throw new TypeError('resources.kubelet.singleProcessOOMKill must be explicit');
    }

    const snapshot = requiredObject(config.initialSnapshot, 'initialSnapshot');
    const instancesByKey = uniqueByKey(snapshot.containerInstances, 'initialSnapshot.containerInstances');
    const cgroupsByKey = uniqueByKey(snapshot.cgroups, 'initialSnapshot.cgroups');
    const processesByKey = uniqueByKey(snapshot.processes, 'initialSnapshot.processes');
    const event = requiredObject(config.event, 'event');
    if (event.type !== 'memory-allocation' || event.scope !== 'memcg') {
      throw new TypeError('event must be a memcg memory-allocation');
    }
    const allocationMi = nonNegative(event.allocationMi, 'event.allocationMi');
    const process = processesByKey[requiredString(event.actorProcessKey, 'event.actorProcessKey')];
    if (!process) throw new TypeError('event.actorProcessKey must reference an initial process');
    if (process.role !== 'container-init' && process.role !== 'child') {
      throw new TypeError(process.key + '.role must be container-init or child');
    }
    if (typeof process.killable !== 'boolean') throw new TypeError(process.key + '.killable must be explicit');
    const instance = instancesByKey[requiredString(process.containerInstanceKey, process.key + '.containerInstanceKey')];
    if (!instance) throw new TypeError(process.key + ' must reference a container instance');
    const pod = findEvaluatedPod(evaluated, instance.podKey);
    const container = findContainer(pod, instance.containerKey);
    if (!pod || !container) throw new TypeError(instance.key + ' must reference a configured Pod/container');
    const cgroup = cgroupsByKey[container.cgroupKey];
    if (!cgroup) throw new TypeError(container.key + ' must reference an initial cgroup');
    const memoryCurrentMi = nonNegative(cgroup.memoryCurrentMi, cgroup.key + '.memoryCurrentMi');
    const memoryMaxMi = positive(cgroup.memoryMaxMi, cgroup.key + '.memoryMaxMi');
    const memoryLimitMi = container.resources.limits.memoryMi;
    if (memoryLimitMi === null || memoryLimitMi !== memoryMaxMi) {
      throw new RangeError(cgroup.key + '.memoryMaxMi must equal the container memory limit');
    }
    const expectedOomGroup = kubelet.singleProcessOOMKill ? 0 : 1;
    if (cgroup.memoryOomGroup !== expectedOomGroup) {
      throw new RangeError(cgroup.key + '.memoryOomGroup contradicts singleProcessOOMKill');
    }

    const premise = validateOutcome(config, 'memcg');
    const projectedMi = memoryCurrentMi + allocationMi;
    const memcgOomEntered = premise.outcome.oomEntered;
    const victim = memcgOomEntered && process.killable ? process : null;
    const containerTerminated = !!victim && (victim.role === 'container-init' || cgroup.memoryOomGroup === 1);
    const runtime = requiredObject(premise.assumptions.runtime, 'assumptions.runtime');
    if (typeof runtime.recordsOomTerminationEvidence !== 'boolean') {
      throw new TypeError('assumptions.runtime.recordsOomTerminationEvidence must be explicit');
    }

    return {
      resources: config.resources,
      initialSnapshot: config.initialSnapshot,
      event: event,
      assumptions: config.assumptions,
      node: evaluated.node,
      pod: pod,
      container: container,
      instance: instance,
      cgroup: Object.assign({}, cgroup, {memoryCurrentMi: memoryCurrentMi, memoryMaxMi: memoryMaxMi}),
      process: Object.assign({}, process, {
        footprintMi: processFootprint(process, process.key),
        oomScoreAdj: oomScoreAdj(pod.qosClass, container.resources.requests.memoryMi, evaluated.nodeCapacityMi, pod.systemCritical)
      }),
      charge: {
        allocationMi: allocationMi,
        projectedMi: projectedMi,
        exceedsMemoryMax: projectedMi > memoryMaxMi,
        excessMi: Math.max(0, projectedMi - memoryMaxMi),
        reclaimSatisfiedAllocation: premise.outcome.reclaimSatisfiedAllocation,
        memcgOomEntered: memcgOomEntered
      },
      victim: victim,
      containerTerminated: containerTerminated,
      runtimeReportsOomKilled: containerTerminated && runtime.recordsOomTerminationEvidence,
      shouldRestart: restartDecision(containerTerminated, pod.restartPolicy)
    };
  }

  function simulateNodeWide(config) {
    const evaluated = evaluateResources(config.resources);
    const snapshot = requiredObject(config.initialSnapshot, 'initialSnapshot');
    const instancesByKey = uniqueByKey(snapshot.containerInstances, 'initialSnapshot.containerInstances');
    const processesByKey = uniqueByKey(snapshot.processes, 'initialSnapshot.processes');
    const domain = requiredObject(snapshot.allocationDomain, 'initialSnapshot.allocationDomain');
    const totalPagesMi = positive(domain.totalPagesMi, 'initialSnapshot.allocationDomain.totalPagesMi');
    const candidateKeys = domain.candidateProcessKeys;
    if (!Array.isArray(candidateKeys) || !candidateKeys.length) {
      throw new TypeError('initialSnapshot.allocationDomain.candidateProcessKeys must be non-empty');
    }
    if (new Set(candidateKeys).size !== candidateKeys.length) {
      throw new TypeError('initialSnapshot.allocationDomain.candidateProcessKeys must be unique');
    }
    const availableAfterReclaimMi = nonNegative(snapshot.availableAfterReclaimMi, 'initialSnapshot.availableAfterReclaimMi');
    const nonCandidateMemoryMi = nonNegative(snapshot.nonCandidateMemoryMi, 'initialSnapshot.nonCandidateMemoryMi');

    const event = requiredObject(config.event, 'event');
    if (event.type !== 'memory-allocation' || event.scope !== 'node') {
      throw new TypeError('event must be a node memory-allocation');
    }
    const allocationMi = nonNegative(event.allocationMi, 'event.allocationMi');
    const sourceProcess = processesByKey[requiredString(event.actorProcessKey, 'event.actorProcessKey')];
    if (!sourceProcess) throw new TypeError('event.actorProcessKey must reference an initial process');

    const premise = validateOutcome(config, 'global');
    const rankingAssumption = requiredObject(premise.assumptions.ranking, 'assumptions.ranking');
    if (rankingAssumption.model !== 'linux-normalized-teaching-approximation') {
      throw new TypeError('assumptions.ranking.model must identify the teaching approximation');
    }
    if (rankingAssumption.candidateSetCompleteForLesson !== true) {
      throw new TypeError('assumptions.ranking.candidateSetCompleteForLesson must be true');
    }

    const candidates = candidateKeys.map(function(key) {
      const process = processesByKey[key];
      if (!process) throw new TypeError('candidate ' + key + ' must reference an initial process');
      if (process.role !== 'container-init' && process.role !== 'child') {
        throw new TypeError(process.key + '.role must be container-init or child');
      }
      if (typeof process.killable !== 'boolean') throw new TypeError(process.key + '.killable must be explicit');
      const instance = instancesByKey[requiredString(process.containerInstanceKey, process.key + '.containerInstanceKey')];
      if (!instance) throw new TypeError(process.key + ' must reference a container instance');
      const pod = findEvaluatedPod(evaluated, instance.podKey);
      const container = findContainer(pod, instance.containerKey);
      if (!pod || !container) throw new TypeError(instance.key + ' must reference a configured Pod/container');
      const footprintMi = processFootprint(process, process.key);
      const adj = oomScoreAdj(pod.qosClass, container.resources.requests.memoryMi, evaluated.nodeCapacityMi, pod.systemCritical);
      return {
        key: process.key,
        name: process.name,
        podKey: pod.key,
        podName: pod.name,
        containerKey: container.key,
        instanceKey: instance.key,
        role: process.role,
        killable: process.killable,
        qosClass: pod.qosClass,
        restartPolicy: pod.restartPolicy,
        usageMi: footprintMi,
        footprintMi: footprintMi,
        memoryRequestMi: container.resources.requests.memoryMi,
        memoryLimitMi: container.resources.limits.memoryMi,
        oomScoreAdj: adj,
        badnessProjection: (footprintMi / totalPagesMi) * 1000 + adj
      };
    });

    const accountedMi = candidates.reduce(function(total, candidate) { return total + candidate.footprintMi; }, 0)
      + nonCandidateMemoryMi + availableAfterReclaimMi;
    if (accountedMi !== evaluated.nodeCapacityMi) {
      throw new RangeError('initial node memory snapshot must account for node capacity');
    }

    const ranking = candidates.filter(function(candidate) { return candidate.killable && candidate.oomScoreAdj > -1000; })
      .slice().sort(function(a, b) {
        if (b.badnessProjection !== a.badnessProjection) return b.badnessProjection - a.badnessProjection;
        if (b.footprintMi !== a.footprintMi) return b.footprintMi - a.footprintMi;
        return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
      });
    const globalOomEntered = premise.outcome.oomEntered;
    const victim = globalOomEntered ? (ranking[0] || null) : null;
    const victimProcess = victim ? processesByKey[victim.key] : null;
    const victimInstance = victim ? instancesByKey[victim.instanceKey] : null;
    const victimPod = victim ? findEvaluatedPod(evaluated, victim.podKey) : null;
    const containerTerminated = !!victimProcess && victimProcess.role === 'container-init';
    const runtime = requiredObject(premise.assumptions.runtime, 'assumptions.runtime');
    if (typeof runtime.recordsOomTerminationEvidence !== 'boolean') {
      throw new TypeError('assumptions.runtime.recordsOomTerminationEvidence must be explicit');
    }

    return {
      resources: config.resources,
      initialSnapshot: config.initialSnapshot,
      event: event,
      assumptions: config.assumptions,
      node: evaluated.node,
      pods: evaluated.pods,
      candidates: candidates,
      ranking: ranking,
      rankingModel: rankingAssumption.model,
      sourceProcess: sourceProcess,
      globalOomEntered: globalOomEntered,
      victim: victim,
      victimProcess: victimProcess,
      victimInstance: victimInstance,
      victimPod: victimPod,
      containerTerminated: containerTerminated,
      runtimeReportsOomKilled: containerTerminated && runtime.recordsOomTerminationEvidence,
      shouldRestart: !!victimPod && restartDecision(containerTerminated, victimPod.restartPolicy),
      allocationMi: allocationMi,
      allocationShortfallMi: Math.max(0, allocationMi - availableAfterReclaimMi)
    };
  }

  const DEFAULT_CONTAINER_CONFIG = deepFreeze({
    resources: {
      node: {key: 'worker-a', memoryCapacityMi: 8192, cgroupVersion: 'v2'},
      kubelet: {singleProcessOOMKill: true},
      pods: [{
        key: 'burstable', name: 'Burstable Pod', uid: 'pod-oom-container-1', restartPolicy: 'Always',
        containers: [{
          key: 'app-container', name: 'app', cgroupKey: 'app-cgroup',
          resources: {
            requests: {cpuMilli: null, memoryMi: 128},
            limits: {cpuMilli: null, memoryMi: 1024}
          }
        }]
      }]
    },
    initialSnapshot: {
      containerInstances: [{key: 'app-instance-1', podKey: 'burstable', containerKey: 'app-container', state: 'Running', restartCount: 0}],
      cgroups: [{key: 'app-cgroup', memoryCurrentMi: 960, memoryMaxMi: 1024, memoryOomGroup: 0}],
      processes: [{key: 'app-process-1', name: 'app process #1', containerInstanceKey: 'app-instance-1', role: 'container-init', killable: true, rssMi: 960, swapMi: 0, pageTablesMi: 0}]
    },
    event: {key: 'app-allocation-1', type: 'memory-allocation', scope: 'memcg', actorProcessKey: 'app-process-1', allocationMi: 128},
    assumptions: {
      allocationOutcome: {reclaimSatisfiedAllocation: false, oomEntered: true, oomScope: 'memcg'},
      runtime: {recordsOomTerminationEvidence: true}
    }
  });

  const DEFAULT_NODE_WIDE_CONFIG = deepFreeze({
    resources: {
      node: {key: 'worker-a', memoryCapacityMi: 8192, cgroupVersion: 'v2'},
      pods: [
        {
          key: 'best-effort', name: 'BestEffort Pod', uid: 'pod-best-effort-1', restartPolicy: 'Always',
          containers: [{
            key: 'worker-container', name: 'worker', cgroupKey: 'worker-cgroup',
            resources: {requests: {cpuMilli: null, memoryMi: null}, limits: {cpuMilli: null, memoryMi: null}}
          }]
        },
        {
          key: 'burstable', name: 'Burstable Pod', uid: 'pod-burstable-1', restartPolicy: 'Always',
          containers: [{
            key: 'app-container', name: 'app', cgroupKey: 'burstable-cgroup',
            resources: {requests: {cpuMilli: null, memoryMi: 128}, limits: {cpuMilli: null, memoryMi: 2048}}
          }]
        },
        {
          key: 'guaranteed', name: 'Guaranteed Pod', uid: 'pod-guaranteed-1', restartPolicy: 'Always',
          containers: [{
            key: 'api-container', name: 'api', cgroupKey: 'api-cgroup',
            resources: {requests: {cpuMilli: 1000, memoryMi: 1024}, limits: {cpuMilli: 1000, memoryMi: 1024}}
          }]
        }
      ]
    },
    initialSnapshot: {
      containerInstances: [
        {key: 'worker-instance-1', podKey: 'best-effort', containerKey: 'worker-container', state: 'Running', restartCount: 0},
        {key: 'app-instance-1', podKey: 'burstable', containerKey: 'app-container', state: 'Running', restartCount: 0},
        {key: 'api-instance-1', podKey: 'guaranteed', containerKey: 'api-container', state: 'Running', restartCount: 0}
      ],
      processes: [
        {key: 'best-effort-process', name: 'worker process', containerInstanceKey: 'worker-instance-1', role: 'container-init', killable: true, rssMi: 512, swapMi: 0, pageTablesMi: 0},
        {key: 'burstable-process', name: 'app process', containerInstanceKey: 'app-instance-1', role: 'container-init', killable: true, rssMi: 1536, swapMi: 0, pageTablesMi: 0},
        {key: 'guaranteed-process', name: 'api process', containerInstanceKey: 'api-instance-1', role: 'container-init', killable: true, rssMi: 768, swapMi: 0, pageTablesMi: 0}
      ],
      allocationDomain: {key: 'worker-a-global', totalPagesMi: 8192, candidateProcessKeys: ['best-effort-process', 'burstable-process', 'guaranteed-process']},
      availableAfterReclaimMi: 32,
      nonCandidateMemoryMi: 5344
    },
    event: {key: 'node-allocation-1', type: 'memory-allocation', scope: 'node', actorProcessKey: 'burstable-process', allocationMi: 256},
    assumptions: {
      allocationOutcome: {reclaimSatisfiedAllocation: false, oomEntered: true, oomScope: 'global'},
      ranking: {model: 'linux-normalized-teaching-approximation', candidateSetCompleteForLesson: true, deterministicTieBreak: 'key'},
      runtime: {recordsOomTerminationEvidence: true}
    }
  });

  window.OOM_KILLER_MODEL = {
    fmtMi: fmtMi,
    fmtCpu: fmtCpu,
    derivePodQos: derivePodQos,
    burstableAdj: burstableAdj,
    simulateContainer: simulateContainer,
    simulateNodeWide: simulateNodeWide,
    DEFAULT_CONTAINER_CONFIG: DEFAULT_CONTAINER_CONFIG,
    DEFAULT_NODE_WIDE_CONFIG: DEFAULT_NODE_WIDE_CONFIG,
    simulate: simulateContainer,
    DEFAULT_CONFIG: DEFAULT_CONTAINER_CONFIG
  };
})();
