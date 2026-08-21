# Phase 10 — Scenario: in-place Pod vertical scaling

## Context Links

- Depends on: [phase-06](phase-06-scenario-vpa-resize.md) (the disruptive
  alternative it replaces)
- Related: deck's existing `oom-killer` and `kubelet-eviction` scenarios

## Overview

- **Priority:** P2 (Tier B)
- **Status:** pending
- **Scenario id:** `inplace-pod-resize` · tag `RESIZE`
- **Description:** Change a running Pod's CPU and memory **without recreating
  it**, via the `resize` subresource — and see the three ways it can refuse.

## Key Insights

- The `pods/resize` subresource patches `spec.containers[].resources` on a
  **running** Pod. The Pod keeps its UID, its node, and its containers. This is
  the mechanism VPA has always wanted (phase 06 evicts precisely because it did
  not exist).
- `resizePolicy` is **per resource, per container**: `restartPolicy:
  NotRequired` (default, applied live) or `RestartContainer`. Memory decrease
  commonly requires a container restart because the kernel cannot reliably
  shrink a live cgroup memory limit; CPU is adjusted live.
- The kubelet — not the scheduler — decides admission of the resize against the
  node's remaining allocatable, and reports the outcome in
  `status.conditions`:
  - `PodResizePending` with reason `Deferred` — cannot do it now, will retry.
  - `PodResizePending` with reason `Infeasible` — the node can never satisfy it;
    the resize is not retried and the Pod must be recreated elsewhere.
  - `PodResizeInProgress` while the change is being applied.
  Deferred vs Infeasible is the distinction that decides whether waiting helps.
- `status.containerStatuses[].allocatedResources` is what the node has actually
  granted; `spec` is only the request. When they disagree, the resize has not
  landed. Scheduler accounting follows the **allocated** value.
- Feature maturity varies by version (beta from 1.33, enabled by default), and
  QoS class **cannot change** via resize. Both need a stated-assumption badge.

## Requirements

**Functional**
- Model: `{pod:{cpuMilli, memMi, allocatedCpuMilli, allocatedMemMi},
  request:{cpuMilli, memMi}, resizePolicy:{cpu, memory},
  node:{allocatableCpuMilli, allocatableMemMi, usedByOthers…}}`.
- Returns `{admitted, condition: 'InProgress'|'Deferred'|'Infeasible',
  restartRequired[], allocatedAfter}` — all three conditions reachable from
  three configs.

## Architecture

Single Node, dissected (`SIZE.nodeDeep`) so the kernel row is available: kubelet
and CRI runtime on the agent row, the Pod and its cgroup on the pod/kernel rows —
reusing the existing OOM scenario's node anatomy so the viewer does not relearn it.

```
kubectl ──PATCH pods/resize──▶ API Server ──▶ kubelet (admission vs allocatable)
                                                  │ CRI UpdateContainerResources
                                                  ▼
                                             cgroup limits ──▶ status.allocatedResources
```

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-inplace-pod-resize-model.js`
- `k8s-flow-3d-scenario-inplace-pod-resize-world.js`
- `k8s-flow-3d-scenario-inplace-pod-resize-steps.js`
- `k8s-flow-3d-scenario-inplace-pod-resize.js`

**Modify**
- `k8s-flow-3d/k8s-flow-3d.html`

## Implementation Steps

1. Model: admission arithmetic against node allocatable; classify
   Deferred (would fit if other Pods shrink/leave) vs Infeasible (exceeds node
   allocatable outright). Validate all values finite and non-negative.
2. World: reuse the dissected-node layout constants; cgroup box on the kernel
   row with a `fill` state driven by the allocated/limit ratio.
3. Steps:
   - Ch.1 The subresource: same Pod, same UID — contrast with phase 06's
     evict-and-recreate in one phase.
   - Ch.2 CPU increase, `NotRequired`: kubelet admits → CRI updates cgroup →
     `allocatedResources` catches up. Show spec vs allocated diverging then
     converging.
   - Ch.3 Memory decrease with `RestartContainer`: the container restarts, the
     **Pod does not**. Restart count increments; identity preserved.
   - Ch.4 `Deferred`: node currently full; condition set, retry pending.
   - Ch.5 `Infeasible`: request exceeds node allocatable; no retry — the only
     fix is a new Pod on a different node, handing back to the scheduler
     scenario.
   - Ch.6 Limits: QoS class cannot change; feature-gate/version assumption badge.
4. HUD: `Changed` requested resources · `Boundary` node allocatable ·
   `Result` allocated + condition.

## Todo List

- [ ] Resize model with all three conditions
- [ ] Node assertions: Deferred vs Infeasible boundary, restart-required matrix
- [ ] World reusing the dissected-node anatomy + cgroup `fill` state
- [ ] Steps ch.1–ch.6
- [ ] Assembly + HTML band
- [ ] Browser walk

## Success Criteria

- The Pod box is never retired or replaced in any chapter — identity preserved
  across every resize outcome.
- `spec` vs `allocatedResources` are two separately readable HUD rows.
- Deferred and Infeasible are distinguishable from text alone.

## Risk Assessment

- **Version-dependent behaviour** — semantics moved between 1.27 alpha, 1.33
  beta and later. Mitigation: pin the version in the file header, badge every
  version-specific claim with provenance, avoid stating GA status.
- **Overlap with the OOM scenario's cgroup teaching** — reference, do not
  re-teach; one phase maximum on cgroup mechanics.

## Security Considerations

None — static visualization.

## Next Steps

Tier B complete. Re-walk all fifteen scenarios, then decide Tier C
(see [phase 11](phase-11-deferred-scale-catalog.md)).
