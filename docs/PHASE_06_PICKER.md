# Phase 06 — Point-and-Click Extraction

**MASUM SCRAPNEXS · v0.1.0 · 19 November 2026 · Awaiting approval**

Phase 05 was approved and committed locally as `8ace87a`. Phase 06 changes are uncommitted pending review. The repository remains `masum-scrapnex` and the package remains `instant-scraper`; nothing was published.

## Workflow

1. Invoke the toolbar extension on an authorized HTTP(S) page, open the side panel and select **Pick elements**.
2. Hover a page element to see a dashed outline, then click. The picker keeps the exact element when appropriate or suggests a nearby repeating row. The selected row is highlighted separately. Keyboard users can focus the page, move with arrow keys and pick with Enter or Space.
3. Use **Parent**, **First child** or **Pick new row** to correct scope. Changing row scope clears the previous field rules. The displayed row selector is for inspection, not an executable input.
4. Choose a field type, click **Pick field**, then choose an element inside the selected row. Supported types are visible text, HTTP(S) link/image URL, image alt text and explicitly allowlisted descriptive attributes. Inspect or remove fields before confirming.
5. **Confirm selection** freezes a read-only preview (up to six rows and eight fields) in side-panel memory and releases the webpage. **Cancel picker** or Escape discards it instead. No recipe or dataset is saved; navigating away clears the preview.

## Engineering decisions

- **Authority and transport:** inject one packaged picker into the granted top-frame Chrome document after a deliberate side-panel action. Verify the active tab, origin, route and document ID. The isolated agent accepts only the named port from the extension's side-panel URL and validates bounded operation and preview messages. There are no new permissions, manifest content scripts, web-accessible resources or dependencies.
- **Selection and matching:** use bounded sibling fingerprints and structural similarity, independent of CSS class names. The inspected selectors use local tag/ordinal paths; sampled peers are queried with structured relative steps. Inspect up to 128 siblings, preview no more than six matching rows, and label a capped count as a lower bound. The selected example is kept first.
- **Field safety:** no arbitrary attribute name, JavaScript or CSS selector input. Forms, edits, frames, hidden content and shadow content are outside scope. Read only allowed visible or descriptive values. Safe URLs are displayed as text, with no preview fetching; non-HTTP(S) or credential-bearing URLs are discarded. Missing fields remain null rather than shifting columns.
- **Reversibility:** a closed-shadow overlay with pointer-transparent, locally scoped styling is appended without altering existing page elements. While actively picking, capture the normal click so the selected link does not navigate. Review mode leaves ordinary clicks alone. On confirm, cancel, disconnect, departure or two-minute expiry, remove the overlay, observers, listeners and timers. The picker cannot undo arbitrary website handlers that already ran before its event listener.
- **Dynamic pages:** debounce local rechecks. Suitable sibling additions refresh the preview, removed or hidden anchors invalidate relevant fields, and a lost row returns to row-picking without substituting another row. Preserve the active picking instruction when a mutation arrives during a field pick. Route and tab changes end the session; selector paths are still heuristic when similar siblings differ in structure.

## Demonstrated results

| Structure | Observed behavior |
| --- | --- |
| Catalog cards | Clicking the first product link highlighted its article and found three matching rows. The preview aligned Link URL, Image alt text and `data-price` across cards, including `85.00` for Camp stove. Confirm removed the overlay; a subsequent link click navigated normally. |
| Inventory table | Corrected an individual cell to its parent row, inspected the first child, selected the first-cell text field, and previewed three rows including `সরঞ্জাম` and `Camp mug`. Keyboard-only arrows and Enter also selected a row. |
| Dynamic catalog and strict-CSP table | Added sibling refreshed 3 → 4 matches; removing the selected element cleared the preview. Navigation, Escape, and closing the side-panel port tore down the overlay. In the strict-CSP case, the page body matched its original markup after teardown. |

## Verification and evidence

| Check | Result |
| --- | --- |
| `npm run format:check`, `npm run typecheck`, `npm run lint`, production WXT build | Passed. |
| `npm test` | **23 passed** (including two new message/attribute boundary tests). |
| `npm run test:e2e` | **21 passed**, including five new picker scenarios on loopback fixtures. The positive automation used a copied manifest with a loopback-only test grant. The unchanged production build separately verified no picker action is offered without authorization. |
| Native Chrome fixture smoke | Passed on Chrome for Testing `159.0.8154.6`, headed via Xvfb with the unchanged production manifest. Native toolbar invocation granted access; side panel started picking; clicking the product title selected its repeated article without following the link. Cancel removed the overlay and a second click followed the normal hash link. |
| `npm audit` | Zero known vulnerabilities reported at check time; not a code security audit. |

See [command transcript](PHASE_06_CHECKS.txt). Native and automated evidence screenshots were captured. Tests used controlled fixtures, not third-party sites. Chrome 116, Edge, Firefox, touch-specific flows, all page layouts, and screen-reader interoperability remain unverified.

## Changes, defects and remaining scope

Created `entrypoints/picker.ts`, `src/core/picker/`, browser picker connector/hook, side-panel picker UI, two fixtures, unit and browser tests, this report and the transcript. Updated the side-panel workspace and styles, visibility guard for editable regions, authorization regression test and README. No dependency or permission changes.

Resolved a mutation-refresh bug that could overwrite the active field-picking instruction. Final checks showed no unresolved defect within their tested scope. Repeated heterogeneous rows or layouts outside the top-frame HTML scope can still require manual correction; field previews are bounded and in memory. No full dataset collection, edit pipeline, saved recipes, or export was implemented in Phase 06.

## Next approval gate

Phase 07 is **Extraction and Data Processing**. It has not begun. Reply `APPROVE PHASE 06` to proceed, or request changes within Phase 06.
