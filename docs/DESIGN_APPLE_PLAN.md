# Apple design language migration — zero-tolerance plan

**Scope:** every surface of MASUM SCRAPNEXS (popup, side panel, options, dialogs, data grid)
**Target:** Apple Human Interface Guidelines — clarity, deference, depth, system typography,
translucent materials, purposeful motion
**Enforcement:** automated gates, not review opinions. A phase is not done until its gates are green.

**Status (2026-11-22):** phases A–G complete; every gate below is enforced by a test in the
repository. Evidence per phase is recorded in `docs/DESIGN_APPLE_LOG.md`; the token and
component reference is `docs/DESIGN_SYSTEM.md`.

---

## 1. What "Apple design" means concretely here

Apple's guidance is a small number of principles applied with discipline. This plan translates each
into a rule a machine can check.

| HIG principle | Translation for this product |
| --- | --- |
| **Clarity** | Text first: legible sizes, honest hierarchy, no decorative noise. Density comes from spacing, not from shrinking type below 11 px |
| **Deference** | Chrome recedes. Content (data, previews) is the brightest thing on screen; toolbars use materials, not heavy borders |
| **Depth** | Layering communicates hierarchy: translucent toolbars over content, sheets above panels, one elevation per level — never two shadows doing the same job |
| **System typography** | The system font stack (`-apple-system`, `SF Pro Text`, `SF Pro Display`) so the app feels native on Apple hardware, with Inter retained as the cross-platform fallback |
| **Consistency** | One control vocabulary: filled for the primary action, tinted for secondary, plain for tertiary, destructive always red and always confirmed |
| **Forgiveness** | Destructive actions confirm, all actions are reversible until committed, errors explain recovery |

### Honest constraint

Apple's **SF Pro** is not licensed for web bundling, and the **Liquid Glass** material is not
reproducible in CSS beyond an approximation. This project therefore:

- uses the **system font stack** — on macOS/iOS this *is* SF Pro; elsewhere it resolves to
  Segoe UI / Roboto / Inter;
- implements materials as `backdrop-filter` + translucent fills with a solid fallback, and says so;
- never claims to be an Apple product or to use Apple assets. Icons stay Lucide (SF-Symbols-shaped,
  not SF Symbols).

---

## 2. Design tokens (single source of truth)

All values live in `src/styles/tokens.css`. Components may consume only tokens — never literals.

### 2.1 Typography ramp (macOS scale, 4 px grid)

| Role | Size / line | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `largeTitle` | 28 / 34 | 700 | −0.02em | Surface titles (side panel header) |
| `title1` | 22 / 28 | 600 | −0.01em | Section titles |
| `title2` | 17 / 22 | 600 | −0.01em | Card titles |
| `headline` | 15 / 20 | 600 | 0 | Panel headers, row titles |
| `body` | 13 / 19 | 400 | 0 | Default text |
| `callout` | 12.5 / 18 | 400 | 0 | Dense secondary text |
| `subhead` | 12 / 16 | 500 | 0.01em | Labels, column headers |
| `footnote` | 11 / 15 | 400 | 0.01em | Metadata, hints |
| `caption` | 11 / 14 | 500 | 0.02em | Tags, badges |
| `mono` | 12 / 17 | 400 | 0 | Cell values, diagnostics |

Floor: **no text below 11 px. Body is 13 px.** Numerals use `font-variant-numeric: tabular-nums`
in tables and prices.

### 2.2 Spacing (4 pt grid)

`--space-1..12` = 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64.
Component padding defaults: control 8×12, card 16, panel 20, surface 24.

### 2.3 Radii

`--radius-xs` 6 (inputs, small buttons) · `--radius-sm` 8 (rows) · `--radius-md` 10 (cards) ·
`--radius-lg` 14 (sheets, dialogs) · `--radius-xl` 20 (hero) · `--radius-pill` 999.

### 2.4 Semantic color roles

Named as Apple does — by *role*, not hue. Each role is defined for **dark**, **light**, and
**system**, and again for `prefers-contrast: more`.

