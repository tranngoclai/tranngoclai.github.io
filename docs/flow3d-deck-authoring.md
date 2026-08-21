# flow3d deck authoring guide

How to build a new scenario deck (e.g. AWS, CI/CD, business flow) on top of
the flow3d kit and engine, without reading a single scenario file.

Domain-neutral files (`flow3d-*`) live under `/flow3d`. K8s-specific scenario files (`k8s-flow-3d-*`, `k8s-flow-3d.html`) live under `/k8s-flow-3d`. A new domain deck (e.g. `aws-flow-3d`) would get its own top-level folder alongside `/k8s-flow-3d`, reusing `/flow3d`.

**The reference implementation is the k8s `scheduler-pipeline` scenario.** Every
rule in §1–§6 is demonstrated there. When this guide and a deck disagree, the
deck is wrong; when this guide and the reference scenario disagree, this guide
is stale. §6 is the conformance checklist that turns that claim into something
you can grep for.

This guide describes the kit, the engine and the authoring contract. It
deliberately contains **no scenario content** — no step copy, no component keys,
no per-deck numbers. Read a scenario file for those; read this file for the
rules that hold across every scenario. Everything here is a rule the shipped kit
and engine enforce today and the reference scenario demonstrates — if a field is
not documented here, the engine does not read it.

---

## 1. The six layers

A deck is six layers of files.  Each layer is allowed to know about the layers
above it but never about the layers below.

```
 layer          what it does                              knows about
 ─────────────  ─────────────────────────────────────────  ──────────────────
 deck manifest  page metadata: lang, title, canvasLabel    nothing
 layout law     column order, role bands, one SIZE table   nothing
 model          deterministic domain simulation; the       nothing (pure fn)
                source of every domain value shown
 world          components, positions, tones; reads        layout law, model
                labels from the model                      (labels)
 steps          phases: copy + choreography; reads         model (verdicts,
                verdicts from the model                    numbers)
 assembly       runs the model once, wires world + steps   model, world, steps
                into KIT.scenario()
```

**Deck manifest** (`flow3d-deck.js`)
Calls `FLOW3D.deck({...})` with the three pieces of *page* metadata: `lang`,
`title`, `canvasLabel`.  That is the whole surface -- there is **no splash
gate**: the engine renders the first registered scenario immediately, and the
scenario selector is populated from the registry.  Scenario names, tags and
chrome belong to `KIT.scenario()`, never to the manifest.

**Layout law** (`<domain>-flow-3d-layout.js`)
A deck-wide table of X columns, Z bands, Y heights and one `SIZE` map, plus
helpers (`lanes()`, `cols()`, `queueSlots()`, `on()`).  Every world reads from
it and **no world hand-types a coordinate or a size**.  This is what keeps a
shared component the same size across every scenario in the deck, and keeps a
column in the same place when the viewer switches scenarios mid-session.
Components being *compared* to each other must share one `SIZE` entry -- if the
box is bigger the viewer reads "more important", which is the wrong lesson when
the point is that only colour and badge distinguish them.

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
and calls `KIT.scenario({id, name, tag, pipeline, world, steps})`.

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

`'<name>\n<configuration>'`, never `'<name> — <verdict>'`.  Labels change only
when the configuration they state actually changes.  Verdicts are expressed
through tone and badge; explanation belongs in the panel text.

Everything after the first `\n` is wrapped in `<span class="detail">` by
`captionHtml()` (`flow3d-engine-label-zoom-detail.js:26`) and hidden at wide
camera distances.  So line 1 must be the identity on its own -- a caption whose
name only makes sense together with its second line is unreadable in a wide
shot.

### Rule 3b -- state lives on a status chip, not in the caption
`flow3d-kit-world-builder.js:35`, `flow3d-engine-node-status-label.js`

A component has **three** text channels and they are not interchangeable:

| channel | lifetime | carries |
|---|---|---|
| caption (`label`) | changes only when configuration changes | name + configuration |
| badge (`KIT.mark`/`pulse` `badge`) | **one phase** -- built into the step layer, torn down on the next Next, and never re-created on replay | "this just changed" |
| status chip (`status`) | replayed from step 0 by `applyPersistentStep()`, so it survives every later phase | the component's current lifecycle state |

