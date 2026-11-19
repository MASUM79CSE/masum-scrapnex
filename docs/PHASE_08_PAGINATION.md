# Phase 08 — Pagination and dynamic crawling

**MASUM SCRAPNEXS · Development snapshot `0.1.0`**  
**Implemented and verified; approval pending.** Phase 09 has not begun.

## Demonstrate a run

Build the extension and load `.output/chrome-mv3` as an unpacked extension, or unzip the Chrome build and load its directory. To reproduce the controlled demonstration locally from the source tree using the pinned Node version:

```sh
node --input-type=module -e 'import { createServer } from "node:http"; import { servePagination } from "./tests/fixtures/pagination/pages.ts"; createServer((req,res) => { if (!servePagination(req,res)) res.writeHead(404).end(); }).listen(8080,"127.0.0.1");'
```

1. Open `http://127.0.0.1:8080/paging/numbered?page=1`, invoke the toolbar popup, and open the side panel. Choose **Analyze page**, select the inventory table, then choose **Inspect pagination controls**. No page interaction is sent during inspection.
2. Select **Numbered pagination** and review the displayed first destination. Set **Maximum additional actions** to `2` and **Minimum delay** to `500` ms; click **Authorize and start**. The starting page is collected before either numbered-page action. The fixture reaches page 3, verifies three snapshots, skips two duplicate rows, and leaves four unique records in the working grid.
3. Use `/paging/next?page=1`, `/paging/url?page=1`, `/paging/more`, or `/paging/scroll` for the alternate modes. Inspect and authorize each separately. Discard the prior working dataset before starting another run.
4. **Pause run** stops at the next verified checkpoint, **Resume run** continues the same in-memory run, and **Stop run** prevents further actions and preserves verified records. A click or navigation already issued cannot be undone. When verification fails, the run stops; inspect the actual page, analyze it again, and explicitly authorize a new run if appropriate. No uncertain operation is retried automatically. Keep the source tab active, and keep the panel open; closure or reload does not resume a run.

## Supported actions and limits

| Mode | Evidence and constraints |
| --- | --- |
| Next-page link | Explicit `rel=next` (including document metadata), or a recognized next-page label inside a pagination landmark. Generic “Next” outside a landmark is not enough. |
| Numbered pagination | A single marked current page and a linked next number in a pagination landmark. |
| URL pattern | An existing same-path link in a pagination landmark with a one-step increment of `page`, `paged`, or `p` and otherwise unchanged query parameters. No unlinked addresses are generated. |
| Load More | A unique visible, enabled, non-form button with a recognized label in main content. The control must still match at action time. It is invoked once per verified step, with no repeat after a failed or duplicate-only result. |
| Infinite scrolling | Fixed increments of the main page viewport. The observer waits for relevant DOM changes, quiet time, and visible `aria-busy` to clear; in the absence of a content mutation, a verified forward viewport movement can enable the next step. Stops on no verified progress or caps. Nested scrollers are not supported. |

- The user authorizes one type of action and **1–10 additional actions** after the first page, with a **500–5,000 ms** minimum delay. The run deadline is 120 seconds, including pauses. Navigation has a 12-second verification window. DOM observation and extraction are separately bounded. All records are deduplicated by exact normalized row tuples. The combined dataset remains capped at 10,000 records and two million data units.
- The browser adapter binds to the original tab, window, and top-frame document; verifies each committed link destination and a new document ID; and checks the same candidate ID and column signature on each page. Redirects or site-initiated navigation can occur in the browser, but unexpected destinations are not read or replayed. Tab switches, incoherent results, loading timeouts, repeating URLs, and schema drift prevent further actions. Real listings whose structure or candidate ID changes between pages can require a new run.
- This builds on automatic structure detection. The manual picker still supports a single-page capture; manual selectors are not carried between pages. No general URL crawl, arbitrary selector execution, special handling of login/paywall/CAPTCHA, silent recovery after a crash, durable history, export, third-party compatibility claims, or permission expansion is included.
- Page controls are heuristic and site code controls their effects. Review the displayed control and run only on webpages you are authorized to automate. The engine does not attempt to defeat page protections and does not collect an unexpected redirect. Source pages and destination URLs can still make their ordinary network requests; the extension does not upload the dataset.

## Verification scope

The production manifest test checks the unchanged MV3 permission surface and bundled entrypoints. Authorized workflow automation uses a test copy with a loopback-only host grant, not a change to the shipped manifest. Chromium tests run the real packaged page agent and paginator on loopback HTML pages, including navigation, delayed content, review without interaction, pause/resume/stop, and failure retention. The screenshot is the packaged panel document in a controlled Chromium tab, not a native side-panel screenshot. Chrome 116, Edge, Firefox, touch and screen-reader operation, and third-party sites are not verified.

Final checks: **37 unit/component and 38 Chromium tests passed**, including nine multi-page workflow cases. Formatting, TypeScript, ESLint, diff checks, production build (484.46 kB), and `npm audit` (zero advisories) passed on the pinned Node runtime and Chromium/Chrome for Testing `159.0.8154.6`. See [the checks transcript](PHASE_08_CHECKS.txt).

The single-page scale regression captured 100, 1,000, and 10,000 records in 75.7, 115.4, and 971.5 ms respectively from collect click to the verified rendered grid, with 23 initial DOM data rows in each case. These are single-run Chromium fixture observations, not multi-page throughput claims.

**Approval gate: `APPROVE PHASE 08`**
