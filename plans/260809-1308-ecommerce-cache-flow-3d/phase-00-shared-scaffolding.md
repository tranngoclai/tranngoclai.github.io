# Phase 00 — Shared scaffolding

## Context Links
- `docs/flow3d-deck-authoring.md` §4a (files), §4b (script band), §5 (TONE)
- `docs/caching-levels-flow.md` §10 (summary table = source of the cost/TTL data)
- Reference: `k8s-flow-3d/k8s-flow-3d-layout.js`, `k8s-flow-3d-deck.js`, `k8s-flow-3d.html`
- Overview: [plan.md](plan.md)

## Overview
- Priority: P1 (blocks 01-04)
- Status: ✓ completed
- Effort: 1.5h
- Everything four scenarios share: the folder, the layout law, the level cost
  table, the deck chrome, the empty `SCENARIOS`, the HTML shell, the root card.

## Key Insights
- k8s deck learned the hard way that per-scenario coordinates drift; it fixed it
  with one `*-layout.js` law. Start with the law here rather than retrofitting.
- All four scenarios walk the same 9 levels in the same left→right order, so the
  X axis is the single strongest teaching device in the deck. Fix it once.
- The per-level latency/TTL numbers appear in three scenarios (read, cold, and as
  the stale-window baseline in write). Duplicating them in three models would let
  them disagree — extract one frozen table module.
- `flow3d.css` and the engine are referenced via `../flow3d/…`, so the new folder
  sits as a sibling of `k8s-flow-3d/`, not nested.

## Requirements
Functional
- `ECOM_CACHE_LAYOUT` exports X columns, Z role bands, Y helpers, `SIZE` table,
  row helpers, `lanes()`, `cols()`.
- `ECOM_CACHE_LEVELS` exports a frozen 9-entry level table + shared formatters
  (`fmtMs`, `fmtTtl`, `fmtMoney`, `fmtPct`) and input validators.
- `FLOW3D.deck({...})` called with Vietnamese chrome.
- `window.SCENARIOS = [];` before any scenario file.
- HTML shell loads kit → deck → layout → levels → scenarios-index → scenario
  files → engine, in that order.

Non-functional
- No file over 200 lines. No edits under `/flow3d`.
- Layout + levels modules are pure data/pure functions; runnable under `node`.

## Architecture
X axis = distance from client to disk (the request's journey):

```
 client  browser  cdn    lb    app    orm    db     os    disk
  -34     -27     -19    -11    -2      6     14     22    30
```

`dns` sits at the `browser` X but on the `resolve` Z band — it is a side lookup,
not a link in the data path. Z bands:

```
 z = +9  resolve/control  DNS resolver, admin console, CI runner, Pub/Sub bus
 z =  0  spine            the request data path, left to right
 z = -9  store/backing    Redis keyspace, data files, WAL, dirty-page list, CI cache bucket
```

`SIZE` table (heights encode tier): `actor`, `gate` (every cache-lookup box is
the same size at every level — that sameness IS the lesson), `core`, `store`,
`engine`, `queue`, `surface` slab, `entry` (a cached object/page).

Level table shape, one frozen entry per level 1-9:
`{n, key, name, control, invalidation, serveMs, missForwardMs, ttlSec, onRequestPath}`
— `serveMs`/`missForwardMs` feed phases 01/03, `ttlSec`/`invalidation` feed 02,
`onRequestPath:false` marks level 9 only.

## Related Code Files
Create
- `ecommerce-cache-flow-3d/ecommerce-cache-flow-3d.html`
- `ecommerce-cache-flow-3d/ecommerce-cache-flow-3d-deck.js`
- `ecommerce-cache-flow-3d/ecommerce-cache-flow-3d-layout.js`
- `ecommerce-cache-flow-3d/ecommerce-cache-flow-3d-level-costs.js`
- `ecommerce-cache-flow-3d/ecommerce-cache-flow-3d-scenarios-index.js`

Modify
- `index.html` — add a third card next to the K8s Flow 3D card.

Do not touch
- everything under `flow3d/`, everything under `k8s-flow-3d/`.

## Implementation Steps
1. `mkdir ecommerce-cache-flow-3d`.
2. Copy `k8s-flow-3d/k8s-flow-3d.html` → `ecommerce-cache-flow-3d/ecommerce-cache-flow-3d.html`.
   Leave all markup and the `../flow3d/*` kit + engine bands untouched; replace
   only the DECK band (deck → layout → level-costs → scenarios-index → the 4
   scenario file groups) per authoring §4b.
3. Write `-layout.js` as an IIFE assigning `window.ECOM_CACHE_LAYOUT`, mirroring
   the header-comment style of `k8s-flow-3d-layout.js`: state each law, then the
   data. Include `L.X`, `L.Z`, `L.Y`, `L.on(h)`, `L.SIZE`, `L.row`, `L.cols`,
   `L.lanes`, `L.spread`.
4. Write `-level-costs.js`: `finite()`/`nonNegative()` validators, `LEVELS`
   frozen array, `byKey()` lookup, and the four formatters. Throw on any
   non-finite or negative field at load.
5. Write `-deck.js`: `FLOW3D.deck({lang:'vi', title, brand:'⛁ shophub-cache',
   sidebarTitle:'Scenarios', canvasLabel, intro:{eyebrow,title,sub,cta}})`.
   Do not declare scenario chips — the shell renders them from `SCENARIOS[]`.
6. Write `-scenarios-index.js`: one line, `window.SCENARIOS = [];`.
7. Add the root `index.html` card: `href="ecommerce-cache-flow-3d/ecommerce-cache-flow-3d.html"`,
   tag `Interactive deck`, Vietnamese blurb.
8. Open the HTML — splash renders with zero chips, no console error. That is the
   correct intermediate state.

## Todo List
- [x] Create folder
- [x] Copy + rewrite HTML script band
- [x] `-layout.js` with the four laws documented in its header
- [x] `-level-costs.js` with validators and formatters
- [x] `-deck.js` chrome (vi)
- [x] `-scenarios-index.js`
- [x] Root `index.html` card
- [x] Load HTML: splash renders, console clean

## Success Criteria
- Page loads, splash shows deck copy, no console errors, empty scenario list.
- `node -e "global.window={};require('./ecommerce-cache-flow-3d/ecommerce-cache-flow-3d-level-costs.js');console.log(window.ECOM_CACHE_LEVELS.LEVELS.length)"` prints `9`.
- Same command for `-layout.js` prints the X column count without throwing.
- `git status` shows no modification under `flow3d/`.

## Risk Assessment
- **X columns too wide for the default camera** → verify with one throwaway box
  at each extreme before writing four worlds against the law. Mitigation: tune
  `L.X` spacing and per-scenario `w.cam()` distance in phase 01, then freeze.
- **Level table over-modelled** (invented numbers not in the doc) → only encode
  fields the doc states or that are plainly illustrative; mark illustrative
  latencies as such in the file header.
- **Layout law drifts** once four worlds exist → every world must read `L.SIZE`,
  never literal sizes. Enforce at review.

## Security Considerations
- Static client-side deck, no secrets, no network calls beyond the existing
  Three.js CDN and Google Fonts links inherited from the k8s shell.
- Content is fictional (ShopHub, PID-4521); no real customer or pricing data.

## Next Steps
Unblocks phases 01-04. Phase 01 is the first consumer of both shared modules and
will surface any gap in the layout law.
