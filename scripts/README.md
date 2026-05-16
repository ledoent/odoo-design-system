# Design-system tooling

Scripts for keeping the Penpot reference file **Odoo 19.0 Design System** in sync with the canonical source `odoo/odoo:19.0`.

## `scss-to-dtcg.py`

Parses `$variable: value !default;` declarations out of:

- `addons/web/static/src/scss/primary_variables.scss`
- `addons/web/static/src/scss/secondary_variables.scss`
- `addons/web/static/src/views/form/form.variables.scss`
- `addons/web/static/src/views/kanban/kanban.variables.scss`
- `addons/web/static/src/webclient/navbar/navbar.variables.scss`

Resolves simple variable references and `o-to-rem(<px>)` calls; skips variables whose value involves SASS functions (`darken`, `mix`, `lighten`, `rgba`, etc.) — we don't fabricate values, we omit them.

Emits a single DTCG JSON file at `tokens/odoo-19.dtcg.json` with one token set `odoo-19-dtcg`. Token count breakdown (against Odoo 19.0 at the time of generation):

| Category | Count | Examples |
| --- | --- | --- |
| color | 40 | brand-primary `#71639e`, gray-100 …900, success/info/warning/danger |
| dimension | 54 | spacer `16px`, font-size-base `0.875rem`, form-sheet-min-width `990px`, kanban-default-record-width `320px` |
| font-weight | 3 | normal `400`, medium `500`, bold `700` |
| opacity | 6 | disabled `0.5`, muted `0.76` + the `$o-opacities` map |
| number | 4 | line-height-base `1.5`, contrast ratio `2.9` |

**Run:**

```sh
python3 scripts/scss-to-dtcg.py > tokens/odoo-19.dtcg.json
```

Re-run whenever the upstream `odoo/odoo` 19.0 branch ships SCSS variable changes — the script is deterministic and idempotent.

## Importing into Penpot

The DTCG JSON is loaded into the file's tokens library via Penpot's UI (no good API hook for token-set CRUD in Penpot 2.15.3 — the only `update-file` change ops are for shapes, pages, and library colors):

1. Open the file in Penpot: <https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553>
2. Right sidebar → **Tokens** tab (next to Layers / Assets)
3. **⋯ Options → Import** → select `tokens/odoo-19.dtcg.json`
4. Penpot renders each token as a live, applyable token — color swatches in the panel, dimension values on layout fields, etc.

Designers and `mcp__penpot__execute_code` calls can both apply tokens by reference (`shape.applyToken(token, ['fill'])`) so visual consistency stays automatic.

## Source pinning

Each generated JSON file should be regenerated against a pinned `odoo/odoo` commit. The metadata block in the output carries `source: "odoo/odoo:19.0 — addons/web/static/src/scss/*"` but does not yet stamp the exact commit SHA — `git -C odoo-19/custom/src/odoo log -1 --format=%H` from a fresh `inv git_aggregate` gives it for the regenerate-on-update workflow.
