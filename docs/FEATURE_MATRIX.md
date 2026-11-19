# MASUM SCRAPNEXS — Feature matrix

The reference column describes [publisher listing claims](https://chromewebstore.google.com/detail/instant-data-scraper/ofaokhiedipichpaobibbnahnkdoiiah) unless noted, not tested behavior. “Not established” does not mean absent. All SCRAPNEX implementation is **NOT STARTED**.

| Capability | Reference evidence | SCRAPNEXS v1 plan | First primary phase | Acceptance |
|---|---|---|---|---|
| Automatic suggestions and customization | Advertises automatic detection (publisher calls it AI) and customization | Deterministic scoring, evidence, ranked alternatives | 04–05 | R01 |
| Native tables, spans, nested and headerless | Table edge cases not established | Rectangular aligned projection and explicit warnings | 05, 07, 11 | R02 |
| Cards, listings, link/image collections | Automatic HTML detection advertised; exact support not established | Structural clustering and evidence-based relative fields | 05, 07 | R01, R03 |
| Visual selection and field controls | Customizable selections advertised; picker steps not established | Visual/keyboard picker, manual relative rules and preview | 06–07 | R04 |
| Next and numbered navigation | Next via buttons or links advertised; numbered/pattern controls not established | User-approved, scoped, verified navigation | 08 | R05 |
| Infinite scroll and configurable waits | Both advertised | Scoped observer and explicit limits | 08 | R05 |
| Load More | Not separately established | Confirm control; stop on failed/no-growth steps | 08 | R05 |
| Spreadsheet preview/editing | Preview, column rename/filter advertised | Virtual grid, search/filter/sort, reorder/delete, cell edits and dedupe | 03, 07 | R06 |
| Clipboard | Copy/paste preview advertised | Copy all or selection with spreadsheet safeguards | 09 | R07 |
| Export formats | CSV, XLS, XLSX advertised | CSV, XLSX and typed JSON; legacy XLS excluded | 09 | R07 |
| Local persistence and configuration reuse | Publisher states scraped data stays in browser; recovery/history not established | IndexedDB sessions, versioned recipes, settings, clear history and quota reporting | 10 | R08 |
| Accessibility and privacy UI | Not established | Original light/dark, accessible desktop workspace; no hidden telemetry or upload | 03, 10, 13 | R09 |
| Advanced diagnostics/config import and finite URL queue | Not established | Redacted diagnostics, validated imports and explicit approval for each origin | 11 | R10 |
| Browser support | Chrome listing reviewed | Chrome release; Edge/Firefox adapter feasibility and explicit support matrix | 12–14 | Browser release evidence |

## Verification coverage map (planned)

| Fixture set | Essential assertions | Test layer |
|---|---|---|
| Standard/headerless/sparse/span tables; nested/empty rows, footers, malformed spans | Counts, header paths, exact null/empty semantics, no inner-table bleed | Vitest DOM and browser parity |
| Simple/complex product cards, article/search/directory listings; dynamic classes, nested repeats | Positive candidate ordering and field alignment; stable output across class changes; no merging unrelated lists | Vitest fixtures; browser layouts |
| Navigation links, ads, banners, buttons, decorative/empty groups | False positives penalized; genuine links in primary content remain candidates | Vitest fixtures |
| Unicode, missing fields, malformed and unsafe links, duplicate-looking rows | Correct normalization, no silent loss or navigation from values | Vitest fixtures; export round-trip |
| Next/full reload, numbered and URL-pattern; infinite scroll and Load More; disabled/stalled/redirect cases | Verify progress, action permissions, no runaway loops, cancel/recover | Extension E2E on controlled local pages |
| Manual picker, hostile markup, storage quota/restart, copied/exported formulas | Teardown, trust boundary, idempotent batches, safe text outputs | Unit/contract and browser; explicit manual checks |
| 100/1,000/10,000 records | Report conditions and measured throughput, memory and responsiveness, verify virtualized rendering | Repeatable performance run |
