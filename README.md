# MASUM SCRAPNEXS

An independent, local-first Chrome extension for collecting structured web data. **Repository:** `masum-scrapnex`. **Package:** `instant-scraper`. This is the **Phase 08 development snapshot (`0.1.0`)**, not a complete scraper or a release build for publication. The popup, workspace, and settings have a shared light/dark design. Try the clearly labeled, built-in sample data to select a candidate, sort/search records, and select rows. The extension also detects structures on the authorized tab and shows a read-only preview of up to six rows per candidate. Point-and-click selection can narrow the row scope, choose individual fields, and confirm a local preview. Collect the selected structure from the current page, then edit, sort, filter, or deduplicate the working dataset. The working copy is in memory only. For automatically detected structures, you can also inspect and authorize a bounded, same-origin pagination run. Durable dataset storage and export are not enabled.

## Build and load locally

Use [Node.js](https://nodejs.org/) `24.22.3` (see `.nvmrc`) and npm `10.8.2` or newer. From the project root:

```sh
npm ci
npm run build
```

Open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `.output/chrome-mv3`. Open an ordinary HTTPS page and invoke the toolbar popup; select **Open side panel**, then click **Analyze page** for suggestions or **Pick elements** to manually select a row. Use only webpages you are authorized to analyze. Browser version `116` is a provisional manifest minimum, not a tested compatibility guarantee.

The extension requests `activeTab`, `scripting`, `storage`, and `sidePanel`. There are no host permissions or automatically registered content scripts. The packaged agents run in the authorized top-frame document only for a requested scan, capture, picker session, or explicitly authorized pagination run. No request, click, navigation, or file export is triggered by detection. The extension stores only the appearance preference in `storage.local`.

## Try the standalone UI preview

```sh
npm run preview:ui
```

The preview starts in sample mode and exercises the same workspace UI without Chrome extension APIs. Its theme preference is isolated to preview-origin local storage.

## Verify

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npx playwright install chromium
npm run test:e2e
```

On a fresh Debian/Linux environment with missing shared libraries, use `npx playwright install --with-deps chromium` (OS package installation may require administrator privileges). In a fresh Arena sandbox you can run npm with the pinned runtime, for example `npm exec --yes --package=node@24.22.3 -- npm ci`, and use the same prefix for the other `npm` commands.

| Path                 | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `entrypoints/`       | WXT extension worker, popup, side panel, options, and page agent |
| `src/browser/`       | Browser ports, Chrome adapter, and validated shell messages      |
| `src/ui/`            | Workbench, settings, brand components, and sample data           |
| `src/core/detector/` | Table and listing detection and bounded previews                 |
| `src/core/analyzer/` | Bounded, deterministic DOM structure analysis                    |
| `src/data/`          | Initial typed extraction contracts                               |
| `src/styles/`        | Shared design tokens, responsive CSS, and React mounting         |
| `tests/unit/`        | URL/context handling and message boundary tests                  |
| `tests/e2e/`         | Generated manifest and Chromium extension smoke tests            |
| `docs/`              | Design baseline and phase verification                           |

See [Phase 08 pagination and verification](docs/PHASE_08_PAGINATION.md) and [Phase 07 extraction and editing](docs/PHASE_07_EXTRACTION.md). Development follows explicit approval gates. Phase 09 has not begun.
