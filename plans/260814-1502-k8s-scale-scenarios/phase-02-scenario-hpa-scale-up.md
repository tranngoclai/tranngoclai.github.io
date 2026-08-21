# Phase 02 — Scenario: HPA scale-up

## Context Links

- Depends on: [phase-00](phase-00-shared-scale-scaffolding.md),
  [phase-01](phase-01-scenario-manual-scale.md)
- Blocks: [phase-03](phase-03-scenario-hpa-scale-down.md),
  [phase-07](phase-07-scenario-keda-scale-to-zero.md)
- `K8S_SCALE_MATH` from phase 00

## Overview

- **Priority:** P0
- **Status:** pending
- **Scenario id:** `hpa-scale-up` · tag `HPA`
- **Description:** CPU utilisation rises on a 3-replica Deployment; the HPA
  controller computes a new replica count and writes it through the same scale
  subresource phase 01 established.

## Key Insights

- The formula is the whole lesson:
  `desired = ceil(current * (currentMetric / targetMetric))`, where
  `currentMetric` for `type: Resource` + `averageUtilization` is **usage as a
  percentage of the Pod's CPU *request***, not of the node and not of the limit.
  A Pod with no CPU request makes the HPA metric undefined.
- The **10% tolerance** (`--horizontal-pod-autoscaler-tolerance`, default `0.1`)
  suppresses the whole scaling action when the ratio lands in `0.9..1.1`. Users
  routinely read this as a broken HPA.
- Pods that are **unready or still in the initialization window** are excluded
  from the average; a Pod with a missing metric is treated pessimistically
  (assumed 0% when scaling up). This is why an HPA can look "stuck" right after
  a previous scale-up.
- HPA reconciles on a **15s period** against a metrics pipeline that is itself
  lagging (metrics-server default resolution 15s, kubelet cAdvisor window ~10s).
  The observed metric is always old. State this explicitly — it is the cause of
  most over-scaling complaints.
- HPA writes replicas; it never talks to the scheduler, never picks a node, and
  cannot help if the resulting Pods are unschedulable (that hand-off is phase 04).

## Requirements

**Functional**
- Model config: `{replicas: 3, targetUtilPct: 50, requestMilli: 200, pods: [...]}`
  with per-Pod `usageMilli`, `ready`, `initializing`.
- Model computes: per-Pod utilisation, eligible-Pod average, ratio, tolerance
  verdict, raw desired, clamped desired (`minReplicas`/`maxReplicas`).
- A second config run demonstrating the **tolerance no-op** case, so the same
  scenario shows both "acts" and "declines to act" from the same model.

**Non-functional**
- All arithmetic via `K8S_SCALE_MATH`; the model owns unit conversion and
  formatting.

## Architecture

```
kubelet/cAdvisor ─▶ metrics-server ─▶ API Server (metrics.k8s.io)
                                          │  watch
                                          ▼
                                   HPA controller ──PATCH scale──▶ Deployment
                                                                      ▼
                                                         ReplicaSet ▶ new Pods
```

Columns: `metrics` (metrics-server, from phase 00) · `core` API Server ·
`control` HPA controller on `Z.autoscale`, Deployment/RS on `Z.workload` ·
`queue` · `node`.

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-hpa-scale-up-model.js` (shared with phase 03 —
  name it `...-hpa-model.js` if phase 03 confirms full reuse)
- `k8s-flow-3d-scenario-hpa-world.js` (shared world, both directions)
- `k8s-flow-3d-scenario-hpa-scale-up-steps.js`
- `k8s-flow-3d-scenario-hpa-scale-up.js`

**Modify**
- `k8s-flow-3d/k8s-flow-3d.html`

## Implementation Steps

1. Model: validate `targetUtilPct > 0`, `requestMilli > 0`, `minReplicas <=
   maxReplicas`; throw on non-finite. Return a frozen result carrying
   `perPod[]`, `eligible[]`, `excluded[]` (with exclusion reason),
   `avgUtilPct`, `ratio`, `toleranceVerdict`, `desiredRaw`, `desiredClamped`.
2. World: metrics-server as `SIZE.metrics` on the metrics column; HPA controller
   as `SIZE.controller`, `shape: 'hex'` (it is a policy evaluator) on
   `Z.autoscale`; six Pod slots, three visible.
3. Steps:
   - Ch.1 Observation: cAdvisor → metrics-server → API Server. One phase per hop.
   - Ch.2 Decision: HPA reads metric → excludes unready/initializing Pods (one
     phase, showing the excluded box marked `historical`) → computes ratio →
     tolerance check → clamps to bounds.
   - Ch.3 Action: PATCH scale → RS creates Pods → scheduler binds → Ready.
   - Ch.4 The no-op: replay the same claim with the second config where the
     ratio is 1.06; HPA declines. Same camera, same workload — the guide's
     before/after ghost rule.
4. HUD every phase: `Changed` (avg utilisation), `Boundary` (target + tolerance
   band), `Result` (desired replicas).
5. Assembly, pipeline: Observe · Aggregate · Compute · Tolerance · Apply.

## Todo List

- [ ] HPA model with exclusion reasons and tolerance verdict
- [ ] Node assertions: ratio, ceil behaviour, tolerance boundary at exactly 1.1
- [ ] Shared HPA world (metrics column + autoscale band)
- [ ] Steps ch.1–ch.4
- [ ] Assembly + HTML band
- [ ] Browser walk

## Success Criteria

- Panel utilisation percentages, HUD gauge and Pod labels agree to the digit.
- The tolerance no-op chapter visibly changes nothing in the world except the
  verdict badge — proving the HUD, not the animation, carries the claim.
- Excluded Pods are identifiable as excluded from text alone, not colour.

## Risk Assessment

- **Tolerance default drift** — configurable per-cluster and moving to a
  per-HPA field upstream. Mitigation: read tolerance from model config and print
  it as a stated assumption with provenance, per authoring guide §3a.
- **Scenario tries to teach the whole metrics pipeline** — cAdvisor internals are
  out of scope. Keep ch.1 to three phases.

## Security Considerations

None — static visualization.

## Next Steps

Phase 03 reuses this model and world for the scale-down direction.
