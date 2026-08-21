# Phase 11 — Deferred scale catalog (Tier C)

## Context Links

- All Tier A/B phases in this plan
- `docs/k8s-pod-evaluation.md` (existing decision-order reference)

## Overview

- **Priority:** P3 — documentation deliverable, no scenario code
- **Status:** pending
- **Description:** The remaining scaling mechanisms found in Kubernetes, each
  with the reason it is **not** built in this plan and what it would take. This
  file is the answer to "did we collect all of them" — the ten built scenarios
  plus these six are the complete set.

## Deferred mechanisms

### 11.1 Karpenter (just-in-time node provisioning)
Replaces Cluster Autoscaler's node-group model with per-Pod instance selection:
`NodePool` + `NodeClass`, bin-packs pending Pods, picks an instance type that
fits, and **consolidates** by replacing several under-used nodes with one
cheaper node. Disruption budgets and `do-not-disrupt` annotations gate that.
**Why deferred:** it is a full alternative to phase 04/05 rather than an
addition; building it well means a second node-provisioning world.
**Build cost:** one full scenario set + reuse of the phase-00 `cloud` column.

### 11.2 Job / CronJob parallelism
`completions` + `parallelism` control how many Pods run at once; indexed Jobs
give each Pod an ordinal; `backoffLimit` and `activeDeadlineSeconds` bound
retries. Scaling here is a *work-queue* concept, not a serving-capacity one.
**Why deferred:** distinct enough from the serving-workload story that it reads
as a different deck chapter.
**Build cost:** one scenario set, small model.

### 11.3 DaemonSet — scaling by node count
A DaemonSet has no `replicas`; its Pod count is a function of matching nodes.
It therefore scales as a **consequence** of phases 04/05, and its Pods are what
block CA scale-down and require `--ignore-daemonsets` on drain.
**Why deferred:** its whole teaching point is already a phase inside 05.
**Build cost:** low, but mostly duplicate content.

### 11.4 Overprovisioning headroom (pause Pods)
Low/negative-priority placeholder Pods reserve capacity; a real Pod preempts
them instantly, giving fast scale-up while CA provisions a replacement node in
the background. It is the standard answer to phase 04's provisioning latency.
**Why deferred:** it is a composition of the deck's existing `preemption`
scenario with phase 04 — best built *after* both exist, as a short scenario that
references rather than re-teaches.
**Build cost:** low; high value once 04 lands. **Strongest Tier C candidate.**

### 11.5 HPA × Cluster Autoscaler feedback loop (traffic-spike capstone)
End-to-end: traffic rises → HPA adds replicas → replicas go Pending → CA adds a
node → Pods bind → load per Pod falls → stabilization → CA scale-down. The two
controllers never talk to each other; each only observes cluster state.
**Why deferred:** a composite of 02, 03, 04, 05. Building it before those exist
means writing all four models anyway.
**Build cost:** low if it reuses the four models; it is mostly steps.
**Recommended as the eventual finale of the deck.**

### 11.6 Descheduler
Rebalances after scaling: evicts Pods that violate current affinity/topology or
that sit on over-used nodes, so the scheduler can place them better. Not a
scaler — a corrective loop that runs *because* scaling happened.
**Why deferred:** add-on, and its content overlaps the deck's eviction scenarios.

### Explicitly out of scope
Control-plane scaling limits (etcd size, API server watch fan-out, informer
cache pressure, `kube-proxy`/Service scale) — real scaling concerns, but they
have no per-Pod causal story and would not survive this deck's "one thing = one
component" rule at a useful level of abstraction.

## Requirements

- Land this file as the deck's scaling coverage record.
- Add the Tier C list to `docs/k8s-pod-evaluation.md` (or a new
  `docs/k8s-scaling-mechanisms.md`) so the catalog is discoverable outside
  `plans/`.

## Implementation Steps

1. After Tier A lands, re-evaluate 11.4 — it may be cheap enough to promote.
2. After Tier B lands, re-evaluate 11.5 as the deck finale.
3. Write `docs/k8s-scaling-mechanisms.md` summarising all sixteen mechanisms and
   which scenario id (if any) teaches each.

## Todo List

- [ ] Re-evaluate 11.4 after phase 04
- [ ] Re-evaluate 11.5 after phase 05
- [ ] Write `docs/k8s-scaling-mechanisms.md` coverage table

## Success Criteria

Every scaling mechanism in Kubernetes is either implemented as a scenario in
this plan or listed here with an explicit reason and build cost.

## Risk Assessment

- **Catalog rots** — deferred items silently become wrong as upstream moves.
  Mitigation: the coverage doc carries an `asOf` date, matching the provenance
  rules the authoring guide already requires.

## Security Considerations

None — documentation only.

## Next Steps

Decision required from the user (see plan.md unresolved questions): build Tier C
later, or close it out permanently.
