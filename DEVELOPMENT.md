# Development guide

## Requirements

- Node.js `24.22.3` (pinned in `.nvmrc`; `engine-strict=true` in `.npmrc`)
- npm `10.8.2` or newer

## Setup

```sh
npm ci
npm run build          # .output/chrome-mv3
```

Load `.output/chrome-mv3` via `chrome://extensions` → Developer mode → Load unpacked.

## Scripts

| Script                                                        | Purpose                                               |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `npm run dev`                                                 | WXT dev server with hot reload                        |
| `npm run build`                                               | Production MV3 build                                  |
| `npm run zip`                                                 | Packaged archive for distribution                     |
| `npm run typecheck` / `npm run lint` / `npm run format:check` | Static gates                                          |
| `npm test`                                                    | Unit and component tests (Vitest)                     |
| `npm run test:e2e`                                            | Build, then Playwright against the packaged extension |
| `npm run preview:ui`                                          | Standalone UI preview with sample data                |

## Architecture in one screen

| Layer       | Location                                                 | Rule                                                                   |
| ----------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| Domain      | `src/core/**`                                            | Pure logic, no browser APIs, unit-testable in Node                     |
| Browser     | `src/browser/**`                                         | Ports and Chrome adapters; validates every message crossing a boundary |
| UI          | `src/ui/**`                                              | React components; never touches `chrome.*` directly                    |
| Entrypoints | `entrypoints/**`                                         | Thin wiring: worker, popup, side panel, options, injected agents       |
| Agents      | `entrypoints/{page-agent,picker,paginator,collector}.ts` | Run in the page's isolated world, return bounded plain data            |

Data flow: user gesture → `activeTab` grant → packaged agent injected into the top frame →
bounded scan → schema-validated report → UI preview → explicit collect → working dataset in
memory (saved only on request).

## Test strategy

| Layer                             | What it proves                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `tests/unit/`                     | Contracts, editors, exporters, ranking, picker and import validation in Node               |
| `tests/e2e/`                      | The packaged extension in real Chromium: tabs, permissions, downloads, IndexedDB, restarts |
| `tests/fixtures/corpus/`          | 46 deterministic pages scored for top-1 detection accuracy                                 |
| `tests/fixtures/corpus/captured/` | Real captured pages (see [CAPTURE_CORPUS.md](docs/CAPTURE_CORPUS.md))                      |
| `tests/qa/`                       | Independent artefact verification (export bytes)                                           |

E2E tests that need page access copy the build and add a **loopback-only** host permission in the
copy; the shipped manifest is asserted clean in the same suite and in CI.

## Conventions

- Bound everything: every loop over page or user data has a node, time, row or size limit.
- Never widen permissions. CI fails if `host_permissions` or static `content_scripts` appear.
- No telemetry and no network egress for collected data.
- Prefer fixtures over live sites; prefer measured numbers over adjectives.
- Each phase ends with evidence, then **stops** for approval.

## Release procedure

1. `npm run format:check && npm run typecheck && npm run lint && npm test && npm run test:e2e`
2. Bump the version in `package.json` (the UI badge and diagnostics follow automatically).
3. Update `CHANGELOG.md`.
4. `npm run build && npm run zip`; record SHA-256 of the archive.
5. Install the archive in a clean Chrome profile and run the smoke checklist in the release notes.
6. Publication requires explicit authorisation separate from any phase approval.
