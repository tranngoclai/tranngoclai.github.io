# Phase 04 — Scenario: Build cache (level 9, off the request path)

## Context Links
- `docs/caching-levels-flow.md` §9 (build/compiler cache and the runtime vs
  build-time argument), §10 row 9, §11 "tối ưu tự do"
- `docs/flow3d-deck-authoring.md` §1 (one-way layering — the doc cites it by name)
- Depends on: [phase-00](phase-00-shared-scaffolding.md); closes the loop into
  [phase-02](phase-02-scenario-write-path.md) purge mechanics

## Overview
- Priority: P3 (last, deliberately)
- Status: ✓ completed
- Effort: 2h
- **Post-review fix (applied):** hidden-node reveal changed from `set[key]:KIT.move(...,{hidden:false})` to phase-level `show:[...]` array (CDN-purge and browser-handoff phases) per code-review feedback.
- The CI pipeline never runs during a user request. It produces the artifacts
  levels 2 and 3 will cache. Separate story, separate world, on purpose.

## Key Insights
- The doc's argument for separating this scenario is the same one-way layering
  rule the flow3d kit enforces between model/world/steps. That parallel is worth
  making explicit in the scenario's opening phase — it justifies the deck's own
  structure to the viewer.
- Correctness contrast: a wrong build cache key produces a stale *artifact*; a
  wrong runtime cache key produces a stale *price*. Level 9 is free to be
  aggressive because it cannot serve a user the wrong number.
- The closing beat is the punchline of the whole deck: a content-hashed filename
  means the browser needs **no invalidation at all** — the URL changed, so the
  old entry is simply never requested again. Contrast directly with phase 02,
  where the browser was the one level that could not be purged.
- Three sub-caches with three different key strategies: lockfile hash (all or
  nothing), per-module content hash (partial reuse), Docker layer chain (prefix
  reuse — one changed layer invalidates every layer after it).

## Requirements
Functional
- `simulate(config)` returns per-sub-cache `{key, hit, savedSec}` for install /
  compile / docker, `totalSec`, `coldTotalSec`, `savedSec`, `savedPct`, plus the
  emitted `bundleName` (`main.[hash].js`) old vs new.
- `dockerLayers(changedIndex)` — pure fn returning reused vs rebuilt layers,
  demonstrating prefix invalidation.
- Validate: module counts integers ≥ 0, changed ≤ total, durations non-negative.

Non-functional
- Model must not read `ECOM_CACHE_LEVELS` request-path costs — different units,
  different meaning. Only the level-9 metadata row is shared.

## Architecture
A different world from the other three (this is the point), but reusing the
layout law's `SIZE` table and the `cdn`/`browser` X columns at the far right so
the handoff lands where the viewer expects it:

```
 z+ resolve band:  ci-trigger(system) → ci-runner(surface slab)
 z  0 spine:       lockfile(gate) → installer(engine) → bundler(engine)
                     → docker-builder(engine) → registry(store)
                     → [x = cdn column] cdn-edge(gate) → browser-cache(gate)
 z- store band:    ci-cache-bucket(store), module-cache(store), layer-cache(store)
```

`subject` is the commit/build being followed, not a request. Say so in the first
phase so the violet box is not misread as an HTTP request.

Pipeline: `Trigger · Install · Compile · Image · Publish · Purge`.

## Related Code Files
Create
- `…-scenario-build-cache-model.js`
- `…-scenario-build-cache-world.js`
- `…-scenario-build-cache-steps.js`
- `…-scenario-build-cache.js` (assembly)

Modify
- `ecommerce-cache-flow-3d.html` — four entries, last scenario group.

## Implementation Steps
1. Model: `DEFAULT_CONFIG` — `lockfileChanged: false`, `modulesTotal`,
   `modulesChanged`, `dockerLayers`, `dockerChangedIndex`, per-step cold
   durations. Freeze it; validate as above.
2. Model: `simulate()` computes each sub-cache's hit, saved seconds, and the
   totals; derives `bundleName` from a short content hash so the old/new names
   differ visibly.
3. Model: `dockerLayers(changedIndex)` returns `{reused, rebuilt}` arrays.
4. World: build the CI lanes plus the two right-hand runtime boxes; keep the CI
   boxes on the `engine` tone family and the runtime pair exactly as they look
   in the other scenarios, so the handoff is recognisable.
5. Steps arc A (framing): one phase stating that nothing here is on the request
   path, and why mixing it into read/write would misrepresent the system.
6. Steps arc B (install): hash `package-lock.json` → key unchanged → restore
   `node_modules` from the CI bucket, `crown`, skip `npm install`; a `warn`
   sibling phase for the lockfile-changed miss.
7. Steps arc C (compile): per-module content hash; unchanged modules reuse the
   persistent compile output (`ok`), changed modules rebuild (`warn`); HUD gauge
   `modulesRebuilt / modulesTotal`.
8. Steps arc D (docker): layer chain; one changed layer marks everything after
   it `danger` — prefix invalidation, visually distinct from arc C's per-module
   reuse.
9. Steps arc E (publish + handoff): push image/bundle → `main.[newhash].js` →
   trigger CDN purge (level 3) → browser (level 2) requests the new filename
   automatically; explicit phase: "no browser invalidation happened — the URL
   changed". Close with the trade-off note: build cache errors cost a wrong
   artifact, never a wrong price.
10. Assembly + smoke test.

## Todo List
- [x] `-model.js` three sub-caches + `dockerLayers()` + validators
- [x] `node` assertions: hits reduce `totalSec`; `dockerLayers` prefix rule
- [x] `-world.js` (CI lanes + right-hand runtime handoff)
- [x] `-steps.js` five arcs
- [x] `-build-cache.js` assembly
- [x] HTML entries (last group)
- [x] Walkthrough smoke test
- [x] Full-deck pass: all four scenarios, console clean

## Success Criteria
- Opening phase states the off-request-path framing before any machinery.
- Docker arc visibly differs from the compile arc (prefix vs per-item).
- Final phase shows the browser fetching a new filename with no purge call.
- `node`: `savedSec === coldTotalSec - totalSec` and
  `dockerLayers(k).rebuilt.length === layers - k`.

## Risk Assessment
- **Viewer reads the CI world as another request path** → different Z framing,
  explicit first phase, and `subject` relabelled as the build.
- **Scope creep into full CI/CD teaching** (test caching, matrix builds) → hold
  to exactly the three sub-caches the doc names.
- **Right-hand handoff boxes imply the request path is live here** → keep them
  `hidden: true` until the publish arc reveals them.

## Security Considerations
- Build caches are a real supply-chain surface: a poisoned cache entry keyed on a
  weak hash ships arbitrary code. One phase's `why` should note that the key must
  be a content hash of the lockfile, not a branch name — this is also the doc's
  §10 row-9 failure mode. Do not expand into a threat catalogue.
- No registry credentials, tokens, or real pipeline URLs appear anywhere.

## Next Steps
Deck complete. Final pass: walk all four scenarios, verify splash chips render
from `SCENARIOS[]`, then update `docs/caching-levels-flow.md` "Quyết định đã
chốt" item 4 (currently says the deck is not built) and add the deck to
`index.html` if not already done in phase 00.
