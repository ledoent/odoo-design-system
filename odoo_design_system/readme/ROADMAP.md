Initial release (19.0.1.0.0) intentionally ships a small surface:

- Three OWL components (`OdsChip`, `OdsInitialsAvatar`, `OdsCardTile`)
- One Sass mixin family (`ods-extension-vars`, `ods-initial-vars`, `ods-card-chrome`)
- One backend showcase menu

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
- **DTCG → SCSS generator.** `static/src/tokens/design-system.dtcg.json`
  ships alongside `_tokens.scss` today, but the SCSS is hand-mirrored.
  Wire up `style-dictionary` (or a small Python script) so the SCSS
  partial regenerates from the DTCG JSON at build time. Then designers
  edit tokens in Penpot, export DTCG, commit it, and the SCSS follows
  automatically.
- **Tokenized brand logo.** Move `ledoweb_branding/static/src/img/logo.svg`
  into a per-tenant override that uses `currentColor` (or
  `var(--o-color-primary)`) for the fill, so changing
  `color.brand.primary` in DTCG recolors the logo without re-exporting
  raster assets.
