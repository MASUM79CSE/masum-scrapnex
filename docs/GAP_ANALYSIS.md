# MASUM SCRAPNEXS — Gap analysis

Evidence-based audit of `main` (`883755c`) against the master brief (v1 scope), the production
launch bar in [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md), and the Chrome Web Store requirements.
Every claim below was checked against the repository, not recalled.

**Verdict:** no *architectural* gaps — nothing is built on a foundation that must be replaced.
The gaps are **coverage** (untested reality), **completeness** (v1 features still open) and
**packaging** (release artefacts that do not exist yet). Roughly 70 % of v1 scope is done.

---

## 1. Critical gaps — these block launch

| # | Gap | Evidence | Why it matters |
| --- | --- | --- | --- |
| C1 | **Never tested on real websites** | Every detection test runs against fixtures we wrote; phase reports explicitly say "no third-party site was scanned" | The core value proposition is unproven. Accuracy on our own fixtures (46/46) does not transfer automatically |
| C2 | **Phase 11 incomplete** | 11.4 selector correction, 11.5 field customization, 11.6 pagination recovery UI, 11.7 large-data handling still open | These are named v1 requirements in the master brief §Phase 11 |
| C3 | **No release artefacts** | `LICENSE`, `CHANGELOG.md`, `DEVELOPMENT.md`, `SECURITY.md` (root), user guide, store listing, screenshots, privacy-policy URL all absent | Phase 14 gate and store submission both require them |
| C4 | **Chrome version claim unsupported** | Manifest declares `minimum_chrome_version: "116"`; only Chrome for Testing 159 has ever run | Shipping an untested minimum is a support liability |
| C5 | **No independent QA pass** | All evidence is single-reviewer (me) | Phase 13 requires "independent evaluation"; that cannot be me grading my own work |

---

## 2. High gaps — fix before submitting

| # | Gap | Evidence |
| --- | --- | --- |
| H1 | **No global error handling** — no error boundary, no `unhandledrejection`/`window.onerror` hook anywhere in `src/` or `entrypoints/` | grep returns zero matches |
| H2 | **Large data stops at 10 000 rows** — `maxDatasetRows = 10_000` is a hard cap with no "export partial" path | `src/core/extraction/contracts.ts:4` |
| H3 | **No memory or soak evidence** — no heap measurement, no long-run test | `docs/reports/` has accuracy only |
| H4 | **Accessibility is partial** — axe runs in three specs, but no systematic WCAG 2.1 AA pass, no screen-reader run, no 200 % zoom check | `tests/e2e/{library,extension,detector}.spec.ts` |
| H5 | **Cross-browser unverified** — no Firefox/Edge build configuration or matrix, despite v1 scope decision | no `docs/BROWSER_MATRIX.md`; `wxt.config.ts` targets Chrome only |
| H6 | **Feature matrix is stale** — still says "All SCRAPNEX implementation is NOT STARTED" | `docs/FEATURE_MATRIX.md:3` |
| H7 | **No test coverage measurement** — coverage tooling not installed or configured | `vitest.config.ts` has no coverage settings |

---

## 3. Medium gaps

| # | Gap | Evidence |
| --- | --- | --- |
| M1 | **Field customization is partial** — rename, move and delete columns exist; per-field transforms (trim, absolute URL, numeric), kind override, default values and hide-without-delete do not | `src/core/extraction/edit.ts` exports only `renameColumn`, `moveColumn`, `deleteColumn`, `editCell` |
| M2 | **No correction of an auto-detected structure** — the picker is a separate flow; you cannot take a detected table and fix one wrong column | `src/core/picker/selection.ts` has `manualPlan`/`suggestRow`, but no "repair this candidate" entry point |
| M3 | **Pagination recovery is internal only** — statuses include `recovery`, but no per-page retry / skip / keep-N-rows UI | `src/core/pagination/run.ts:17` |
| M4 | **No store assets or copy** — nothing prepared for Chrome Web Store | repo audit |
| M5 | **English-only UI** — fine as a decision, but no `_locales` means no path to translation without refactoring strings | grep for `_locales`/`i18n` returns nothing |
| M6 | **Diagnostics are scan-level only** — no capture-level or pagination-level diagnostics for support cases | `src/core/detector/diagnostics.ts` |
| M7 | **Version label hard-coded** — UI shows `v0.1.0 FOUNDATION` independent of `package.json` | `src/ui/workspace.tsx` |

---

## 4. Deliberate non-goals — not gaps

The master brief §3.2 excludes these from v1; they must be *stated* in the user guide and listing,
not built: manual-picker pagination, cross-origin capture, JS-only infinite scroll without DOM
growth, nested scroll containers, automatic retry after a failed page, undo of performed page
actions, native save-dialog/Excel-UI verification, legacy `.xls`.

---

## 5. What is genuinely strong (no gap)

- Permission model: 4 permissions, zero host permissions, no static content scripts, **enforced in CI**.
- Zero network egress from collected data; no telemetry; verified by grep and by test.
- Bounded everything: scan 1.8 s, 50 k nodes, 640 chars/cell, 24 KiB config import, 12-URL queue, 10 k rows.
- Transactional IndexedDB with migration, rollback and quota handling.
- Deterministic, offline, 46-page accuracy harness with a regression floor.
- Honest documentation culture that separates verified from unverified claims.

---

## 6. Recommended order

1. **C1** real-page corpus (needs your authorised captures) — everything else is guesswork without it.
2. **C2** finish Phase 11 (11.4 → 11.7).
3. **H1, H2, M1–M3** reliability and editing depth, which also satisfy H2's cap messaging.
4. **H5** cross-browser (Phase 12), then **H4/H3/H7** measurement (Phase 13).
5. **C3, M4, M7** packaging and store prep (Phase 14).
6. **C5** recruit a second reviewer before submitting.
