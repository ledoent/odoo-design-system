# odoo-design-system

Shared OWL components + CSS tokens for OCA UI consistency on Odoo 18 and 19.

Single Odoo addon: `odoo_design_system`. Single canonical Penpot file
at [design.hz.ledoweb.com](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553)
("Ledo Odoo Design System") is the source of truth.

## Where things live

| Surface | Where |
| --- | --- |
| Tokens (source of truth) | Penpot **TOKENS** panel — sets `global` + `theme-light` / `theme-dark` / `theme-high-contrast` |
| Tokens (committed) | [`odoo_design_system/static/src/tokens/design-system.dtcg.json`](odoo_design_system/static/src/tokens/design-system.dtcg.json) |
| Generated SCSS | `odoo_design_system/static/src/scss/_tokens.generated.scss` (`pnpm run tokens`) |
| OWL components | [`odoo_design_system/static/src/components/`](odoo_design_system/static/src/components/) |
| Penpot designer guide | [`docs/penpot/README.md`](docs/penpot/README.md) |
| Multi-week buildout plan | [`docs/penpot/PHASED_BUILDOUT.md`](docs/penpot/PHASED_BUILDOUT.md) |
| DMS case study | [`docs/case-studies/dms/`](docs/case-studies/dms/) + sibling Penpot file |
| Asset Management case study | [`docs/case-studies/account-asset-management/`](docs/case-studies/account-asset-management/) |

## What's inside

- **Tokens** — DTCG JSON in Tokens-Studio multi-set shape. 181 tokens
  across four sets: `global` (theme-invariant — spacing, typography,
  radius, motion, brand color, neutral scale, bucket + extension palettes)
  and `theme-light` / `theme-dark` / `theme-high-contrast` (color +
  elevation only). style-dictionary regenerates `_tokens.generated.scss`
  + `dist/brand_variables.scss` on demand. Hand-written Sass mixins live
  in `_tokens.scss`.
- **Theme machinery** — every theme-switchable token (surface, text,
  border, state, elevation) is emitted under `[data-theme="<name>"]`
  selectors. Toggle in one line:

  ```js
  document.documentElement.dataset.theme = "dark"; // or "light", "high-contrast"
  ```

- **OWL components**
  - `<OdsChip variant="neutral|ext|size|count|warning|success" label="…"/>`
  - `<OdsInitialsAvatar name="…"/>`
  - `<OdsCardTile accent="ext|initial|preview" …/>`
  - `<OdsIcon set="lucide|heroicons|heroicons-solid|heroicons-mini" name="…"/>`
- **Showcase** — backend menu rendering every component live with the
  source snippet next to it. Open it via the **Design System → Components**
  menu after install. Now includes a 3-button theme switcher at the
  top — visually verify dark / high-contrast before merging a token change.
- **CI gates** —
  - [`test.yml`](.github/workflows/test.yml) — `pnpm run tokens:check`
    (regenerates SCSS, fails on drift) + `pnpm run test` (token + SCSS
    contract assertions).
  - [`penpot-token-sync.yml`](.github/workflows/penpot-token-sync.yml) —
    nightly + on-PR diff between live Penpot and the committed JSON.

## Versions

- **19.0** — primary release. Manifest version `19.0.3.0.0`. Tested on
  doodba odoo-19 smoke environments. Currently shipping.
- **18.0** — backport. Deferred until 19.0 is sealed. The Penpot file
  documents both versions (pages `04 — Components / 18.0 deltas` and
  `05 — Components / 19.0 deltas`) so the design lead is unified even
  while the addon's installable code ships in one branch first.

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

## Showcase preview

Open **Design System → Components** after install for the live page.
Captured from a local doodba odoo-19 smoke test:

![Tokens + bucket palette](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/screenshots/ods-showcase-viewport.png)
![Chips, initials, card tiles](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/screenshots/ods-showcase-chips.png)
![Heroicons + heroicons-solid + card chrome](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/screenshots/ods-showcase-icons.png)

## Working in Penpot

The full designer workflow — how to edit a token, propose a new component
variant, and let the round-trip CI close the loop — is documented in
[`docs/penpot/README.md`](docs/penpot/README.md).

## License

LGPL-3
