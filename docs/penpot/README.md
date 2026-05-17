# Penpot — designer onboarding

The single Penpot file at
[`Ledo Odoo Design System`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553)
is the source of truth for every visual decision the
[`odoo_design_system`](../../) Odoo addon ships. Designers edit here;
engineers regenerate SCSS from the exported DTCG JSON.

## What's in the file

Twelve pages, in order:

| # | Page | What lives there |
| --- | --- | --- |
| 00 | Cover | One-page brand card + version axis |
| 01 | Foundations / Tokens | Full swatch grid — brand, portal, bucket, extension, sizing |
| 02 | Iconography | Lucide + Heroicons (solid / outline / mini) samplers |
| 03 | Components (shared) | OdsChip, OdsInitialsAvatar, OdsCardTile, OdsIcon — all variants |
| 04 | Components / 18.0 deltas | Where the 18.0 backport differs from 19.0 |
| 05 | Components / 19.0 deltas | Current release notes against the primitives |
| 06 | Patterns | Spined card, chip row, form hero — composed primitives |
| 07 | Templates / Backend views | Kanban grid, list view, searchpanel, drop-zone |
| 08 | Templates / Portal & Website | Portal grid, empty state, mobile portrait |
| 09 | PR Drafts | Scratch space for in-flight design proposals |
| 10 | Playground | Free-form experiment area |
| 11 | Changelog | Page-level audit log |

The DMS case-study lives in a sibling file: [`DMS — Migration & Modernization`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=290ad95c-cfaf-819b-8008-07b812589ea5).

## Editing tokens

Tokens are imported as four Penpot design-tokens sets, in this order:
`global`, `theme-light`, `theme-dark`, `theme-high-contrast`. The `global`
set carries all theme-invariant tokens (spacing, typography, radius, motion,
brand colors, neutral scale, the bucket + extension palettes). The three
`theme-*` sets override only colors + elevation. Open **TOKENS** (left
sidebar, third tab); the `$themes` dropdown lets you preview a theme
without committing.

When you change a token:

1. The CI workflow [`penpot-token-sync.yml`](../../.github/workflows/penpot-token-sync.yml)
   detects the divergence between Penpot and the committed JSON.
2. Either: open a PR that runs `node scripts/penpot-export-tokens.mjs odoo_design_system/static/src/tokens/design-system.dtcg.json`
   and commits the regenerated JSON. The pre-existing `pnpm run tokens` then
   regenerates the `_tokens.generated.scss` Odoo consumes (it carries a `:root`
   + light block plus `[data-theme="dark"]` and `[data-theme="high-contrast"]`
   override blocks; switching themes is a single `document.documentElement.dataset.theme = "<name>"` call).
3. Or: undo the change in Penpot to keep the existing release.

### Bulk-importing the JSON (one-time / major reshape)

For a structural change (new groups, mass rename) the simplest path is
Penpot's built-in import:

1. In the file, open the **TOKENS** panel.
2. Click the kebab menu next to **SETS** → **Import JSON**.
3. Drag `odoo_design_system/static/src/tokens/design-system.dtcg.json` into
   the dialog and confirm.

Penpot replaces every named set in one transaction. After it lands,
re-run `node scripts/penpot-export-tokens.mjs odoo_design_system/static/src/tokens/design-system.dtcg.json`
to canonicalize whitespace + key order, then `pnpm run tokens` for the
generated SCSS. Single PR, single commit.

## Editing components

Use the OWL source at `odoo_design_system/static/src/components/` as the
ground truth for prop names and variants. The Penpot component on page 03 is
the design mock; the code is the implementation. Both should agree.

If you add a new variant in Penpot:

1. Mock it on page 03 next to the others.
2. Drop a note on page 09 (PR Drafts) describing the prop change.
3. An engineer wires the OWL code; merging that PR closes the loop.

## Connecting from your machine

The service account `hello@ledoweb.com` owns the file. Both UI login and
REST API access use the credentials in `/.env` (gitignored). Memory file
`memory/penpot_design_credentials.md` documents IDs and the exact API usage.

```bash
PENPOT_TOKEN=$(grep '^PENPOT_TOKEN=' .env | head -1 | cut -d= -f2-)
PENPOT_FILE_ID=038df003-0f49-80b2-8008-0774e5399553

# Pull the live tokens into a JSON file you can diff:
node scripts/penpot-export-tokens.mjs /tmp/penpot.json
diff odoo_design_system/static/src/tokens/design-system.dtcg.json /tmp/penpot.json
```

## When the live file and the repo drift

`scripts/penpot-export-tokens.mjs` always wins — Penpot is the source of truth.
Run it after every design change, regenerate SCSS via `pnpm run tokens`, and
commit both files in a single PR titled `feat(tokens): <description>`.
