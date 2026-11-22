# Changelog

All notable changes to MASUM SCRAPNEXS. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **New visual language across every surface.** An Apple-inspired design system (system font
  stack, 11–28 px type ramp, 4 pt spacing, hairline separators, translucent toolbar with an opaque
  fallback, one elevation per level) now covers the popup, side panel, options page, dialogs and
  the data grid. Existing class names and all behaviour are unchanged; the design layer is additive
  CSS plus a remapped token set. Apple assets are not bundled: typography resolves to the system
  stack and materials are CSS approximations, both stated in `docs/DESIGN_SYSTEM.md`.
- The popup is now a 320 px card (was 360 px).
- Compact layouts use a five-tab bar with short labels (`Preview`, `History`) instead of a wrapping
  navigation row; the long labels remain in the sidebar at wide widths.

### Fixed

- Editable grid cells now include their visible value in the accessible name (WCAG 2.5.3), so
  screen readers and voice control can address them.
- Checkbox targets are 32 px, and export checkbox rows are no longer 18 px tall.
- Increased-contrast and reduced-transparency preferences now apply in light mode; the override
  previously lost to the more specific `:root[data-theme="system"]` selector.
- Escape closes an open disclosure sheet and returns focus to its summary.
- Five text declarations below the 11 px floor are corrected; the type-floor gate now also matches
  the `font` shorthand that hid them.

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
