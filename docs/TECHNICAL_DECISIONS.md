# MASUM SCRAPNEX — Technical decisions and evidence

All design decisions are proposals pending Phase 01 approval. Dependency metadata below is a dated observation, not a lockfile.

## Environment reconnaissance (19 November 2026)

| Probe | Actual result |
|---|---|
| `pwd; ls -la; git status --short` | `/home/user`, initially only `uploads/`; not a Git repository. Attachments are unchanged. |
| `node -v; npm -v; git --version` | Node `20.20.2`; npm `10.8.2`; Git `2.47.3`. Terminal and workspace writes verified by creating these Markdown files. Files under `/home/user` are eligible for persistence per environment contract; later-turn retention not yet observed. |
| `command -v` and conventional install/cache paths + Node/Python module probes | Chrome/Chromium/Firefox/Playwright/Xvfb not found in checked locations; Playwright/Puppeteer not resolvable in Node, Python Playwright/Selenium absent, no `DISPLAY`. No browser or extension was launched. |
| `npm ping --fetch-retries=0 --fetch-timeout=5000` | `PONG` from npm registry. Chrome Web Store and Chrome developer pages were readable through the fetch tool; browser binary download and runtime not verified. |
| `npm view … version engines --json --fetch-retries=0` | WXT `0.21.5`: Node `>=22`; Vitest `5.1.1`: Node `^22.12.0 || ^24.0.0 || >=26.0.0`; Vite `8.3.8`: Node `^20.19.0 || >=22.12.0`; Playwright Test `1.65.1`: Node `>=20`. |

## Decision records

| ID | Proposed decision and why | Alternatives/trade-off and verification |
|---|---|---|
| D01 | User-facing identity **MASUM SCRAPNEX**. Preserve mandated engineering repository/package slug `instant-scraper`; package `0.1.0`, release `1.0.0`. | Rename engineering IDs only on explicit change request; no reference branding in public UI. |
| D02 | WXT/Vite build for MV3 and target adaptation; React/TypeScript for multi-surface UI and typed contracts; Tailwind semantic tokens and Lucide for consistent accessible styling; Vitest, Playwright, ESLint and Prettier. | Native DOM tools for extraction (TreeWalker, MutationObserver, URL). Do not add a backend, state framework or dependency where browser APIs suffice. Adopt reproducible Node 24 LTS tooling in Phase 02; verify the actual runtime plus pinned direct/transitive versions before committing the lockfile. If Node 24 provisioning is blocked, report and review compatible older versions or alternate dev environment; no silent bypass of engine checks. |
| D03 | Chrome 116+ provisional API floor for gesture-driven `sidePanel.open`; narrow ports for workspace, tabs, permission, transport, settings and save. | Documented capability is not a tested version promise. Validate the oldest claimed browser and a modern release; raise tested floor explicitly if needed. Do not assume Edge Firefox UI APIs match. |
| D04 | Deterministic DOM ranking with transparent evidence and manual fallback. Prefer semantic layout and structural repeatability over CSS-class labels. | No AI, hidden network endpoints, proprietary cloning, or guesses from weak semantic signals. Calibrate against representative local fixtures, keeping a holdout set for regression. |
| D05 | Service worker coordinates short operations; isolated page agent observes the current active document; extension-origin IndexedDB holds durable state. | In-memory job runners break on suspension. Atomic batches and checkpoints allow controlled recovery; uncertain actions never replay automatically. Hot path retains bounded chunks only. |
| D06 | Start with `activeTab` and `scripting` plus necessary local settings/panel permissions. Use same-origin, confirmed actions and explicit new-origin consent. | No permanent all-site host permission. If later a narrow optional permission is proposed, review its exact manifest pattern and behavior in Phase 08/11. Without it, require per-origin activation. |
| D07 | Prefer small owned CSV/JSON serialization with strong cases for quoting and Excel safety, or evaluate PapaParse if it reduces risk. Evaluate SheetJS distribution, maintenance, license and bundle size for XLSX. | No CDN runtime; pin verified package source and integrity for XLSX; XLSX string-cell safety and independent round-trip are required, regardless of library. |
| D08 | Controlled local fixtures for repeatable E2E; Playwright bundled Chromium with persistent context for an unpacked extension, installed Chrome manual checks for real toolbar activation/side panel. | Arena HTTP preview is not extension validation. A directly opened extension page tests UI, not a toolbar grant or side-panel browser chrome. If launch is unavailable in Arena, run a documented local/CI smoke and record blockers until actual evidence exists. |

## Primary-source checks

- [Chrome `activeTab`](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab): explicit invocation, same-origin navigation preserves temporary access; cross-origin navigation and tab close revoke it. `scripting` still required to inject a packaged script.
- [Chrome sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel): programmatic `open` starts in Chrome 116 and requires a user action.
- [Chrome extension worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): worker suspension/termination is expected; persistent state must not live in globals.
- [Playwright Chrome extensions](https://playwright.dev/docs/chrome-extensions): persistent Chromium context and bundled Chromium for sideloaded automation. Separate manual Chrome verification is still planned.

## Risks and decision checkpoints

| Risk | Consequence and mitigation | Review |
|---|---|---|
| High — runtime mismatch and unknown Chromium launch | Stock Node is below current WXT/Vitest requirements. Provision pinned compatible tooling; use CI/manual Chrome fallback and mark browser verification blocked until demonstrated. | 02 |
| High — weak grouping, span ambiguity and selector drift | False positives/silent column shifts. Validate fixtures, show score evidence, preserve span provenance, and stop for review when selectors drift. | 04–07, 11 |
| High — unrelated click or navigate/worker race | Unintended actions or duplicate batches. Strict control/destination validation, step leases, checkpointing, uncertain-state review; direct user navigation is always possible. | 08, 13 |
| High — partial visibility in virtual lists, frames, shadow boundaries | Rows silently missing if scope is unclear. Start with top-level rendered DOM; state snapshot/partial coverage and detect no-growth. | 04, 08 |
| High — mixed local content trust or spreadsheet behavior | Privacy leakage or formulas from extracted content. Narrow origin/authority, text rendering, URL policy, adversarial export tests and no preview image downloads. | 02, 09, 13 |
| Medium — online sheets/library and storage sizing | XLSX may consume significant memory; quotas and migrations can fail. Preflight limits, preserve committed data, offer CSV, independently verify exports. | 09–10 |
| Medium — duplicate rows and cross-browser differences | Wrongly dropped records or degraded UI. Compare canonical values and occurrence counts, provide user control, maintain tested platform matrix. | 07, 12 |
