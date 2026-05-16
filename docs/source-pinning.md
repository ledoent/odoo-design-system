# Source pinning — Odoo 19.0 reference

The Penpot file **Odoo 19.0 Design System** (`design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553`) is documentation, not invention. Every artifact in it traces back to a specific source in `odoo/odoo:19.0` or a specific OCA module on a pinned commit.

## What lives where

| Penpot page | Origin |
| --- | --- |
| 00 — Overview | Hand-written reading map; no upstream source |
| 01 — Tokens / Colors | `tokens/odoo-19.dtcg.json` (regenerated from `addons/web/static/src/scss/primary_variables.scss` via `scripts/scss-to-dtcg.py`) |
| 02 — Tokens / Dimensions | Same source, dimension category |
| 03 — Tokens / Typography | Same source, font-weight + line-height + font-stack categories |
| 04 — Apps grid (stock 19.0) | Screenshot of `localhost:8169/odoo/apps` against the `odoo_19_review` demo DB; produced by `scripts/capture-stock-surfaces.sh` and uploaded to `gs://ledo-pr-assets/odoo-design-system/stock-19.0/apps-grid.png` |
| 0X — \<other surfaces\> | Screenshots produced by the same script; see the surface map at the bottom of `scripts/capture-stock-surfaces.sh` |
| 1X — OCA web_responsive overlay | Pin TBD — see "OCA overlay" below |

## Pinning the Odoo SHA

The aggregated Odoo source lives at `odoo-19/custom/src/odoo/` (managed by `inv git_aggregate`). The currently-pinned commit is whatever `odoo-19/custom/src/repos.yaml` resolves to. To capture it for a regenerate batch:

```sh
cd ../../../../odoo-19/custom/src/odoo
git rev-parse HEAD             # → record in the DTCG JSON $metadata + in the Penpot Overview page
git log -1 --format=%cd        # → human-readable date for the doc footer
```

The `scripts/scss-to-dtcg.py` output's `$metadata` block notes the SCSS files it read but does **not** yet stamp the exact SHA — add a `--pin` flag in the next pass.

## When to re-capture

Re-capture screenshots when:

1. **Upstream Odoo 19.0 ships SCSS variable changes** — bumps `$o-brand-primary` from one hex to another, adjusts `$o-form-sheet-min-width`, etc. Regenerate the DTCG JSON, designer reimports into Penpot.
2. **A view-level template changes** — new field type, redesigned control panel, restyled kanban card. Re-screenshot the affected surface only.
3. **A runboat / runbot URL we cite goes stale** — they expire frequently. Point the footer of each surface page at the *most recent* runboat URL, but keep the screenshot pinned to the SHA we captured against.

## OCA overlay

`OCA/web` ships `web_responsive`, currently at **18.0** on `1.0.5` in this tree (`odoo/custom/src/web/web_responsive/`). A 19.0 port is needed before screenshotting the overlay variant — track in a separate branch.

When the 19.0 port lands:

1. Add a second Docker compose stack (`docker-compose.web-responsive.yml` overlay) with `web_responsive` installed on top of the same `odoo_19_review` DB.
2. Run `scripts/capture-stock-surfaces.sh --variant web_responsive` against the second stack.
3. Pages in the Penpot file get sibling pages `1X.web_responsive — <surface>` — overlay annotations cite `web_responsive/static/src/legacy/scss/web_responsive.scss` and the relevant template patch (`apps_menu.xml`, `form_buttons.xml`, etc.).

## Authority

If the SCSS, the XML, or the captured screenshot disagree, **the code wins.** The Penpot file is a snapshot; the source is the truth. Update the file, never the other way around.
