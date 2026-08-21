# Phase 00 — Shared scale scaffolding

## Context Links

- `docs/flow3d-deck-authoring.md` — 5 layers, 4 rules, kit API
- `k8s-flow-3d/k8s-flow-3d-layout.js` — the shared layout law being extended
- `flow3d/flow3d-engine-scenario-registry.js` — id/validation contract
- `k8s-flow-3d/k8s-flow-3d.html` — script band, load order

## Overview

- **Priority:** P0 — blocks all ten scenario phases
- **Status:** pending
- **Description:** Extend the layout law with the columns/bands scaling actors
  need, add one shared scale-math module, and register the new script band slots.

## Key Insights

- Every existing scenario reads position and size from `K8S_LAYOUT`. Scaling
  introduces actors that have **no column yet**: metrics-server, HPA controller,
  VPA trio, Cluster Autoscaler, cloud provider API, node group template.
- A newly provisioned Node is not a "moved" Node. Rule 1 (one thing = one
  component) means the world must **declare it up front as `hidden`** and reveal
  it when the cloud provider returns it — never build a mesh mid-run.
- HPA ratio math is used by three scenarios (02, 03, 07). That is the DRY
  threshold; one shared module, not three copies. VPA/CA math is used once each
  and stays in its own model.
- Node count changing is the first time this deck has a variable-cardinality
  world. The cap must be declared in the model config (`maxNodes`) so the world
  can pre-declare exactly that many slabs.

## Requirements

**Functional**
- New X columns: `metrics` (observation plane), `cloud` (provider API, right of
  the node field).
- New Z bands: `autoscale` (HPA/VPA/CA controllers), `provision` (node group).
- New `SIZE` entries: `metrics` (a collector), `nodegroup` (a template plate).
- `L.nodeLanes(maxNodes)` — deterministic lane Z for a node field that grows,
  so Node 1 does not shift when Node 4 appears.
- `K8S_SCALE_MATH` module: `desiredReplicas()`, `withinTolerance()`,
  `clampToBounds()`, `fmtPct()`, `fmtCores()`.

**Non-functional**
- Zero change to the five existing scenarios' rendered output. Adding table
  entries must not move any existing box.
- `flow3d/*` untouched (domain-neutral layer stays domain-neutral).

## Architecture

```
X axis (extended)          actor  gate  core  control  queue  node  cloud
                            -30    -24   -13     -5       2     16    30
Z bands (extended)          sched +9 · workload +3 · spine 0 · policy -3
                            store -9 · lifecycle -9 · gc -15
                            autoscale +6  (HPA/VPA/CA controllers)
                            provision -6  (node group template, at X.cloud)
```

Scaling reads left→right as: metrics observed → controller decides → scale
subresource written on the workload object → replicas reconciled → Pods queue →
Nodes (possibly provisioned from the cloud column on the far right).

## Related Code Files

**Modify**
- `k8s-flow-3d/k8s-flow-3d-layout.js` — add `L.X.metrics`, `L.X.cloud`,
  `L.Z.autoscale`, `L.Z.provision`, `SIZE.metrics`, `SIZE.nodegroup`,
  `L.nodeLanes()`
- `k8s-flow-3d/k8s-flow-3d.html` — script band: shared math before scenarios
- `docs/flow3d-deck-authoring.md` — note the scale columns in the layout section

**Create**
- `k8s-flow-3d/k8s-flow-3d-scale-math.js` — shared autoscaler arithmetic

## Implementation Steps

1. Add the new columns/bands/sizes to `k8s-flow-3d-layout.js`, each with the
   same style of comment the file already uses (why the value, not what).
2. Add `L.nodeLanes(maxNodes)`: returns `maxNodes` lane Z values from a fixed
   centre so revealing a slab never re-centres existing ones. `L.lanes()` stays
   as-is for fixed-cardinality scenarios.
3. Create `k8s-flow-3d-scale-math.js` exporting `window.K8S_SCALE_MATH`:
   - `desiredReplicas(current, currentMetric, targetMetric)` →
     `ceil(current * currentMetric / targetMetric)`
   - `withinTolerance(ratio, tolerance)` → `Math.abs(ratio - 1) <= tolerance`
     (default tolerance `0.1`)
   - `clampToBounds(desired, min, max)`
   - Formatters `fmtPct`, `fmtCores`, `fmtMi` (reuse the existing OOM formatter
     shape so all decks print memory identically).
   - Validate inputs: throw `TypeError` on non-finite, `RangeError` on
     `targetMetric <= 0`, `min > max`.
4. Insert `<script src="k8s-flow-3d-scale-math.js">` after
   `k8s-flow-3d-layout.js` and before any scale scenario model.
5. Add a `node` smoke shim `k8s-flow-3d/dev-model-check.js` (dev-only, not
   loaded by the HTML) that stubs `window` and asserts each scale model's
   arithmetic — the authoring guide requires models to be runnable under plain
   node, and there is no test runner in this repo.
6. Open `k8s-flow-3d.html`, confirm all five existing scenarios render
   byte-identically in layout (visual diff by walking each to step 1).

## Todo List

- [ ] Extend `K8S_LAYOUT` with metrics/cloud columns and autoscale/provision bands
- [ ] Add `SIZE.metrics`, `SIZE.nodegroup`
- [ ] Add `L.nodeLanes(maxNodes)`
- [ ] Create `k8s-flow-3d-scale-math.js` with validation + formatters
- [ ] Wire script band in `k8s-flow-3d.html`
- [ ] Create `dev-model-check.js` node smoke harness
- [ ] Verify five existing scenarios unchanged
- [ ] Update layout section of `docs/flow3d-deck-authoring.md`

## Success Criteria

- `node k8s-flow-3d/dev-model-check.js` exits 0.
- Existing five scenarios walk end to end with no console errors and no visible
  layout shift.
- `K8S_SCALE_MATH.desiredReplicas(3, 0.9, 0.5) === 6`; tolerance 0.05 ratio is
  a no-op; `clampToBounds(20, 2, 10) === 10`.

## Risk Assessment

- **Layout regression** — new table entries are additive only; risk is an
  accidental edit to an existing value. Mitigation: diff `k8s-flow-3d-layout.js`
  before commit, existing keys must be untouched.
- **Over-engineering the shared math** — keep it to the four functions actually
  needed by phases 02/03/07. Anything used once stays in its scenario model.

## Security Considerations

Static site, no user input, no network calls beyond the Three.js CDN already in
use. Nothing to add.

## Next Steps

Phase 01 (manual scale) is the smallest consumer of this scaffolding and
validates it before the autoscaler phases build on it.
