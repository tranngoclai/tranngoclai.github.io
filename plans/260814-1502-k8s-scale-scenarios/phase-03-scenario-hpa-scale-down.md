# Phase 03 — Scenario: HPA scale-down & stabilization

## Context Links

- Depends on: [phase-02](phase-02-scenario-hpa-scale-up.md) (model + world reuse)

## Overview

- **Priority:** P1
- **Status:** pending
- **Scenario id:** `hpa-scale-down` · tag `HPA`
- **Description:** Load drops from 6 replicas' worth to 2 replicas' worth. The
  HPA does **not** immediately drop to 2. Teaches the stabilization window and
  the `behavior` policy machinery.

## Key Insights

- Scale-down uses a **stabilization window** (default 300s, vs 0s for scale-up):
  the controller takes the **maximum** desired replica count observed across the
  window, so one quiet minute cannot shrink the deployment. The asymmetry —
  scale up fast, scale down slow — is deliberate and is the scenario's thesis.
- `behavior.scaleDown.policies` cap the *rate*: `type: Percent, value: 10,
  periodSeconds: 60` and `type: Pods, value: 4, periodSeconds: 60`.
  `selectPolicy: Min` (default for scale-down) picks the **most conservative**
  policy; `selectPolicy: Max` picks the fastest; `selectPolicy: Disabled`
  forbids scale-down entirely.
- The window and the policies compose: stabilization decides *what* the target
  may be, policies decide *how far* one reconcile may move toward it. Two
  separate limits, commonly confused as one.
- Scale-down still goes through the same ReplicaSet victim ordering as phase 01 —
  HPA does not choose which Pods die. Cross-reference that explicitly.

## Requirements

**Functional**
- Model extends phase 02's with `history[]` (desired-replica observations with
  timestamps), `stabilizationWindowSeconds`, `policies[]`, `selectPolicy`.
- `stabilizedTarget(history, now, windowSeconds)` → max over window.
- `policyLimit(current, policies, selectPolicy)` → allowed replica floor for this
  reconcile, plus which policy bound it.
- Result exposes the per-reconcile trace: t=0, t=60, t=120, … until settled.

**Non-functional**
- The trace is an ordered sequence proving one claim ("scale-down is rate
  limited") — implement as **beats inside one phase** where the trace exceeds
  600ms, per authoring rule 4, not as separate claims.

## Architecture

Same world as phase 02. Adds a timeline element: the reconcile trace is rendered
as HUD rows per beat, not as new components. Replica boxes retire in the order
the ReplicaSet controller would pick.

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-hpa-scale-down-steps.js`
- `k8s-flow-3d-scenario-hpa-scale-down.js`

**Modify**
- HPA model from phase 02 — add stabilization + policy functions
- `k8s-flow-3d/k8s-flow-3d.html`

## Implementation Steps

1. Extend the HPA model. Validate `stabilizationWindowSeconds >= 0`, each policy
   `value > 0` and `periodSeconds > 0`; `RangeError` otherwise.
2. Compute the reconcile trace deterministically from `history` — no wall clock.
3. Steps:
   - Ch.1 Load drops; the raw formula already says 2.
   - Ch.2 Stabilization holds the target at 6 because the window still contains
     the high observation. One phase, HUD shows window contents.
   - Ch.3 Window slides; target becomes 2, but the `Percent 10% / 60s` policy
     permits only one Pod this period. Beats: t=0 → t=60 → t=120 → settled.
   - Ch.4 `selectPolicy` variants: `Min` (default) vs `Max` vs `Disabled`,
     as a before/after comparison against the same workload.
   - Ch.5 Hand-off: which Pods die is phase 01's rule, not HPA's.
4. HUD: `Changed` observed metric · `Boundary` stabilized target + policy cap ·
   `Result` replicas this reconcile.

## Todo List

- [ ] Stabilization + policy functions in the HPA model
- [ ] Node assertions: window max, Min/Max/Disabled selection, per-period caps
- [ ] Steps ch.1–ch.5 with beats for the reconcile trace
- [ ] Playback controls verified for the >600ms trace
- [ ] Assembly + HTML band
- [ ] Browser walk

## Success Criteria

- The reconcile trace end state is deterministic and identical on replay.
- Stabilization and policy limits are visibly two separate rows in the HUD.
- No phase claims both "stabilization held it" and "policy capped it" at once.

## Risk Assessment

- **Two mechanisms in one scenario** — risk of a muddled phase. Mitigation:
  ch.2 and ch.3 must each hold the other mechanism constant and say so in
  `heldConstantInputs`.

## Security Considerations

None — static visualization.

## Next Steps

Phase 04 picks up where HPA stops: replicas exist but nothing can schedule them.
