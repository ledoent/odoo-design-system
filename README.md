# odoo-design-system

Shared OWL components + CSS tokens for OCA UI consistency on Odoo 19.

Single Odoo addon: `odoo_design_system`.

## What's inside

- **Tokens** — `static/src/scss/_tokens.scss` declares one accent
  variable (`--ods-accent`), eight bucket colors, a per-extension
  palette, and the Sass mixins that emit data-attribute-keyed
  selectors. Every fallback maps to an Odoo 19 `$o-*` token.
- **OWL components**
  - `<OdsChip variant="ext|size|count|warning|success" label="…"/>`
  - `<OdsInitialsAvatar name="…"/>`
  - `<OdsCardTile accent="ext|initial|preview" …/>`
- **Showcase** — backend menu rendering every component live with the
  source snippet next to it. Open it via the **Design System → Components**
  menu after install.

## Why

OCA UI work tends to re-implement the same micro-patterns (label
pills, hashed-tint avatars, accent-coloured kanban tiles) in every
module. This addon is the shared substrate so the next OCA module
doesn't have to.

Seeded from work in [`OCA/dms#475` / `ledoent/dms#1`](https://github.com/ledoent/dms/pull/1)
— the dms module's `_dms_tokens.scss` and `.o_dms_chip` family were
generalized into the `--ods-*` variables and `<OdsChip>` component here.

## Install

```bash
# In your doodba project or directly into addons/
cd custom/src
git clone git@github.com:ledoent/odoo-design-system.git
```

Then add `odoo_design_system` to `addons.yaml` and depend on it from
any module that wants the tokens or components.

## License

LGPL-3
