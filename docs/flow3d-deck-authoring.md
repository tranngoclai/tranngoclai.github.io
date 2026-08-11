# flow3d deck authoring guide

How to build a new scenario deck (e.g. AWS, CI/CD, business flow) on top of
the flow3d kit and engine, without reading a single `k8s-flow-3d-scenario-*.js`
file.

Domain-neutral files (`flow3d-*`) live under `/flow3d`. K8s-specific scenario files (`k8s-flow-3d-*`, `k8s-flow-3d.html`) live under `/k8s-flow-3d`. A new domain deck (e.g. `aws-flow-3d`) would get its own top-level folder alongside `/k8s-flow-3d`, reusing `/flow3d`.

---

## 1. The five layers

A deck is five layers of files.  Each layer is allowed to know about the layers
above it but never about the layers below.

```
 layer          what it does                              knows about
 ─────────────  ─────────────────────────────────────────  ──────────────────
 deck manifest  shell copy: splash, brand, sidebar title  SCENARIOS[].name
 model          deterministic domain simulation; the       nothing (pure fn)
                source of every domain value shown
 world          components, positions, tones; reads        model (labels)
                labels from the model
 steps          phases: copy + choreography; reads         model (verdicts,
                verdicts from the model                    numbers)
 assembly       runs the model once, wires world + steps   model, world, steps
                into KIT.scenario()
```

**Deck manifest** (`flow3d-deck.js:127`)
Calls `FLOW3D.deck({...})` with the chrome that wraps every scenario: page
language, document title, topbar brand, sidebar heading, canvas `aria-label`,
and the intro splash.  The scenario chips on the splash are rendered from
`SCENARIOS[].name` automatically -- never declared in the manifest.

**Model**
A plain-JS module that exports pure functions and a frozen `DEFAULT_CONFIG`.
It owns every domain value the panel copy and the 3D states reference, including
topology, policy, workload, verdicts and derived metrics.  Presentation values
such as coordinates, camera distance and animation timing stay in world/steps.
No Three.js, no DOM -- runnable under plain `node` for regression assertions.

**World**
A function receiving the raw engine context (`w.node`, `w.txt`, `w.cam`) and
declaring every component via `KIT.world(w).node(key, {...})`.  The world is
built once and never torn down.

Every conceptual component also has a lifecycle, even when the renderer keeps
its mesh allocated:

- `inactive` -- declared by the world but not yet part of the current design.
- `active` -- participates in the current causal state.
- `retired` -- no longer participates; it may fade or move aside.
- `historical` -- retained only to explain an earlier state or comparison.

`hidden` is a presentation flag, not a lifecycle.  A retired component must not
silently become active again outside an explicit replay/reset transition.

**Steps**
An array of step objects, each optionally subdivided into `phases`.  A step
groups phases under one title; a phase is one causal claim + one explanation +
one beat of choreography.  The phase expander (`flow3d-engine-phase-expander.js`)
flattens phases into ordinary steps before the engine runs, so the rendering
layer never knows about them.

**Assembly**
Runs the deterministic model with its default config, computes derived results,
and calls `KIT.scenario({name, tag, pipeline, world, steps})`.

---

## 2. The four rules the kit enforces

These emerged from the two original scenarios and are argued in the file headers
cited.  They are not guidelines -- the kit API makes it hard to violate them.

### Rule 1 -- one thing = one component
`flow3d-kit-world-builder.js:9`

The persistent world is built once.  The same entity stays the **same box** when
it moves (via `KIT.move()`), rather than being replaced at the destination.  A
thing's verdict belongs **on** the thing (tone + badge), never on a separate chip
beside it.

Replication is different from movement.  A cache fill, fan-out or retry must
create an explicit copy/token and preserve the source; never teleport one box to
several destinations.  Aggregate crowds may be one component only when their
cardinality and aggregation semantics are stated.

### Rule 2 -- captions on the front face
`flow3d-kit-world-builder.js:21`

The kit computes `labelPos` from the box's own geometry -- centred on the front
face, `FACE_GAP` proud of it (`flow3d-kit-design-tokens.js:98`).  This avoids
back-row captions stacking on front-row boxes.  Use `caption: 'top'` only for
boxes too thin to print on.

### Rule 3 -- a label carries name + configuration only
`flow3d-kit-world-builder.js:29`

`'Worker A\n11/12Gi'`, not `'Worker A -- failed NodeResourcesFit'`.  Labels
change only when the configuration they state actually changes.  Verdicts are
expressed through tone and badge; explanation belongs in the panel text.

