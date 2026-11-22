# MASUM SCRAPNEXS — Production launch plan

**Author:** Principal engineering review · **Date:** 2026-11-19 · **Status:** ratified decisions recorded, execution started

**Ratified decisions (2026-11-19):** launch target = **public Chrome Web Store** · v1 browser
scope = **Chrome + Edge + Firefox** · localization = **English only** · first execution step =
**accuracy corpus before more detection code**.
**Code baseline:** `36fed25` (docs reorganized) on top of Phase 10 `554591e`; Phase 11 work uncommitted in the working tree.

> **This document is a plan, not an authorization.** The master brief requires a separate
> `APPROVE PHASE n` command before each phase's work is accepted, and publishing requires
> explicit authorization beyond that. Nothing here changes an approved scope on its own.

---

## 1. Executive summary

The product is a genuinely working, well-engineered **Phase 10** extension. It is **not**
launch-ready, and the distance is larger than the remaining feature work suggests.

| Dimension | Today | Launch bar |
| --- | --- | --- |
| Feature completeness (v1 scope) | ~70 % — Phase 11 partly done | 100 % of v1 scope, with explicit "not supported" statements |
| Verification | 60 unit/component + 48 Chromium tests, all green | Same suites + real-world corpus accuracy report + independent QA pass |
| Browser support | Chrome for Testing 159 only | Documented matrix; min-version claim backed by evidence |
| Release engineering | Manual `npm run build` in a sandbox | Reproducible builds, CI gate, signed artifacts, version discipline |
| Documentation set | README + design docs + phase reports | README, DEVELOPMENT, SECURITY, CHANGELOG, user guide, QA report, release notes |
| Store readiness | Nothing prepared | Listing copy, screenshots, privacy policy URL, permission justifications |

**The single largest risk is not code quality — it is detection accuracy on real websites.**
Every detection test to date runs against controlled fixtures. A scraper that is excellent on
fixtures and mediocre on live pages fails at launch, and that is invisible to the current suite.

**Estimated distance to a submittable release candidate:** 20–30 engineering days of focused
work, calendar 4–6 weeks with approval gates and review points. See §9.

---

## 2. Evidence-based state of the product

### 2.1 What is genuinely strong

- **Security posture is above average for this category.** Four permissions
  (`activeTab`, `scripting`, `storage`, `sidePanel`), zero host permissions, no declared content
  scripts, no remote code, no network egress path for collected data, no telemetry.
- **Bounded engineering.** Every hot loop has an explicit budget: 1.8 s scan cap, 10 k row cap,
  2 M UTF-16 payload cap, 640 chars/cell, 32-row preview, 24 KiB config import, 12-URL queue cap.
- **Transactional persistence.** IndexedDB v2 with metadata/payload split, rollback on failed
  upgrade, age-based cleanup, documented quota behavior.
- **Honest documentation culture.** Phase reports distinguish "verified" from "unverified"
  (fixture vs. browser vs. native Chrome vs. third-party site). This is rare and should be kept.
- **Real browser tests, not jsdom mocks.** Packaged extension loaded into Chromium, driven by
  Playwright, with real downloads, real IndexedDB, real keyboard input.

### 2.2 Verified gaps that block launch

| # | Gap | Evidence | Severity |
| --- | --- | --- | --- |
| G1 | **No real-world accuracy data.** Zero third-party sites tested; detection precision/recall unknown | `docs/phases/PHASE_05_DETECTION.md` limitations | Critical |
| G2 | **No CI pipeline.** No `.github/`, gates run manually per session | repo audit | High |
| G3 | **Chrome 159-only evidence**, while the manifest declares `minimum_chrome_version: 116` | `wxt.config.ts` vs. test logs | High |
| G4 | **No release documents**: `CHANGELOG.md`, `DEVELOPMENT.md`, `SECURITY.md`, `LICENSE`, user guide all missing | repo audit | High (Phase 14 gate) |
| G5 | **Phase 11 features incomplete**: ranking, nested tables, irregular cards, selector correction, field customization, pagination recovery, large data | master brief §Phase 11 | High |
| G6 | **No error/observability story.** Unhandled promise rejections, worker restarts mid-run, tab-close during pagination have no user-visible diagnosis path | code review | Medium-High |
| G7 | **Accessibility verified piecemeal** (axe in some suites, 320 px, keyboard) — no systematic WCAG 2.1 AA audit, no screen-reader pass | phase reports | Medium-High |
| G8 | **Large-data ceiling untested past 10 k rows** — no memory measurement, no explicit UX for "you hit the cap" | Phase 07 report | Medium |
| G9 | **Store assets and compliance artifacts absent** (no listing copy, screenshots, privacy policy URL, data-use disclosure) | repo audit | Medium (blocks submission) |
| G10 | **No lockfile-pinned CI cache / no SBOM**, dependency audit is manual | repo audit | Low-Medium |

