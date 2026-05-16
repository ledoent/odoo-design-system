Initial release (19.0.1.0.0) intentionally ships a small surface:

- Three OWL components (`OcaChip`, `OcaInitialsAvatar`, `OcaCardTile`)
- One Sass mixin family (`oca-extension-vars`, `oca-initial-vars`, `oca-card-chrome`)
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
