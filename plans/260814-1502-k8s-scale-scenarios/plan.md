# K8s Scale Scenarios — flow3d deck expansion

Add every Kubernetes **scaling** mechanism as a scenario in the existing
`k8s-flow-3d` deck. Current deck teaches placement + destruction (scheduler,
preemption, kubelet eviction, OOM, PDB/drain). It teaches **nothing about how
replica or node count changes**. This plan closes that gap.

Deck: `/k8s-flow-3d` (reuse — same domain, same layout law, same shell).
Kit/engine: `/flow3d` (domain-neutral, untouched).
Authoring contract: `docs/flow3d-deck-authoring.md` (5 layers, 4 rules).

## Full scale catalog (collected)

| # | Mechanism | Tier | Phase |
|---|---|---|---|
| 1 | Manual scale: `kubectl scale` → scale subresource → RS reconcile → **scale-down victim ordering** | A | 01 |
| 2 | HPA scale-up: metrics-server → ratio formula → tolerance → replicas | A | 02 |
| 3 | HPA scale-down: stabilization window + `behavior` policies | A | 03 |
| 4 | Cluster Autoscaler scale-up: unschedulable Pod → node group → new Node | A | 04 |
| 5 | Cluster Autoscaler scale-down: utilization + unneeded time + blockers | A | 05 |
| 6 | VPA: recommender → updater evicts → admission mutates requests | A | 06 |
| 7 | KEDA scale-to-zero: external metric, activation vs scaling threshold | B | 07 |
| 8 | StatefulSet scale: ordinal ordering, Ready gate, PVC retention | B | 08 |
| 9 | Rolling update surge: `maxSurge`/`maxUnavailable` replica arithmetic | B | 09 |
| 10 | In-place Pod resize: `resize` subresource, `resizePolicy`, Infeasible | B | 10 |
| 11–16 | Karpenter, Job parallelism, DaemonSet-by-node, overprovisioning headroom, HPA×CA feedback loop, descheduler | C | 11 (catalog only) |

Tier A = the six that carry the non-obvious teaching points. Tier B = build after
A lands. Tier C = documented in phase 11 with a build note; **not built** in this
plan (each is either a third-party controller or a composite of A+B).

## Phases

| Phase | File | Status |
|---|---|---|
| 00 | [Shared scale scaffolding](phase-00-shared-scale-scaffolding.md) | pending |
| 01 | [Manual scale](phase-01-scenario-manual-scale.md) | pending |
| 02 | [HPA scale-up](phase-02-scenario-hpa-scale-up.md) | pending |
| 03 | [HPA scale-down](phase-03-scenario-hpa-scale-down.md) | pending |
| 04 | [CA scale-up](phase-04-scenario-cluster-autoscaler-scale-up.md) | pending |
| 05 | [CA scale-down](phase-05-scenario-cluster-autoscaler-scale-down.md) | pending |
| 06 | [VPA resize](phase-06-scenario-vpa-resize.md) | pending |
| 07 | [KEDA scale-to-zero](phase-07-scenario-keda-scale-to-zero.md) | pending |
| 08 | [StatefulSet scale](phase-08-scenario-statefulset-scale.md) | pending |
| 09 | [Rollout surge](phase-09-scenario-rollout-surge.md) | pending |
| 10 | [In-place Pod resize](phase-10-scenario-inplace-pod-resize.md) | pending |
| 11 | [Deferred catalog](phase-11-deferred-scale-catalog.md) | pending |

## Dependencies

- 00 blocks every scenario phase (new layout columns/bands + shared scale math).
- 02 blocks 03 (same model, same world) and 07 (KEDA drives an HPA).
- 04 blocks 05 (same world, opposite direction).
- 01 blocks 09 (rollout surge is replica arithmetic on top of manual scale).
- 06 and 10 are independent; 10 references 06's conclusion.

## Key constraints

- Every domain number lives in the model. Step prose formats it, never restates it.
- Panel prose = Vietnamese; component labels, hover text, identifiers = English.
  (Matches every existing scenario.)
- No build step, no package.json. Files load via `<script>` in
  `k8s-flow-3d/k8s-flow-3d.html`; load order is the dependency graph.
- Steps files exceeding ~200 LOC split by chapter, as scheduler-pipeline and
  kubelet-eviction already do.

## Unresolved questions

1. Deck scenario count goes 5 → 15 (A+B). The `<select>` becomes long — do we
   add `optgroup` grouping (Placement / Disruption / Scale) to the shell, or
   accept a flat list ordered by registration? Phase 00 assumes flat + ordering;
   grouping would touch domain-neutral shell code.
2. Tier C: build later, or drop permanently?
