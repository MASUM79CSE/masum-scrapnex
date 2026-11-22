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