### Rule 4 -- a phase states exactly one causal claim
`flow3d-engine-phase-expander.js:2`

One Next click = one phase = one causal claim. The viewer reads one explanation
for one claim, and only effects supporting that claim play. A distributed-system
claim may contain parallel `fork`, `join` or `copy` effects when simultaneity is
the point.

When a single claim needs an ordered trace -- for example request, retry,
deduplicate, then commit -- the phase may expose labelled `beats`. Beats are not
extra claims or navigation phases; each one must be necessary evidence for the
same claim. Beats must not be used to avoid splitting unrelated causes or
independently useful decisions into separate phases. A sequence longer than 600 ms provides Play/Pause, Previous/Next
beat, Replay and Skip. Unrelated causes still belong in separate phases.

Short effects keep timing offsets within 0-1.5 s and run once. Replay is always
user-triggered; causal motion does not auto-loop while the viewer reads. Long
traces do not hide their order in timing offsets; they use an explicit
timeline/scrubber and deterministic end state.

---

## 3. The model contract

Generalised from `k8s-flow-3d-scenario-kubelet-eviction-model.js` and
`k8s-flow-3d-scenario-scheduler-model.js`.

A model module:

1. **Exports pure deterministic functions** -- given the same input, the same
   output every time.  The simulation may describe topology, state transitions,
   policies, flows and arithmetic.  No side effects, no globals read.
2. **Exports a frozen `DEFAULT_CONFIG`** -- the exact configuration the
   scenario teaches.  The assembly clones it and feeds it to `simulate()`.
3. **Exposes `simulate(config)`** returning a result object that contains
   everything downstream (entities and lifecycle, typed relations, world labels,
   step verdicts, HUD values and causal invariants).
4. **Validates inputs** -- throws `TypeError` / `RangeError` on non-finite or
   negative values, so bad arithmetic surfaces at load time rather than as a
   wrong badge three steps later.
5. **Exposes formatters** (e.g. `fmtMi()`, `fmtCpu()`) so the panel copy, the
   world label, and the HUD all format the same number the same way.

For a system with independent planes or capability axes, the model uses a
structured architecture state rather than one scalar generation ID. For example,
media delivery, interaction, financial correctness and fleet policy evolve
independently and remain cumulative. A scalar generation ID is valid only
when every architecture really forms one total order.

Every phase result also declares a causal contract:

```js
{
  primaryClaim,
  changedInput,
  heldConstantInputs,
  affectedPlane,
  capacityBoundary,
  latencyTarget,
  consistencyRequirement,
  failureAssumptions,
  invariantIds
}
```

The result carries a verdict per plane: `pass`, `fail` or `untested`. A healthy
media path must not silently make an untested interaction or money path appear
healthy. Overall readiness is never stronger than the plane verdicts support.

The model is the **only** place a domain value is stated.  If the panel copy says
`768Mi < 1024Mi`, both `768` and `1024` come from the model result, never from a
literal in the step file.  Domain values include workload, capacity, thresholds,
rates, policy and derived results.  Coordinates, camera distance and animation
timing are presentation values and remain in world/steps.

### 3a. Typed flows and provenance

Every relation in the domain result declares what it carries and how it changes
identity.  Use a small vocabulary such as:

- `kind`: `media`, `control`, `metadata`, `money`. `interaction` may name a
  domain plane, but comment/like relations still use `metadata` as their kind.
- `mode`: `move`, `copy`, `fork`, `join`, `aggregate`, `commit`, `no-op`.

The current renderer may draw these relations with the same `KIT.link()` or
`KIT.flow()` primitive, but the phase copy, hover/focus text or legend must keep
their meanings distinguishable.  A visual arrow without semantic type is not a
complete authoring artifact.

Claims and planning inputs carry two independent provenance dimensions alongside
their value: `evidenceClass` says how well the input is supported, while
`derivationClass` says whether it is an input or computed result.

```js
{
  value: 2,
  unit: 'Mbps',
  evidenceClass: 'illustrative',
  // 'observed' | 'unverified-source-note' | 'estimated' | 'illustrative'
  derivationClass: 'input', // 'input' | 'derived'
  sourceRef: '...',         // required for observed facts and external rates
  asOf: 'YYYY-MM-DD',
  confidence: 'medium',
  assumption: 'average delivered bitrate per viewer'
}
```

Every derived record also lists `formula` and `inputProvenanceIds`. Never turn an
illustrative or unverified case-study value into a claim about a production
system. Step prose formats the model value and preserves both classifications.

### 3b. Visual grammar

Decks reuse the same meaning before introducing domain decoration:

