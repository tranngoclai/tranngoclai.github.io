# Phase 03 — Scenario: Cold cache (every level misses at once)

## Context Links
- `docs/caching-levels-flow.md` §10 closing note ("Cold cache toàn hệ thống"),
  §6 cold-buffer-pool penalty, §8 kernel page cache
- Depends on: [phase-00](phase-00-shared-scaffolding.md),
  [phase-01](phase-01-scenario-read-path.md) (reuses its cost walk)

## Overview
- Priority: P2
- Status: ✓ completed
- Effort: 2h
- Right after a deploy / DB restart, the same `GET /products/4521` finds nothing
  anywhere. No short-circuit exists. Show the full-depth cost and the warm-up.

## Key Insights
- The doc is explicit that cold cache is **not a new mechanism** — it is the
  existing levels all taking their miss branch simultaneously. So this scenario
  must reuse the phase-01 model rather than introduce new arithmetic; a second
  cost table would be a lie about the system.
- The payoff frame is the side-by-side number: warm `servedBy` latency vs cold
  full-depth latency, from one function with two configs.
- The doc's operational conclusions belong here, not in phase 01: restart the DB
  off-peak, or dump/restore the buffer pool; expect a load spike after deploy.
- Different levels go cold for different reasons — deploy invalidates 2/3/9 by
  filename hash, restart empties 5/6/8, level 1 survives (DNS TTL is unrelated
  to deploys). Stating which levels are *not* cold is what makes it precise.

## Requirements
Functional
- `simulate(config)` returns per-level `{coldReason | 'still warm'}`, the
  cumulative miss walk, `coldMs`, `warmMs`, `penaltyMs`, `penaltyX`.
- `warmMs` comes from the phase-01 model's warm run, not a re-typed number.
- A warm-up arc: N-th request after restart re-fills levels bottom-up and the
  cumulative latency drops back — driven by a pure `warmup(requestIndex)`.

Non-functional
- Depends on `ECOM_CACHE_LEVELS` and `READ_PATH_MODEL`; both must load first.
  Document that ordering in the HTML band comment.

## Architecture
Reuse the phase-01 world grammar, but build a **separate** world function (the
kit builds one world per scenario). Differences from phase 01:
- Every cache `gate` starts `danger`/empty-labelled (`'Redis\n(empty)'`).
- Add `deploy-event` (`system`) on the resolve band as the trigger actor.
- The `disk` box is the only `store` that is warm at step 0 — the truth always
  lives there, which is why the walk always terminates.

Pipeline: `Deploy · Cold walk · Disk · Fill · Warm`.

Trigger arc first (what went cold and why), then the single request's full-depth
walk, then the fill-back, then the comparison HUD.

## Related Code Files
Create
- `…-scenario-cold-cache-model.js`
- `…-scenario-cold-cache-world.js`
- `…-scenario-cold-cache-steps.js`
- `…-scenario-cold-cache.js` (assembly)

Modify
- `ecommerce-cache-flow-3d.html` — four entries, **after** the read-path model.

## Implementation Steps
1. Model: `DEFAULT_CONFIG` lists per-level `coldReason` strings tied to the
   trigger (`deploy` vs `db restart` vs `both`). Validate that every level key
   exists in `ECOM_CACHE_LEVELS`.
2. Model: `simulate()` walks all levels with `hit:false`, accumulating from the
   shared cost table; pull `warmMs` from `READ_PATH_MODEL.simulate(defaults)`;
   compute `penaltyMs` and `penaltyX = coldMs / warmMs` rounded via a formatter.
3. Model: `warmup(i)` — request 1 pays full depth; request 2 hits Redis; request
   3 hits LB; and so on, returning the same result shape so the HUD reuses it.
4. World: same columns, all caches empty-labelled, plus `deploy-event`.
5. Steps arc A (trigger): deploy pushes new bundle hashes → levels 2/3 keys no
   longer match; DB restart → buffer pool empty; container restart → page cache
   gone; note that DNS (level 1) is untouched.
6. Steps arc B (the walk): one phase per level, each ending `danger`, request box
   advancing right. No `crown` until disk. Disk gets the `crown` — the only
   scenario where it does.
7. Steps arc C (fill-back): page cache → buffer pool → ORM → Redis → LB → CDN
   fill in reverse; each fill flips a box from `danger` to `live`.
8. Steps arc D (verdict): HUD with `KIT.gauge('cold', coldMs, coldMs, ' ms')`
   vs `KIT.gauge('warm', warmMs, coldMs, ' ms')` and `KIT.score('penalty',
   penaltyX + '×')`; closing copy carries the doc's operational advice.
9. Assembly + smoke test.

## Todo List
- [x] `-model.js` reusing `ECOM_CACHE_LEVELS` + `READ_PATH_MODEL`
- [x] `node` assertion: `coldMs > warmMs`, `warmup(1).cumulativeMs === coldMs`
- [x] `-world.js` (all caches empty)
- [x] `-steps.js` four arcs
- [x] `-cold-cache.js` assembly
- [x] HTML entries after the read-path model
- [x] Walkthrough smoke test

## Success Criteria
- `warmMs` shown here is byte-identical to the number phase 01 shows.
- Every cache box is `danger` before the walk and `live` after the fill.
- Disk is the only `crown`.
- No console error; load order does not break if the read-path model moves.

## Risk Assessment
- **Cross-model dependency breaks load order** → guard with an explicit
  `if (!window.READ_PATH_MODEL) throw new Error(...)` at the top of the cold
  model so the failure is loud at load, not a wrong badge later.
- **Repetitive walk bores the viewer** (8 near-identical miss phases) → give each
  phase a distinct `why` drawn from the doc's per-level notes, and keep the
  camera moving with the request.
- **Overlap with phase 01's miss branch** → phase 01's miss branch stays scoped
  to one level's fallback; this scenario is the only place all levels are cold
  at once. State the distinction in both scenario intros.

## Security Considerations
- The realistic risk here is availability, not confidentiality: a post-deploy
  thundering herd against the origin. Mention request coalescing / staggered
  restarts once; do not turn it into a mitigation catalogue.

## Next Steps
Phase 04 explains where the new bundle hashes in arc A come from, closing the
loop between build time and the cold read path.