The consequence authors get wrong: **a verdict that must still be true three
phases later cannot live in a badge.**  A badge announces the moment; the chip
holds the conclusion.  A checkpoint that rejects a candidate writes both -- a
badge naming the reason for that one beat, and `status: 'rejected'` so the
`✕ Fail` chip is still on the component many phases later.

`status` takes a *token* from `NODE_STATUS` (`flow3d-engine-node-status-label.js:26`),
never a free-form sentence: one coloured glyph + exactly one word, so the same
state renders identically in every deck.  An unknown token logs a console
warning and falls back to the raw string.  Tokens available today:

```
pending queued scheduling bound assigned synced creating pulling starting
running ready passed rejected throttled pressure terminating evicted killed
full winner
```

`status` is accepted at build time (`w.node(key, {status})`) and in every state
mark (`KIT.mark(tone, badge, {status})`, `KIT.pulse`, `KIT.move`, and via
`KIT.beat`'s `status` option).

A badge is a tag, not a sentence. `KIT.mark`/`pulse` warn on the console once
per badge over **28 characters** (`flow3d-kit-state-marks.js:42`) -- past that
the pill is wide enough to collide with neighbouring labels. Detail belongs in
`desc()` or an `explain` beat.

### Rule 3c -- every phase declares `labels`
`flow3d-engine-scenario-registry.js:37`

`focusLabels` defaults **on**, which means the engine shows a caption only for
the components a phase names in `labels`. A phase that omits `labels` therefore
falls back to whatever the previous phase left standing, and a deck that never
declares `labels` prints every caption in every frame -- the exact wall of
numbers the front-face caption rule exists to prevent.

Declare `labels` on every phase: the components whose *name and configuration*
are load-bearing for this one claim. The rest keep their geometry and their
tone, they just stop shouting. At baseline a deck carries roughly one `labels`
declaration per phase.

### Rule 4 -- a phase states exactly one causal claim
`flow3d-engine-phase-expander.js:2`

One Next click = one phase = one causal claim. The viewer reads one explanation
for one claim, and only effects supporting that claim play. A distributed-system
claim may contain parallel `fork`, `join` or `copy` effects when simultaneity is
the point.

When a single claim needs an ordered trace -- for example request, retry,
deduplicate, then commit -- the phase may expose labelled beats. Beats are not
extra claims or navigation phases; each one must be necessary evidence for the
same claim. Beats must not be used to avoid splitting unrelated causes or
independently useful decisions into separate phases. Unrelated causes still
belong in separate phases.

The practical test is whether a hop is a **stage of one journey** or a
**decision of its own**. A request passing through a fixed sequence of gates on
its way to a single destination is one journey: it never turns back and has
exactly one endpoint, so it is one phase drawn with `KIT.chain`
(`flow3d-kit-state-marks.js:178`), which emits n−1 arrows in a single phase,
each departing as the previous one lands.

```js
const PACE = {at: 0.35, dur: 0.85};
const HOP  = KIT.chainTimes(3, PACE);   // the schedule, computed once

set: {
  'gate-1': KIT.mark('ok', '<verdict tag>', {at: HOP[0].arrive}),
  'gate-2': KIT.mark('ok', '<verdict tag>', {at: HOP[1].arrive})
},
scene(a) {
  KIT.chain(a, ['origin', 'gate-1', 'gate-2', 'destination'], 'info',
    Object.assign({labels: ['<action>', '<action>', '<action>'],
                   inks:   ['info', 'pass', 'pass']}, PACE));
}
```

`set` is written outside `scene`, so both must agree on when each hop lands.
`KIT.chainTimes(n, pace)` is that shared schedule -- read it from both, and
retiming the sequence never desynchronises a badge from its arrow. Hand-typing
two sets of offsets is the bug this exists to prevent.

Whereas a filter evaluating four candidates is four decisions -- each can pass
or fail independently and each is separately useful -- so it is four phases,
generated with `KIT.sweep(<model's candidate list>, fn)` over the *model's* list
rather than a hand-written array. Structure comes from the model; only the prose
is written by hand.

### Rule 4b -- explanation is reader-paced, in the scene
`flow3d-engine-explain-beats.js`

The shipped form of a beat is the `explain` array on a phase.  The panel is no
longer where the explanation is read: each beat is a bubble anchored **in the
scene**, and one Next click plays exactly one beat.  Only when a phase runs out
of beats does the next Next advance to the next phase.

```js
explain: [
  {of: 'gate-1',              text: '<one sentence about this component>', tone: 'sky'},
  {of: ['worker', 'queue'],   text: '<one sentence about the pair>',       tone: 'mute'}
]
```

| field | meaning |
|---|---|
| `of` | key, array of keys, or `[]`. Drives the camera *and* the bubble anchor |
| `text` | the sentence; inline HTML (`<b>`, `<code>`, `<span class="hi">`) allowed |
| `tone` | INK name for the bubble border |
| `dy` | override the bubble's lift (default 2.4 single / 3.4 group) |

The engine derives framing from `of` -- authors never hand-place a beat camera:

- **one key** -- frames tight on it; the bubble hangs over that component.
- **several keys** -- frames the group; the bubble sits at the group's centroid,
  because the sentence belongs to no single member.
- **empty, or every key still hidden** -- the bubble hangs at the current camera
  target rather than being dropped. Beats about a component that has not been
  revealed yet do not move the camera.

Two properties follow from this and both matter when authoring:

- **Consecutive beats sharing the same `of` do not re-frame.** Three beats about
  one component in a row hold one shot. Splitting a subject across non-adjacent
  beats costs the viewer a camera move each time -- keep beats about one
  component together.
- **Beats are reader-paced, so no playback controls are needed.** The bubble
  stands until the viewer clicks Next; there is no timer. `Prev` is symmetric --
  it steps back one beat inside the phase before falling through to the previous
  phase, so an accidental Next never destroys an explanation.

A phase with no `explain` array is technically legal -- one Next, one phase --
which is what made the field additive when it landed. **It is no longer
optional for new work.** A phase without beats puts its whole explanation in the
side panel, so the viewer reads text while looking away from the thing being
described, and the camera never visits the component the sentence is about. A
scenario with zero `explain` arrays is not at baseline, however good its panel
copy is.

The panel `desc` does not go away -- it stays as the printable long form, and
its `lead` is still the intro card (Rule 4c). The beats are the same argument
cut into the pieces the camera can visit.

Short effects keep timing offsets within 0-1.5 s and run once. Replay is always
user-triggered; causal motion does not auto-loop while the viewer reads.

### Rule 4c -- an opening card is a hook; the scene is the explanation
`flow3d-engine-ui-controller.js`

Two overlays open a scenario, and both are gates the viewer dismisses (Next,
Space, Enter, Escape or the Skip button) -- neither runs on a timer, so the
choreography behind them never plays unseen.

**Step intro** fires on the first phase of each step when navigating (not on
scenario load, not on `prefers-reduced-motion`).  It renders `⑤ <step title>`
plus **one hook line**, and the hook is the `lead` argument of that phase's
`KIT.desc(lead, body, why)` -- taken as plain text, `.lead` span only.

This makes `lead` do double duty, and constrains how it is written:

- Keep `lead` under ~25 words. It is the card, and a card long enough to need
  scanning both spoils the beats and stops being a hook.
- `lead` must stand alone. `body` and `why` never reach the card.
- The step glyph comes from `stepNo` (`①②③…`), falling back to a plain number
  past the glyph table, so a deck with more than 15 steps still renders.

**Pipeline intro** (`pipelineIntro` on the scenario) is the one-time opening for
the whole deck: it reveals the cast and spotlights each named component in turn
while the world's own establishing wide shot holds.  It must not start a camera
tween of its own -- the world's `w.cam(...)` is the establishing shot, and the
zoom into step ① is the payoff.  Captions are scoped to the spotlit component
for its duration, so only one name is ever on screen.

```js
pipelineIntro: {
  title: '<one line — the hook for the whole deck>',
  desc:  '',                       // optional second line
  nodes: ['<key>', '<key>', …],    // the cast, revealed up front
  bubbles: [                       // `at` spacing IS the pacing of the opening
    {key: '<key>', text: '<name>', at: 0.5, dur: 0.6, tone: 'info'},
    {key: '<key>', text: '<name>', at: 1.3, dur: 0.6, tone: 'core'}
  ],
  overviewAfter: 0.9               // lift the dim for a full-architecture beat
}
```

Those five fields are the whole contract (`flow3d-engine-ui-controller.js:140`).
`nodes` are revealed up front; each bubble's `at` spotlights one `key` and dims
the rest without moving the camera; `overviewAfter` seconds past the last bubble
the dim lifts (default `0.9` when omitted). Keep `dur` under the gap to the next
bubble or two names end up on screen at once. Any other key you write here is
silently ignored -- a `duration` field, for instance, does nothing, because the
card is a gate the viewer dismisses, not a timed slide. Nothing warns about a
dead key, so check the field names against the list above rather than against an
older deck.

Both overlays are skipped entirely under `prefers-reduced-motion`, so nothing
load-bearing may live only on a card.

Bubbles here are name-only badges, not explanation -- the explanation is the
camera move.  A per-component "what is this thing" introduction is **not** a
separate system: `explain` beats already name a component the first time a beat
is about it.  An earlier `componentIntro` registry that did this in parallel was
removed precisely because it produced two competing sentences on one component.

---

## 3. The model contract

A model module:

1. **Exports pure deterministic functions** -- given the same input, the same
   output every time.  The simulation may describe topology, state transitions,
   policies, flows and arithmetic.  No side effects, no globals read.
2. **Exports a frozen `DEFAULT_CONFIG`** -- the exact configuration the
   scenario teaches, deep-frozen (`Object.freeze` on nested arrays and objects
   too).  The assembly feeds it to `simulate()`.
3. **Exposes `simulate(config)`** returning a result object that contains
   everything downstream needs: entities and lifecycle, relations, world labels,
   step verdicts and HUD values.
4. **Validates inputs** -- throws `TypeError` / `RangeError` on non-finite or
   negative values, so bad arithmetic surfaces at load time rather than as a
   wrong badge three steps later.
5. **Exposes formatters** (e.g. `fmtMi()`, `fmtCpu()`) so the panel copy, the
   world label, and the HUD all format the same number the same way.
6. **Publishes one namespaced global** (`window.<DOMAIN>_MODEL`), which the
   world and the assembly read. Nothing else is exported.

The model is the **only** place a domain value is stated.  If the panel copy
states a comparison between two numbers, both numbers come from the model
result, never from a literal in the step file.  Domain values include workload,
capacity, thresholds, rates, policy and derived results.  Coordinates, camera
distance and animation timing are presentation values and remain in world/steps.

### 3a. Shape vocabulary

SHAPE is a third vocabulary, orthogonal to TONE (role) and SIZE (a deck's own
`*-layout.js`). It answers "what kind of thing is this", via
`flow3d-kit-shape-library.js`'s `KIT.SHAPE` registry and `KIT.world().node()`'s
`shape` param. Omit `shape` and a node stays a plain `box` -- zero-change for
every world written before this vocabulary existed.

| shape | kind | typical use |
|---|---|---|
| `box` | service | a stateless process or request handler |
| `slab` | platform / scenery | ground, a host, inert backdrop |
| `cylinder` | durable store | a database, disk-backed store |
| `hex` | checkpoint / policy | admission control, IAM evaluation |
| `rack` | buffer / queue | a queue, a stack of pending items |
| `grid` | aggregate | a fixed-cardinality cluster or matrix |
| `client` | client device (monitor) | a client, a worker, a physical device |
| `seal` | immutable commit | a ledger entry, a signed/committed record |
| `tiers` | layered store | a cache with multiple tiers, a layered store |
| `redis` | layered cache (Redis) | deck-registered `tiers` variant; product marks embossed into the same solid |

A shape's silhouette never encodes a live number. `grid` always renders a
fixed 3x3 matrix regardless of how many real items it represents, and never
rotates to face a flow's direction -- every shape always stands vertical. The
real count is redundant text in the label, never the silhouette's only
source: a component's kind and state must stay identifiable from text alone,
matching the rule that colour is never the only signal.

Some shapes carry state orthogonal to TONE (look) and lifecycle (identity):
`fill` (0..1, e.g. `cylinder`), `count` (0..max, e.g. `rack`, `grid`), `open`
(bool, e.g. `hex`). Only the param a shape's `SHAPE[id].state` declares
support for has any effect; state changes are absolute values (never deltas)
so `applyPersistentStep`'s replay-from-step-0 stays deterministic.

A deck-specific shape is allowed only via `KIT.defineShape(id, def)`, which
throws unless the definition supplies both a text `kind` and a `geo(w,h,d)`
function. The *call* still lives in `flow3d-kit-shape-library.js` alongside the
shared vocabulary -- `redis` is the worked example -- so that no scenario file
ever contains a raw THREE.js call, and so the a11y layer can name every shape
in the registry from one place. A shape id used by a world but never registered
falls back silently to `box` (`flow3d-kit-world-builder.js:92`), which is why a
typo'd `shape` never errors and never looks obviously wrong. Preview every shape
(including any custom ones) via
`flow3d/flow3d-shape-gallery.html`, a standalone dev tool that renders the
whole registry with captions and flow-anchor markers and doubles as a
geometry-regression check.

---

## 4. Checklist for a new deck

### 4a. Files to create

| file | purpose |
|------|---------|
| `<domain>-flow-3d-deck.js` | Calls `FLOW3D.deck({...})` with the page metadata |
| `<domain>-flow-3d-layout.js` | Layout law: X columns, Z bands, one `SIZE` table, lane/slot helpers |
| `<domain>-flow-3d-scenarios-index.js` | `window.SCENARIOS = [];` -- one line |
| `<domain>-flow-3d-scenario-<name>-model.js` | Deterministic domain simulation for the scenario |
| `<domain>-flow-3d-scenario-<name>-world.js` | Component layout via `KIT.world()` |
| `<domain>-flow-3d-scenario-<name>-<part>.js` | Step/phase arrays -- split by story handover when one file grows past ~600 lines |
| `<domain>-flow-3d-scenario-<name>.js` | Assembly: runs model, calls `KIT.scenario()` |

Multiple scenarios follow the same pattern, each with their own model/world/
steps/assembly set. Two scenarios may share one model when they teach the same
mechanism from different angles; the sharing scenario then has no model file of
its own.

### 4b. The HTML shell

Copy `k8s-flow-3d/k8s-flow-3d.html` into a new `<domain>-flow-3d/` folder.  The
markup is domain-neutral -- every piece of visible text comes from the deck
manifest or from scenario code.  Copy the current shell rather than an older
deck's: the engine resolves several elements by id and silently degrades when
one is missing --

| element | owner | missing means |
|---|---|---|
| `#step-intro` / `#intro-title` / `#intro-desc` / `#intro-skip` | Rule 4c overlays | no step or pipeline intro |
| `#nav-progress` | `refreshNavState()` | no `Step 5/9 · nhịp 2/4` readout |
| `#pipeline-ui` | HUD controller | no stage strip, and labels stop reserving the bottom band |
| `#score-hud` | HUD controller | `scoreMode` phases render nothing |

The only section that changes is the **script band** near the bottom of `<body>`.
The deck folder sits beside `/flow3d`, so every shared file is loaded with a
`../flow3d/` prefix:

```
 ── keep: Three.js CDN ──────────────────────────────────────────
 <script src="https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js">
 <script src="https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/controls/OrbitControls.js">

 ── keep: kit + registry (domain-neutral) ───────────────────────
 <script src="../flow3d/flow3d-kit-design-tokens.js">
 <script src="../flow3d/flow3d-kit-shape-library.js">
 <script src="../flow3d/flow3d-kit-world-builder.js">
 <script src="../flow3d/flow3d-kit-state-marks.js">
 <script src="../flow3d/flow3d-kit-panel-and-hud.js">
 <script src="../flow3d/flow3d-engine-scenario-registry.js">
 <script src="../flow3d/flow3d-deck.js">

 ── REPLACE: deck + scenarios ───────────────────────────────────
 <script src="<domain>-flow-3d-deck.js">
 <script src="<domain>-flow-3d-layout.js">
 <script src="<domain>-flow-3d-scenarios-index.js">
 <script src="<domain>-flow-3d-scenario-<name>-model.js">
 <script src="<domain>-flow-3d-scenario-<name>-world.js">
 <script src="<domain>-flow-3d-scenario-<name>-<part>.js">
 <script src="<domain>-flow-3d-scenario-<name>.js">
 ...repeat the five lines above per scenario...

 ── keep: engine (domain-neutral) ───────────────────────────────
 <script src="../flow3d/flow3d-engine-phase-expander.js">
 <script src="../flow3d/flow3d-engine-scene-setup.js">
 <script src="../flow3d/flow3d-engine-animation-helpers.js">
 ...remaining engine files...
 <script src="../flow3d/flow3d-engine-render-loop.js">
```

**Load order matters:**
- Kit before deck (deck calls `FLOW3D.deck()`).
- Scenario registry before any scenario (it defines `KIT.scenario()`; a
  scenario file that loads first throws on an undefined function).
- Layout law before any world (worlds read every coordinate and size from it).
- Scenarios-index before any scenario (creates `SCENARIOS`).
- Model before world (world reads labels from model).
- World and steps before assembly (assembly wires them into `KIT.scenario()`).
- Phase expander before the rest of the engine (expander flattens phases).
- Engine last (reads `SCENARIOS` at init).

### 4c. Causal, content, and smoke validation

Open the HTML, walk every scenario end to end with the Next button, and confirm:

- Numbers in the panel prose, the 3D labels, and the HUD rows agree.
- No step throws in the browser console, and no console warning fires for an
  over-long badge or an unknown `status` token.
- The phase expander correctly splits steps that declare `phases`.
- Each phase explains one causal claim; parallel effects share that cause rather
  than hiding unrelated actions in one beat.
- Ordered beats inside one phase all prove the same primary claim.
- Every `explain` beat's `of` names components that are actually revealed by
  that point; a beat pointing at a hidden component holds the frame instead of
  zooming at empty floor, which is correct behaviour but usually the wrong copy.
- Beats about one component sit adjacent, so the camera holds instead of
  drifting once per Next.
- `Prev` walks back through the beats of the current phase before leaving it,
  and is enabled on step 1 once a beat has been read.
- Each step's `lead` reads as a standalone hook on the intro card -- check the
  card, not just the panel.
- Any verdict that must outlive its phase is on a `status` chip, not only a
  badge. Walk past the phase and confirm it is still there.
- Movement, copy/fan-out, aggregation and lifecycle transitions preserve entity
  identity and satisfy the model's invariants.
- Every flow's meaning is identifiable from its `KIT.link` label, the panel copy
  or the note -- not by colour alone.
- Every component's kind (`box`, `cylinder`, `hex`, ...) and any shape state
  (`fill`, `count`, `open`) stay identifiable from its label/hover text --
  never from silhouette or overlay alone.
- With `prefers-reduced-motion` enabled both overlays are skipped, and nothing
  load-bearing was only on a card.

---

## 5. What is domain-neutral and what is not

### Domain-neutral (`flow3d-*`)

Everything prefixed `flow3d-` knows nothing about any subject domain:

| file | role |
|------|------|
| `flow3d-kit-design-tokens.js` | `TONE`, `INK`, `TIME`, `FACE_GAP` |
| `flow3d-kit-world-builder.js` | `KIT.world()`, `KIT.stack()`, `region()` |
| `flow3d-kit-shape-library.js` | `KIT.SHAPE` registry, `KIT.defineShape()` |
| `flow3d-kit-state-marks.js` | `KIT.mark()`, `KIT.pulse()`, `KIT.move()`, `KIT.link()`, `KIT.chain()`, `KIT.chainTimes()`, `KIT.flow()`, `KIT.note()`, `KIT.bubble()`, `KIT.beat()` |
| `flow3d-kit-panel-and-hud.js` | `KIT.desc()`, `KIT.gauge()`, `KIT.score()`, `KIT.stage()`, `KIT.sweep()` |
| `flow3d-engine-scenario-registry.js` | `KIT.scenario()` -- id validation, defaults, registration order |
| `flow3d-deck.js` | `FLOW3D.deck()` -- shell chrome |
| `flow3d.css` | All layout, panel, HUD, pipeline strip, intro overlays |
| `flow3d-engine-*.js` | Scene setup, animation, persistent world, phase expansion, explain beats, rendering |

### Domain-specific (`<domain>-flow-3d-*`)

Everything prefixed with the domain name:

| file | role |
|------|------|
| `<domain>-flow-3d-deck.js` | Page metadata: lang, title, canvasLabel |
| `<domain>-flow-3d-layout.js` | Layout law: columns, bands, one SIZE table |
| `<domain>-flow-3d-scenarios-index.js` | Empty `SCENARIOS` array |
| `<domain>-flow-3d-scenario-*-model.js` | Deterministic domain simulation |
| `<domain>-flow-3d-scenario-*-world.js` | Component layout |
| `<domain>-flow-3d-scenario-*-<part>.js` | Step/phase definitions |
| `<domain>-flow-3d-scenario-*.js` | Assembly |

### The TONE vocabulary is role-based, not domain-based

`TONE` names describe the **role a component plays in a story**, not the thing
itself (`flow3d-kit-design-tokens.js:4`):

| tone | role | example in one domain | example in another |
|------|------|-------------|-------------|
| `subject` | the one component the scenario follows | a unit of work | a Lambda invocation |
| `peer` | same kind as subject, not being followed | another unit of work | another invocation |
| `core` | the hub everything talks to | the central API | an API Gateway |
| `system` | a service that acts on its own | a scheduler | EventBridge |
| `gate` | a checkpoint the subject passes through | an admission check | IAM policy evaluation |
| `store` | durable storage | the consensus store | DynamoDB |
| `queue` | a buffer things wait in | the pending queue | SQS |
| `engine` | low-level machinery | the runtime | Firecracker |
| `surface` | inert scenery | a host platform | a VPC |
| `live` | healthy | running | Succeeded |
| `ok` | passed a check | check passed | health check OK |
| `warn` | provisional | under pressure | throttled |
| `danger` | failed | check rejected | invocation error |
| `doomed` | marked for destruction | eviction target | terminating |
| `crown` | the winner | the selected candidate | selected target |

A raw hex is accepted anywhere a tone name is accepted, for genuine one-off
colours.

---

## 6. Conformance baseline

What "matches the reference scenario" means, in the order the gaps actually
appear. Run these against a deck folder before calling it done.

### 6a. Shell

```sh
grep -c 'id="step-intro"' <domain>-flow-3d/*.html     # must be 1
```

The engine resolves the Rule 4c overlay elements by id and degrades **silently**
when they are missing -- no error, the intros simply never appear. A deck copied
from a shell predating the overlays has a dead `pipelineIntro` and dead step
cards, and nothing anywhere says so. Copy the current
`k8s-flow-3d/k8s-flow-3d.html`, not an older deck's.

### 6b. Authoring surface

Each of these is a rule above; the count is the cheap proxy for it.

| grep | rule | at baseline |
|---|---|---|
| `explain:` | 4b -- explanation in the scene | ≥1 per phase |
| `labels:` | 3c -- captions are scoped | ~1 per phase |
| `status:` | 3b -- verdicts outlive their phase | every lasting verdict |
| `pipelineIntro` | 4c -- the cast is introduced | 1 per scenario |
| `KIT.chain` | 4 -- multi-hop journeys | wherever a hop chain exists |
| `KIT.sweep` | 4 -- phases generated from the model | wherever the model lists candidates |

Zero `explain` or zero `status` across a whole deck is the signature of a deck
written before those channels existed, not of a deck that decided it did not
need them.

### 6c. The `status` question

The one that is hardest to see in review and most damaging in use: **walk to the
end of the scenario and ask which verdicts are still on screen.**

Every scenario has conclusions that must survive the phase that produced them --
which candidate passed, which tier answered, which write committed. If that
conclusion is carried by a `KIT.mark` badge alone, it is gone on the next Next
and gone again on replay, and by the final step the scene no longer shows the
result the scenario exists to teach. The badge announces the moment; the
`status` chip holds the conclusion. A verdict needs both.

### 6d. Values

```sh
# every hit in a step file is suspect
grep -nE '[0-9]{2,}' <domain>-flow-3d/*-scenario-*-*.js
```

A number in a step file that did not come from the model result is a number that
can drift out of agreement with the label and the HUD. Coordinates, camera
distance and timing offsets are the exceptions -- they are presentation, and
they belong in world/steps (timing) or the layout law (geometry).

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
  caption,         // 'face' (default) | 'top' | [x,y,z]
  status,          // NODE_STATUS token -- initial lifecycle state
  shape,           // a KIT.SHAPE id -- what kind of thing this is,
                   // orthogonal to tone/size. Omit for 'box' (zero-change).
  fill, count, open // shape state at build time -- only the param the
                   // shape declares support for (SHAPE[id].state) has effect
});

