# UX/UI review — phase-01 `manual-scale` scenario spec

Reviewed: `plans/260814-1502-k8s-scale-scenarios/phase-01-scenario-manual-scale.md`
Benchmarks: `pdb-drain-{world,steps}.js`, `kubelet-eviction-ranking.js`, `preemption-world.js`,
`k8s-flow-3d-layout.js`, `flow3d-kit-panel-and-hud.js`, `docs/flow3d-deck-authoring.md`.

---

## A. Spatial / layout — Deployment + ReplicaSet controllers · VERDICT: **change**

Spec's `Z.workload (offset)` does not resolve. Geometry proves it:

- `SIZE.controller` = `[4.6, 3.8, 3.0]`. Two of them on band `z=3` need `dx ≥ 5.6`.
- ReplicaSet must stay at pdb-drain's exact coord `[-5, 0, 3]` (moving an existing
  component per-scenario is the one thing the layout law exists to prevent).
- Space left of it on that band: API Server right edge = `-10.7`; a 4.6-wide box needs
  centre `≥ -7.4` to clear it, but `≤ -10.6` to clear RS. Contradiction → **X-splitting on
  one band is geometrically impossible.** The offset must be on Z.

**Recommendation — add one named sub-band in phase 00, not an ad-hoc offset:**

```
L.Z.workloadOwner = -1.5   // controller that owns a template and never touches Pods
                           // (Deployment, StatefulSet, Job) — sits BEHIND the
                           // controller that creates/deletes Pods
L.Z.workload     =  3      // unchanged: ReplicaSet controller (pdb-drain parity)
```

Exact positions:

| node | pos | size | tone | shape |
|---|---|---|---|---|
| `scheduler` | `[-5, 0, 9]` (`X.control`,`Z.sched`) | `SIZE.scheduler` | system | — |
| `replicaset-controller` | `[-5, 0, 3]` (`Z.workload`) | `SIZE.controller` | system | — |
| `deployment-controller` | `[-5, 0, -1.5]` (`Z.workloadOwner`) | `SIZE.controller` | system | — |

Clearances: RS↔Deployment `dz=4.5` → **1.5 clear**; RS↔scheduler `dz=6.0` → **3.0 clear**;
Deployment vs `X.core` spine boxes: different column, no conflict. Reads front-to-back as
`binds → creates/deletes Pods → owns the template`, i.e. depth = distance from the Pod.
Rationale: pdb-drain separates its three controllers by *role band*, not by nudge; this keeps
that grammar and is reusable by phases 08/09.

Caveat: `Z.policy = -3` (disruption controller) is 1.5 from `workloadOwner` → a future
scenario needing both would collide. See Unresolved Q1.

**Two-Worker lane math** (`L.lanes([6.5, 6.5])`) = `[4.85, -4.85]`:

```
worker-a slab [16, -1.6,  4.85]   pod row z =  6.55   agent row z =  3.15
worker-b slab [16, -1.6, -4.85]   pod row z = -3.15   agent row z = -6.55
```

---

## B. Cardinality & identity · VERDICT: **change** (spec under-specifies; one hard limit)

`COL = L.cols(L.X.node, 4)` = `[9.4, 13.8, 18.2, 22.6]`; `POD_Y = L.on(1.4) = -0.6`.

- **3 pods per Worker fits.** `SIZE.pod` width 3.0 at `PITCH 4.4` → 1.4 clearance; slab spans
  `6.5..25.5`, so COL[0..2] used by pods leaves COL[3] free for a kubelet, exactly as
  pdb-drain does. ✅
- **5 pods on one Worker does NOT fit** the shared grid — `L.cols(16,5)` leaves 0.7 slab
  margin and breaks pod-column alignment with every other scenario. So the 5 replicas MUST
  split max 3 / 3 across the two Workers. Spec must state the distribution.

**Recommended fixed homes** (victim set then spans both nodes — prevents the misread
"scale-down drains a node"):

```
api-0  [ 9.4, -0.6,  6.55]  Worker A          api-2  [ 9.4, -0.6, -3.15]  Worker B
api-1  [13.8, -0.6,  6.55]  Worker A          api-3  [13.8, -0.6, -3.15]  Worker B  (hidden)
api-4  [18.2, -0.6,  6.55]  Worker A (hidden)
```

**Before binding**, the two revealed pods sit in the queue column exactly where pdb-drain's
replacement sits: `L.queueSlots(2)` → `KIT.stack([2, 1.2, 9.9], 2, 1.5)`. Reveal there
(`show`), then one `KIT.move()` per pod to its Worker slot at bind time — same box, no clone.

