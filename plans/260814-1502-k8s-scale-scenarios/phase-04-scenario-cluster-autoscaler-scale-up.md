# Phase 04 — Scenario: Cluster Autoscaler scale-up

## Context Links

- Depends on: [phase-00](phase-00-shared-scale-scaffolding.md) (`cloud` column,
  `L.nodeLanes`, provision band)
- Continues from the deck's existing `scheduler-pipeline` scenario end state
  (Pod `Pending`, `0/N nodes are available`)
- Blocks: [phase-05](phase-05-scenario-cluster-autoscaler-scale-down.md)

## Overview

- **Priority:** P0
- **Status:** pending
- **Scenario id:** `cluster-autoscaler-scale-up` · tag `CA`
- **Description:** A Pod cannot be scheduled on any existing Node. Cluster
  Autoscaler simulates each node group, asks the cloud provider for a machine,
  and the new Node joins — then, and only then, the scheduler binds.

## Key Insights

- CA is triggered by **unschedulable Pods**, not by utilisation. If the Pod is
  Pending for a reason a new Node cannot fix (untolerated taint, unbindable PVC
  topology, host port, cross-node anti-affinity), CA adds nothing — it runs the
  scheduler's own predicates against a **simulated** node from the group's
  template and only scales a group whose template would fit.
- CA does not place the Pod. It changes the node group size; the **scheduler**
  binds afterwards, and may bind a completely different Pod to the new Node.
  That decoupling is the scenario's central claim.
- **Scale-from-zero** works only when the group's template advertises its
  capacity and labels (cloud-provider tags / ASG tags). Without them, CA cannot
  simulate a group at size 0 and silently never scales it.
- The wait is real: node provisioning + kubelet registration + CNI ready is
  minutes, bounded by `--max-node-provision-time` (default 15m). A Pod that
  needs a node *now* is not saved by CA — that is the case for overprovisioning
  headroom Pods (Tier C, catalog phase 11).
- CA and HPA are not aware of each other. HPA makes Pods; CA makes room. The
  composite loop is catalogued as Tier C.

## Requirements

**Functional**
- Model config: existing nodes with allocatable/requested, one Pending Pod with
  requests, node groups `[{name, min, max, current, template:{cpu, mem, labels,
  taints}}]`.
- Model runs a simplified fit predicate per group template, returns
  `{eligibleGroups[], rejectedGroups[{name, reason}], chosenGroup, expander,
  newNodeSize, provisionSeconds}`.
- One rejected group must fail on a **non-resource** predicate (taint) to make
  the "CA cannot fix every Pending" point concrete.

**Non-functional**
- `maxNodes` in config; the world pre-declares that many slabs via
  `L.nodeLanes(maxNodes)`, extras `hidden`.

## Architecture

```
Pending Pod ──unschedulable──▶ Cluster Autoscaler (Z.autoscale)
                                    │ simulate group templates (X.cloud, Z.provision)
                                    ▼
                              Cloud provider API (X.cloud)
                                    │ increase desired size
                                    ▼
                              new Node ──register──▶ API Server ──▶ scheduler binds
```

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-cluster-autoscaler-model.js` (shared with phase 05)
- `k8s-flow-3d-scenario-cluster-autoscaler-world.js` (shared with phase 05)
- `k8s-flow-3d-scenario-cluster-autoscaler-scale-up-steps.js`
- `k8s-flow-3d-scenario-cluster-autoscaler-scale-up.js`

**Modify**
- `k8s-flow-3d/k8s-flow-3d.html`

## Implementation Steps

1. Model: fit predicate `templateFits(pod, template)` covering requests, taints
   and node labels; return the failing predicate name for rejected groups.
   Validate group `min <= current <= max`; `RangeError` otherwise.
2. World: node group templates as `SIZE.nodegroup` plates on `Z.provision` at
   `X.cloud`; cloud provider API as `SIZE.core` at `X.cloud`, `Z.spine`; CA as
   `SIZE.controller`, `shape: 'hex'` on `Z.autoscale`. Pre-declare 4 node slabs,
   2 visible.
3. Steps:
   - Ch.1 The Pod is Pending and why (reuse the scheduler scenario's vocabulary).
   - Ch.2 CA simulates: one phase per group — fits / rejected-for-taint /
     rejected-for-size — via `KIT.sweep`.
   - Ch.3 Expander picks among eligible groups (state the strategy in use:
     `random` default, or `least-waste`/`priority`); assumption badge required.
   - Ch.4 Cloud API called; group desired size +1; **nothing in the cluster has
     changed yet** — an explicit phase, because this is where the wait lives.
   - Ch.5 Node registers with the API Server, becomes Ready (reveal the slab).
   - Ch.6 Scheduler — not CA — binds the Pod.
   - Ch.7 Limits: `maxNodes` reached; scale-from-zero requires group templates.
4. HUD: `Changed` pending Pod count · `Boundary` group `current/max` ·
   `Result` nodes Ready.

## Todo List

- [ ] CA model with template fit + rejection reasons
- [ ] Node assertions: taint rejection, size rejection, max clamp
- [ ] Shared CA world with pre-declared node slabs
- [ ] Steps ch.1–ch.7
- [ ] Assembly + HTML band
- [ ] Browser walk

## Success Criteria

- Revealing the new Node does not shift the existing Node lanes.
- The scenario never shows CA binding a Pod.
- The provisioning wait is a distinct phase with an explicit duration from the
  model, carrying an `illustrative` provenance badge.

## Risk Assessment

- **Cloud-provider specificity** — group templates and expander behaviour vary
  (AWS ASG, GKE MIG, DOKS node pools). Mitigation: keep the provider abstract,
  name the concept "node group", and mark provider-specific numbers illustrative.
- **New variable-cardinality world** — first scenario where node count changes.
  Mitigation: phase 00's `L.nodeLanes` is validated here first; if it misbehaves,
  fix the layout law, not the scenario.

## Security Considerations

None — static visualization.

## Next Steps

Phase 05 reuses this model/world for the removal direction, where PDB and the
deck's existing `pdb-drain` scenario re-enter.