w.region(text, x, z, order);       // floating area label
w.cam([x,y,z], dist);              // the establishing wide shot

KIT.stack(topPos, count, gap);     // evenly spaced vertical positions
```

### State marks (`flow3d-kit-state-marks.js`)

```js
KIT.mark(tone, badge, {at, dy, hover, label, status, pos})
KIT.pulse(ink, badge, {at, dy, hover, status})
KIT.move(pos, {tone, ink, badge, at, dy, status})
KIT.link(a, fromKey, toKey, ink, {at, dur, loop, lift, width, label, labelDy})
KIT.chain(a, [keys], ink, {at, dur, gap, labels, inks, loop, hold, lift, width})
KIT.chainTimes(hopCount, {at, dur, gap})  // → [{at, arrive}] — the shared schedule
KIT.flow(a, [[from],[arc],[to]], ink, {at, dur, loop, width})
KIT.note(a, text, ref, ink, at)          // ref: 'key' | {of, band, dx, dy, dz} | [x,y,z]
KIT.bubble(a, key, text, {at, dur, tone, dy})
KIT.beat(fromKey, toKey, ink, {mark, at, dy, hover, label, status, link})
```

`label` on `KIT.link` is required at every call-site -- an arrow with no caption
does not say what action it is performing.

`KIT.chain` returns its hop schedule, so a `scene` that draws the chain and a
`set` written above it can share one source of timing (Rule 4). Use it for a
journey; use separate phases for separate decisions.

`KIT.note` names the component the caption is *about*, so the caption follows
that box when it moves; `band: true` drops it to the deck-wide headline height
(`KIT.NOTE_BAND`) for a phase summary rather than a fact about one box. **One
note per phase at most** -- it is the phase's headline inside the 3D frame, and
a second one turns the frame back into the wall of text the panel already is.

`KIT.bubble` is a short component-anchored aside on a timer, and several may be
visible at once (one per actor).  It is **not** the explanation channel -- that
is the phase's `explain` array, whose bubbles are reader-paced and never expire.

### Panel and HUD (`flow3d-kit-panel-and-hud.js`, `flow3d-engine-scenario-registry.js`)

```js
KIT.desc(lead, body, why)                      // three-part explanation
KIT.gauge(name, used, total, unit, {tone,win,txt}) // measurement row
KIT.score(name, value, {win, tone})            // rating row
KIT.stage(icon, label, tone)                   // pipeline position
KIT.sweep(items, fn)                           // map candidates to phases
KIT.scenario({id, name, tag, pipeline, pipelineIntro, world, steps,
              focusLabels, showPipeline})