**Retirement is missing from the spec.** Authoring guide: a retired component "may fade or
move aside" and must not silently reactivate. Recommend an explicit graveyard, mirroring
preemption's victims-return-to-queue and eviction's `P.evicted`:

```
POS.deleted = KIT.stack([L.X.queue, 1.2, L.Z.workload], 3, 1.5)   // x=2, z=3
```
Move the 3 victims there with `tone:'doomed'` + badge, keep them visible through the chapter
(they are the evidence), `hide` only at the closing phase.

---

## C. Step / phase choreography · VERDICT: **change — drop `KIT.sweep` for the ranking**

`kubelet-eviction-ranking.js` already solved this and the spec picked the opposite pattern.
Its solution: **one phase per *criterion*, not per *candidate***, with the whole candidate set
carried as stable HUD rows that re-tone/re-order between phases. 3 criteria, 4 pods → 3 phases.
`KIT.sweep` is for the scheduler-filter case where each candidate fails a *different* plugin;
here all 5 pods go through the *same* comparator and the lesson is the order of the rules.
Sweeping 5 pods × 6 predicates is the phase-count creep the spec's own risk note fears.

**Recommended Ch.2 = 5 phases:**

| # | claim | HUD |
|---|---|---|
| 2.1 | `kubectl scale --replicas=2` writes the same scale subresource — sign is the only difference | replica rows |
| 2.2 | `pod-deletion-cost` short-circuits the whole chain (or: no pod sets it, so the chain runs) | 5 pod rows, cost column |
| 2.3 | **State beats age**: unassigned → Pending → not-Ready. One claim, three predicates as ordered evidence | 5 pod rows re-ordered |
| 2.4 | **Ties break on age, newest first**: readySeconds → restarts → creationTimestamp | 5 pod rows, ranks + crown-inverse on victims |
| 2.5 | RS issues 3 `DELETE`s; survivors stated | replica rows |

2.3 and 2.4 each carry 3 predicates as **beats within one claim** (Rule 4 allows ordered beats
that are evidence for the same claim) — not as separate phases. Stagger the marks
`at: 0.4 / 0.7 / 1.0`, total < 600 ms so no playback controls needed.
2.5 is one claim → three staggered `KIT.mark` + `KIT.move`, not three phases.

Design the workload so **exactly 3 of the 6 predicates fire**; the other three appear as
greyed HUD row text ("not applicable — all Running"), which teaches they exist without
spending a phase. Total scenario: Ch.1 ≈ 6 phases, Ch.2 = 5, Ch.3 = 2 → **13 phases**, in line
with pdb-drain (17) and eviction.

---

## D. HUD · VERDICT: **change — both calls are wrong as specified**

1. **`KIT.score('ready', n)` is a rendering bug.** `score.v` drives bar width as a percentage
   (0–100). `score('ready', 5)` renders a **5 %** bar next to a gauge bar that is 100 % — the
   viewer reads "ready is nearly empty". Use `gauge` for a count. Reserve `score` for 0/1-ish
   flags (as pdb-drain does for `disruptionsAllowed`).
2. **A gauge whose total moves 3→5→2 misleads.** The HUD contract is "rows compare like against
   like, in a stable order across phases … read a before/after by looking at which row moved."
   If the denominator moves with the numerator, `3/3`, `5/5` and `2/2` all render as a full bar
   and the entire scale story renders as *no change*. Also `spec.replicas` is a desired input,
   not a measurement out of a capacity — it has no natural denominator.

**Fix — pin the denominator to the scenario maximum (`config.scaleUp = 5`) for every row,
every phase**, and mirror pdb-drain's `budget()` helper shape:

```js
const replicas = (desired, current, ready, tone) => [
  KIT.gauge('spec.replicas',        desired, run.maxReplicas, ' Pods', {txt: desired + ' desired'}),
  KIT.gauge('status.replicas',      current, run.maxReplicas, ' Pods'),
  KIT.gauge('status.readyReplicas', ready,   run.maxReplicas, ' Pods',
            {tone: ready === desired ? 'ok' : 'warn', win: ready === desired})
];
```
Now 3→5→2 visibly grows then shrinks, and the desired/ready gap during scale-up is readable as
two bars of different length. `run.maxReplicas` comes from the model, not a literal.

