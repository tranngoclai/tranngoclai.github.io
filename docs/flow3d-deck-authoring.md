# flow3d deck authoring guide

How to build a new scenario deck (e.g. AWS, CI/CD, business flow) on top of
the flow3d kit and engine, without reading a single `k8s-flow-3d-scenario-*.js`
file.

---

## 1. The five layers

A deck is five layers of files.  Each layer is allowed to know about the layers
above it but never about the layers below.

```
 layer          what it does                              knows about
 ─────────────  ─────────────────────────────────────────  ──────────────────
 deck manifest  shell copy: splash, brand, sidebar title  SCENARIOS[].name
 model          pure arithmetic; the source of every       nothing (pure fn)
                number the scenario shows
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
It owns every number the panel copy and the 3D states reference, so those two
surfaces cannot disagree.  No Three.js, no DOM -- runnable under plain `node`
for regression assertions.

**World**
A function receiving the raw engine context (`w.node`, `w.txt`, `w.cam`) and
declaring every component via `KIT.world(w).node(key, {...})`.  The world is
built once and never torn down.

**Steps**
An array of step objects, each optionally subdivided into `phases`.  A step
groups phases under one title; a phase is one action + one explanation + one
beat of choreography.  The phase expander (`flow3d-engine-phase-expander.js`)
flattens phases into ordinary steps before the engine runs, so the rendering
layer never knows about them.

**Assembly**
Runs the model with its default config, computes derived results, and calls
`KIT.scenario({name, tag, pipeline, world, steps})`.

---

## 2. The four rules the kit enforces

These emerged from the two original scenarios and are argued in the file headers
cited.  They are not guidelines -- the kit API makes it hard to violate them.

### Rule 1 -- one thing = one component
`flow3d-kit-world-builder.js:9`

The persistent world is built once.  A thing that moves must be the **same box**
moving (via `KIT.move()`), not a new box at the destination.  A thing's verdict
belongs **on** the thing (tone + badge), never on a separate chip beside it.

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

### Rule 4 -- a phase holds exactly one action
`flow3d-engine-phase-expander.js:2`

One Next click = one phase = one action.  The viewer reads the explanation for a
single beat, and only that beat's flows and state changes play.  Timing offsets
within a phase stay in the 0-1.5 s range, with short `loop` values so the
action replays gently while the viewer reads.

---

## 3. The model contract

Generalised from `k8s-flow-3d-scenario-kubelet-eviction-model.js` and
`k8s-flow-3d-scenario-scheduler-model.js`.

A model module:

1. **Exports pure functions** -- given the same input, the same output, every
   time.  No side effects, no globals read.
2. **Exports a frozen `DEFAULT_CONFIG`** -- the exact configuration the
   scenario teaches.  The assembly clones it and feeds it to `simulate()`.
3. **Exposes `simulate(config)`** returning a result object that contains
   everything downstream (world labels, step verdicts, HUD numbers).
4. **Validates inputs** -- throws `TypeError` / `RangeError` on non-finite or
   negative values, so bad arithmetic surfaces at load time rather than as a
   wrong badge three steps later.
5. **Exposes formatters** (e.g. `fmtMi()`, `fmtCpu()`) so the panel copy, the
   world label, and the HUD all format the same number the same way.

The model is the **only** place a number is stated.  If the panel copy says
`768Mi < 1024Mi`, both `768` and `1024` come from the model result, never from
a literal in the step file.

---

## 4. Checklist for a new deck

### 4a. Files to create

| file | purpose |
|------|---------|
| `<domain>-flow-3d-deck.js` | Calls `FLOW3D.deck({...})` with the new deck's chrome |
| `<domain>-flow-3d-scenarios-index.js` | `window.SCENARIOS = [];` -- one line |
| `<domain>-flow-3d-scenario-<name>-model.js` | Pure arithmetic for the scenario |
| `<domain>-flow-3d-scenario-<name>-world.js` | Component layout via `KIT.world()` |
| `<domain>-flow-3d-scenario-<name>-<steps>.js` | Step/phase arrays (one or more files) |
| `<domain>-flow-3d-scenario-<name>.js` | Assembly: runs model, calls `KIT.scenario()` |

Multiple scenarios follow the same pattern, each with their own model/world/
steps/assembly set.

### 4b. The HTML shell

Copy `k8s-flow-3d.html`.  The markup is domain-neutral -- every piece of
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

### 4c. Smoke test

Open the HTML, walk every scenario end to end with the Next button, and confirm:

- Numbers in the panel prose, the 3D labels, and the HUD rows agree.
- No step throws in the browser console.
- The phase expander correctly splits steps that declare `phases`.

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
| `flow3d.css` | All layout, pipeline strip, panel, HUD, splash |
| `flow3d-engine-*.js` | Scene setup, animation, persistent world, phase expansion, rendering |

### Domain-specific (`<domain>-flow-3d-*`)

Everything prefixed with the domain name:

| file | role |
|------|------|
| `<domain>-flow-3d-deck.js` | Chrome: splash copy, brand, language |
| `<domain>-flow-3d-scenarios-index.js` | Empty `SCENARIOS` array |
| `<domain>-flow-3d-scenario-*-model.js` | Pure arithmetic |
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
    pipelineStep,  // index into pipeline[]
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

Fields `focus`, `cam`, `dist`, and `pipelineStep` fall through from the parent
step when the phase does not override them.

---

## Timing constants (`flow3d-kit-design-tokens.js`)

```
TIME.lead  = 0.30   when a flow starts after the phase lands
TIME.draw  = 1.05   how long a flow takes to travel
TIME.loop  = 3.70   full replay cycle
TIME.land  = 1.20   when a state change commits (after its flow arrives)
```

These are the defaults used by `KIT.link`, `KIT.flow`, and `KIT.beat`.  Override
per call with `{at, dur, loop}`.