### 2.3 Known limits that must be stated, not fixed

Some items are deliberate v1 non-goals (master brief §3.2). The launch bar is that each is
**stated in the user guide and store listing**, not silently absent:

manual-picker pagination · cross-origin capture · JS-only infinite scroll without DOM growth ·
nested scroll containers · automatic retry after a failed page · undo of already-performed page
actions · native save dialog / Excel UI · Chrome 116/Edge/Firefox behavior (until Phase 12).

---

## 3. Production definition of quality

These are the acceptance thresholds I would hold a release to. They should be ratified before work starts.

| Area | Bar | How it is measured |
| --- | --- | --- |
| Detection accuracy | ≥ 90 % of a 40-page corpus yields the expected primary structure as the top-ranked candidate; ≤ 5 % pages produce a *harmful* wrong candidate (silently wrong columns/rows) | Corpus harness (see W1) with human-labelled expectations |
| Extraction fidelity | 100 % field alignment on the golden fixture set; zero silent null-for-text swaps | Existing golden fixtures + new ones |
| Performance | Analyze ≤ 1.8 s on a 10 k-node page (p95); collect 10 k rows ≤ 8 s; grid stays ≥ 50 fps at 10 k rows | Repeatable measurement script, recorded in report |
| Memory | No unbounded growth; peak < 300 MB at 10 k rows with 8 columns | Chromium heap snapshot comparison |
| Stability | No unhandled rejection in a 60-minute soak across 30 pages; recovery path documented for every failure mode | Soak test |
| Security | Zero host permissions; zero remote code; every message validated against a schema; injection audit clean | Phase 13 audit + static review |
| Privacy | No network request carries page content; verified by proxy/network capture during E2E | Playwright request interception assertion |
| Accessibility | WCAG 2.1 AA for the workspace; full keyboard operation; 200 % zoom; one screen-reader smoke pass | axe + manual matrix |
| Browser support | Chrome ≥ 120 verified; claim matches evidence exactly | Compatibility matrix |
| Build integrity | Reproducible artifact, checksummed, version-locked, dependency audit clean | Release checklist |

---

## 4. Workstreams

Ten workstreams. Each has a definition of done and produces an artifact. Workstreams W1–W4
map onto the required approval phases; W5–W10 run alongside but their *evidence* lands in
Phase 13/14 gates.

### W1 — Real-world accuracy program (unblocks the biggest risk)

**Why first:** it can invalidate detection work that has not started yet.

1. Build a **corpus harness**: `tests/corpus/` with a manifest of 40 pages — 12 e-commerce
   listings, 8 article/feed feeds, 6 search results, 6 directory pages, 4 tables-on-docs pages,
   4 deliberately hostile pages (whole-page grid layout, div-soup, ads interleaved).
2. Record per page: URL, expected structure kind, expected column count, expected row count band.
3. **Capture fixtures offline** (single-file HTML snapshots, committed with size caps) so the suite
   is deterministic and legal — never re-fetch at test time.
4. Harness asserts: top-1 candidate identity, column-name sanity, row-count band, and a
   "harmful wrong" flag. Output a per-run accuracy table into `docs/reports/ACCURACY.md`.
5. Only pages the user is authorized to analyze are captured; snapshotting is opt-in per page.
6. Rerun after every detection change. This becomes the objective function for ranking work.

**DoD:** accuracy table with ≥ 40 pages, baseline recorded, harness in CI, and a documented policy
for adding pages.

### W2 — Complete Phase 11 (the remaining v1 scope)

Sequenced by user value, each with tests written first:

