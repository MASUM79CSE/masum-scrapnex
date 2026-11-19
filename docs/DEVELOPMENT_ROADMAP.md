# MASUM SCRAPNEXS — Development roadmap and Phase 01 checklist

**Approval protocol:** complete, verify and document each phase, then stop. To authorize Phase 02, reply `APPROVE PHASE 01`. Phase 02 has not begun. Do not publish or distribute a production extension without separate explicit authorization.

## Phase 01 implementation checklist (documentation only)

| Item | Status and evidence |
|---|---|
| Environment inspection, terminal/storage/git/network/browser probes | VERIFIED — actual command outputs summarized in [TECHNICAL_DECISIONS.md](TECHNICAL_DECISIONS.md). No extension launch. |
| Product brand, benchmark public research and core workflows | VERIFIED at documentation level — [REQUIREMENTS.md](REQUIREMENTS.md) and [FEATURE_MATRIX.md](FEATURE_MATRIX.md); hands-on benchmark unverified. |
| Functional/nonfunctional requirements and acceptance criteria | VERIFIED as design artifacts — R01–R10 and coverage map. |
| Architecture, project structure, domain algorithm, browser ports and data models | VERIFIED as design artifacts — [ARCHITECTURE.md](ARCHITECTURE.md). None implemented. |
| Storage/export, risks, threat model and permissions | VERIFIED as design artifacts — [SECURITY.md](SECURITY.md) and decision register. No runtime claims. |
| Roadmap/gates and verification plan | VERIFIED as design artifacts — this file. |
| User approval | NOT STARTED — awaiting command. |

## Phases and exit evidence

| Phase | Scope | Evidence before asking approval |
|---|---|---|
| 01 Research and architecture | Six planning documents only | Internal consistency and stated limitations; user approves direction. |
| 02 Greenfield initialization | Initialize the repository (now `masum-scrapnex`), Git and initial docs; provision compatible Node; WXT/React/TypeScript/Tailwind, lint/format, Vitest, Playwright; entrypoints, adapters and model scaffolding | Install and verify pinned versions, typecheck/lint/unit tests/build; inspect generated MV3 manifest, try Chromium extension smoke and explain any unresolved browser blocker. |
| 03 Design/UI foundation | Original identity and light/dark tokens; popup, panel, grid and settings foundations | Keyboard/contrast/narrow-width and view-state checks; omit unavailable actions or explicitly label disabled scope. |
| 04 DOM analyzer | Bounded structure/visibility analysis and fixture harness | Tree/region and budget/cancel assertions; initial browser performance baseline and proposed thresholds. |
| 05 Automatic detection | Native tables, recurring structures, scoring and alternatives | Golden rank and regression fixtures incl. false positives; evidence visible for alternatives. |
| 06 Visual selection | Overlay, picker navigation, similar row selection and manual fields | Browser interaction and teardown cases. |
| 07 Extraction/data processing | Table/data field projection, normalization/dedup, grid workflows | Exact fixture outputs and edit/selection consistency tests; data transforms do not corrupt row alignment. |
| 08 Pagination and dynamic collection | Next/numbered/pattern, Load More, scroll, progress, stop and recovery | Local browser flows, blocked transitions and interruption; implement minimal checkpoint storage required for this feature, expand repositories in 10. |
| 09 Exports | CSV, XLSX, JSON, clipboard and subset controls | Byte/golden and independent spreadsheet round-trips; covered formula, Unicode and size boundaries. |
| 10 Persistence/history | Versioned settings, DB revisions, sessions/recipes, quotas, deletion and recovery | Restart/reload, quota, deletion, migration and idempotence checks. |
| 11 Advanced features | Irregular grouping, recovery/large data refinements, redacted diagnostics, reusable configuration and reviewed finite URL queue | Completed feature matrix, config validation and negative permission tests. |
| 12 Cross-browser readiness | Portability review and capability/build compatibility checks | Measured Chrome/Edge/Firefox matrix listing verified features, degradations and blocked items; no unsupported v1 promise. |
| 13 QA, security and performance | Full regression, clean-profile behavior, permissions, dependency audit, a11y and data-size tests | Independent review and QA evidence under severity rubric; no unresolved critical issue, reproducible perf report and limitations. |
| 14 Production release | Package `1.0.0`, docs/assets/privacy metadata and clean-install verification | Source and validated archive, README/DEVELOPMENT/SECURITY/CHANGELOG, user guide, matrix, QA report, release notes and final report. No publication without explicit permission. |

Start every code phase with a failing or scoped test where practical. Record command, actual output, test environment and remaining gaps. Distinguish unit/DOM fixture, integration, browser protocol and genuine browser UI checks. Tests in each relevant layer are rerun before its gate. Independent QA is a fresh verification pass against acceptance criteria, ideally by another reviewer; do not claim an independent reviewer participated without evidence. Type/lint/unit/build checks are not applicable at the documentation-only gate.

Future, not part of v1: 1.1 stronger complex-DOM/dynamic support; 1.2 richer templates and dataset workflows; 1.3 verified Edge/Firefox release support; 2.0 deeper configurable workflows and optional integrations subject to separate approval.
