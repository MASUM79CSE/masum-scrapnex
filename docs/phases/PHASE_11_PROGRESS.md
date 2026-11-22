# Phase 11 — Advanced product features (in progress)

Phase 10 was approved and committed as `554591e`. This is a development checkpoint, not the Phase 11 approval gate.

## Features in this checkpoint

| Feature | Current behavior | Evidence |
| --- | --- | --- |
| Ranking (11.1) | Cross-kind scores are no longer compared directly. A deterministic evidence layer scores each preview on fill rate, distinct first-column values, typed and named columns, and penalises site-chrome rows (sign in, privacy, cookie, careers…). Every candidate explains its score. | `tests/unit/detector-rank.test.ts` (4 cases) + corpus |
| Nested tables (11.2) | Inner table content never bleeds into the parent cell, and a table nested inside another detected table can never be the primary suggestion — it is demoted below its ancestor. | `nested-05` corpus page asserts both |
| Irregular cards (11.3) | Cards with missing image/price and variable extra text stay one structure instead of splitting | 4 `irregular-*` corpus pages |
| Configuration reuse | A complete, fresh scan on the saved HTTP(S) origin is required. A unique exact layout or unique layout with the same distinct normalized labels and types may match. Reordering or regenerated column IDs do not prevent the latter. Multiple matches never auto-select. The UI explains why selection is available or blocked. | `tests/unit/library.test.ts`, same-profile restart and reuse test |
| Configuration import and export | Download one configuration as versioned JSON. Import a UTF-8 file no larger than 24 KiB; review its site, name, and fields before saving. Validation rejects unknown fields, formats, and unsafe origins. No sample data, selectors, routes, or original storage IDs are exchanged. Column labels and origin are included; review before sharing. An imported configuration cannot start navigation, grant access, or collect data. | `tests/unit/phase11-portable.test.ts`, browser download and import round-trip |
| Controlled multi-URL queue | Review up to 12 URLs, one per line. Open the next URL with a separate click, use the extension toolbar for temporary access, then explicitly analyze and collect. Only a successful capture from the exact queued URL and opened tab marks the entry complete or partial. Different URLs and redirects do not complete it. Never opens the following page automatically. Each working dataset stays separate; save or export before discarding it to continue. Queue state is in memory only. | `tests/unit/url-queue.test.ts`, browser exact-page capture workflow |
| Basic extraction diagnostics | Expand diagnostics after a scan and optionally download a local JSON report of statuses, candidate kinds, scores, counts, and preview-level missing/blank totals. No page addresses, row values, labels, IDs, selectors, or source notes are included. | `tests/unit/phase11-portable.test.ts`, browser inspection of actual downloaded bytes |

## Corpus baseline

`tests/fixtures/corpus/pages.ts` + `tests/e2e/corpus.spec.ts` run the packaged agent over
**46 deterministic pages** across 12 archetypes and write `docs/reports/ACCURACY.md`.

| Run | Pages | Top-1 | Notes |
| --- | --- | --- | --- |
| Baseline | 41 | 41 (100 %) | Before ranking work; harness modelled sampled tables wrongly |
| After 11.1–11.3 | 46 | 46 (100 %) | Ranking layer added, 5 new pages, nested bleed assertions |

Full regression after the ranking change: 64 unit/component and 49 Chromium tests green,
formatting/typecheck/lint clean, zero audit findings.

The corpus is authored here, so it guards against regressions; it is **not** evidence of
real-world accuracy. Captured pages from authorised sites are still required before launch.

## Checkpoint verification

Node 24.22.3 and Chrome for Testing 159.0.8154.6: **64 unit/component tests and 49 Chromium tests passed**. Formatting, type checking, lint, the production build, the Git diff check, and dependency audit passed (zero vulnerabilities). The production manifest is byte-for-byte identical to the Phase 10 Chrome archive. Browser collection tests use a temporary loopback permission in a test copy only.

The remaining Phase 11 work covers ranking, complex nested tables, irregular card detection, selector correction, field customization, pagination recovery, and large-data handling. The completed feature matrix and full regression evidence will be prepared for the Phase 11 gate.
