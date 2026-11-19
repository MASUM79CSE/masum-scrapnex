# Phase 07 — Extraction and data processing

**MASUM SCRAPNEXS · Development snapshot `0.1.0`**  
**Implemented and verified; approval pending.** Phase 08 has not begun.

## Demonstration

1. Build with `npm ci && npm run build` using the pinned Node version. Load `.output/chrome-mv3` as an unpacked extension. On an authorized page, use the toolbar popup to open the side panel.
2. Select **Analyze page**, choose a table or listing, and press **Collect records**. The six-row preview is not the dataset. Alternatively, use **Pick elements**, choose a repeated row and any explicit fields, then press **Collect selected rows**. **Confirm selection** remains a preview-only action.
3. In **Working dataset**, activate a cell with click or Enter. Save normalized text, save a blank value, or use **Mark as missing**. `Empty` denotes a present blank value; `—` denotes missing. The source page is not edited.
4. Sort from a header, search across one or all columns, filter for empty or populated rows, or jump to a distant row. **Manage columns** supports rename, reorder, and removal. **Remove duplicates** retains the first captured occurrence of each exact normalized tuple. Selected rows can also be deleted.
5. **Back to workspace** keeps the working copy in memory. Closing or reloading the panel loses it; **Discard dataset** clears it explicitly. A second dataset cannot replace it silently.

Fixture evidence: `phase-07-virtual-grid.png` shows the editor open at record 988 in a 1,000-row collection. The Chromium editing test separately verifies persistence of the edit within the panel, no edit to the original DOM, and loss on panel reload. The screenshot is the packaged panel document opened in a test tab, not a screenshot of Chrome's native side-panel container.

## Design and scope

- Automatic capture repeats deterministic analysis in the exact top-frame document used by the scan and requires the candidate ID, sampled values and inferred columns to match. Changes outside the preview before a capture may be reflected in the new snapshot. A route change, DOM mutation observed during capture, or picker disconnect rejects the in-flight result rather than committing a mixed dataset.
- Native tables project visible text and merged cells into rectangular records. Repeated listings use the inferred column plan; manual rules read visible text, link URLs, image URLs or alt text, and an allowlisted attribute. Forms/controls and editable subtrees are excluded. Relative URLs are resolved on the source page; non-HTTP(S) and credential-bearing URLs are rejected. URLs render as inert text; the extension does not load captured images or link targets.
- Text is normalized to NFC, trimmed, and bounded; no inferred numbers, dates or currencies are converted. Sort is stable and locale-aware, with natural digit ordering and missing values last. Filtering and sorting do not reorder the underlying capture. Duplicates distinguish a missing value from an explicit empty string and are removed only on request.
- Collection is cooperative and bounded: 10,000 records, two million UTF-16 data units (at least one unit per cell), 640 units per cell, up to 12 inferred or 8 manual columns, 50,000 iterator steps and a four-second collection budget after planning. The budget is checked between work units, not a real-time guarantee. Known limits are reported as partial. Late table columns outside the inferred schema are not added automatically. Complex DOM/CSS layouts, heuristic grouping, or changing pages can reduce useful capture; a page's off-DOM rows are not present to collect.
- The React table renders a scroll window and overscan rather than one DOM row per record. It preserves absolute row indices for assistive technology and offers a focusable scroll region and keyboard jump. Search, sort, edits, and deduplication operate over the full captured data, not just visible rows.
- The production MV3 permission set remains `activeTab`, `scripting`, `sidePanel`, and `storage`. No host grant, auto-injected content script, changed permissions, data persistence, upload, or automated navigation was introduced. There is no iframe, pagination, Load More, infinite scroll, export, history, deletion undo, or multi-URL processing in this phase.

## Verification methods

- Vitest checks normalization, URL safety, wire validation, editing limits, sorting, filtering, exact duplicates, stable row identities, and virtualization calculations.
- Chromium checks cover packaged automatic collection and manual picker transport, keyboard editing, narrow layout, automated axe rules, original DOM integrity, stale selection rejection, in-flight mutation and abort, both caps, and the unchanged production manifest. Live-page workflow tests use a separate test copy with loopback-only host access; the shipped extension does not have that permission. Chrome 116, Edge, Firefox, third-party pages, touch interfaces, and screen-reader speech are not verified.
- Scale figures are single-run test-runner wall times on simple two-column loopback tables. Capture starts after detection and includes reinjection, re-analysis, message transfer, rendering and the test's wait for the table; jump includes Playwright input and its wait for the last row to enter the viewport. They are not native Chrome side-panel or frame-time benchmarks. See the accompanying checks file for the measured values and command results.

| Fixture rows | Captured | Initial rendered data rows | Collect to grid | Keyboard jump |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 100 | 23 | 95.3 ms | 795.9 ms |
| 1,000 | 1,000 | 23 | 123.1 ms | 700.4 ms |
| 10,000 | 10,000 | 23 | 868.4 ms | 212.6 ms |

Final suite: **29 unit/component tests and 29 Chromium tests passed**. Formatting, TypeScript, ESLint, production build, and diff checks passed. `npm audit` reported zero vulnerabilities. Browser version: Chromium / Chrome for Testing `159.0.8154.6`. See [the checks transcript](PHASE_07_CHECKS.txt).

**Approval gate: `APPROVE PHASE 07`**
