# Phase 05 — Scenario: Cluster Autoscaler scale-down

## Context Links

- Depends on: [phase-04](phase-04-scenario-cluster-autoscaler-scale-up.md)
  (shared model + world)
- Connects to the deck's existing `pdb-drain` scenario

## Overview

- **Priority:** P1
- **Status:** pending
- **Scenario id:** `cluster-autoscaler-scale-down` · tag `CA`
- **Description:** Three Nodes, one lightly used. CA marks it unneeded, waits,
  then drains and deletes it — unless one Pod on it blocks the whole removal.

## Key Insights

- A Node is a candidate only when **every** condition holds: sum of requests
  below `--scale-down-utilization-threshold` (default 0.5), unneeded
  continuously for `--scale-down-unneeded-time` (default 10m), and **all its
  Pods can be rescheduled elsewhere**. The last one is what actually fails.
- Single blockers that keep a whole Node alive:
  - a Pod not backed by a controller (bare Pod),
  - a Pod with local storage / `emptyDir` (without
    `cluster-autoscaler.kubernetes.io/safe-to-evict: "true"`),
  - a restrictive PDB with no disruption budget available,
  - `kube-system` Pods without a PDB,
  - `safe-to-evict: "false"` annotation.
  One such Pod pins an otherwise empty node indefinitely — the most common
  "why is my cluster not shrinking" cause and the scenario's payload.
- CA drains via the **Eviction API**, so PDB *is* respected here — the opposite
  of kubelet node-pressure eviction in the deck's existing scenario. Making that
  contrast explicit is the reason this belongs in this deck.
- Utilisation is computed from **requests**, not actual usage. A node at 5%
  real CPU with 90% requested is never a scale-down candidate. Same request-vs-usage
  distinction the scheduler scenario already teaches; reuse the vocabulary.

## Requirements

**Functional**
- Model config: nodes with pods, each pod carrying `{controller, localStorage,
  pdb, namespace, safeToEvict}`; thresholds `utilizationThreshold`,
  `unneededMinutes`.
- `scaleDownCandidates(nodes)` → per node `{utilization, unneeded, blockers[]}`
  with a named blocker rule per blocking Pod.
- At least two nodes evaluated: one removable, one blocked by exactly one Pod.

**Non-functional**
- Removing a node retires its slab (`retired` lifecycle), it does not vanish
  silently; the lane stays reserved so replay is deterministic.

## Architecture

Reuses phase 04's world. Direction reverses: CA → cordon+drain via API Server
Eviction → Pods rescheduled to remaining nodes → cloud API decreases group size
→ Node retired.

## Related Code Files

**Create**
- `k8s-flow-3d-scenario-cluster-autoscaler-scale-down-steps.js`
- `k8s-flow-3d-scenario-cluster-autoscaler-scale-down.js`

**Modify**
- `k8s-flow-3d-scenario-cluster-autoscaler-model.js` — add candidate evaluation
- `k8s-flow-3d/k8s-flow-3d.html`

## Implementation Steps

1. Extend the CA model with `scaleDownCandidates()`, each blocker returning a
   stable rule id (`bare-pod`, `local-storage`, `pdb-exhausted`,
   `kube-system-no-pdb`, `safe-to-evict-false`).
2. Steps:
   - Ch.1 Utilisation is request-based — show a node at low real usage that is
     *not* a candidate.
   - Ch.2 Candidate found; the unneeded timer runs (one phase, explicit duration).
   - Ch.3 Reschedulability simulation, one phase per Pod via `KIT.sweep`; the
     blocked node fails on exactly one Pod and the rule is named on that Pod.
   - Ch.4 The removable node drains through the Eviction API — PDB consulted,
     unlike kubelet node-pressure eviction. Explicit contrast phase.
   - Ch.5 Cloud API decreases group size; node retired; `min` size floor stated.
3. HUD: `Changed` node utilisation · `Boundary` threshold + unneeded time ·
   `Result` nodes removed / blocked.

## Todo List

- [ ] `scaleDownCandidates` + blocker rules in the CA model
- [ ] Node assertions: each blocker rule fires in isolation
- [ ] Steps ch.1–ch.5
- [ ] Contrast phase cross-referencing `pdb-drain` and kubelet eviction
- [ ] Assembly + HTML band
- [ ] Browser walk

## Success Criteria

- The blocked node's blocking Pod is identifiable from label/hover text alone.
- The retired node slab stays in place (retired, not deleted) and replay from
  step 0 reproduces the identical end state.
- Panel states the PDB-respected vs PDB-ignored matrix consistently with
  `docs/k8s-pod-evaluation.md` §10.

## Risk Assessment

- **Overlap with `pdb-drain`** — risk of re-teaching PDB instead of scale-down.
  Mitigation: PDB gets exactly one phase here, framed as "who calls the Eviction
  API", with the detail deferred to the existing scenario.

## Security Considerations

None — static visualization.

## Next Steps

Phase 06 switches axis from horizontal to vertical.
