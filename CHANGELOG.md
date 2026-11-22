# Changelog

All notable changes to MASUM SCRAPNEXS. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Versioned JSON export and reviewed import of extraction configurations, with strict
  schema validation, a 24 KiB limit and fresh local identity on import.
- Locally generated extraction diagnostics with no site address, DOM text, selectors or values.
- Explicit multi-URL queue: one page at a time, opened by a separate click, each page still
  authorised individually; no automatic navigation, permission grant or collection.
- Evidence-based candidate ranking (fill rate, distinct values, typed and named columns) with a
  penalty for site-chrome rows, replacing cross-kind score comparison.
- Deterministic 46-page detection accuracy corpus with a regression floor in CI.

### Changed

- A table nested inside another detected table can no longer be the primary suggestion.
- Partial captures explain the limit that stopped collection and confirm that captured data
  remains editable and exportable.
- The UI version badge reads the real package version instead of a hard-coded string.

### Fixed

- Inner-table content no longer leaks into a parent table's preview cells.

## [0.1.0] — 2026-11-19

Phases 01–10 of the approved build.

### Added

- WXT + React + TypeScript MV3 foundation with a pinned Node runtime, lint, format and tests.
- Original light/dark identity across popup, side panel and settings.
- Bounded DOM analyser, native-table and repeating-structure detection with ranked alternatives.
- Visual point-and-click picker with keyboard operation and manual relative fields.
- Extraction, virtualised grid, sorting, filtering, editing, column management and deduplication.
- Bounded pagination: next, numbered and URL patterns, Load More and scroll, with pause, resume,
  stop and verification of every transition.
- CSV, XLSX and JSON exports plus tab-separated clipboard copy, all with spreadsheet-safety.
- Local history: transactional IndexedDB snapshots, schema migration and rollback, retention
  cleanup, versioned settings and configuration recipes.

### Security

- Four permissions (`activeTab`, `scripting`, `storage`, `sidePanel`), no host permissions, no
  static content scripts, no remote code, no telemetry and no network path for collected data.
