# Phase 09 — Scenario: rolling update surge (`maxSurge` / `maxUnavailable`)

## Context Links

- Depends on: [phase-01](phase-01-scenario-manual-scale.md) (replica arithmetic,
  Deployment → ReplicaSet hops)
- Related: [phase-02](phase-02-scenario-hpa-scale-up.md) (both write replicas)

## Overview

- **Priority:** P2 (Tier B)
- **Status:** pending
- **Scenario id:** `rollout-surge` · tag `ROLLOUT`
- **Description:** A rolling update on 4 replicas. Pod count temporarily exceeds
  `spec.replicas` and available count temporarily falls below it — scaling that
  nobody asked for, driven by two knobs most teams never touch.

## Key Insights

- During a rollout the Deployment runs **two** ReplicaSets and the totals are
  bounded by: `total pods <= replicas + maxSurge` and
  `available pods >= replicas - maxUnavailable`. Both default to 25%, rounded
  **up** for surge and **down** for unavailable.
- `maxUnavailable: 0` + `maxSurge: 1` is a zero-downtime rollout that needs
  spare cluster capacity; if the surge Pod cannot schedule, the rollout stalls
  forever with no error — it hands straight into the Cluster Autoscaler
  scenario (phase 04). Worth one explicit phase.
- `maxSurge: 0` + `maxUnavailable: 1` is the opposite trade: no extra capacity
  needed, guaranteed reduced serving capacity.
- HPA and the rollout **both write replicas**, on different objects: HPA on the
  Deployment's scale subresource, the Deployment controller on each ReplicaSet.
  They do not conflict, but a scale event mid-rollout redistributes across both
  ReplicaSets proportionally — one phase, stated as a rule.
- `progressDeadlineSeconds` (default 600) is what eventually marks a stalled
  rollout `ProgressDeadlineExceeded`; it does **not** roll back automatically.

## Requirements

**Functional**
- Model: `{replicas, maxSurge, maxUnavailable, steps[]}` where each step is a
  reconcile producing `{oldRs, newRs, total, available, boundedBy}`.
- Percentage inputs resolved to counts with the correct rounding direction; the
  model must expose the rounding so the prose can state it.
- A stalled variant where the surge Pod is unschedulable.

## Architecture

Reuses phase 01's world with a second ReplicaSet box on `Z.workload` and 6 Pod
slots (4 + surge headroom), split visually old-version vs new-version by tone.

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-rollout-surge-model.js`
- `k8s-flow-3d-scenario-rollout-surge-world.js`
- `k8s-flow-3d-scenario-rollout-surge-steps.js`
- `k8s-flow-3d-scenario-rollout-surge.js`

**Modify**
- `k8s-flow-3d/k8s-flow-3d.html`

## Implementation Steps

1. Model: resolve percentages (`ceil` for surge, `floor` for unavailable),
   validate that not both resolve to 0 (`RangeError` — that configuration can
   never progress), emit the reconcile sequence to completion.
2. World: old ReplicaSet Pods `peer` tone, new ReplicaSet Pods `subject` tone;
   two surge slots hidden.
3. Steps:
   - Ch.1 The two bounds and how the percentages round.
   - Ch.2 Reconcile trace to completion — beats inside one phase, since the
     whole trace proves one claim (the bounds are never violated).
   - Ch.3 `maxUnavailable: 0` variant: the surge Pod cannot schedule; rollout
     stalls; `progressDeadlineSeconds` fires. Hand-off to phase 04.
   - Ch.4 `maxSurge: 0` variant: capacity dips instead. Before/after with the
     same workload and camera.
   - Ch.5 HPA-during-rollout rule.
4. HUD: `Changed` new-version Pods · `Boundary` surge ceiling / availability
   floor · `Result` total and available.

## Todo List

- [ ] Rollout model with rounding, bounds and stalled variant
- [ ] Node assertions: 25% rounding both directions, both-zero rejection
- [ ] World with two ReplicaSets and surge slots
- [ ] Steps ch.1–ch.5
- [ ] Assembly + HTML band
- [ ] Browser walk

## Success Criteria

- At no phase does the visible Pod count exceed `replicas + maxSurge` or the
  available count fall below `replicas - maxUnavailable`; the model asserts this
  as an invariant and the HUD shows both bounds.
- Old-version and new-version Pods are distinguishable from label text, not tone
  alone.

## Risk Assessment

- **"Is this even scaling?"** — a fair objection; it is replica arithmetic, not
  demand-driven scaling. Mitigation: the scenario tag is `ROLLOUT`, and the
  panel frames it as "replica count moves for a reason that is not load".

## Security Considerations

None — static visualization.

## Next Steps

Phase 10 closes the vertical axis that phase 06 opened.
