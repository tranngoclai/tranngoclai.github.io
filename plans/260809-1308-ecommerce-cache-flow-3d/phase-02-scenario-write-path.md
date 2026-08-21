# Phase 02 — Scenario: Write path (invalidation cascade + two traps)

## Context Links
- `docs/caching-levels-flow.md` write-path block, §5 (race condition), §6 (WAL,
  no manual invalidation), §7 (ORM-bypass trap), §10 table, §11 risk list
- `docs/flow3d-deck-authoring.md` §2 Rule 1 and Rule 4
- Depends on: [phase-00](phase-00-shared-scaffolding.md); assumes the world
  grammar from [phase-01](phase-01-scenario-read-path.md)

## Overview
- Priority: P1
- Status: ✓ completed
- Effort: 3h
- **Post-review fix (applied):** hidden-node reveal changed from `set[key]:KIT.move(...,{hidden:false})` to phase-level `show:[...]` array (admin phase, race-reveal phase) per code-review feedback.
- Admin sets `PID-4521` price `89.99 → 79.99`. Invalidation travels the read
  path **backwards**, disk→client, and gets weaker at every step. Then two ways
  it silently fails.

## Key Insights
- The write path is the read path reversed, and that reversal is the lesson:
  levels that were cheapest to read (browser, CDN) are the most expensive to
  correct. Reuse phase-01's X columns so the reversal is visible as direction.
- Levels 6 and 8 need no invalidation call at all (WAL / kernel handle it);
  level 7 auto-invalidates via ORM signal; level 5 needs an explicit `DEL` or
  Pub/Sub; levels 3-4 need a purge API; level 2 cannot be invalidated at all —
  it only expires. Five distinct mechanisms, five distinct visual verbs.
- The race in §5 is an **ordering** bug, not a caching bug: A and B both read,
  B writes fresh, A writes stale later. It must be told with two `peer`/`subject`
  request boxes and a timeline, or it degenerates into "cache was wrong".
- The ORM-bypass trap in §7 is the sharpest single frame in the whole deck: DB
  correct, buffer pool correct, ORM cache wrong — a level being *above* the
  engine in the read order is the entire explanation.

## Requirements
Functional
- `simulate(config)` returns: `oldPrice`, `newPrice`, ordered `cascade[]` of
  `{level, mechanism, staleWindowSec, needsExplicitCall}`, and
  `totalStaleWindowSec` (worst-case time a user can still see `$89.99`).
- `raceOutcome({aReadAtMs, bReadAtMs, writeAtMs, aWriteAtMs, bWriteAtMs})` →
  pure fn returning the value that ends up in Redis and whether it is stale.
- `bypassImpact({viaOrm})` → which levels hold the correct value and which do
  not, when the update is raw SQL.
- Steps split: `-cascade.js` (the 8 levels) and `-traps.js` (race + bypass).

Non-functional
- Every price, TTL, and stale window from the model. No literals in step copy.
- The two traps must not mutate the cascade result — they are separate pure
  calls on the same config.

## Architecture
Same world spine as phase 01 (reused X order, mirrored direction of travel), plus:
- `admin-console` (`system`) on the resolve band, left of nothing — it enters at
  the DB end, which is itself the point.
