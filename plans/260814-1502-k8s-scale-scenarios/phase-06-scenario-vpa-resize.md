# Phase 06 — Scenario: VPA vertical scaling

## Context Links

- Depends on: [phase-00](phase-00-shared-scale-scaffolding.md)
- Related: [phase-10](phase-10-scenario-inplace-pod-resize.md) (the restart-free
  alternative), deck's existing `oom-killer` scenario (why requests matter)

## Overview

- **Priority:** P1
- **Status:** pending
- **Scenario id:** `vpa-resize` · tag `VPA`
- **Description:** A Pod's memory request is far below its working set. VPA
  recommends a new request — and then has to **destroy the Pod** to apply it.

## Key Insights

- VPA is three components, not one: **recommender** (watches history, writes
  `status.recommendation`), **updater** (evicts Pods whose requests are outside
  the recommendation), **admission controller** (mutates the *new* Pod's requests
  on create). Nothing mutates a running Pod.
- Therefore `updateMode: Auto` means **planned Pod destruction**. Recommendation
  without disruption is `updateMode: Off` (recommendation only) or `Initial`
  (apply at creation only). This surprises people who expect resizing in place.
- The updater uses the **Eviction API**, so PDB applies. A Deployment with
  `minAvailable` equal to its replica count means VPA can never apply anything —
  it silently does nothing forever.
- HPA and VPA on the **same resource metric** fight: VPA lowers requests →
  utilisation-vs-request rises → HPA scales out → load per Pod drops → VPA
  lowers again. Supported combination is HPA on a custom/external metric with
  VPA on CPU/memory. Give this its own chapter.
- The recommendation is bounded by `minAllowed`/`maxAllowed` in the VPA's
  `resourcePolicy`, and by whether any Node can fit the new request at all — a
  too-large recommendation produces a Pending Pod, converting a vertical problem
  into the scheduler scenario's problem.

## Requirements

**Functional**
- Model config: `{pod:{requestMi, usageMi, limitMi}, history[], target: 'p90',
  minAllowed, maxAllowed, updateMode, pdb:{minAvailable, replicas},
  nodeAllocatableMi}`.
- Model returns `{recommendedMi, boundedBy, appliedBy, disruptionRequired,
  pdbAllows, fitsNode}` — including the "recommendation exists but cannot be
  applied" outcome.
- Reuse the memory formatter from the existing OOM model so `Mi` prints
  identically deck-wide.

**Non-functional**
- The resized Pod is a **new Pod object** (new UID). The world must retire the
  old box and reveal a pre-declared replacement, exactly like `pdb-drain` does.

## Architecture

```
metrics history ─▶ VPA recommender ─▶ VPA object (status.recommendation)
                                          │ read
                        VPA updater ──────┘  ──pods/eviction──▶ API Server
                                                                     │
                     new Pod create ──▶ VPA admission controller ──mutate requests──▶ scheduler
```

Three VPA components share `Z.autoscale`; the VPA object sits on `Z.store`
beside the PDB, since it is a stored policy object, not a process.

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-vpa-resize-model.js`
- `k8s-flow-3d-scenario-vpa-resize-world.js`
- `k8s-flow-3d-scenario-vpa-resize-steps.js`
- `k8s-flow-3d-scenario-vpa-resize.js`

**Modify**
- `k8s-flow-3d/k8s-flow-3d.html`

## Implementation Steps

1. Model: validate `minAllowed <= maxAllowed`, positive finite memory values;
   compute recommendation from history percentile, clamp, and report which bound
   applied. Determine `disruptionRequired` from `updateMode`.
2. World: recommender / updater / admission controller as three `SIZE.controller`
   boxes on `Z.autoscale`; VPA object as `SIZE.gate`, `shape: 'hex'` on
   `Z.store`; one Node with the subject Pod plus a hidden replacement Pod.
3. Steps:
   - Ch.1 The mismatch: request 256Mi, working set 900Mi — connect to the OOM
     scenario's consequence.
   - Ch.2 Recommender writes a recommendation; **nothing has changed yet**.
   - Ch.3 `updateMode: Off` — the end of the story for many clusters.
   - Ch.4 `updateMode: Auto` — updater calls Eviction API; PDB consulted; Pod
     terminates.
   - Ch.5 New Pod created; admission controller mutates requests; scheduler
     binds using the *new* request (may not fit — show the bound check).
   - Ch.6 HPA conflict: same-metric feedback loop, stated as a rule, not animated.
4. HUD: `Changed` request · `Boundary` min/max allowed + node allocatable ·
   `Result` applied / recommendation-only.

## Todo List

- [ ] VPA model with bounds, mode handling, PDB and node-fit outcomes
- [ ] Node assertions: clamp at min, clamp at max, blocked-by-PDB case
- [ ] World with three VPA components + stored VPA object
- [ ] Steps ch.1–ch.6
- [ ] Assembly + HTML band
- [ ] Browser walk

## Success Criteria

- The old Pod is retired and the new Pod is a distinct pre-declared box — no
  in-place mutation of the original box's label to the new request.
- Every memory figure comes from the model and prints via the shared formatter.
- The "recommendation exists but nothing applies it" outcome is reachable and
  visibly distinct from the applied outcome.

## Risk Assessment

- **VPA is an add-on, not core k8s** — versions and behaviour vary. Mitigation:
  mark the scenario tag `VPA (add-on)` and carry provenance on version-specific
  claims.
- **Scope creep into OOM** — the OOM consequence is already a scenario. One
  reference phase, no re-teaching.

## Security Considerations

None — static visualization.

## Next Steps

Tier A complete after this phase. Re-walk all six before starting Tier B.
