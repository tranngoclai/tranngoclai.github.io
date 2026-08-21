---
title: "ecommerce-cache-flow-3d deck — 9-level caching visualized"
description: "New flow3d deck with 4 scenarios (read path, write path, cold cache, build cache) built on the domain-neutral flow3d kit."
status: pending
priority: P2
effort: 11h
branch: main
tags: [flow3d, visualization, caching, deck]
created: 2026-08-09
---

# ecommerce-cache-flow-3d

New top-level deck `/ecommerce-cache-flow-3d/` visualizing the 9 caching levels of
ShopHub `PID-4521` from `docs/caching-levels-flow.md`, using `/flow3d` unchanged.

## Sources of truth
- Content: `docs/caching-levels-flow.md` — authoritative, do not re-derive.
- Authoring rules + kit API: `docs/flow3d-deck-authoring.md`.
- Reference shape: `k8s-flow-3d/` (layout law, model/world/steps/assembly split).

## Non-negotiables
- `/flow3d` is read-only. Zero edits.
- Five-layer one-way dependency: deck → model → world → steps → assembly.
- Rule 1 one thing = one box; Rule 2 face captions; Rule 3 label = name+config;
  Rule 4 one phase = one action.
- Every number printed anywhere comes from a model, never a step literal.
- Deck language `vi` (matches `k8s-flow-3d-deck.js` and the source doc).

## Phases

| # | phase | effort | status |
|---|-------|--------|--------|
| 00 | [Shared scaffolding](phase-00-shared-scaffolding.md) — folder, layout law, level-cost table, manifest, index, HTML shell, root card | 1.5h | ✓ completed |
| 01 | [Read path](phase-01-scenario-read-path.md) — levels 1-8 hit cascade, short-circuit vs full miss | 2.5h | ✓ completed |
| 02 | [Write path](phase-02-scenario-write-path.md) — invalidation cascade + race condition + ORM bypass | 3h | ✓ completed |
| 03 | [Cold cache](phase-03-scenario-cold-cache.md) — all levels miss at once, contrast vs warm | 2h | ✓ completed |
| 04 | [Build cache](phase-04-scenario-build-cache.md) — level 9, off the request path | 2h | ✓ completed |

Dependencies: 00 blocks 01-04. 03 reuses the level-cost table plus the read-path
model. 02 and 04 are independent of each other. Recommended order 00 → 01 → 02
→ 03 → 04 (03 reads best right after 01; 04 closes the loop into 02's CDN purge).

## Shared TONE mapping (fixed once in phase 00, obeyed by all four worlds)

| tone | e-commerce role |
|------|-----------------|
| `subject` | the thing being followed: `GET /products/4521`, or the price mutation 89.99→79.99 |
| `peer` | a second concurrent request (request B in the race) |
| `core` | origin app server (ShopHub SSR process) |
| `system` | independent actors: DNS resolver, CDN edge PoP, CI runner, admin console |
| `gate` | a cache lookup decision point (hit/miss check) at any level |
| `store` | durable/persistent bytes: Redis, Postgres data files, WAL, CI cache bucket |
| `queue` | buffers: dirty-page list, purge queue, Pub/Sub invalidate channel |
| `engine` | low-level machinery: buffer-pool manager, kernel page cache, disk, bundler, Docker builder |
| `surface` | inert scenery: client device, edge region, origin datacenter, CI runner slabs |
| `live` | a fresh cached entry currently serving |
| `ok` | hit / check passed (fresh, 304 validated) |
| `warn` | stale-but-usable (SWR, expired awaiting revalidate, dirty page) |
| `danger` | miss, or a wrong value served |
| `doomed` | entry being invalidated: DEL, purge, LRU evict |
| `crown` | the level that actually served the response — the winner of the cascade |

## Done when
All four scenarios walk end to end from `ecommerce-cache-flow-3d.html` with no
console errors, panel/label/HUD numbers agreeing, and every model passing its
`node` assertions.
