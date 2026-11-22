# Feature matrix

Status legend: **Verified** = exercised by automated tests in this repository ·
**Implemented, partial** = works but narrower than the brief · **Open** = not built ·
**Out of scope** = deliberate v1 non-goal (master brief §3.2).

Last updated against `main` after the Phase 11 detection work. Evidence column names the
authoritative test or document.

## Detection and extraction

| Capability | Status | Evidence |
| --- | --- | --- |
| Automatic suggestions with ranked alternatives | Verified | `tests/e2e/detector.spec.ts`, 46-page corpus |
| Evidence-based cross-kind ranking | Verified | `tests/unit/detector-rank.test.ts` |
| Native tables with colspan/rowspan projection | Verified | `tests/fixtures/detector/tables.html`, corpus `span-*` |
| Headerless and sparse tables | Verified | corpus `tables-02` |
| Nested tables (no inner bleed, no primary promotion) | Verified | corpus `nested-01…05` |
| Repeating cards, irregular shapes | Verified | corpus `irregular-01…04` |
| Product / article / directory / list classification | Verified | `tests/e2e/detector.spec.ts`, corpus |
| Div-soup layouts without semantic markup | Verified | corpus `soup-*` |
| Site-chrome and advertisement rejection | Verified | `detector-rank` chrome penalty, corpus decoy metric |
| Real-world accuracy measurement | **Open** — needs captured pages | [CAPTURE_CORPUS.md](CAPTURE_CORPUS.md) |

## Manual control and fields

| Capability | Status | Evidence |
| --- | --- | --- |
| Point-and-click picker, parent/child correction | Verified | `tests/e2e/picker.spec.ts` |
| Manual relative fields, picked attributes | Verified | `picker.spec.ts` (images, alt, price) |
| Keyboard operation and Escape teardown | Verified | `picker.spec.ts` |
| Repair an auto-detected structure's fields | **Open** | [GAP_ANALYSIS](GAP_ANALYSIS.md) M2 |
| Rename / reorder / delete columns | Verified | `tests/unit/extraction.test.ts` |
| Field transforms, kind override, defaults, hide | **Open** | GAP_ANALYSIS M1 |

## Collection runs

| Capability | Status | Evidence |
| --- | --- | --- |
| Next / numbered / URL-pattern pagination | Verified | `detector.spec.ts` pagination cases |
| Load More, scroll | Verified | `detector.spec.ts` |
| Bounded actions, delay and time budget | Verified | Phase 08 limits |
| Pause / resume / stop with verified rows kept | Verified | `detector.spec.ts` |
| Redirect and failed-step refusal | Verified | `detector.spec.ts` |
| Per-page retry / skip / keep-N recovery UI | **Open** | GAP_ANALYSIS M3 |
| Pagination for manual picker selections | Out of scope | brief §3.2 |

## Data, export and persistence

| Capability | Status | Evidence |
| --- | --- | --- |
| Virtualised grid, sort, search, filter, dedupe | Verified | `detector.spec.ts` scale cases |
| Cell editing and row deletion | Verified | `tests/unit/extraction.test.ts` |
| CSV / XLSX / JSON export, subset controls | Verified | `tests/unit/export.test.ts`, QA script |
| Clipboard copy with formula safety | Verified | `detector.spec.ts` |
| Partial-capture messaging and export of captured rows | Verified | `tests/unit/ui.test.tsx` |
| Snapshots, migration, rollback, retention | Verified | `tests/e2e/library.spec.ts` |
| Configuration save, reuse, export/import | Verified | `library.spec.ts`, `phase11-portable.test.ts` |
| Hard ceiling above 10 k rows | **Open** | `maxDatasetRows` |

## Platform, quality and release

| Capability | Status | Evidence |
| --- | --- | --- |
| Minimal permissions, no host grants, no remote code | Verified (asserted in CI) | `tests/e2e/extension.spec.ts`, `ci.yml` |
| Light/dark, narrow widths, keyboard paths | Verified | `extension.spec.ts` |
| Systematic WCAG 2.1 AA audit and screen-reader pass | **Open** | GAP_ANALYSIS H4 |
| Global error boundary with safe diagnostics | Verified | `tests/unit/ui.test.tsx` |
| Cross-browser (Edge / Firefox) | **Open** — Phase 12 | [BROWSER_MATRIX.md](BROWSER_MATRIX.md) |
| Multi-URL queue with per-page authorisation | Verified | `library.spec.ts` |
| CI pipeline with manifest guard | Verified | `.github/workflows/ci.yml` |
| Coverage measurement | **Open** | GAP_ANALYSIS H7 |
| Store listing, assets, privacy policy | **Open** — Phase 14 | GAP_ANALYSIS M4 |

## Accounting

- Verified capabilities: 34
- Open items (blocking launch): 9 — real-page accuracy, field transforms, structure repair,
  recovery UI, >10 k ceiling, WCAG audit, cross-browser, coverage, store package
- Deliberate non-goals: 7
