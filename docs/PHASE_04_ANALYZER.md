# Phase 04 — DOM Analyzer Foundation

**MASUM SCRAPNEX · 19 November 2026 · Awaiting approval**

Phase 03 was approved and committed locally as `b1ed94a`. This phase implements and tests the analyzer as a standalone TypeScript module; it does **not** connect the production extension to live webpage analysis. The shipped page agent, popup, and sample workspace remain unchanged. No host permissions or runtime dependencies were added.

## How the analyzer works

`analyzeDocument(doc, options?)` resolves to a typed result with `complete`, `partial`, or `cancelled` status. Candidates are compact structural summaries: an ephemeral ID, common tag, observed and estimated count, ordinal score, confidence label and explanation codes. The function does not extract cells, record text, attribute values, URLs, DOM handles, or selectors for reuse.

1. **Traverse the current snapshot.** Iterative depth-first traversal starts at the document body. Each stack frame advances by one node; it does not copy an entire sibling list. Count each entered node, including non-elements. Read only the presence of visible content signals: tag/allowlisted role, nonblank direct text prefix, heading, link, and image. Aggregate those bits upward in a second pass. No page styles are changed and no site action is triggered.
2. **Check visibility conservatively.** Prune non-HTML subtrees, forms/controls, frames, scripts/templates and elements with `hidden`, `inert`, `aria-hidden=true`, `display:none`, zero computed opacity or `content-visibility:hidden`. `visibility:hidden` wrappers can still contain an explicitly visible descendant. Offscreen content is eligible; CSS geometry, clipping, occlusion and overlap are not tested. Open shadow trees and their host light-child projections are skipped; closed roots are not entered and an inaccessible closed host’s light DOM is not reliably identifiable.
3. **Compare bounded fingerprints.** For each parent, enumerate or evenly sample eligible direct children. A fingerprint is a normalized root tag/role plus a multiset of direct and second-level tag/role paths, using at most 12 children and four grandchildren per sampled child. Similarity is multiset Jaccard: the sum of shared multiplicities divided by the sum of maximum multiplicities. Two differing root keys have zero similarity. Class identifiers and raw content values are not features.
4. **Propose groups.** Assign each child to the most similar of at most six exemplars per root key, at a similarity threshold of `0.60`. The first member fixes the exemplar, so this is deterministic for a stable snapshot but intentionally order-sensitive. Require at least two observed siblings and a content signal in at least half. If sampled, scale the observed fraction to the scanned sibling count and mark the count as estimated. Uniform sampling can miss sparse or periodically distributed shapes; no estimate covers unseen parts of a partial scan.
5. **Rank and explain.** Compute `30×similarity + 25×recurring-signal coverage + 20×content evidence + 15×repetition + 10×visibility − penalties`, then round and clamp to `0–100`. Recurring signal types occur in at least 65% of observed members; coverage saturates at three signals. Content combines nonempty rows with richer heading or image signals. Repetition saturates at 12 rows and uses observed, not extrapolated count. Visibility currently contributes a fixed 10 for eligible groups. Subtract 40 for site/navigation landmark-like regions, 9 for mostly link-only content and 4 for a sampled group. Confidence bands are **strong ≥76**, **possible ≥53**, otherwise **weak**. They express relative evidence, not the probability of a correct extraction. Break ties on observed size then document order. Nested groups may remain as independent alternatives; overlap reconciliation and table-specific precedence are later work.
6. **Stop safely.** Defaults: 50,000 nodes, depth 64, 1,200 ms, 192 siblings sampled per parent, 20 returned candidates and a cooperative task yield every 192 work items. Fixed upper clamps protect the override API. Asynchronous yields permit cancellation; abort discards candidates. Mutation observation invalidates results from a changing DOM, including body replacement or detachment. It also catches innocuous mutations and therefore favors a retry over stale candidates. CSS-only changes from rules/media/animation can occur without DOM mutations. Explicit node, depth or time stops are partial, not an assertion of completeness. Time budgets are cooperative, not a hard deadline inside an individual browser style computation.

The module makes no network requests, does not run page-provided code or interpret selectors, does not return sensitive source values, and only observes the supplied document. The browser harness builds a separate test-only script for controlled local fixtures; it is not a new extension entrypoint.

## Measured fixture baseline

Debian 13 (Linux x86-64), Node `24.22.3`, Chrome for Testing `159.0.8154.6`, headless Playwright, one test worker. Flat, same-shape `<article><h2>…</h2></article>` records; about three DOM nodes each. Four scans per size in the same page: first after changing DOM, then three warm scans. Timings include cooperative scheduling and analyzer work, not fixture construction, extraction, or rendering a data grid.

| Fixture rows | DOM nodes visited | First scan | Warm runs | Warm median |
| ---: | ---: | ---: | --- | ---: |
| 100 | 302 | 8.0 ms | 1.6 / 1.1 / 3.7 ms | 1.6 ms |
| 1,000 | 3,002 | 22.9 ms | 10.1 / 9.2 / 9.4 ms | 9.4 ms |
| 10,000 | 30,002 | 183.9 ms | 81.9 / 92.8 / 83.0 ms | 83.0 ms |

The largest fixture completed traversal, but its candidate count is **an estimate based on 192 sampled siblings**, not 10,000 individually matched or extracted rows. Initial same-fixture regression investigation thresholds (not release promises or CI time assertions): warm median above 25 / 75 / 350 ms at these sizes, or any unexpected partial result. Validate deeper production-like fixtures, memory and responsiveness separately before release. Raw timings vary by browser and host load.

## Changes and verification

- **Created:** `src/core/analyzer/{index.ts,types.ts,shape.ts,visibility.ts}`, `tests/unit/analyzer-shape.test.ts`, `tests/e2e/analyzer.spec.ts`, and controlled fixtures under `tests/fixtures/analyzer/`; this report and a command transcript.
- **Modified:** `README.md` to describe the harness and current scope. No production entrypoint was modified. Phase 04 source is left uncommitted pending review.

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Format, strict TypeScript, lint and production build | VERIFIED | `npm run format:check`, `npm run typecheck`, `npm run lint`, and WXT build passed. |
| Fingerprints, confidence and score behavior | VERIFIED | `npm test`: 18 passed, including four new scoring tests. |
| Nested/irregular/dynamic fixtures and safety limits | VERIFIED | `npm run test:e2e`: 11 passed, comprising six analyzer browser fixture tests and five packaged-extension regressions. Verified landmark demotion, class independence, stale-state invalidation, visibility and limit handling. |
| Baseline measurements and dependency check | VERIFIED | Fixture runs above and `npm audit` reported zero known vulnerabilities at check time. |
| Live webpage hookup, table semantics and real field extraction | NOT STARTED | This phase deliberately keeps production entrypoints unchanged. |

See the [command transcript](PHASE_04_CHECKS.txt). No unresolved defect was observed within the tested scope. Heuristic false positives, layout visibility beyond the checked CSS properties, mutation noise on dynamic pages, sampling bias, and deep/large DOMs remain known risks. Native toolbar interactions and Chrome 116/Edge/Firefox remain unverified from earlier phases. No reference site or third-party live site was scanned.

## Next approval gate

Phase 05 is **Automatic Detection Engine**. It will build on these structural candidates with richer classification, native tables, and candidate presentation. It has not begun. Reply `APPROVE PHASE 04` to proceed or request changes within this phase.