| Meaning | Required visual behavior |
|---|---|
| Media | Continuous ribbon; source remains when a copy/fan-out occurs |
| Control | One-shot hollow pulse |
| Metadata | Dot bundle with explicit `xN`; distinct shapes for different event semantics |
| Money command | Token carrying operation ID/fingerprint; retry keeps the ID and adds attempt number |
| Ledger commit | One immutable seal; presentation effects never replace it |
| Capacity | Container boundary with demand/capacity gauge on its edge |
| Aggregate | Many tokens converge into a labelled bundle with ratio |
| Before/after | Ghost overlay with the same camera, workload and units |
| Assumption | Text badge plus provenance; never colour alone |

The default HUD has three rows: `Changed`, `Boundary`, `Result`. Calculations,
provenance and secondary metrics live in an accessible disclosure/table. A
pressure phase reads visually as `input delta -> boundary fills -> verdict`;
its fix reads `mechanism -> same-workload replay -> invariant result`.

---

## 4. Checklist for a new deck

### 4a. Files to create

| file | purpose |
|------|---------|
| `<domain>-flow-3d-deck.js` | Calls `FLOW3D.deck({...})` with the new deck's chrome |
| `<domain>-flow-3d-scenarios-index.js` | `window.SCENARIOS = [];` -- one line |
| `<domain>-flow-3d-scenario-<name>-model.js` | Deterministic domain simulation for the scenario |
| `<domain>-flow-3d-scenario-<name>-world.js` | Component layout via `KIT.world()` |
| `<domain>-flow-3d-scenario-<name>-<steps>.js` | Step/phase arrays (one or more files) |
| `<domain>-flow-3d-scenario-<name>.js` | Assembly: runs model, calls `KIT.scenario()` |

Multiple scenarios follow the same pattern, each with their own model/world/
steps/assembly set.

### 4b. The HTML shell

Copy `k8s-flow-3d/k8s-flow-3d.html` into a new `<domain>-flow-3d/` folder.  The markup is domain-neutral -- every piece of
visible text comes from the deck manifest or from scenario code.  The only
section that changes is the **script band** near the bottom of `<body>`:

```
 ── keep: Three.js CDN ──────────────────────────────────────────
 <script src="https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js">
 <script src="https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/controls/OrbitControls.js">

 ── keep: kit (domain-neutral) ──────────────────────────────────
 <script src="flow3d-kit-design-tokens.js">
 <script src="flow3d-kit-world-builder.js">
 <script src="flow3d-kit-state-marks.js">
 <script src="flow3d-kit-panel-and-hud.js">
 <script src="flow3d-deck.js">

 ── REPLACE: deck + scenarios ───────────────────────────────────
 <script src="<domain>-flow-3d-deck.js">
 <script src="<domain>-flow-3d-scenarios-index.js">
 <script src="<domain>-flow-3d-scenario-<name>-model.js">
 <script src="<domain>-flow-3d-scenario-<name>-world.js">
 <script src="<domain>-flow-3d-scenario-<name>-<steps>.js">
 <script src="<domain>-flow-3d-scenario-<name>.js">

 ── keep: engine (domain-neutral) ───────────────────────────────
 <script src="flow3d-engine-phase-expander.js">
 <script src="flow3d-engine-scene-setup.js">
 <script src="flow3d-engine-animation-helpers.js">
 ...remaining engine files...
 <script src="flow3d-engine-render-loop.js">
```

**Load order matters:**
- Kit before deck (deck calls `FLOW3D.deck()`).
- Scenarios-index before any scenario (creates `SCENARIOS`).
- Model before world (world reads labels from model).
- World and steps before assembly (assembly wires them into `KIT.scenario()`).
- Phase expander before engine (expander flattens phases).
- Engine last (reads `SCENARIOS` at init).

### 4c. Causal, content, and smoke validation

Open the HTML, walk every scenario end to end with the Next button, and confirm:

- Numbers in the panel prose, the 3D labels, and the HUD rows agree.
- No step throws in the browser console.
- The phase expander correctly splits steps that declare `phases`.
- Each phase explains one causal claim; parallel effects share that cause rather
  than hiding unrelated actions in one beat.
- Ordered beats inside one phase all prove the same primary claim and expose
  playback controls when the trace exceeds 600 ms.
- Movement, copy/fan-out, aggregation and lifecycle transitions preserve entity
  identity and satisfy the model's invariants.
- Every flow remains identifiable as media, control, metadata or money in text,
  hover/focus copy or a legend -- not by colour alone.
