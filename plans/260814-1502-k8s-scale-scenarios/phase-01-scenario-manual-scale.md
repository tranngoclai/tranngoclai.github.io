# Phase 01 — Scenario: manual scale (`kubectl scale`)

## Context Links

- Depends on: [phase-00](phase-00-shared-scale-scaffolding.md)
- Pattern reference: `k8s-flow-3d/k8s-flow-3d-scenario-pdb-drain*.js` (smallest
  complete scenario set in the deck)
- `docs/flow3d-deck-authoring.md` §3 model contract

## Overview

- **Priority:** P0 — the base every other scale scenario assumes
- **Status:** pending
- **Scenario id:** `manual-scale` · tag `SCALE`
- **Description:** `kubectl scale deploy/api --replicas=5` and back down to 2.
  Teaches that scaling writes the **scale subresource**, that the Deployment
  never creates Pods, and — the real payload — **which Pods a scale-down picks**.

## Key Insights

- `kubectl scale` does not touch Pods. It PATCHes `deploy/api` `scale`
  subresource; Deployment controller updates the ReplicaSet; ReplicaSet
  controller reconciles Pod count. Three hops, three distinct controllers.
- Scale-down victim order is **not random and not PriorityClass**. ReplicaSet
  sorts candidates roughly: unassigned (no node) first → `Pending` before
  `Running` → not-Ready before Ready → shorter Ready duration → more container
  restarts → newer creation timestamp. `controller.kubernetes.io/pod-deletion-cost`
  annotation overrides ahead of most of this.
- This is a genuinely surprising result and directly contrasts with the deck's
  existing eviction/preemption ordering rules — the scenario should say so.
- Scale-down deletes Pods directly; it is **not** an Eviction API call, so PDB
  does not gate it. That contrast is worth one explicit phase (links to the
  existing `pdb-drain` scenario's conclusion).

## Requirements

**Functional**
- Model: 3 → 5 → 2 replicas, five Pod records each with `phase`, `ready`,
  `readySeconds`, `restarts`, `createdAt`, optional `deletionCost`.
- Model exports `scaleDownOrder(pods, count)` returning the ordered victim list
  and, per victim, the **rule that decided it**.
- Steps must show the chosen victims tagged with their deciding rule, not just
  a tone change.

**Non-functional**
- All five Pods pre-declared in the world; scale-up reveals `hidden` Pods,
  scale-down retires them. No mesh created mid-run.

## Architecture

```
kubectl ─PATCH scale─▶ API Server ─▶ Deployment controller
                                        │ set RS .spec.replicas
                                        ▼
                                   ReplicaSet controller ──create/delete──▶ Pods
                                                                             │
                                                          new Pods ▶ ActiveQ ▶ Nodes
```

Columns: `actor` kubectl · `core` API Server · `control` Deployment controller
(Z.workload) + ReplicaSet controller (Z.workload, offset) + scheduler (Z.sched) ·
`queue` pending Pods · `node` two Workers.

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-manual-scale-model.js`
- `k8s-flow-3d-scenario-manual-scale-world.js`
- `k8s-flow-3d-scenario-manual-scale-steps.js`
- `k8s-flow-3d-scenario-manual-scale.js` (assembly)

**Modify**
- `k8s-flow-3d/k8s-flow-3d.html` — four script tags in the deck band

## Implementation Steps

1. Model: `DEFAULT_CONFIG` frozen — `{initial: 3, scaleUp: 5, scaleDown: 2, pods: [...]}`.
   `simulate()` returns `{initial, scaleUp, scaleDown, created[], victims[]}`
   where each victim carries `{key, rule, detail}`.
2. Implement `scaleDownOrder()` as an explicit comparator chain, one predicate
   per documented rule, each returning the rule name that fired. Validate
   `scaleDown <= initial <= scaleUp` and throw `RangeError` otherwise.
3. World: pods use `shape: 'seal'` + `SIZE.pod` (deck convention), Deployment
   and ReplicaSet controllers as `SIZE.controller` on `Z.workload`, Workers as
   `shape: 'slab'`. Pods 4 and 5 declared `hidden: true`.
4. Steps, one causal claim per phase:
   - Ch.1 Scale-up: kubectl PATCH → API Server persists `spec.replicas=5` →
     Deployment controller updates RS → RS controller creates 2 Pods (Pending)
     → scheduler binds each → kubelets start them.
   - Ch.2 Scale-down: kubectl PATCH `replicas=2` → RS controller ranks
     candidates (one phase per applied rule, using `KIT.sweep`) → deletes the
     three victims → surviving set stated.
   - Ch.3 Contrast: this was `DELETE`, not `pods/eviction` — PDB never consulted.
5. HUD: `KIT.gauge('replicas', current, scaleUp, ' Pods')` +
   `KIT.score('ready', n)` on every phase.
6. Assembly: `pipeline` = Request · Deployment · ReplicaSet · Schedule · Settle.
7. Register scripts in the HTML band after `k8s-flow-3d-scale-math.js`.

## Todo List

- [ ] Model + `scaleDownOrder` comparator chain + validation
- [ ] Node smoke assertions in `dev-model-check.js`
- [ ] World with 5 pre-declared Pods (2 hidden)
- [ ] Steps ch.1 scale-up
- [ ] Steps ch.2 scale-down with per-rule phases
- [ ] Steps ch.3 PDB contrast
- [ ] Assembly + HTML script band
- [ ] Browser walk, console clean

## Success Criteria

- Victim order shown in the panel matches `scaleDownOrder()` output exactly; no
  literal Pod name in step prose that is not read from the model.
- Every Pod box keeps identity across scale-up and scale-down (no clone).
- Replica gauge in the HUD agrees with the visible Pod count at every phase.

## Risk Assessment

- **Victim-order accuracy** — the ordering is implementation detail of the
  ReplicaSet controller and shifts between releases. Mitigation: state it as
  "current upstream heuristic" in the panel's *why* line and pin the reference
  in a file-header comment; do not present it as an API guarantee.
- **Phase count creep** — one phase per ordering rule could reach 6+. Mitigation:
  use `KIT.sweep` and collapse rules that do not fire for this workload.

## Security Considerations

None — static visualization.

## Next Steps

Phase 02 (HPA scale-up) reuses this world's Deployment/ReplicaSet column and
adds the metrics column from phase 00.
