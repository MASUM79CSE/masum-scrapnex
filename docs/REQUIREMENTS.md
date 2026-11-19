# MASUM SCRAPNEX — Product requirements

**Phase 01 · 19 November 2026 · Awaiting approval**  
**Product:** MASUM SCRAPNEX (“Scrap-neks”). **Engineering identifiers:** `instant-scraper` (codename, proposed repository and npm package as specified); package starts at `0.1.0`, with `1.0.0` the release target.  
**Positioning:** Transform structured information on the web into usable data — directly in your browser, under your control.

## Scope and research

An independently designed Chrome desktop extension for people who need to collect and organize tables, cards, or listings without writing selectors or code. The product is deterministic and local-first: no AI, accounts, cloud dependency, backend, telemetry or automated upload. Edge and Firefox are future targets; portability work is not a compatibility claim.

The [Instant Data Scraper Chrome Web Store listing](https://chromewebstore.google.com/detail/instant-data-scraper/ofaokhiedipichpaobibbnahnkdoiiah) describes automatic detection and manual refinement, dynamic-load awareness with configurable delays and waits, next-page and infinite-scroll collection, preview and clipboard, column renaming/filtering, and spreadsheet/CSV export. The listing describes its detection as AI; that is the publisher’s terminology, not verified implementation detail. The listing was reviewed as a public functional reference; the extension was not installed or exercised. Load More, point-and-click interaction details, JSON export, history and multi-URL capabilities are **our requirements**, not verified comparable reference features. No proprietary code, names, icons or visual assets will be reused.

## Core user flows

1. **Quick capture:** user invokes toolbar action on a supported page → popup shows page/connection state → open workspace → analyze → compare candidates with evidence and preview → choose → collect current page → review, edit and export. Nothing is collected from other tabs by default.
2. **Correct detection:** choose manual mode → hover/keyboard navigation, select an element and inspect parent/child or similar rows → choose fields → preview → confirm or cancel. Exit leaves the page unchanged apart from any site actions the user takes outside picker mode.
3. **Collect additional pages:** select Next, numbered, explicitly configured URL pattern, Load More or infinite scroll → inspect proposed target and approve bounds → progress shows verified pages/steps and deduplicated rows → pause/resume/stop → review partial or final data. Page analysis alone never triggers actions.
4. **Return to work:** reopen local history or reuse a recipe for an approved origin; validate the current page and show a new preview before collecting. Options include local data deletion, privacy and storage information.

## Functional requirements and release acceptance

| ID | Requirement | Release acceptance evidence |
|---|---|---|
| R01 | Analyze a supported top-level page on explicit invocation. Rank native tables and repeated structures, covering product/article/job/property/event/course/profile/directory/search listings and meaningful link/image collections. Show kind, count estimate, fields and ranking reason. | Known positives show the intended candidate; navigation/ad/button-only fixtures do not outrank primary data. Two identical fixture snapshots yield the same ordering. Truncation and no-results are distinct states. |
| R02 | Preserve native table semantics (headers, body sections, footers, null cells, empty rows, spans, headerless and nested tables). | Golden outputs match exact header paths, row counts and alignment; nested contents are not duplicated into the outer row. Unsupported or malformed projections produce warnings, never silent shifts. |
| R03 | Infer reusable per-row fields from DOM evidence: visible text, links, image URLs, alt text and useful semantic hints; neutral names when uncertain. Distinguish missing from empty. | Fixtures include irregular cards, changing classes, sparse fields, Unicode and malformed URLs; preview matches collected output on unchanged document; uncertain labels remain neutral. |
| R04 | Manual picker supports hover and selection highlights, parent/child navigation, similar-row discovery, selector inspection/correction and manual fields including safe selected attributes. | Use keyboard as well as pointer; Escape/cancel, navigation and disconnect tear down overlays/listeners; hidden form values are absent. |
| R05 | Bound Next, numbered and URL-pattern navigation, Load More and incremental infinite scroll. Explicitly authorize repeated actions; detect progress, retries, failure, no-growth and loops. | Controlled pages with real navigation and SPA updates plus disabled, delayed, no-growth, redirect and cancellation cases; stop blocks future actions and leaves exported partial rows available. |
| R06 | Virtualized grid with counts, search, sorting/filtering, column rename/reorder/delete, row delete, cell edit, duplicate removal, empty-row filter and row/column selection. | Tests cover stable row/column identity when sorting or editing. Export preview explicitly states whether all, filtered, or selected records/columns will be included. |
| R07 | Local UTF-8 CSV, XLSX and typed JSON; copy all/selected. | Round-trip selected rows and columns; quotes/newlines/Unicode, blank/null, duplicate display labels and formula-leading cell/header values tested. XLSX reopened independently. |
| R08 | Persist sessions/data/recipes locally; reusable, versioned configurations, import/export, history, storage usage and deletion. | Restart/migration/quota tests preserve committed rows; stale configs require review; imported recipes do not execute or grant access; deleting a session cascades to its local data. |
| R09 | Accessible branded popup, side panel, preview and settings; light/dark tokens and visible status/limits. | Keyboard-only and screen-reader spot checks, focus visibility/contrast, narrow panel, meaningful empty/loading/denied/partial/error states; no simulated success or dead controls. |
| R10 | Advanced ranking, complex table/card handling, recovery and diagnostics; process an explicit finite multi-URL list through an authorized workflow. | Only nominated, approved URLs are processed. Unlisted targets and cross-origin redirects are not followed by the extension; no implied scope expansion. Config export contains no dataset or sensitive source URL. |

## Nonfunctional requirements

- **Privacy and security:** minimize permissions, no browser-history permission, extract DOM data without executing it, test message validation, safe rendering and exports, and avoid storing URL queries by default. See [SECURITY.md](SECURITY.md).
- **Reliability:** cancelable steps, persistence of committed batches, typed error with actionable status, no automatic replay of uncertain clicks/navigation, honest partial/truncated results.
- **Performance:** use bounded scans, incremental work and virtualized rendering. Measure detection, extraction, UI responsiveness, peak memory, storage and export at 100/1,000/10,000 rows with machine/browser/dataset and cold/warm conditions recorded. Phase 04 sets baseline measurements and proposes thresholds; Phase 13 validates thresholds. No measured performance yet.
- **Maintainability:** strict TypeScript, schema validation/versioning, unit and integration tests, production MV3 build and independent release QA; platform-bound logic isolated behind useful capabilities.
- **Explicit exclusions:** restricted pages, all iframes and closed shadow roots are unsupported in the v1 baseline; open shadow roots are deferred unless separately reviewed. No network interception, credential extraction, access-control or anti-bot bypass, automatic login, evasion, proxies, unbounded crawling or mobile release. Rendered virtual lists may expose only a subset at a time; report incomplete coverage rather than claiming completeness.

## Phase 01 sign-off criteria

Verify the six documents exist and agree on scope, platform, authorization, storage/export, tests and sequencing. Approve the proposed limits, architecture and scope assumptions, or request changes in Phase 01. Browser/product validation belongs to later phases; no code or repo is created at this gate.
