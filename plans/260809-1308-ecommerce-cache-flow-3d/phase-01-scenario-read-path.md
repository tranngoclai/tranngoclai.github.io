# Phase 01 — Scenario: Read path (cache hit cascade)

## Context Links
- `docs/caching-levels-flow.md` §1-8 and the "Kết luận cốt lõi" read-path block
- `docs/flow3d-deck-authoring.md` §3 (model contract), §2 (four rules)
- Reference shape: `k8s-flow-3d/k8s-flow-3d-scenario-pdb-drain-{model,world,steps}.js`
- Depends on: [phase-00](phase-00-shared-scaffolding.md)

## Overview
- Priority: P1 (the deck's anchor scenario; sets the visual grammar)
- Status: ✓ completed
- Effort: 2.5h
- Follow one `GET /products/4521` down levels 1→8, showing that a hit at any
  level short-circuits everything to its right, and what a full miss costs.

## Key Insights
- The teaching payload is the **short-circuit**, not the list of levels. Every
  level must be drawn as the same-size `gate` box so that "which one answered"
  is the only variable the eye tracks. The winner gets `crown`.
- Doc's governing principle: closer to client = cheaper but harder to revoke.
  The X axis already encodes it; the HUD must state the millisecond saving so
  the claim is numeric, not rhetorical.
- Level 1 (DNS) is not on the data path — it resolves a name before the request
  exists. Placing it on the `resolve` Z band avoids implying it caches content.
- Level 2 must show the doc's three-row header table: hashed bundle `immutable`,
  hero image `max-age + ETag`, price API `no-store`. The price API being
  uncacheable at the browser is exactly why the request reaches level 3 at all.

## Requirements
Functional
- `simulate(config)` returns per-level `{n,key,name,hit,serveMs,cumulativeMs}`,
  the `servedBy` level, `fullDepthMs`, `savedMs`, `savedPct`.
- Two runs are computed by the assembly from one model: the warm run (hit at
  CDN/Redis) and the deep run (miss through to disk) — same pure function, two
  configs, so the contrast is arithmetic, not two prose claims.
- Steps split into two files: edge levels 1-4, origin levels 5-8.
- Every phase = one level's lookup, or one hit/miss verdict. Never both.

Non-functional
- Model has no Three.js/DOM import and passes `node` assertions.
- Each file under 200 lines; steps split by arc if it grows past that.

## Architecture
World (spine, left→right), all boxes built once, none cloned:

```
 client(actor,subject) → browser-cache(gate) → cdn-edge(gate) → lb-proxy(gate)
   → origin-app(core) → redis(gate)+redis-store(store, z-)
   → orm-cache(gate) → db-engine(engine) + buffer-pool(store, z-)
   → os-page-cache(engine) + dirty-pages(queue, z-) → disk(store)
 z+ resolve band: dns-resolver(system) beside the browser column
```

One `entry` box (`tone: subject`, label `GET /products/4521`) is the request; it
`KIT.move()`s rightward level by level and moves back left when a level answers.
Same box throughout — Rule 1.

Pipeline: `DNS · Browser · CDN · Proxy · App · Store`.

## Related Code Files
Create
- `ecommerce-cache-flow-3d/ecommerce-cache-flow-3d-scenario-read-path-model.js`
- `…-scenario-read-path-world.js`
- `…-scenario-read-path-edge.js` (steps, levels 1-4)
- `…-scenario-read-path-origin.js` (steps, levels 5-8)
- `…-scenario-read-path.js` (assembly)

Modify
- `ecommerce-cache-flow-3d.html` — add these five in load order.

## Implementation Steps
1. Model: `DEFAULT_CONFIG` freezes the product (`PID-4521`, `$89.99`, stock 120),
   the hit-level for the warm run, and reads per-level costs from
   `ECOM_CACHE_LEVELS`. Validate: hit level in 1..8, all costs finite/non-negative.
2. Model: `simulate(config)` walks levels in order, accumulating `cumulativeMs`
   until `hit`, then returns the frozen result. Add `deepRun()` as
   `simulate({...DEFAULT_CONFIG, hitLevel: 8})` for the contrast.
3. World: read every position from `ECOM_CACHE_LAYOUT`; labels are name+config
   only (`'CDN edge\nTTL 60s'`, `'Redis\nproduct:4521 · TTL 300s'`) — Rule 3.
4. Edge steps: (a) DNS resolve hit; (b) browser cache — bundle hit vs price API
   `no-store` miss; (c) request leaves the device; (d) CDN key match; (e) CDN
   hit-fresh serving the SSR HTML, `crown` on `cdn-edge`; (f) the SWR variant as
   a `warn` beat; (g) CDN miss → forward to LB; (h) LB key + `Vary` match; (i) LB
   hit short-circuits before the app process.
5. Origin steps: (j) app receives the request; (k) `GET product:4521` on Redis;
   (l) hit → `crown` on Redis, DB untouched; (m) miss branch → ORM lookup;
   (n) ORM miss → real SQL; (o) buffer-pool page hit; (p) buffer-pool miss →
   OS page cache; (q) page-cache miss → disk seek; (r) fill back up the chain
   with `SET product:4521` and the final `crown`.
6. HUD per phase: `KIT.gauge('cumulative latency', cumulativeMs, fullDepthMs,
   ' ms')` plus `KIT.score('served by', levelName)` and `KIT.score('saved',
   fmtMs(savedMs))`. Every number from the model result.
7. Assembly: run the model once, pass `run` into world + both step factories.
8. Smoke test: walk end to end, confirm the request box never duplicates and the
   crown appears exactly once per branch.

## Todo List
- [x] `-model.js` + validators + `simulate()` + deep run
- [x] `node` assertions for warm and deep runs
- [x] `-world.js` against the layout law
- [x] `-edge.js` steps (levels 1-4)
- [x] `-origin.js` steps (levels 5-8)
- [x] `-read-path.js` assembly + pipeline stages
- [x] HTML script band entries
- [x] Walkthrough smoke test

## Success Criteria
- Panel prose, 3D labels, and HUD state the same milliseconds everywhere.
- Exactly one `crown` per served branch; the request is one box for the whole run.
- No console error across every step; phase expander splits both step files.
- `node` assertion: `warm.cumulativeMs < deep.cumulativeMs` and
  `deep.cumulativeMs === sum(serveMs 1..8)`.

## Risk Assessment
- **Ten spine boxes overflow the frame** → per-phase `cam`/`dist` follow the
  request instead of one wide static shot; verify readability at level 8.
- **Hit and miss branches told as one line** → viewer loses the short-circuit.
  Mitigation: the hit branch ends with `crown` and an explicit "levels 6-8 never
  ran" phase before the miss branch opens.
- **Invented latency numbers read as authoritative** → label the HUD row
  "illustrative" once, in the model header and the first phase's `why`.

## Security Considerations
- No auth surfaces modelled. If a personalised-response beat is added later, it
  must state `Vary: Cookie/Authorization` — caching a logged-in response under an
  anonymous key is a real data-leak class and must not be shown as a plain hit.

## Next Steps
Phase 03 reuses this model's cost walk for the all-miss case. Phase 02 assumes
the world grammar established here (same X order, same gate sizing).