```

`focusLabels` defaults **on** and `showPipeline` defaults to `!!pipeline`
(`flow3d-engine-scenario-registry.js:37`).  `id` is the stable key every
navigation path resolves through -- not the array index; it must be lowercase
kebab-case and unique, and registration throws otherwise.

Pipeline stages are the stages of the mechanism, not a summary of it: a stage
that is the longest and heaviest part of the run needs its own entry, or the
strip freezes for the whole time the viewer most needs a compass. Keep the
declared stage list and any prose about it in agreement -- nothing validates the
count.

### Deck manifest (`flow3d-deck.js`)

```js
FLOW3D.deck({
  lang,            // <html lang>, e.g. 'vi'
  title,           // document.title
  canvasLabel      // aria-label on the 3D canvas
});
```

Three fields, no splash. Anything else passed here is stored on
`FLOW3D.deckDefinition` and never rendered.

### Phase fields (declared in steps, expanded by `flow3d-engine-phase-expander.js`)

```js
{
  title,           // step title (context heading)
  phases: [{
    title,         // this phase's own heading
    desc,          // KIT.desc(lead, body, why) -- `lead` doubles as the
                   // step-intro hook (Rule 4c), so keep it under ~25 words
    explain,       // [{of, text, tone, dy}] -- reader-paced beats (Rule 4b);
                   // one Next plays one beat before the phase advances
    focus,         // [keys] -- components to highlight
    labels,        // [keys] -- components that keep their caption
    cam,           // [x, y, z] camera centre
    dist,          // camera distance
    pipelineStep,  // index into the scenario's `pipeline`
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

`focus`, `cam`, `dist` and `pipelineStep` fall through from the parent step when
the phase does not override them. This list is exhaustive: any other key is
ignored without a warning, so a phase field invented in a step file looks
correct in source and does nothing on screen.

---

## Timing constants (`flow3d-kit-design-tokens.js`)

```
TIME.lead  = 0.30   when a flow starts after the phase lands
TIME.draw  = 1.05   how long a flow takes to travel
TIME.loop  = 3.70   full replay cycle, shared across the phase
TIME.land  = 1.20   when a state change commits (after its flow arrives)
```

These are the defaults used by `KIT.link`, `KIT.flow`, `KIT.chain` and
`KIT.beat`. Override per call with `{at, dur, loop}`. A phase holds one action,
so its offsets stay inside the first ~1.5 s and the flow then replays gently on
`loop` while the viewer reads.