- `wal` (`store`) and `buffer-pool` (`store`) behind `db-engine`.
- `pubsub` (`queue`) on the store band beside Redis, for the multi-instance
  invalidate fan-out (doc §5, kept at description depth per the doc's decision 3).
- `request-a` (`subject`) and `request-b` (`peer`) boxes, `hidden: true` until
  the race arc reveals them.

Pipeline: `Write · Engine · Kernel · ORM · App · Purge · Expire`.

Trap arcs are separate steps, not extra phases on the cascade step, so the
viewer knows the happy path already ended.

## Related Code Files
Create
- `…-scenario-write-path-model.js`
- `…-scenario-write-path-world.js`
- `…-scenario-write-path-cascade.js` (steps)
- `…-scenario-write-path-traps.js` (steps)
- `…-scenario-write-path.js` (assembly)

Modify
- `ecommerce-cache-flow-3d.html` — five entries in load order.

## Implementation Steps
1. Model: freeze `DEFAULT_CONFIG` with `oldPrice: 89.99`, `newPrice: 79.99`,
   per-level `ttlSec` read from `ECOM_CACHE_LEVELS`, and the race timeline.
   Validate prices finite and positive, timeline values finite and ordered.
2. Model: `simulate()` builds the cascade in write order — db → buffer pool +
   WAL → OS dirty page → ORM signal → Redis DEL/Pub-Sub → LB purge → CDN purge →
   browser expiry. Compute `totalStaleWindowSec` as the max, not the sum, and say
   so in the header (the levels expire in parallel, not in series).
3. Model: `raceOutcome()` and `bypassImpact()` as separate exported pure fns.
4. World: build the shared spine, plus WAL/buffer-pool/pubsub/admin and the two
   hidden request boxes.
5. Cascade steps, one phase each: admin PATCH → app UPDATE → buffer-pool page
   rewritten (`ok`, no call needed) → WAL append (`store` flash) → kernel dirty
   page (`warn`, `queue` box) → ORM `post_save` signal auto-purge (`doomed` on
   the ORM entry) → Redis `DEL product:4521` (`doomed`) → Pub/Sub fan-out to
   peer app instances → LB tag purge `product:4521` → CDN purge by URL/tag →
   browser: no purge exists, only TTL/ETag (`warn`, never `ok`) → closing frame
   ranking the levels by "how fast can you take it back".
6. Trap steps — race: reveal A and B; A reads old; admin writes; B reads new;
   B writes cache; A writes cache **after** and wins; Redis now `danger` holding
   `$89.99` while the DB is `$79.99`; final phase states the fix (short lock or
   version/timestamp compare before write) with the model's values.
7. Trap steps — ORM bypass: raw SQL `UPDATE` enters below the ORM; DB `ok`,
   buffer pool `ok`, ORM cache `danger` still serving `$89.99`; state that the
   read path consults level 7 before level 6, so a correct engine cannot save it.
8. Assembly: one model run; pass the same `run` plus the two trap results.

## Todo List
- [x] `-model.js`: cascade + `raceOutcome` + `bypassImpact` + validators
- [x] `node` assertions incl. the stale-write race producing `oldPrice`
- [x] `-world.js` (shared spine + WAL/pubsub/dirty-pages/A/B)
- [x] `-cascade.js` steps
- [x] `-traps.js` steps
- [x] `-write-path.js` assembly + pipeline
- [x] HTML script band entries
- [x] Walkthrough smoke test

## Success Criteria
- Every level shows its own invalidation verb; browser never reaches `ok`.
- Race arc ends with Redis holding `oldPrice` while DB holds `newPrice`, both
  numbers sourced from the model.
- Bypass arc ends with exactly one `danger` box (ORM cache) among green ones.
- `node`: `raceOutcome` with `aWriteAtMs > bWriteAtMs` returns `{stale: true,
  value: oldPrice}`, and with the order reversed returns `{stale: false}`.

## Risk Assessment
- **The race arc needs simultaneity, which 3D steps render as sequence** →
  mitigate with an explicit timeline note (`KIT.note`) carrying t-values from
  the model, and keep both request boxes on screen the whole arc.
- **Scenario grows past comfortable length** (cascade + 2 traps) → if the step
  count exceeds ~30 phases, split traps into their own `KIT.scenario()` rather
  than trimming the cascade; the cascade is the doc's core claim.
- **Pub/Sub topology over-detailed** — the doc explicitly deferred it. Keep it to
  one fan-out phase.

## Security Considerations
- Stale price is a commercial-integrity issue: a user checking out on a cached
  `$89.99` while the DB says `$79.99` is a pricing dispute. Say so once, in the
  race arc's `why`, without inventing a legal claim.
- Purge APIs are privileged endpoints; the copy should not imply purge is
  callable by anonymous clients.

## Next Steps
Phase 04's final beat (bundle push → CDN purge → browser auto-fetch) references
this phase's purge mechanics and should reuse its wording for the browser level.
