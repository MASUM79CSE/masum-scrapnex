# Apple design migration — execution log

Plan: [DESIGN_APPLE_PLAN.md](DESIGN_APPLE_PLAN.md). One section per phase; a phase is only
"done" when its gates are green and its evidence is recorded here.

---

## Phase A — Foundations ✅

**Delivered**

- `src/styles/tokens.css` — the single source of truth: type ramp (11–28 px, 13 px body),
  4 pt spacing scale, radii, control metrics, four elevation levels, materials, motion curves,
  and a full semantic colour model (label / fill / separator / tint / status roles).
- Four appearance contexts: **dark**, **light**, **system (light)**, and
  **`prefers-contrast: more`** overrides for both dark and light.
- Legacy variable names (`--bg`, `--surface`, `--text`, `--accent`, …) aliased to the new
  roles, so every existing component adopts the new palette without a risky rename.
- Global layer: system font stack (SF Pro on Apple platforms, Segoe/Roboto/Inter elsewhere),
  Apple type scale on headings, tabular numerals in data surfaces, one high-contrast focus ring
  for every interactive element, `::selection` tint, macOS-style overlay scrollbars.
- Appearance branches: `prefers-reduced-motion` (transforms removed, transitions ≤ 1 ms),
  `prefers-reduced-transparency` and `prefers-contrast: more` (materials collapse to opaque,
  hairlines strengthen, focus ring thickens).
- Typography floor enforced: **six declarations at 8–10 px were raised to 11 px**, and
  sub-11 px sizes are now a test failure.

**Gate evidence (G1–G6)**

| Gate | Result |
| --- | --- |
| G1 text contrast ≥ 4.5:1 | pass — lowest is 5.20:1 (light tertiary) |
| G2 non-text contrast ≥ 3:1 | pass — control border 3.43:1, focus ring 5.82:1 minimum |
| G3 focus never removed | pass — audit scans for `outline: none/0` without a replacement |
| G4 no colour literals outside tokens | pass — scanner over `src/styles`, `src/ui`, `src/browser` |
| G5 four-context token parity | pass — every semantic role present in dark, light, system |
| G6 11 px floor, 13 px body | pass — style scan + metrics assertion |

Measured contrast matrix (generated from the tokens, not by eye):

| Pair | Dark | Light | Min |
| --- | --- | --- | --- |
| text (`label` on `bgWindow`) | 17.18:1 | 15.25:1 | 4.5:1 |
| text on card (`label` on `bgSurface`) | 14.75:1 | 17.01:1 | 4.5:1 |
| secondary (`labelSecondary` on `bgSurface`) | 8.51:1 | 7.40:1 | 4.5:1 |
| tertiary (`labelTertiary` on `bgSurface`) | 5.96:1 | 5.20:1 | 4.5:1 |
| on tint (`onTint` on `tint`) | 10.15:1 | 5.82:1 | 4.5:1 |
| on destructive (`onDestructive` on `destructive`) | 7.47:1 | 5.85:1 | 4.5:1 |
| destructive (`destructive` on `bgSurface`) | 6.67:1 | 5.85:1 | 4.5:1 |
| warning (`warning` on `bgSurface`) | 10.05:1 | 5.93:1 | 4.5:1 |
| success (`success` on `bgSurface`) | 8.94:1 | 6.13:1 | 4.5:1 |
| info (`info` on `bgSurface`) | 9.10:1 | 6.83:1 | 4.5:1 |
| control border (`controlBorder` on `bgSurface`) | 3.83:1 | 3.43:1 | 3:1 |
| focus ring (`focusRing` on `bgSurface`) | 11.36:1 | 5.82:1 | 3:1 |

**Evidence artefacts:** `artifacts/screenshots/apple/{sidepanel,popup,options}-{dark,light}.png`
via `node tools/capture-ui.mjs`.

**Carried into later phases:** component-level restyling (B), shell/navigation (C), data
surfaces (D), flows (E), motion (F), full verification (G).

---

## Phase B — Core controls ✅

**Delivered** — a single control vocabulary, all token-driven:

