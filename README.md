# MASUM SCRAPNEX

An independent, local-first Chrome extension for collecting structured web data. `instant-scraper` is the engineering/package identifier. This is the **Phase 02 development scaffold (`0.1.0`)**, not a working scraper or a release build for publication. The popup, side-panel page, options page, and background service worker load; webpage analysis, collection, storage, and export are not enabled.

## Build and load locally

Use [Node.js](https://nodejs.org/) `24.22.3` (see `.nvmrc`) and npm `10.8.2` or newer. From the project root:

```sh
npm ci
npm run build
```

Open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `.output/chrome-mv3`. Open an ordinary HTTPS page and invoke the toolbar popup; then try **Open side panel**. The automated check loads the underlying extension pages in Chromium; the manual process above is how to verify the real toolbar interaction. Browser version `116` is a provisional manifest minimum, not a tested compatibility guarantee.

The extension requests `activeTab`, `scripting`, `storage`, and `sidePanel`. There are no host permissions or automatically registered content scripts. The packaged page agent does not collect or read webpage data in Phase 02. The options page contains no editable settings yet.

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

| Path           | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `entrypoints/` | WXT extension worker, popup, side panel, options, and page agent |
| `src/browser/` | Browser ports, Chrome adapter, and validated shell messages      |
| `src/data/`    | Initial typed extraction contracts                               |
| `src/styles/`  | Minimal React mounting and Tailwind wiring                       |
| `tests/unit/`  | URL/context handling and message boundary tests                  |
| `tests/e2e/`   | Generated manifest and Chromium extension smoke tests            |
| `docs/`        | Phase 01 design baseline and Phase 02 verification               |

See [Phase 02 verification](docs/PHASE_02_VERIFICATION.md) for exact scope, evidence, and limitations. Development follows explicit approval gates. Phase 03 has not begun.
