---
name: flow3d-hidden-node-reveal-bug
description: In flow3d decks (k8s-flow-3d, ecommerce-cache-flow-3d), a node created with hidden:true can ONLY be revealed via phase-level `show: [key]` (or timed `showAt`) — never via `hidden:false` inside a `set[key]` KIT.move()/KIT.mark() call, which is silently a no-op.
metadata:
  type: project
---

flow3d kit engine contract: `w.node(key, {hidden: true, ...})` creates a node
invisible by default. The ONLY way to reveal it later is the phase-level
`show: ['key']` array (or timed `showAt: {key: seconds}`), consumed by
`flow3d-engine-persistent-world.js` `applyStepLook()`. `KIT.move()`/`KIT.mark()`
pass any extra option keys into the per-step `set[key]` look object, but
`setNodeLook()` only reads `pos/label/col/edge/hover` from it — a `hidden`
key placed there is silently dropped, never checked anywhere in the engine.

**Why:** Found during review of `ecommerce-cache-flow-3d` (first deck built
after `k8s-flow-3d`) — an agent wrote `set: {entry: KIT.move(pos, {hidden:
false, ...})}` in 4 places across 2 scenario files (write-path, build-cache),
believing this would reveal hidden nodes. It doesn't. Verified by reading
`flow3d-engine-persistent-world.js` (`setNodeLook`, `applyStepLook`) and
`flow3d-engine-flow-state.js` (`scheduleStateChange`) directly, and confirmed
the correct pattern by grepping `show:` usage in the older, correct
`k8s-flow-3d/*.js` scenario files (e.g. `k8s-flow-3d-scenario-pdb-drain-steps.js:31`).
This is NOT caught by static checks (kit-rule compliance, node-reference
integrity) — it's a rendering-time behavior only visible by walking the
scenario in-browser.

**How to apply:** When reviewing any flow3d deck (or authoring one), grep for
`hidden:\s*(true|false)` inside `set:` blocks — that's always wrong. The only
legitimate uses of `hidden` are (a) at `w.node()` creation time, and (b) as a
top-level phase field `show:`/`hide:` (immediate) or `showAt:`/`hideAt:`
(timed). Full report:
`ecommerce-cache-flow-3d/plans/reports/code-reviewer-260809-1411-ecommerce-cache-flow-3d-deck.md`.