| Element | Treatment |
| --- | --- |
| `.button--primary` | Filled tint, 38 px tall, semibold, soft elevation, press-scale 0.985 |
| `.button--outline` / `--quiet` | Transparent with hairline, fills on hover |
| `.button--destructive` | Solid red, always paired with a confirmation |
| `.button:disabled` | Reduced-tint fill, tertiary label, `cursor: not-allowed`, no shadow |
| Icon buttons | 32 px hit floor; accessible name is a gate (G8) |
| `.nav-link` | Segmented tab bar; `aria-current` gets tint wash + tint ring |
| Text inputs, select, textarea | Filled surface, 3:1 border (above WCAG 1.4.11's minimum), tint on focus |
| Checkboxes / radios | `accent-color: var(--tint)`, 16 px |
| `.search-box` | Pill field, focus ring on the wrapper, no inner outline |
| `.count-tag` | Caption pill; partial-capture tag switches to the warning role |
| Disclosure (`details.export-panel`) | Grouped-list row, 38 px, hairline separator when open |
| `[role="alert"]` | Destructive wash with a 3 px coloured edge |
| `.sort-button` | Plain text control with hover fill |

**Bug found and fixed during this phase.** The `prefers-contrast: more` and
`prefers-reduced-transparency` overrides were written against `:root`, which loses to the more
specific `:root[data-theme="system"]` selector (0,2,0 vs 0,1,0). In light mode the accessibility
override silently did nothing — exactly the class of defect a gate exists to catch. Both layers
now target `:root`, `:root[data-theme="light"]` and `:root[data-theme="system"]` explicitly,
including the nested light-preference case.

**New gate suite** — `tests/e2e/design.spec.ts`, run against the packaged extension:

| Gate | Assertion | Result |
| --- | --- | --- |
| G7 | all visible controls ≥ 30 px tall, primary ≥ 38 px | pass |
| G8 | no icon-only control without an accessible name (3 surfaces) | pass |
| G9 | Tab produces a ≥ 2 px visible outline | pass |
| G11 | reduced motion collapses transitions/animations to ≤ 2 ms | pass |
| G12 | increased contrast sets `--materialBlur: none` | pass |
| G13 | axe (WCAG 2.0/2.1 A + AA) reports zero violations | pass |
| G14 | layout shift on first paint < 0.1 | pass |

**Evidence:** `artifacts/screenshots/apple/*-{dark,light}.png`, regenerated after the phase.

---

## Phase C — Shell and navigation ✅

**Delivered** — the frame the product lives in:

| Region | Treatment |
| --- | --- |
| Window chrome | 52 px sticky toolbar, translucent material with a solid `--bgChrome` fallback; hairline separator instead of a heavy border |
| Brand | 28 px mark, 17 px semibold wordmark, 11 px tracked caption |
| Sidebar | Source-list: sticky under the toolbar, scrolls on its own, 32 px rows, tinted selection |
| Compact navigation | Under 680 px the sidebar becomes a five-tab bar: one row, icon over label, 44 px targets, never wrapping |
| Labels | Responsive: `Data preview` / `Local history` on wide, `Preview` / `History` in the tab bar. Only the visible label is in the accessibility tree, so the accessible name always matches the screen |
| Hero | The gradient banner and the grid texture are gone. A quiet surface card, 22–28 px title, 13 px description, grouped source row |
| Workflow | A step rail, not a second card: hairline border, 20 px index circles, tinted current step |
| Footer | Hairline rule, footnote caption |
| Options | Single centred column (max 820 px), cards without shadow stacking |
| Popup | 320 px card, material header, filled status row, full-width 38 px primary action |

**Bugs found and fixed during this phase.**

1. `.app-grid { grid-template-columns: 216px … }` silently applied to the options page and crushed
   its content into a 130 px column: a later single-class rule outranks the earlier
   `.app-grid--options` rule at equal specificity. Both the base and the 975 px override are now
   scoped with `:not(.app-grid--options)`. Visible only in a screenshot — no test asserted options
   width.
2. The extension gate's popup width check encoded the old 360 px; the plan specifies 320 px. The
   assertion was updated, not bypassed.
3. G6 had a hole: it scanned `font-size:` but not the `font:` shorthand, so five declarations
   below the 11 px floor (`font: 650 9px var(--mono)`) had survived Phase A. The gate now matches
   both forms and all five are fixed.
4. axe caught `.build-tag span` at 3.44:1 — a text element using `--labelQuaternary`, which is a
   graphic role. It now uses `--labelTertiary` (5.96:1 dark, 5.20:1 light).

**New gate suite** — `tests/e2e/shell.spec.ts`:

| Gate | Assertion | Result |
| --- | --- | --- |
| G10 | no horizontal overflow at 320 px on all three surfaces; every visible control inside the viewport | pass |
| G10 | the work grid stacks from two columns to one instead of clipping | pass |
| G13 | axe clean on 5 surface × width combinations (compact and wide) | pass |
| shell | five tabs share one row at 320/375/420/560/680 px and never overflow the bar | pass |
| shell | wide sidebar lists every tab at one left edge and one width | pass |
| shell | toolbar and sidebar stay pinned while the panel scrolls | pass |
| shell | with materials disabled the bar is opaque (`rgb(…)`, alpha 1, no blur) | pass |
| shell | each breakpoint exposes the label it shows, with no duplicate accessible names | pass |

*200 % zoom is emulated as a halved CSS viewport (320 px from a 640 px window) — that is the reflow
a real zoom produces. Page-scale zoom does not reflow and would prove nothing.*

**Regression:** format, typecheck and lint clean; **73 unit tests (13 files)**; **64 Chromium e2e
tests** (56 previous + 8 new). One existing assertion was updated for the deliberate popup width
change.

**Evidence:** `artifacts/screenshots/apple/{sidepanel,popup,options}-{dark,light}.png`.

---

## Phase D — Data surfaces ✅

**Delivered** — the grid is the product, so it got the most attention:

| Surface | Treatment |
| --- | --- |
| Candidate list | Grouped list, one hairline between rows, 16 px radio, tinted selection with a 2 px left bar |
| Sample preview table | 34 px rows, hairline separators, zebra striping removed, sticky-width numerics |
| Working dataset grid | Sticky opaque header, 34 px rows, `--font-text` with `tabular-nums`, hairline separators, row selection tinted with a left bar |
| Filters and tools | Caption labels, 32 px fields, pill search, tabular counts |
| Column manager | Disclosure sheet with grouped rows and 32 px targets |
| Inline cell editor | Raised card (shadow-2), tint edge, opens in place |
| Empty state | Quiet tinted glyph, 15 px title, 13 px explanation |
| Capture status | Inline footnote with a success dot; destructive colour on failure |

**Defects the gates found (three real ones):**

1. **WCAG 2.5.3 Label in Name.** Every editable cell button carried
   `aria-label="Edit Batch in row 8"` while its visible text was the cell value, so the accessible
   name did not contain the visible label. 38 nodes failed axe. The name now ends with the value:
   `Edit Batch in row 8: 3`. This changed the accessible name, so four `exact: true` test lookups
   were updated to prefix regexes — the assertions were corrected, not deleted.
2. **16 px checkboxes were 16 px hit targets.** Native checkboxes ignore padding and borders
   (verified in Chromium: `padding: 8px` leaves the box at 16 px), so CSS alone cannot grow them.
   Row checkboxes are now wrapped in a 32 px `.row-check` label, and the export/column checkbox
   rows became 32 px settings rows.
3. **`.export-columns` rows were 18 px tall** — below the G7 floor once inputs were included in
   the gate. Fixed with a 32 px row and a hover fill.

**New gate suite** — `tests/e2e/design-data.spec.ts`, run with real captured records:

| Gate | Assertion | Result |
| --- | --- | --- |
| G13 | axe clean on the populated grid (200 rows) | pass — 0 violations |
| G7 | every control in the dataset panel ≥ 28 px (checkbox label counted as its target) | pass |
| D | `font-variant-numeric` is `tabular-nums` on grid cells | pass |
| D | the table header stays pinned (≤ 1 px drift) while 2 000 px of rows scroll under it | pass |
| D | a selected row computes a different background from an unselected one | pass |
| **Exit** | **10 000 rows sustain ≥ 50 fps** | **pass — 60 fps, p95 16.7 ms, max 16.8 ms, 23 DOM rows** |

The frame rate is measured as painted frames in a one-second continuous scroll window, not as an
average frame delta: rAF is quantised to the refresh interval, so an average delta hides drops, and
in a background tab rAF throttles to ~1 Hz (the first attempt measured 1 fps and was wrong until the
panel was brought to the foreground).

**Regression:** format/typecheck/lint clean, **73 unit**, **69 Chromium e2e**.
**Evidence:** `artifacts/screenshots/apple/sidepanel-data-{dark,light}.png` plus the four surface
captures.

---

## Phase E — Flows and overlays ✅

**Delivered:**

| Surface | Treatment |
| --- | --- |
| Disclosure sheets (save, export, import, queue, diagnostics) | 40 px summary row, hairline body, inset focus ring, hover fill |
| Export options | Caption labels, 32 px fields, grouped fieldset, success/warning notes |
| History and configuration lists | Grouped rows with a single hairline between them, actions on the right |
| Feedback | Toast-style banner with a tint edge, 240 ms entrance, destructive variant for errors |
| URL queue | Mono textarea, 32 px field, grouped form |
| Diagnostics | Mono block on a raised surface, scrollable, capped at 40 vh |
| Crash card | Centred sheet (shadow-3), title1 heading, mono detail block with a destructive edge |
| Dismissal | **Escape closes the sheet the user is in and returns focus to its summary** |

The Escape behaviour is new code (`src/ui/overlays.ts`), not styling: `<details>` has no dismissal of
its own, so an open sheet could only be closed by finding its summary again. The handler is scoped —
it closes only a sheet that contains the focused element, so Escape never closes something the user
is not looking at.

**New gate suite** — `tests/e2e/design-flows.spec.ts`:

| Gate | Assertion | Result |
| --- | --- | --- |
| G9 | Escape closes an open sheet and focus returns to the summary | pass |
| G9 | Escape still dismisses while typing inside the sheet | pass |
| G9 | a sheet opens with Enter, shows a ≥ 2 px focus ring, closes with Escape | pass |
| G7 | every sheet summary row is ≥ 38 px | pass |
| G11 | reduced motion removes the toast entrance (≤ 2 ms) | pass |
| G13 | axe clean on the history view **with every sheet open** | pass — 0 violations |
| G13 | axe clean on the options page with every sheet open | pass — 0 violations |

Opening every sheet before running axe matters: a closed `<details>` hides its content from the
scan, so the usual sweep would have skipped exactly the surfaces that were newly styled.

**Regression:** format/typecheck/lint clean, **73 unit**, **76 Chromium e2e**.
**Evidence:** `artifacts/screenshots/apple/sidepanel-history-{dark,light}.png`.
