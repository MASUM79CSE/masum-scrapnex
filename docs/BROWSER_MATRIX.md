# Browser compatibility matrix

Only verified cells may be claimed. Everything else is stated as untested, not "supported".

| Capability | Chrome 159 (verified) | Microsoft Edge | Firefox |
| --- | --- | --- | --- |
| Toolbar popup, side panel and settings | Verified | Untested — same Chromium engine, `sidePanel` API differs in packaging | Not built |
| `activeTab` + `scripting` scan on demand | Verified | Untested | Not built |
| Detection, extraction, editing and grid | Verified | Untested | Not built |
| Bounded pagination (next/numbered/URL/Load More/scroll) | Verified | Untested | Not built |
| CSV/XLSX/JSON export and clipboard | Verified | Untested | Not built |
| Local history, snapshots and configuration recipes | Verified | Untested | Not built |
| Manifest permission set | 4 permissions, no host grants (asserted in CI) | Not packaged | Not packaged |

## Notes

- The manifest declares `minimum_chrome_version: "116"` because `chrome.sidePanel` requires 116.
  That is an **API floor**, not a support claim: verification was performed on Chrome for Testing
  159.0.8154.6 only.
- Firefox would need `sidebar_action` instead of `side_panel`, a different downloads path and
  MV3 event-page differences. Phase 12 covers the portability audit; until it reports verified
  runs, Firefox is unsupported.
- No touch-specific, screen-reader or assistive-technology combinations have been verified beyond
  the accessibility checks recorded per phase.
