# Phase 05 — Automatic Detection Engine

**MASUM SCRAPNEXS · v0.1.0 · 19 November 2026 · Awaiting approval**

| Identifier | Current value |
| --- | --- |
| Project / extension display name | MASUM SCRAPNEXS |
| Local Git repository and source archive root | `masum-scrapnex` |
| npm package | `instant-scraper` (unchanged) |

The rename and approved Phase 04 baseline were committed locally as `051010a`. No remote was configured or renamed. Phase 05 changes remain uncommitted pending review. Historical verification reports and archives retain the name of their original snapshots. Nothing was published.

## Implemented behavior

On an authorized HTTP(S) page, open the toolbar popup, choose **Open side panel**, and click **Analyze page**. The extension scans only on that click. It pins the scan to the granted top-frame document, executes one packaged isolated script, and checks the active tab and route again before using a bounded, validated result. Tab activation, navigation, removal and focus changes invalidate the displayed preview. There are no persistent host grants, auto-injected scripts, navigation actions, or saved extraction sessions. The standalone Live Preview remains the sample-only workspace.

- **Native HTML tables:** identify visible native tables, skip layout-role tables and footer rows, infer heading paths from `thead` or leading header rows, and use `Column n` when no header evidence exists. The bounded preview represents simple spans, differentiates existing empty cells from missing or hidden slots, and excludes nested table text from an outer cell.
- **Repeated collections:** combine Phase 04 structure scores with recurring semantics to recognize product and article listings, directories, ordinary lists, and generic repeating cards. No class labels are required. Reject navigation-landmark groups, repeated controls and empty structures. Filter out generic repeated table rows to avoid duplicate candidates for the same table.
- **Field inference:** compare relative tag/ordinal paths across observed rows, retain recurring fields, and use neutral labels where meanings are ambiguous. In valid collections, headings, prices, dates, addresses, descriptions, links, and image URLs can form columns. Native table preview fields are visible text. HTTP(S) URLs are rendered as text, never fetched, linked, or displayed as images by the preview; credential-bearing or non-HTTP(S) values are dropped.
- **Bounded display:** rank up to eight candidates and show at most six read-only preview rows and twelve columns per candidate. Estimates and scan limits are labeled. Scores express heuristic evidence, not accuracy probabilities. Candidate explanations are available in the side panel.

### Demonstrated output on controlled fixtures

| Fixture | Observed result |
| --- | --- |
| Inventory table with `rowspan`, `colspan`, and grouped headers | Columns `Item`, `Stock / Warehouse`, `Stock / Shop`. A merged `Trail lamp` value aligned to two records. The blank Shop cell remained empty, missing/hidden fields remained null, and Bangla `সরঞ্জাম` was preserved. |
| Headerless stock table | Neutral columns `Column 1`, `Column 2`. Preview contained `Pack`, `৳4000` and `Mug`, `৳850`. |
| Catalog, journal, directory, gear list and community cards | All five collection kinds recognized. Catalog included product name, price, description, link, and image URL; article and directory rows exposed Date and Address respectively. Unsafe URL values and hidden form content did not appear. |
| Navigation/control-only page | Zero candidates. |

## Verification

| Check | Result and evidence |
| --- | --- |
| Format, strict TypeScript, lint, production MV3 build | Passed. Production manifest displays the new name and has no persistent host grant or registered content script. |
| Unit/component checks | **21 passed**, including result-schema validation, URL validation, unique labels and previous analyzer/UI checks. |
| Chromium automated checks | **16 passed**. A copy of the packaged build with a test-only loopback host grant exercised exact table/collection previews and clearing stale results. A separate test on the unchanged production manifest verified that no loopback host access or scan action was available before authorization. |
| Real Chrome toolbar + activeTab + side panel | **Passed on Chrome for Testing 159.0.8154.6**, headed via Xvfb using the unchanged production manifest and a controlled loopback fixture. Invoked through Chrome's native extensions menu, clicked Open side panel, clicked Analyze page, and opened Data preview. Screenshots show native permission invocation output and extracted fixture cells. |
| `npm audit` | Reported zero known vulnerabilities at check time; not a full security audit. |

See [automated command output](PHASE_05_CHECKS.txt). No third-party website was scanned. Earlier incomplete toolbar verification is closed for this browser build only. Chrome 116, Edge and Firefox are not verified.

## Files changed, defects, and limits

- **Created:** `src/core/detector/`, `src/ui/live-detection.tsx`, `src/browser/use-detection.ts`, detector fixtures, unit and browser tests, this report, and command output. Captured native popup, native side panel, and expanded test-fixture screenshots outside the repo. Generated a rebuildable source archive with `masum-scrapnex/` as its root.
- **Modified:** internal analyzer handoff (preserves the Phase 04 public summary interface), Chrome adapter/port, packaged page agent, popup, side panel, workspace/styles, extension tests and README. Renaming changes were committed with Phase 04 approval, before Phase 05 implementation.
- **Fixed during headed check:** the native popup initially shrank to its content, causing the brand and privacy badge to overlap. Setting the popup's intended width corrected it; repeated native scan verification passed on the rebuilt extension.
- **Limits:** current table projection is a preview, not exhaustive HTML table semantics or a full extraction engine. Ambiguous column paths, irregular spans, heterogeneous lists, continuously mutating pages, untested styles, and shadow/iframe content can affect coverage. The 10,000-row log lines still measure the Phase 04 structural harness, not end-to-end extraction. No manual picker, dataset editing/persistence, pagination, or export was started.

## Next approval gate

Phase 06 is **Point-and-Click Extraction**. It has not begun. Reply `APPROVE PHASE 05` to proceed, or request changes to Phase 05.