- Every observed fact, external rate and estimate retains provenance and its
  `observed` / `estimated` / `illustrative` classification.
- Every snapshot exposes the changed input, held constants, affected plane,
  capacity boundary, latency/consistency contract, failure assumptions and
  plane-level verdicts. Untested planes never inherit `pass` from the active one.

Also verify the always-present semantic surface. With WebGL unavailable, reduced
motion enabled or animation skipped, HTML/SVG/text must still convey component
identity, causal order, domain values, flow type and verdict. A blank canvas,
colour-only state or static screenshot without explanation is not acceptable.

The semantic surface is always mounted, not only after WebGL failure. It owns
chapter/phase navigation, the focused heading, ordered trace, changed input,
plane verdicts and before/after table. Canvas is a synchronized enhancement.
Next/Back updates a deep-linkable phase hash and browser history; the active
chapter/phase uses `aria-current="step"`. Component details open by focus/click;
hover is optional enhancement. `aria-live="polite"` announces only the concise
Changed/Boundary/Result summary. Forced-colors and reduced-motion paths preserve
shape, path label, focus visibility, ordered trace and deterministic end state.

The shell provides a skip link, one `<main>`, and a chapter `<nav>`. Next/Back
moves programmatic focus to the new phase heading without stealing focus during
an active form interaction. Predict/recap uses `<fieldset>` + `<legend>` and all
controls have visible `:focus-visible` treatment. If canvas is purely decorative
relative to the synchronized DOM, mark it `aria-hidden="true"`; if it exposes a
real interactive control, give that control an accessible name and state instead
of duplicating the whole semantic tree on the canvas.

---

## 5. What is domain-neutral and what is not

### Domain-neutral (`flow3d-*`)

Everything prefixed `flow3d-` knows nothing about any subject domain:

| file | role |
|------|------|
| `flow3d-kit-design-tokens.js` | `TONE`, `INK`, `TIME`, `FACE_GAP` |
| `flow3d-kit-world-builder.js` | `KIT.world()`, `KIT.stack()`, `region()` |
| `flow3d-kit-state-marks.js` | `KIT.mark()`, `KIT.pulse()`, `KIT.move()`, `KIT.link()`, `KIT.flow()`, `KIT.note()`, `KIT.beat()` |
| `flow3d-kit-panel-and-hud.js` | `KIT.desc()`, `KIT.gauge()`, `KIT.score()`, `KIT.stage()`, `KIT.scenario()`, `KIT.sweep()` |
| `flow3d-deck.js` | `FLOW3D.deck()` -- shell chrome |
| `flow3d.css` | All layout, chapter/capability rails, legacy pipeline, panel, HUD, splash |
| `flow3d-engine-*.js` | Scene setup, animation, persistent world, phase expansion, rendering |

### Domain-specific (`<domain>-flow-3d-*`)

Everything prefixed with the domain name:

| file | role |
|------|------|
| `<domain>-flow-3d-deck.js` | Chrome: splash copy, brand, language |
| `<domain>-flow-3d-scenarios-index.js` | Empty `SCENARIOS` array |
| `<domain>-flow-3d-scenario-*-model.js` | Deterministic domain simulation |
| `<domain>-flow-3d-scenario-*-world.js` | Component layout |
| `<domain>-flow-3d-scenario-*-<steps>.js` | Step/phase definitions |
| `<domain>-flow-3d-scenario-*.js` | Assembly |

### The TONE vocabulary is role-based, not domain-based

`TONE` names describe the **role a component plays in a story**, not the thing
itself (`flow3d-kit-design-tokens.js:4`):

| tone | role | k8s example | AWS example |
|------|------|-------------|-------------|
| `subject` | the one component the scenario follows | a Pod | a Lambda invocation |
| `peer` | same kind as subject, not being followed | another Pod | another invocation |
| `core` | the hub everything talks to | API Server | an API Gateway |
| `system` | a service that acts on its own | kube-scheduler | EventBridge |
| `gate` | a checkpoint the subject passes through | admission controller | IAM policy evaluation |
| `store` | durable storage | etcd | DynamoDB |
| `queue` | a buffer things wait in | ActiveQ | SQS |
| `engine` | low-level machinery | container runtime | Firecracker |
| `surface` | inert scenery | a Node platform | a VPC |
| `live` | healthy | Running | Succeeded |
| `ok` | passed a check | Filter passed | health check OK |
| `warn` | provisional | under pressure | throttled |
| `danger` | failed | Filter rejected | invocation error |
| `doomed` | marked for destruction | eviction target | terminating |
| `crown` | the winner | highest-scoring Node | selected target |

