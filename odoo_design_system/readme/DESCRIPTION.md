A small, opt-in design system for Odoo 19 OCA UI work.

Its job is to keep new OCA features visually coherent with each other and
with Odoo core, without re-implementing the same chip / avatar / card-tile
patterns in every module.

It ships:

- A single SCSS partial — `static/src/scss/_tokens.scss` — that declares
  one accent variable (`--ods-accent`), eight hashing-friendly bucket
  colors, a per-file-extension palette, and the mixins that emit the
  `data-*` keyed selectors. Every value falls back to an Odoo 19
  `$o-*` token, so the system inherits any host project theming.
- Three OWL components — `OdsChip`, `OdsInitialsAvatar`, `OdsCardTile` —
  that wrap the most reused micro-patterns (label pill, hashed
  initials circle, accent thumbnail tile).
- A "Design System" backend menu rendering every component live with
  the code that produced it side-by-side, so a contributor can pick a
  component, copy the snippet, and reuse it consistently.

It does NOT replace Odoo's primary variables. It adds a thin OCA-side
layer on top of them, similar in spirit to how `theme_*` modules
layer on top of the frontend defaults.