During the ranking phases (2.2–2.4) swap to eviction's pattern: 5 gauge rows, one per pod,
same order every phase, `txt` carrying the deciding field's value, `tone` `danger` on victims.

---

## E. Tone / shape / label — surfacing the deciding rule · VERDICT: **ok, with a hard "do not"**

No Rule-3 conflict, provided the rule never enters `label`. Four surfaces, each doing its job:

- **label** — `'api-4\nReady'`. Name + configuration only. Changes only if the config changes.
  **Do not** write `'api-4\nnewest — victim'`.
- **badge** (`KIT.mark`) — the verdict + the short rule name: `KIT.mark('doomed', 'victim #1 · newest')`.
  This is precisely Rule 1's "verdict belongs on the thing".
- **hover** — the full predicate and its value:
  `'creationTimestamp 2m ago — later than every survivor; comparator rule 6'`.
- **panel `why`** — the misconception. Mandatory here: *"more restarts does not mean deleted
  first — restarts only break a tie that readiness already left open."*

Shapes: keep `shape:'seal'` for pods and `'slab'` for Workers (deck convention). Controllers stay
plain `box`. Do **not** encode replica count in any silhouette (`grid`/`rack` count state) — the
guide forbids a live number in a silhouette, and it would duplicate the HUD.

Tones: pending pods `peer`; bound-not-ready `warn`; ready `live`; victims `doomed`;
survivors after scale-down `live` + `win` on the HUD row.

---

## F. Pipeline stages · VERDICT: **change**

`Request · Deployment · ReplicaSet · Schedule · Settle` is not a total order for this scenario:
`Schedule` never happens on scale-down, `Settle` is a non-event, and Ch.3 (the PDB contrast)
maps to no stage at all. The strip would sit on a stale stage for a third of the deck.

The kit explicitly blesses backwards pointing ("a retry really does re-enter an earlier stage"),
so the fix is to make the stages *direction-neutral mechanism steps* that both chapters re-enter:

```js
pipeline: [
  KIT.stage('✎', 'Scale',     'ok'),      // PATCH scale subresource   (ch.1 + ch.2)
  KIT.stage('⇄', 'Propagate'),            // Deployment ctrl → RS spec (ch.1 + ch.2)
  KIT.stage('⧉', 'Reconcile'),            // RS ctrl compares desired vs actual
  KIT.stage('⇢', 'Bind',      'ok'),      // scheduler + kubelet       (ch.1 only)
  KIT.stage('⌦', 'Select',    'danger')   // rank + DELETE             (ch.2, ch.3)
]
```

Ch.2 legitimately walks `Scale → Propagate → Reconcile` again and then branches to `Select`
instead of `Bind` — *that re-entry is the lesson* ("same three hops, opposite sign"). Ch.3 pins
`pipelineStep: 4` (Select) because the contrast is about how Select deletes.

---

## G. Accessibility / semantic surface (§4c) · VERDICT: **change — five omissions**

1. **No `hover` mandated.** §4c: every component's kind and shape state must be identifiable
   from label/hover text alone. Spec names shapes but never hover. Require hover on all 11 nodes.
2. **No causal contract per phase.** §3 requires each phase result to declare `primaryClaim`,
   `changedInput`, `heldConstantInputs`, `capacityBoundary`, `failureAssumptions`, plane verdicts.
   Spec's `simulate()` returns only `{initial, scaleUp, scaleDown, created[], victims[]}`.
   Minimum viable: per-phase `{changedInput: 'spec.replicas 3→5', heldConstant: ['resources',
   'nodes', 'PDB'], result: '...'}` — that triple is exactly what `aria-live` announces.
3. **No flow typing.** §3a requires `kind` + `mode` on every relation. Here:
   `kubectl→API` control/commit · `API→Deployment ctrl` metadata/no-op (a watch) ·
   `RS ctrl→Pod (create)` control/copy · `RS ctrl→Pod (delete)` control/commit.
   A create arrow and a delete arrow must not be distinguishable by colour alone — put the verb
   in `KIT.link({label})`, as pdb-drain does throughout.
4. **Provenance is prose, not a field.** Spec's risk section says state the ordering as
   "current upstream heuristic" in the *why* line. §3a requires it be classified:
   `{evidenceClass: 'unverified-source-note', sourceRef: '<k8s replica_set controller sort>',
   asOf: '2026-08-14', confidence: 'medium'}`, and the panel renders that classification.
   This matters more here than anywhere in the deck — the ordering genuinely shifts by release.