`label`, `labelSecondary`, `labelTertiary`, `labelQuaternary`,
`bgWindow` (grouped background), `bgSurface` (elevated card), `bgSurfaceAlt`,
`fillPrimary` (control fill), `fillSecondary`, `fillTertiary`,
`separator` (hairline), `separatorOpaque`,
`tint` (system accent — a green aligned with the brand), `onTint`,
`destructive`, `onDestructive`, `warning`, `success`, `info`,
`materialRegular`, `materialThick`, `materialChrome`,
`focusRing`, `overlayScrim`.

Appearance policy: **never pure black or pure white** for large areas. Dark uses
`#1c1c1e`-family greys; light uses `#f2f2f7`-family greys. Colour is reserved for meaning
(tint, destructive, warning) and never used decoratively.

### 2.5 Elevation

| Level | Use | Shape |
| --- | --- | --- |
| 0 | Flush content | no border, grouped background |
| 1 | Cards, list groups | hairline separator + `--shadow-1` (0 1px 2px / 4 % + 0 4px 12px / 6 %) |
| 2 | Popovers, sticky toolbars | `--shadow-2` (0 4px 16px / 8 % + 0 12px 32px / 10 %) |
| 3 | Sheets, dialogs | `--shadow-3` (0 12px 40px / 14 % + 0 32px 80px / 18 %) + scrim |

### 2.6 Materials

`--material-chrome`: `backdrop-filter: saturate(180%) blur(20px)` + 72 % translucent fill.
Fallback when `backdrop-filter` is unsupported: opaque `bgSurface` (no visual debt).
`prefers-contrast: more` and `prefers-reduced-transparency: reduce` force the opaque fallback.

### 2.7 Motion

| Token | Duration | Curve | Use |
| --- | --- | --- | --- |
| `--ease-standard` | 200 ms | `cubic-bezier(0.32, 0.72, 0, 1)` | Most transitions |
| `--ease-enter` | 240 ms | `cubic-bezier(0.22, 1, 0.36, 1)` | Sheets, dialogs in |
| `--ease-exit` | 140 ms | `cubic-bezier(0.4, 0, 1, 1)` | Dismissals |
| `--ease-spring` | 320 ms | `cubic-bezier(0.34, 1.3, 0.64, 1)` | Selection, toggle thumb |

Rules: animate **transform and opacity only**; never animate layout properties; nothing exceeds
320 ms; no decorative infinite loops; every animation has a `prefers-reduced-motion` branch that
collapses to ≤100 ms opacity or zero.

### 2.8 Control metrics (click targets)

| Class | Visual | Hit area |
| --- | --- | --- |
| Primary / destructive action | 32–36 px tall | **≥ 44 × 44** |
| Standard secondary | 28–32 px tall | ≥ 40 × 40 |
| Dense toolbar / icon button | 28 px | ≥ 32 × 32 (never < 32, spaced ≥ 8 px) |
| List row | 40–44 px | full row |
| Grid cell | 34 px | full cell |

---

## 3. Zero-tolerance gates

Each gate is enforced by a test or script in the repository. **Any failure blocks the phase.**

| # | Gate | Enforcement |
| --- | --- | --- |
| G1 | Text contrast ≥ 4.5:1 (≥ 3:1 for ≥ 18.66 px bold / 24 px regular) | `tests/unit/design-tokens.test.ts` computes WCAG ratios from token pairs |
| G2 | UI/border/control contrast ≥ 3:1 against its background | same test, separator/control pairs |
| G3 | Focus indicator ≥ 3:1 against adjacent colours and never removed | token test + `outline: none` scan |
| G4 | Every colour in `src/**` comes from a token | literal scanner over CSS/TSX |
| G5 | Every token defined in dark, light, system, and `prefers-contrast: more` | parity test |
| G6 | No text < 11 px; body = 13 px | style scan |
| G7 | Every interactive element ≥ 32 px hit area; primary ≥ 44 px | Playwright geometry assertions |
| G8 | Every icon-only control has an accessible name | axe + name assertions |
| G9 | Full keyboard operation, visible focus, Esc closes overlays | Playwright keyboard suite |
| G10 | No horizontal scroll at 320 px; no clipping at 200 % zoom | Playwright viewport suite |
| G11 | `prefers-reduced-motion` removes all transform animation | Playwright media emulation + computed style check |
| G12 | `prefers-contrast: more` disables translucency and raises separator contrast | computed-style check |
| G13 | Zero axe violations (WCAG 2.1 AA rules) on every surface | axe in Playwright for popup, panel, options |
| G14 | No layout shift > 0.1 on first paint of each surface | PerformanceObserver in Playwright |
| G15 | Screenshot baseline for 6 surface × theme combos; diffs require explicit re-baseline | Playwright snapshots, committed |