A raw hex is accepted anywhere a tone name is accepted, for genuine one-off
colours.

---

## Quick reference: kit API

### World building (`flow3d-kit-world-builder.js`)

```js
const w = KIT.world(raw);          // wrap the engine context

w.node(key, {
  label,           // name + config, '\n' for second line
  pos:  [x,y,z],   // home position
  size: [w,h,d],
  tone,            // TONE name or {col, edge, flash}
  order,           // build/entrance-animation order
  hidden,          // built but not shown until a step reveals it
  hover,           // hover text
  caption          // 'face' (default) | 'top' | [x,y,z]
});

w.region(text, x, z, order);       // floating area label

KIT.stack(topPos, count, gap);     // evenly spaced vertical positions
```

### State marks (`flow3d-kit-state-marks.js`)

```js
KIT.mark(tone, badge, {at, dy, hover, label, pos})
KIT.pulse(ink, badge, {at, dy, hover})
KIT.move(pos, {tone, ink, badge, at, dy})
KIT.link(a, fromKey, toKey, ink, {at, dur, loop, lift, width})
KIT.flow(a, [[from],[arc],[to]], ink, {at, dur, loop, width})
KIT.note(a, text, [x,y,z], ink, at)
KIT.beat(fromKey, toKey, ink, {mark, at, dy, hover, label, link})
```

### Panel and HUD (`flow3d-kit-panel-and-hud.js`)

```js
KIT.desc(lead, body, why)                      // three-part explanation
KIT.gauge(name, used, total, unit, {tone,win,txt}) // measurement row
KIT.score(name, value, {win, tone})            // rating row
KIT.stage(icon, label, tone)                   // pipeline position
KIT.scenario({name, tag, pipeline, world, steps, focusLabels, showPipeline})
KIT.sweep(items, fn)                           // map candidates to phases
```

The current kit exposes `pipeline` for a true total order. Before implementing a
multi-axis deck, extend and test the contract with `chapters`, `capabilityAxes`
and `showCapabilityMap`; do not serialize independent capabilities just to fit
the legacy field. This guide specifies that required extension but does not
claim the current engine already implements it.

### Deck manifest (`flow3d-deck.js`)

```js
FLOW3D.deck({
  lang,            // e.g. 'en'
  title,           // document.title
  brand,           // topbar brand text
  sidebarTitle,    // sidebar heading
  canvasLabel,     // aria-label on the 3D canvas
  intro: {
    eyebrow,       // small text above the title
    title,         // HTML allowed (<br> for line breaks)
    sub,           // HTML allowed
    cta            // button text
  }
});
```

### Phase fields (declared in steps, expanded by `flow3d-engine-phase-expander.js`)

```js
{
  title,           // step title (context heading)
  phases: [{
    title,         // this beat's own heading
    desc,          // KIT.desc(lead, body, why)
    focus,         // [keys] -- components to highlight
    labels,        // [keys] -- components that keep their caption
    cam,           // [x, y, z] camera centre
    dist,          // camera distance
    pipelineStep,  // legacy: only for a true total-order pipeline
    activeChapter, // required extension: stable chapter key/camera preset
    capabilityState, // required extension: structured state for all axes
    causalBeats,   // required extension: ordered evidence for one primary claim
    set,           // {key: KIT.mark(...) | KIT.pulse(...) | KIT.move(...)}
    show,          // [keys] to reveal
    hide,          // [keys] to remove
    showAt,        // {key: seconds}
    hideAt,        // {key: seconds}
    scene,         // function(a) { KIT.link(a,...); KIT.note(a,...); }
    scores,        // [KIT.gauge(...) | KIT.score(...)]
    scoreTitle,    // HUD heading
    scoreMode      // 'gauge' | 'score'
  }]
}
```

Fields `focus`, `cam`, `dist`, `pipelineStep`, `activeChapter` and
`capabilityState` fall through from the parent step when the phase does not
override them. The last two require the multi-axis engine extension above.

---

## Timing constants (`flow3d-kit-design-tokens.js`)

```
TIME.lead  = 0.30   when a flow starts after the phase lands
TIME.draw  = 1.05   how long a flow takes to travel
TIME.loop  = 3.70   legacy automatic replay cycle
TIME.land  = 1.20   when a state change commits (after its flow arrives)
```

These are the defaults used by `KIT.link`, `KIT.flow`, and `KIT.beat`. Override
per call with `{at, dur, loop}`. New causal decks disable the legacy automatic
loop and run one-shot; the explicit Replay control invokes the sequence again.