5. **Reduced-motion end state untested.** Success criteria omit it. Add: with animation skipped,
   the DOM must still state replica count, the 3 victims, and each victim's deciding rule.

Not required (shell already provides): skip link, `<main>`, chapter `<nav>`, phase hash,
`aria-current="step"`.

---

## Spec edits required

Line-level changes to `phase-01-scenario-manual-scale.md`:

1. **L60–62 (Architecture · Columns)** — replace `ReplicaSet controller (Z.workload, offset)`
   with `Deployment controller (Z.workloadOwner = -1.5, NEW band, add in phase 00) ·
   ReplicaSet controller (Z.workload = 3, identical coord to pdb-drain) · scheduler (Z.sched)`.
2. **Add to phase-00 dependency list** — `L.Z.workloadOwner = -1.5` is a new phase-00
   deliverable; phase-00 currently adds only `autoscale`/`provision`. Update phase-00 L38–41
   and its todo list too.
3. **L45–47 (Non-functional)** — add: *"5 Pods split max 3 per Worker (`L.cols(X.node,4)`
   admits 3 pod slots + 1 agent slot); hidden Pods reveal in `L.queueSlots(2)` and reach their
   Worker by a single `KIT.move`."*
4. **L45–47** — add retirement rule: *"Victims move to `POS.deleted =
   KIT.stack([L.X.queue, 1.2, L.Z.workload], 3, 1.5)` with `tone:'doomed'`; they stay visible
   through Ch.2 and are hidden only in the closing phase. Retired Pods never reactivate."*
5. **L90–92 (Ch.2)** — delete `one phase per applied rule, using KIT.sweep`. Replace with the
   5-phase table in §C; state that the predicate ladders are `beats` inside phases 2.3/2.4.
6. **L94–95 (HUD)** — replace with the fixed-denominator `replicas()` helper in §D. Delete
   `KIT.score('ready', n)` entirely (score `v` is a 0–100 bar width, not a count).
7. **L96 (pipeline)** — replace the 5 stages with `Scale · Propagate · Reconcile · Bind · Select`
   per §F; add a note that Ch.2 deliberately points backwards.
8. **L77–78 (model)** — extend the `simulate()` return with `maxReplicas`, per-phase
   `{changedInput, heldConstant, result}`, and typed relations (`kind`/`mode`).
9. **L79–82 (step 2)** — add: each comparator predicate returns
   `{rule, field, value, evidenceClass, sourceRef, asOf}`; the ordering carries
   `evidenceClass: 'unverified-source-note'`, not a prose disclaimer.
10. **L42–44 (Functional)** — add: *"The deciding rule appears in the Pod's `mark` badge and
    `hover`, never in its `label` (Rule 3)."*
11. **L110–115 (Success Criteria)** — add three: (a) HUD denominator identical on every phase;
    (b) every node has hover text naming its kind; (c) with reduced motion / animation skipped,
    the DOM states replica count, victims, and each victim's deciding rule.
12. **L117–124 (Risk)** — delete the `KIT.sweep` mitigation (superseded); replace with
    "criterion-per-phase, candidate-per-HUD-row, as `kubelet-eviction-ranking.js`".

## Unresolved questions

1. `Z.workloadOwner = -1.5` sits 1.5 from `Z.policy = -3` — a future scenario needing both a
   Deployment controller and a disruption controller would overlap. Options: (a) accept, and
   document the two bands as mutually exclusive; (b) move `Z.policy` to `-4.5`, which changes
   pdb-drain's rendered output and breaks phase-00's "zero change to existing scenarios"
   constraint. Recommend (a); needs a call.
2. Should the Deployment appear as an **object** (`deploy/api`, `SIZE.gate`, in the store band
   at `[L.X.core, 0, L.Z.store]` — the slot PDB occupies in pdb-drain) *in addition to* the
   Deployment controller? It is what `kubectl scale` actually PATCHes, and the scenario's
   headline claim is "you wrote a subresource, not a Pod". Costs one box, buys the lesson.
3. Ch.3 (PDB contrast) — does it reveal a PDB box that is then shown as *never consulted*
   (strong, but a component that does nothing risks reading as a bug), or stay panel-prose +
   a `KIT.note` only? Recommend the note; confirm.
4. Which 3 of the 6 comparator predicates should fire for the authored workload? Fewer firing
   rules = tighter phases but a less complete picture. Recommend: not-Ready, shorter
   readySeconds, newest — skipping unassigned/Pending/restarts. Needs the author's call.