---

## 4. Phases

Each phase ends with gates green, evidence recorded in `docs/DESIGN_APPLE_LOG.md`, and a visual
capture in `artifacts/screenshots/apple/`.

### Phase A — Foundations
Tokens (type, spacing, radii, colour roles, elevation, materials, motion), global resets,
system font stack, focus ring, tabular numerals, reduced-motion and increased-contrast branches.
Legacy variable names aliased to new tokens so nothing breaks while surfaces migrate.
**Gates:** G1–G6. **Exit:** every token parity-checked; contrast table printed as evidence.

### Phase B — Core controls
Buttons (filled / tinted / plain / destructive), icon buttons, text fields, switches,
segmented control, select, badge, alert (info/warning/error), progress, disclosure row, tooltip.
Every control gets: default, hover, active, focus-visible, disabled, and where relevant selected
and destructive states — all token-driven.
**Gates:** G1–G9, G13. **Exit:** a control gallery route renders every state for review.

### Phase C — Shell and navigation
Popup (compact, 320 px), side panel (header, sidebar navigation, scroll regions, sticky toolbars),
options page (grouped settings), material chrome with opaque fallback.
**Gates:** G10–G13. **Exit:** three surfaces captured in both appearances.

### Phase D — Data surfaces (the actual product)
Candidate cards, preview table, virtualised dataset grid (hairline separators, sticky header,
right-aligned numerics, tabular figures, row selection affordance, inline cell editing),
column manager, filters and search, empty and loading states.
**Gates:** G7, G9, G13, G14. **Exit:** grid at 100/1 000/10 000 rows remains ≥ 50 fps and within budget.

### Phase E — Flows and overlays
Save/export/history/configuration sheets, pagination run controls, destructive confirmations,
toasts, queue panel, diagnostics drawer, crash card.
**Gates:** G9, G11, G13. **Exit:** every flow keyboard-completable, Esc-dismissable, reversible.

### Phase F — Motion and polish
Panel and sheet transitions, selection springs, progress presence, reduced-motion parity,
icon stroke normalisation, spacing rhythm audit.
**Gates:** G11 + motion budget scan (no animation > 320 ms, transform/opacity only).

### Phase G — Verification and documentation
Full gate run, axe sweep, keyboard-only recording, 200 % zoom and 320 px captures,
`docs/DESIGN_SYSTEM.md` (tokens, components, do/don't), release note in `CHANGELOG.md`.

---

## 5. Non-goals

- Recreating Apple's proprietary assets (SF Pro files, SF Symbols glyphs, Liquid Glass shaders).
- Copying a specific Apple app's layout. This is an Apple-*inspired* language applied to a
  data-extraction tool, with its own identity and the existing MASUM SCRAPNEXS accent colour.
- Touch-first gesture design; this is a desktop extension with a narrow side panel.

---

## 6. Risk register

| Risk | Mitigation |
| --- | --- |
| Contrast fails once translucent materials sit on unknown page content | Materials only ever sit over our own backgrounds; text on chrome uses opaque-token colours, verified against the worst case |
| Density loss makes a data grid feel slow | Apple density is spacing-led: 13 px body, 34 px rows, hairline separators — measured against the current grid at 10 k rows |
| `backdrop-filter` cost in a narrow panel | Applied only to two fixed regions; measured in Phase D, disabled under reduced-transparency |
| Font differences across OSes shift layout | Fixed type scale and spacing; snapshots taken on Linux CI, fonts resolved through the stack, no layout depends on glyph width |
| Test churn from class renames | Class names are frozen; the design layer is additive CSS plus token remapping |

---

## 7. Immediate execution order

1. **Phase A now** — tokens + audits (G1–G6) with a printed contrast matrix.
2. Phase B, then C, then D, E, F, G in order, each with its gates.
3. Stop after G with a full verification report for your approval.
