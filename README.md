# MASUM SCRAPNEXS

An independent, local-first Chrome extension for collecting structured web data. **Repository:** `masum-scrapnex`. **Package:** `instant-scraper`. This is the **Phase 10 development snapshot (`0.1.0`)**, not a complete scraper or a release build for publication. The popup, workspace, and settings have a shared light/dark design. Try the clearly labeled, built-in sample data to select a candidate, sort/search records, and select rows. The extension also detects structures on the authorized tab and shows a read-only preview of up to six rows per candidate. Point-and-click selection can narrow the row scope, choose individual fields, and confirm a local preview. Collect the selected structure from the current page, then edit, sort, filter, or deduplicate the working dataset. The working copy stays in memory unless you save a local snapshot. For automatically detected structures, you can also inspect and authorize a bounded, same-origin pagination run. Download the working dataset as CSV, XLSX, or JSON, or copy a tab-separated selection. Use Local history to restore a saved snapshot or select a structure using a saved configuration after a fresh analysis. Settings shows storage usage, cleanup controls, and workflow defaults.

## Build and load locally

Use [Node.js](https://nodejs.org/) `24.22.3` (see `.nvmrc`) and npm `10.8.2` or newer. From the project root:

```sh
npm ci
npm run build
```

Open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `.output/chrome-mv3`. Open an ordinary HTTPS page and invoke the toolbar popup; select **Open side panel**, then click **Analyze page** for suggestions or **Pick elements** to manually select a row. Use only webpages you are authorized to analyze. Browser version `116` is a provisional manifest minimum, not a tested compatibility guarantee.

The extension requests `activeTab`, `scripting`, `storage`, and `sidePanel`. There are no host permissions or automatically registered content scripts. The packaged agents run in the authorized top-frame document only for a requested scan, capture, picker session, or explicitly authorized pagination run. No request, click, navigation, or file export is triggered by detection. Appearance and workflow preferences use `storage.local`; explicitly saved snapshots and configurations use extension-local IndexedDB. The extension does not sync them between profiles.

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

| Path              | Purpose                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `entrypoints/`    | WXT extension worker, popup, side panel, options, and page agents   |
| `src/browser/`    | Browser ports, Chrome adapter, hooks, and validated shell messages  |
| `src/core/`       | Analyzer, detector, extraction, pagination, picker, export, library |
| `src/ui/`         | Workbench panels, settings, brand components, and sample data       |
| `src/data/`       | Shared typed extraction contracts                                   |
| `src/styles/`     | Shared design tokens, responsive CSS, and React mounting            |
| `public/`         | Extension icons and license texts copied into the build             |
| `preview/`        | Standalone UI preview (sample data, no extension APIs)              |
| `tests/unit/`     | Unit and component tests                                            |
| `tests/e2e/`      | Chromium extension end-to-end tests                                 |
| `tests/fixtures/` | HTML and harness fixtures for browser tests                         |
| `tests/qa/`       | Standalone QA verification scripts                                  |
| `docs/`           | Architecture, requirements, security, roadmap, feature matrix       |
| `docs/phases/`    | Per-phase verification reports and check transcripts                |

See [Phase 10 local persistence and verification](docs/phases/PHASE_10_PERSISTENCE.md), [Phase 09 exports and verification](docs/phases/PHASE_09_EXPORT.md) and [Phase 08 pagination](docs/phases/PHASE_08_PAGINATION.md). Development follows explicit approval gates. Phase 11 (advanced product features) is in progress; see [Phase 11 progress](docs/phases/PHASE_11_PROGRESS.md).
