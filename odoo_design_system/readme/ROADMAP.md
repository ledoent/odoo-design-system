Releases:

- **19.0.3.0.0** (current) — Phase 0 of `docs/penpot/PHASED_BUILDOUT.md`
  ships. DTCG JSON now uses Tokens Studio multi-set shape (`global` +
  `theme-light` + `theme-dark` + `theme-high-contrast` + `$themes` +
  `$metadata`). New token groups: spacing, typography
  (family/size/weight/line-height), radius scale, motion (duration +
  easing), elevation, expanded neutral scale, semantic surface / text /
  border / state colors per theme. Generated SCSS emits `:root` + per-
  theme `[data-theme="..."]` blocks. Showcase route gets a 3-button
  theme switcher that toggles `document.documentElement.dataset.theme`,
  re-skinning every `--ods-*` consumer. Total tokens: 59 → 181.
- **19.0.2.0.0** — Penpot becomes the canonical design source.
  All twelve pages of the
  [Ledo Odoo Design System](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553)
  file are populated (cover, foundations, iconography, components shared,
  18.0 + 19.0 deltas, patterns, backend templates, portal templates).
  Round-trip CI gate keeps Penpot and the committed JSON in lockstep.
  **Pages currently hold raster screenshots only — vectorization work is
  tracked in [`docs/penpot/PHASED_BUILDOUT.md`](../../docs/penpot/PHASED_BUILDOUT.md)**
  (12 phases, one PR each, with Chrome DevTools verification per phase).
- **19.0.1.0.0** — Initial release. Three OWL components (`OdsChip`,
  `OdsInitialsAvatar`, `OdsCardTile`) + Sass mixin family
  (`ods-extension-vars`, `ods-initial-vars`, `ods-card-chrome`) + backend
  showcase menu. Later patched: `OdsIcon` + Lucide / Heroicons vendoring,
  style-dictionary integration, DMS case study + Penpot bootstrap.

Likely next steps:

- `<OcaDropzone>` — the marching-dashed file-drop overlay, currently
  inlined in `dms`. Lift to a shared component.
- `<OcaSearchpanel>` styling helper — monospaced section headers +
  tabular counters; currently a per-module SCSS block.
- Dark-mode token pass — verify `color-mix(...)` falls back gracefully
  on browsers without CSS Color Module 5 support.
- An `OcaTokens` JS export so OWL code can read the shared bucket
  palette without re-declaring the colors.
- Cookbook-style examples in the showcase: "kanban card", "portal grid
  card", "form-view hero block" — full layouts rather than just
  components.
- Translation (`.pot`) once strings stabilise.
- ~~**DTCG → SCSS generator.**~~ Shipped: `style-dictionary` wired up
  via `pnpm run tokens`. The JSON is now the single source of truth;
  `_tokens.generated.scss` and `dist/brand_variables.scss` regenerate
  from it. `pnpm run tokens:check` is the CI gate against drift.
- **Tokenized brand logo.** Move `ledoweb_branding/static/src/img/logo.svg`
  into a per-tenant override that uses `currentColor` (or
  `var(--o-color-primary)`) for the fill, so changing
  `color.brand.primary` in DTCG recolors the logo without re-exporting
  raster assets.