| # | Task | Concrete deliverable | Acceptance evidence |
| --- | --- | --- | --- |
| 11.1 | Ranking improvements | Feature-based scoring with per-candidate evidence weights (row consistency, header presence, semantic density, link/text ratio, container similarity); tie-break by extraction completeness | Corpus top-1 rate improves over baseline; unit tests pin each weight |
| 11.2 | Complex nested tables | Nested `table` inside cells preserved as text, never merged into parent; multi-row headers flattened to `Parent / Child`; rowspan/colspan projection with explicit warnings | New fixtures: 3-level nesting, header groups, ragged spans |
| 11.3 | Irregular cards | Clustering tolerates missing fields, variable child counts, mixed image/text order; no merging of unrelated lists; container similarity threshold documented | Fixtures: asymmetric product cards, feed items with/without images |
| 11.4 | Manual selector correction | After auto-detection, user can correct the row container and any single field (pick parent/sibling/child), with instant re-preview and stored correction in the recipe | Browser test: correct → re-preview → collect; correction survives recipe reuse |
| 11.5 | Field customization | Per-field: rename, reorder, hide, change kind (text/url/image/attribute), transform (trim, absolute URL, numeric), default value | Unit + browser tests; export honors hidden/reordered fields |
| 11.6 | Pagination recovery | Detect stalled/no-growth page, offer "retry this page", "skip and continue", "stop and keep N rows"; checkpoint after each page | Browser test: 3 failure modes, data preserved, no duplicate rows |
| 11.7 | Large-data handling | Explicit cap messaging with "export partial" path; streaming collect into batches; grid virtualization verified at 50 k; memory measured | Perf report at 10 k/50 k with heap numbers |
| 11.8 | Config reuse (extend current) | Reuse must survive column reorder (done), *plus* optional field-override diff preview and one-click re-apply | Browser test on second page of same site |
| 11.9 | URL queue (extend current) | Add reorder/remove, per-entry notes, and "advance" guardrails; keep the one-page-at-a-time authorization model | Browser test: no auto-advance, no silent permission grant |

**Non-negotiable during 11.9:** the queue never navigates on its own, never requests permissions,
never collects, and never persists URLs. Current implementation already meets this; the extension
must not regress it.

### W3 — Cross-browser readiness (Phase 12 scope)

- Audit Chrome-specific calls: `chrome.sidePanel`, `chrome.scripting.executeScript` world/`documentId`,
  `chrome.downloads`, IndexedDB assumptions, `tabs.create` activation behavior.
- Produce `docs/BROWSER_MATRIX.md`: feature × Chrome / Edge / Firefox, each cell
  *verified* / *degraded (how)* / *unsupported (why)*.
- Prepare WXT Firefox target (`sidePanel` → `sidebar_action` shim, downloads shim, MV2/MV3 differences)
  and Edge target (Chromium — mostly free).
- **Only claim what is actually run.** If Firefox is untested, the listing says Chrome + Edge.

### W4 — QA, security and performance audit (Phase 13 scope)

Fixed-rubric pass producing `docs/reports/QA_AUDIT.md`:

- Full suite + weekly matrix; severity rubric (Critical/High/Medium/Low/Info) with exit rule:
  **no unresolved Critical or High**, and no data-integrity defect at any severity.
- Security audits: permission diff, message-schema fuzz (malformed/oversized/wrong-origin payloads),
  DOM-injection audit (never assign untrusted strings to `innerHTML`), export-injection audit
  (formula prefixes, CSV/TSV, XLSX inline literals), privacy audit (network capture proof).
- Performance and memory report at 100 / 1 k / 10 k / 50 k rows.
- Accessibility: axe on every surface, keyboard-only run, 200 % zoom, screen-reader smoke.
- Failure-mode catalogue: every path that can stop collection, and what the user sees.

### W5 — Release engineering

- **CI** (GitHub Actions): `format:check → typecheck → lint → unit → build → e2e` on every push,
  with a pinned Node 24.22.3 and a Playwright browser cache. Nightly full matrix.
- **Version discipline:** `0.1.0` → `1.0.0` at Phase 14; `CHANGELOG.md` in Keep-a-Changelog format;
  version reflected in manifest, package, and UI badge (currently hard-coded `v0.1.0 FOUNDATION`).
- **Reproducible artifact:** build from a clean checkout, checksum, record `SHA256SUMS`,
  archive source + built extension per release.
- **Rollback plan:** keep the previous store package; document the unpublish/revert procedure.

### W6 — Documentation set (Phase 14 deliverables)

`README.md` (rewritten for users first, developers second) · `DEVELOPMENT.md` (setup, architecture,
test strategy, release procedure) · `SECURITY.md` (threat model, permission rationale, disclosure
address) · `CHANGELOG.md` · `docs/USER_GUIDE.md` (task-oriented, with screenshots and the
"what it cannot do" section) · `docs/reports/{QA_AUDIT,ACCURACY,PERFORMANCE}.md` · release notes.

### W7 — Store readiness (Chrome Web Store)

