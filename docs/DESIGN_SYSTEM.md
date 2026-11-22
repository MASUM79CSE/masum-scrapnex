# Design system

An Apple-inspired visual language applied to MASUM SCRAPNEXS. This document is the reference for
changing the interface: what the tokens are, what the components do, and what the gates will reject.

- **Plan and gates:** `docs/DESIGN_APPLE_PLAN.md`
- **Phase-by-phase evidence:** `docs/DESIGN_APPLE_LOG.md`
- **Tokens:** `src/styles/tokens.css` (the only file allowed to contain colour literals)
- **Design layer:** the appended blocks at the end of `src/styles/base.css`, one per phase

## Honest scope

This is an Apple-*inspired* language, not an Apple product or a copy of one.

| Not used | What we do instead |
| --- | --- |
| SF Pro font files (not licensed for web bundling) | System stack: `-apple-system, "SF Pro Text", "Segoe UI", Roboto, Inter` — on macOS this *is* SF Pro |
| SF Symbols | Lucide, at a normalised 2 px stroke |
| Liquid Glass shaders | `backdrop-filter` + translucent fills, with an opaque fallback and an opt-out under `prefers-reduced-transparency` and `prefers-contrast: more` |
| A specific Apple app's layout | Our own structure and the MASUM SCRAPNEXS accent, with Apple's *principles* applied |

## Principles → rules

| Principle | Rule in this codebase |
| --- | --- |
| Clarity | Text first. Nothing below 11 px, body is 13 px, hierarchy comes from size and weight, not from boxes |
| Deference | Chrome recedes: one translucent toolbar, hairline separators, no shadows on panels that sit in the flow |
| Depth | One elevation per level: surface (no shadow) → card (`--shadow-1`) → sheet (`--shadow-2`) → crash card (`--shadow-3`) |
| Consistency | One control vocabulary: filled = primary, tinted outline = secondary, plain = tertiary, red = destructive and always confirmed |
| Forgiveness | Destructive actions confirm, all actions are reversible until committed, errors name the recovery |

## Tokens

### Type ramp (`--text-*`)

| Token | Size | Where |
| --- | --- | --- |
| `--text-large-title` | 28 px | Surface titles on wide screens |
| `--text-title-1` | 22 px | Section titles, popup title |
| `--text-title-2` | 17 px | Card titles, brand wordmark |
| `--text-headline` | 15 px | Panel headers, empty-state titles |
| `--text-body` | 13 px | Default and the floor for prose |
| `--text-callout` | 12.5 px | Dense secondary text |
| `--text-subhead` | 12 px | Column labels, meta |
| `--text-footnote` | 11 px | Hints, counts, footers |
| `--text-caption` | 11 px | Badges, tab labels |

Tabular figures (`font-variant-numeric: tabular-nums`) are mandatory in tables, prices and counts.

### Space (`--space-1..12`)

4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64. Control padding is 8×12, card 16, panel 20, surface 24.
Spacing literals in the design layer must land on the 2 px grid — a unit test enforces it.

### Radii

`--radius-xs` 6 (inputs, small buttons) · `--radius-sm` 8 (rows, list items) · `--radius-md` 10
(cards) · `--radius-lg` 14 (sheets, hero) · `--radius-pill` 999 (badges, tab bar).

### Colour roles

Named by role, never by hue: `label`, `labelSecondary`, `labelTertiary`, `labelQuaternary` (graphics
only — 3.4:1), `bgWindow`, `bgSidebar`, `bgChrome`, `bgSurface`, `bgSurfaceAlt`, `fillPrimary`,
`fillSecondary`, `fillTertiary`, `separator`, `separatorOpaque`, `controlBorder`, `tint`, `onTint`,
`tintWash`, `tintLine`, `destructive`, `onDestructive`, `destructiveWash`, `warning`,
`warningWash`, `success`, `info`, `focusRing`, plus `--materialChrome`, `--materialThick`,
`--materialBlur`.

Every role is defined four times: dark, light, `system` (with a nested light preference) and
`prefers-contrast: more`.

Contrast, measured from the tokens:

| Pair | Dark | Light |
| --- | --- | --- |
| `label` on `bgSurface` | 14.75:1 | 17.01:1 |
| `labelSecondary` on `bgSurface` | 8.51:1 | 7.40:1 |
| `labelTertiary` on `bgSurface` | 5.96:1 | 5.20:1 |
| `controlBorder` on `bgSurface` | 3.83:1 | 3.43:1 |
| `focusRing` on `bgSurface` | 11.36:1 | 5.82:1 |
| `onTint` on `tint` | 10.15:1 | 5.82:1 |

### Motion

