# Penpot — designer onboarding

The single Penpot file at
[`Ledo Odoo Design System`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553)
is the source of truth for every visual decision the
[`odoo_design_system`](../../) Odoo addon ships. Designers edit here;
engineers regenerate SCSS from the exported DTCG JSON.

## What's in the file

Twelve pages, in order. Page contract is enforced by
[`tests/pages.test.mjs`](../../tests/pages.test.mjs) against the live
file (skipped in CI when `PENPOT_TOKEN` is unset). The source of truth
is [`docs/penpot/specs/pages.json`](specs/pages.json) — keep it and
this table in lockstep.

| # | Page | What lives there |
| --- | --- | --- |
| 00 | Cover | Project intent + version axis matrix |
| 01 | Foundations | Vector specimens for every token group (Phase 2) |
| 02 | Iconography | Lucide + Heroicons samplers; OdsIcon spec (Phase 3) |
| 03 | Shared Components | OdsChip, OdsInitialsAvatar, OdsCardTile, OdsIcon as Penpot library components (Phase 3) |
| 04 | 18.0 Deltas | Differences when the design system runs on Odoo 18.0 |
| 05 | 19.0 Deltas | Release notes specific to Odoo 19.0 |
| 06 | Patterns | Composed primitives — spined card, chip row, form hero (Phase 4+) |
| 07 | Backend Templates | Kanban, list, form, searchpanel, drop-zone (Phase 4–6) |
| 08 | Portal Templates | Portal grid, empty state, mobile portrait, breadcrumb (Phase 8) |
| 09 | Reports | Printable A4 templates — invoice, quotation, delivery slip (Phase 9) |
| 10 | Drafts | Scratch space for in-flight design proposals |
| 11 | Changelog | Page-level audit log of design-system releases |

Every page background is bound (via Penpot `appliedTokens.fill`) to
the design token `color.surface.canvas`. Toggling the active theme set
in the **TOKENS → THEMES → EDIT** dialog re-skins all 12 pages in one
click. The PCS shape for that binding lives in
[`docs/penpot/specs/token-fill.json`](specs/token-fill.json).

The DMS case-study lives in a sibling file: [`DMS — Migration & Modernization`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=290ad95c-cfaf-819b-8008-07b812589ea5).
Stock-19.0 screenshot captures (PR #6) live in a third sibling: [`Odoo 19.0 — Stock Reference Screenshots`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=ab1caf40-8849-808b-8008-096a0fe717bb)
— pulled out of the canonical file during Phase 1 so the design source
stays raster-free.

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

The file's **Assets** panel (left sidebar, second tab) hosts four
library components, one per OWL atom, promoted from the
**03 — Shared Components** page:

| Library component | OWL source | Variant axes (Phase 3a sampler) |
| --- | --- | --- |
| `OdsIcon` | [`icon/icon.esm.js`](../../odoo_design_system/static/src/components/icon/icon.esm.js) | 4 sets × 12 sampler icons |
| `OdsChip` | [`chip/chip.esm.js`](../../odoo_design_system/static/src/components/chip/chip.esm.js) | 6 variants × {withIcon, no-icon} |
| `OdsInitialsAvatar` | [`initials_avatar/initials_avatar.esm.js`](../../odoo_design_system/static/src/components/initials_avatar/initials_avatar.esm.js) | 8 buckets (one row) |
| `OdsCardTile` | [`card_tile/card_tile.esm.js`](../../odoo_design_system/static/src/components/card_tile/card_tile.esm.js) | 3 accents (`ext` / `initial` / `preview`) |

Drag any of them onto any page and they appear as an instance. The
OWL source is still the ground truth for prop names + behavior; the
Penpot library component is the design mock you instantiate.

**Phase 3a deferred work** (tracked for a Phase 3b PR):

- Per-component variant picker in Penpot's Design panel (variant
  containers grouping every matrix cell under one library entry).
- Real SVG glyphs for `OdsIcon` (currently named-rect placeholders;
  designers see icon names per set, not the glyphs).
- `OdsChip` warning / success bound to the new `color.state.*`
  tokens added in Phase 0.

**Proposing a new variant**:

1. Open the OWL source for the atom you want to extend.
2. Add the new prop / variant in code.
3. Run `pnpm run penpot:snapshot && node scripts/penpot-build-phase-3-components.mjs`
   to regenerate the sampler on Page 03 + refresh the library component.
4. Open a PR titled `feat(<atom>): add <new-variant> variant`.

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