| Requirement | Status | Owner |
| --- | --- | --- |
| Developer account, $5 fee, verified email, 2FA | **User action** | You |
| Privacy policy at a public URL | To write + host (**user action** to publish) | Me to draft |
| Single-purpose statement | To draft | Me |
| Permission justifications (4 permissions, one line each) | To draft | Me |
| Data-use disclosure (no collection, no sale, no remote transfer) | To draft | Me |
| 1–5 screenshots at 1280×800 + 128 px icon + optional 440×280 tile | To produce from real UI | Me |
| Listing copy: name, short description (≤132 chars), full description, category, language | To draft | Me |
| Support contact / URL | **User action** | You |
| Responsible-use statement (user must be authorized to scrape) | To draft | Me |

### W8 — Reliability and error handling

- Single error boundary per surface with a plain-language message and a "copy diagnostics" action
  (reusing the already-redacted diagnostics projector — no page content).
- Explicit handling for: tab closed mid-run, navigation during collect, worker restart, quota
  exceeded, storage blocked, download cancelled, import rejected.
- Soak test: 30 pages / 60 minutes / continuous analyze-collect-discard cycles; zero unhandled rejections.

### W9 — Product polish and accessibility

- Version badge and "FOUNDATION" label removed for 1.0; consistent empty/loading/error states.
- First-run guidance: one-screen explainer of the authorize → analyze → collect → export flow.
- Bangla + English UI strings if localization is in scope (see decisions); otherwise state English-only.
- Dark/light parity verified on every panel; reduced-motion respected.

### W10 — Privacy and responsible use

- Written responsible-use policy in-app ("only collect data you are authorized to collect").
- robots.txt/ToS awareness note; no bypass of authentication, paywalls, or rate limits.
- Confirm zero telemetry and document it explicitly in the listing and user guide.

---

## 5. Phase mapping (approval gates stay intact)

| Gate | Contains | Exit evidence |
| --- | --- | --- |
| **PHASE 11** | W2 complete + W1 harness established and baseline recorded | Completed feature matrix + test evidence + accuracy baseline |
| **PHASE 12** | W3 | Browser compatibility matrix with verified cells only |
| **PHASE 13** | W4 + W5 (CI live) + W8 | QA audit report, zero unresolved Critical/High, perf/memory report |
| **PHASE 14** | W6 + W7 + W9 + W10 + `1.0.0` build | Release candidate ZIP, full doc set, store package, clean-install transcript |

Each gate ends with `STOP` and a single approval command. Publishing is a **separate,
later** authorization that I cannot perform on your behalf.

---

## 6. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Real-world detection accuracy disappoints | High | Critical | W1 first; corpus-driven ranking; ship with honest "verify the preview" guidance |
| Scope creep from "advanced features" | High | Medium | Fix the v1 list in §4 W2; everything else goes to 1.1+ |
| Chrome store rejection (single purpose / permissions) | Medium | High | Minimal permissions already; draft justifications early; pre-submit review checklist |
| Sandbox-only verification ≠ real Chrome | Medium | High | Clean-profile install test on a real desktop Chrome before submission (user-assisted) |
| Large-DOM pages destabilize the worker | Medium | Medium | Budgets already exist; add cap messaging + soak test |
| Test flakiness erodes trust in gates | Medium | Medium | Deterministic fixtures, no network in tests, retries documented not hidden |
| No independent QA reviewer | High | Medium | Be explicit: single-reviewer evidence; recruit a second reviewer or accept stated limitation |
| Time pressure to "just launch" | Medium | High | Go/No-Go checklist in §8 is binary; no partial passes |

---

## 7. Decisions I need from you

1. **Launch target:** public Chrome Web Store listing, unlisted/private (link-only) distribution,
   or self-hosted `.crx`/ZIP for internal use? This changes the bar for W6/W7 substantially.
2. **v1 browser scope:** Chrome only, Chrome + Edge, or Chrome + Edge + Firefox (adds ~5–8 days)?
3. **Localization:** English-only for 1.0, or English + Bangla (adds i18n plumbing, ~3–5 days)?
4. **Store identity:** do you have (or will you create) the developer account, support email, and a
   place to host the privacy policy? I can draft the policy, but I cannot host it or submit for you.
5. **Independent review:** is a second human reviewer available for the Phase 13 audit, or do we ship
   with a single-reviewer limitation stated plainly?

---

## 8. Go / No-Go checklist (binary)

Launch is a **No-Go** if any line below is false.