`--duration-micro` 120 ms · `--duration-standard` 200 ms · `--duration-enter` 240 ms ·
`--duration-exit` 140 ms · `--duration-spring` 320 ms. Nothing may exceed 320 ms, and keyframes may
animate only `transform` and `opacity`. `prefers-reduced-motion` collapses everything to ≤ 2 ms.

## Components

| Component | Class | Rules |
| --- | --- | --- |
| Primary action | `.button.button--primary` | Filled tint, 38 px tall, semibold, press-scale 0.985 |
| Secondary | `.button.button--outline` | Transparent + hairline, fills on hover |
| Destructive | `.button--destructive` | Solid red **and** a confirmation |
| Tab bar (compact) | `.nav-link` | Icon over short label, 44 px, 5 equal columns, never wraps |
| Sidebar row | `.nav-link` | 32 px, tinted selection, truncating label |
| Text field | `input`/`select`/`textarea` | Filled surface, 3:1 border, tint on focus |
| Search | `.search-box` | Pill; the wrapper owns the focus ring |
| Checkbox row | `.row-check`, `.export-check` | 16 px control inside a 32 px label target |
| Badge | `.count-tag`, `.stock-tag`, `.match-tag` | Caption pill; roles carry the colour |
| Sheet | `details.export-panel` | 40 px summary, Escape closes, focus returns |
| Table | `.table-scroll`, `.dataset-grid` | 34 px rows, sticky opaque header, hairline separators |
| Toast | `.library-feedback` | Tint edge, 240 ms entrance, in flow |
| Empty state | `.empty-state` | Tinted glyph, 15 px title, one sentence |

## Do / don't

**Do**

- Reach for a token. If a value is missing, add the token — do not inline the value.
- Keep the primary action filled and there is only ever one per view.
- Use hairlines to group; use fill to select; reserve tint for state and the primary action.
- Test the layout at 320 px and with 200 % zoom before calling a change done.
- Read the gates: they encode the review.

**Don't**

- Add a colour literal anywhere except `tokens.css` — the gate fails.
- Put text below 11 px, or use `--labelQuaternary` for text.
- Add a second shadow to a panel already in the flow.
- Animate `width`, `height`, `top` or `left`.
- Remove an outline without replacing it.
- Bundle Apple assets, or claim this is an Apple product.

## Gates

| Gate | What it checks | Where |
| --- | --- | --- |
| G1–G2 | Text ≥ 4.5:1, borders and graphics ≥ 3:1 | `tests/unit/design-tokens.test.ts` |
| G3 | Focus never removed without a replacement | same |
| G4 | No colour literals outside the token file | same |
| G5 | Every role defined in dark, light, system, increased contrast | same |
| G6 | No text under 11 px, body at 13 px (font-size **and** the `font` shorthand) | same |
| G7 | Hit targets: 30 px controls, 38 px primary | `tests/e2e/design.spec.ts`, `design-data.spec.ts` |
| G8 | Icon-only controls have accessible names | `tests/e2e/design.spec.ts` |
| G9 | Keyboard operation, visible focus, Escape dismisses | `design.spec.ts`, `design-flows.spec.ts` |
| G10 | No horizontal scroll at 320 px, no clipping at 200 % zoom | `tests/e2e/shell.spec.ts` |
| G11 | Reduced motion collapses transitions and animations | `design.spec.ts`, `design-flows.spec.ts` |
| G12 | Increased contrast disables translucency | `tests/e2e/design.spec.ts` |
| G13 | axe reports zero WCAG 2.1 AA violations on every surface and state | `design.spec.ts`, `design-data.spec.ts`, `design-flows.spec.ts` |
| G14 | Layout shift < 0.1 | `tests/e2e/design.spec.ts` |
| G15 | Committed layout baselines, 4 surfaces × 2 themes | `tests/e2e/design-layout.spec.ts` |
| Motion | Durations ≤ 320 ms, only transform/opacity, 2 px spacing grid, one icon stroke | `tests/unit/design-motion.test.ts` |

**G15 note.** The plan asked for pixel snapshots. The gate compares *landmark geometry* instead
(heights, widths, type sizes, radii, overflow) with a 2 px tolerance, because pixel diffs vary with
the host's GPU, font stack and subpixel rounding — a baseline that fails for reasons the change did
not cause trains people to ignore it.

Re-baseline deliberately and review the diff:

```sh
UPDATE_BASELINES=1 npx playwright test tests/e2e/design-layout.spec.ts
git diff tests/e2e/baselines/design-layout.json
```

## Adding a component

1. Use existing tokens; add new tokens to all four appearance blocks if you must.
2. Put the rule in the current phase block of `base.css`, never inline.
3. Add the states: default, hover, active, focus-visible, disabled, and selected/destructive where
   relevant.
4. Add a gate if the component can regress silently (size, name, contrast, motion).
5. Capture it: `node tools/capture-ui.mjs` writes to `artifacts/screenshots/apple/`.
