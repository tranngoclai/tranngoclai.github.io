# Phase 07 — Scenario: KEDA event-driven scale & scale-to-zero

## Context Links

- Depends on: [phase-02](phase-02-scenario-hpa-scale-up.md) (KEDA drives an HPA)

## Overview

- **Priority:** P2 (Tier B)
- **Status:** pending
- **Scenario id:** `keda-scale-to-zero` · tag `KEDA`
- **Description:** A queue-backed consumer sits at **0 replicas**. Messages
  arrive; KEDA activates the workload; the HPA it created then handles 1→N.

## Key Insights

- KEDA does not replace the HPA — a `ScaledObject` **creates** an HPA whose
  metric is an `External` metric served by the KEDA metrics adapter. Everything
  phase 02 teaches still applies above 1 replica.
- The **0↔1 transition is KEDA's, not the HPA's**. A stock HPA cannot scale to
  or from zero (`minReplicas >= 1` without the alpha feature gate). KEDA's
  controller flips the workload between 0 and `minReplicaCount` directly.
- Two different thresholds, routinely conflated: `activationThreshold` decides
  0→1; the trigger's `threshold` feeds the HPA's target for 1→N. A queue depth
  above activation but below threshold gives exactly 1 replica.
- `cooldownPeriod` (default 300s) gates 1→0, on top of the HPA stabilization
  window that gates N→1. Two independent timers.
- Scale-to-zero means **cold start on every burst**: image pull + startup +
  readiness. The scenario should state the latency cost, not just the savings.

## Requirements

**Functional**
- Model: `{queueDepth[], activationThreshold, triggerThreshold, minReplicaCount,
  maxReplicaCount, cooldownSeconds, pollingIntervalSeconds}`.
- Returns per-poll trace: `{active, desiredByHpa, replicas, decidedBy}` where
  `decidedBy` is `keda-activation` | `hpa-formula` | `cooldown-hold`.
- Reuses `K8S_SCALE_MATH.desiredReplicas` for the 1→N segment — the point is
  that it is the same formula.

## Architecture

```
Queue (external) ─▶ KEDA scaler ─▶ KEDA metrics adapter ─▶ API Server (external.metrics.k8s.io)
                        │                                        │
                        │ 0↔1 direct                             ▼
                        └────────────────────────▶ Deployment ◀── HPA (created by ScaledObject)
```

KEDA operator on `Z.autoscale`; the queue as a `shape: 'rack'` component in the
`metrics` column (it is a buffer, and the shape vocabulary already has one).

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-keda-scale-to-zero-model.js`
- `k8s-flow-3d-scenario-keda-scale-to-zero-world.js`
- `k8s-flow-3d-scenario-keda-scale-to-zero-steps.js`
- `k8s-flow-3d-scenario-keda-scale-to-zero.js`

**Modify**
- `k8s-flow-3d/k8s-flow-3d.html`

## Implementation Steps

1. Model with per-poll deterministic trace; validate thresholds positive,
   `minReplicaCount <= maxReplicaCount`.
2. World: queue `rack` with `count` state driven by depth (absolute values only,
   per the shape-state rule); 0 visible Pods initially, N pre-declared hidden.
3. Steps:
   - Ch.1 Idle at zero — no Pods, HPA present but inert.
   - Ch.2 First message: depth crosses `activationThreshold`; KEDA sets
     replicas 1. Explicit claim: the HPA did not do this.
   - Ch.3 Cold start cost — image pull, readiness. One phase, stated duration
     with `illustrative` provenance.
   - Ch.4 Depth climbs; the HPA formula from phase 02 takes over 1→N.
   - Ch.5 Queue drains; HPA stabilization brings N→1; `cooldownPeriod` then
     brings 1→0. Two timers, two phases.
4. HUD: `Changed` queue depth · `Boundary` activation + trigger thresholds ·
   `Result` replicas and who decided.

## Todo List

- [ ] KEDA model + poll trace with `decidedBy`
- [ ] Node assertions: activation boundary, exactly-1 band, cooldown hold
- [ ] World with `rack` queue and hidden Pod slots
- [ ] Steps ch.1–ch.5
- [ ] Assembly + HTML band
- [ ] Browser walk

## Success Criteria

- Every phase names which controller made the change (KEDA vs HPA).
- The queue `rack` count state matches the model depth at every phase and the
  depth is also printed in text.
- The 1→N segment demonstrably reuses `K8S_SCALE_MATH`.

## Risk Assessment

- **Third-party version drift** — KEDA is not core k8s. Mitigation: tag the
  scenario `KEDA (add-on)`, pin claims to a stated version in the file header.

## Security Considerations

None — static visualization.

## Next Steps

Phase 08 covers the workload type where replica count is *not* interchangeable.