- [ ] All v1 scope items implemented, or explicitly documented as unsupported in-app and in the listing
- [ ] Unit + E2E suites green from a clean CI run on the release commit
- [ ] Accuracy report meets the §3 bar on the committed corpus
- [ ] Zero unresolved Critical/High defects; zero data-integrity defects
- [ ] Permission set unchanged (4), no host permissions, no remote code
- [ ] Privacy verification: no request carries page content
- [ ] Accessibility: WCAG 2.1 AA pass on every surface, keyboard-only run completed
- [ ] Performance and memory within budget at 10 k rows (and measured at 50 k)
- [ ] Version `1.0.0` consistent across manifest, package, UI, CHANGELOG
- [ ] Clean-install test on a fresh Chrome profile from the packaged artifact
- [ ] Doc set complete: README, DEVELOPMENT, SECURITY, CHANGELOG, user guide, QA report, release notes
- [ ] Store package complete: listing copy, screenshots, privacy URL, permission justifications
- [ ] Rollback path documented and previous artifact retained
- [ ] Explicit written launch authorization from you

---

## 9. Sequencing and effort

Dependency-ordered. Estimates are engineering days for one focused engineer including tests
and documentation, **not** commitments.

| Order | Item | Days | Depends on |
| --- | --- | --- | --- |
| 1 | W1 corpus harness + baseline | 3–4 | — |
| 2 | W2 11.1–11.3 detection quality (drive against W1) | 6–8 | 1 |
| 3 | W2 11.4–11.5 correction + field customization | 4–5 | 2 |
| 4 | W2 11.6–11.7 recovery + large data | 4–5 | 2 |
| 5 | W2 11.8–11.9 config reuse + queue polish | 2 | 3, 4 |
| **Gate** | **Phase 11 evidence package** | 1 | 1–5 |
| 6 | W3 cross-browser matrix + Firefox/Edge builds | 4–6 | Gate 11 |
| **Gate** | **Phase 12** | 0.5 | 6 |
| 7 | W5 CI pipeline (start earlier if possible) | 2 | — |
| 8 | W4 QA/security/performance audit + fixes | 8–12 | Phase 12, 7 |
| 9 | W8 reliability hardening (overlaps 8) | 3 | 7 |
| **Gate** | **Phase 13** | 1 | 8, 9 |
| 10 | W6 docs + W7 store package + W9/W10 polish | 5–7 | Phase 13 |
| 11 | `1.0.0` build, clean-install, release candidate | 2 | 10 |
| **Gate** | **Phase 14** | 1 | 11 |
| 12 | Store submission + review + staged rollout | calendar 3–10 days | Phase 14 + your authorization |

**Total engineering effort:** ~45–62 days of work; **calendar:** 4–6 weeks at a sustainable
pace with gates, or ~3 weeks compressed (which I would not recommend for a release).

**Critical path:** W1 → detection quality → Phase 11 gate → Phase 12 → Phase 13 → Phase 14.

---

## 9a. Baseline recorded (W1 complete, first pass)

The corpus harness is live: `tests/fixtures/corpus/pages.ts` (41 deterministic pages across 11
archetypes with hashed class names, site chrome, ads, missing fields and Bangla content) and
`tests/e2e/corpus.spec.ts`, which runs the **packaged** `page-agent.js` in Chromium and writes
[`docs/reports/ACCURACY.md`](reports/ACCURACY.md).

| Metric | Value |
| --- | --- |
| Pages | 41 |
| Top-1 structure accuracy | **41/41 (100 %)** |
| Wrong structure ranked first | 0 |
| Right structure, wrong shape | 0 |
| Navigation/decoy leakage into top-1 | 0 |
| Regression floor enforced in the test | 95 % |

**Honest reading:** this corpus is authored by us, so 100 % is a *regression floor*, not evidence
of real-world accuracy. The launch bar in §3 requires captured pages from sites the operator is
authorized to analyze, reported as a separate number. Capturing those pages is the next step and
needs your input on which sites are in scope.

One modelling defect was found and fixed while building the harness: for tables larger than the
32-row scan bound, the detector reports a sampled observed count plus a full estimate. The harness
now compares shape bands against the estimate, and the report marks sampled rows with `*`.

## 10. What I will do immediately after approval

1. Commit the current Phase 11 slice as a checkpoint on a branch (not merged), so the working
   tree stays clean while the corpus work proceeds.
2. Stand up W1: corpus manifest, offline fixtures, accuracy harness, baseline table.
3. Start 11.1 ranking with tests written first, measured against the baseline.
4. Report progress per workstream; stop at the Phase 11 gate with the completed feature matrix
   and test evidence.

Nothing in this plan authorizes Phase 12–14 work, publication, or distribution.
