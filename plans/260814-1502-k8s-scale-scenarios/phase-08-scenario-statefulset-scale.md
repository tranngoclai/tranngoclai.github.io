# Phase 08 — Scenario: StatefulSet scale

## Context Links

- Depends on: [phase-01](phase-01-scenario-manual-scale.md) (contrast: ReplicaSet
  victim ordering vs StatefulSet ordinal ordering)

## Overview

- **Priority:** P2 (Tier B)
- **Status:** pending
- **Scenario id:** `statefulset-scale` · tag `STS`
- **Description:** Scale a 3-replica StatefulSet to 5 and back to 2. Replicas
  are **not** interchangeable, so both directions are strictly ordered — and the
  PersistentVolumeClaims outlive the Pods.

## Key Insights

- Scale-up creates ordinals **ascending, one at a time**, each waiting for the
  previous to be Running **and Ready**. One unready Pod stalls the entire
  scale-up indefinitely — the opposite of a Deployment, which fires them all in
  parallel.
- Scale-down deletes **descending**, one at a time, also gated on readiness.
  There is no victim-selection heuristic at all — contrast directly with
  phase 01, where the controller ranks candidates.
- `podManagementPolicy: Parallel` removes the ordering gate for create/delete
  (not for rolling updates). Worth one phase because it is the fix for the
  stalled scale-up above.
- **PVCs are not deleted by scale-down** unless
  `persistentVolumeClaimRetentionPolicy.whenScaled: Delete` (default `Retain`).
  Scaling 5→2 leaves three PVCs — and the storage bill — behind. Scaling back up
  **re-binds the same PVCs by name** (`data-web-3`), so the new Pod inherits the
  old Pod's data. This is the scenario's payload.
- Each Pod has a stable identity (`web-0`…`web-4`) and DNS name via the headless
  Service; identity is the reason nothing here is interchangeable.

## Requirements

**Functional**
- Model: `{replicas, target, pods:[{ordinal, ready}], retentionWhenScaled,
  podManagementPolicy}`.
- Returns the ordered action list `[{action: 'create'|'delete', ordinal,
  waitsFor, pvc: {name, kept|deleted}}]` and a stalled-scale-up variant when a
  Pod never becomes Ready.

**Non-functional**
- PVCs are separate persistent components (`shape: 'cylinder'`) that **survive**
  their Pod's retirement — a direct exercise of the lifecycle rules.

## Architecture

Columns: `control` StatefulSet controller (`Z.workload`) · `node` two Workers
holding the Pod row · PVCs on the `Z.store` band under their Pods. Headless
Service as a `SIZE.gate` box on `Z.spine`.

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-statefulset-scale-model.js`
- `k8s-flow-3d-scenario-statefulset-scale-world.js`
- `k8s-flow-3d-scenario-statefulset-scale-steps.js`
- `k8s-flow-3d-scenario-statefulset-scale.js`

**Modify**
- `k8s-flow-3d/k8s-flow-3d.html`

## Implementation Steps

1. Model: emit the strictly ordered action list; validate `target >= 0`, ordinals
   contiguous. `podManagementPolicy: Parallel` collapses `waitsFor` to null.
2. World: five Pod slots (`web-0`..`web-4`) and five PVC cylinders pre-declared;
   Pods 3–4 and their PVCs hidden initially.
3. Steps:
   - Ch.1 Identity: ordinals, stable DNS, one PVC per ordinal.
   - Ch.2 Scale-up 3→5: `web-3` created, waits Ready, then `web-4`. One phase
     per gate.
   - Ch.3 The stall: `web-3` never becomes Ready → `web-4` is never created.
     Explicit failure claim.
   - Ch.4 `podManagementPolicy: Parallel` as the before/after fix, same workload.
   - Ch.5 Scale-down 5→2: descending deletion, one at a time.
   - Ch.6 PVC retention: `whenScaled: Retain` leaves `data-web-2..4`; scaling
     back up re-binds by name and the data returns. Contrast with `Delete`.
4. HUD: `Changed` target replicas · `Boundary` readiness gate / retention policy ·
   `Result` Pods ready, PVCs retained.

## Todo List

- [ ] StatefulSet model with ordered action list + stall variant
- [ ] Node assertions: ascending create, descending delete, Parallel collapse
- [ ] World with PVC cylinders outliving Pods
- [ ] Steps ch.1–ch.6
- [ ] Assembly + HTML band
- [ ] Browser walk

## Success Criteria

- No phase shows two ordinals created or deleted simultaneously under the
  default policy.
- A retained PVC box stays visible after its Pod retires, and is the **same box**
  re-bound on scale-up (no clone).
- The contrast with phase 01's victim ranking is stated in exactly one phase.

## Risk Assessment

- **Component count** — 5 Pods + 5 PVCs + controller + service is dense.
  Mitigation: reduce to 5 max ordinals and use the existing `L.cols` pitch;
  camera per chapter rather than one wide shot.

## Security Considerations

None — static visualization.

## Next Steps

Phase 09 returns to Deployments, where replica count moves for a reason that is
not scaling at all.
