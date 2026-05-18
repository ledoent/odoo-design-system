# Phase 3 — Verification

> Status: **shipped — 4 atoms live in the Penpot Assets panel; variant matrices on canvas; full variant-component swap deferred to Phase 3b**
> Phase: [`PHASED_BUILDOUT.md`](../PHASED_BUILDOUT.md) → Phase 3 (Iconography + shared atoms)

## What this proves

Phase 3 promotes the four OWL atoms (`OdsIcon`, `OdsChip`,
`OdsInitialsAvatar`, `OdsCardTile`) into Penpot library components on
the canonical file at
[`design.hz.ledoweb.com/.../file-id=038df003-…`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553)
— draggable from the **Assets** panel onto any page — and lays out a
visual sampler of every variant on the "03 — Shared Components" page
so designers can see what each axis looks like without instantiating
one.

Bullet truth:

- 4 entries in the file's `data.components` index after the build:
  `OdsIcon`, `OdsChip`, `OdsInitialsAvatar`, `OdsCardTile`. Each
  points at a `main-instance-id` on the Shared Components page.
- 181 specimen shapes on the page (icon sampler matrix, chip
  with/without-icon matrix, avatar bucket row, tile-accent row),
  named under `__phase3.<atom>.<key>` for stable re-runs.

## RPC change-op shapes discovered

Phase 3's probe confirmed Penpot 2.15 accepts these change-ops via
REST `update-file`:

- `add-component { id, name, path, main-instance-id, main-instance-page, [variant-id], [variant-properties: [{name, value}]] }` — promotes an existing shape to a library component.
- `mod-component { id, [name], [path], [variant-id], [variant-properties] }` — edits an existing component's metadata.
- `del-component { id }` / `restore-component { id }` / `purge-component { id }` — soft-delete / restore / hard-delete.

Phase 3a (this PR) uses `add-component` only — one component per atom,
no `variant-id`. Phase 3b folds in the full variant-container flow
(group multiple variant components under one container; expose a
variant selector in the right-panel).

## Automated checks (CI green)

```sh
# 1. All Phase 1 / 2 / 3 contracts hold.
PENPOT_TOKEN=… pnpm run test    # 16/16 green
    # - pages.test.mjs (12 pages, 0 rasters)
    # - foundations.test.mjs (184 specimens + binding parity + orphan check)
    # - components.test.mjs (4 atoms in components index + 181 specimens + orphan check)

# 2. SCSS regenerates byte-equal.
pnpm run tokens:check    # ✓

# 3. Round-trip CI gate.
PENPOT_TOKEN=… node scripts/penpot-export-tokens.mjs /tmp/p.json
diff -q odoo_design_system/static/src/tokens/design-system.dtcg.json /tmp/p.json
    # → byte-equal
```

`tests/components.test.mjs` (added in this PR) asserts:
1. Every atom in `docs/penpot/specs/components.json` has a matching entry in `data.components` whose `main-instance-id` points at a real shape on the Shared Components page.
2. Every specimen the spec declares exists on the page with the expected name.
3. No orphan `__phase3.*` shape on the page is missing from the spec (mirroring the Phase 2 canvas → spec parity check).

## Visual evidence

Three full-page screenshots (one per active theme) captured by
[`scripts/penpot-capture-phase-3.mjs`](../../../scripts/penpot-capture-phase-3.mjs):

| Theme | URL |
| --- | --- |
| light         | [components-light.png](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-3/components-light.png) |
| dark          | [components-dark.png](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-3/components-dark.png) |
| high-contrast | [components-high-contrast.png](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-3/components-high-contrast.png) |

The capture script uses
[`scripts/_penpot-ui-theme.mjs`](../../../scripts/_penpot-ui-theme.mjs)
(committed as the preamble to this PR), which clicks Penpot's own
**TOKENS → THEMES → EDIT** dialog instead of mutating
`$metadata.activeThemes` via REST — that path was the Phase 1/2
known cache gap and is now resolved at the capture layer.

## Verdict

- [x] **4 atoms live in `data.components`** — `OdsIcon`, `OdsChip`, `OdsInitialsAvatar`, `OdsCardTile`. Verified by `tests/components.test.mjs` + manually visible in the Penpot Assets panel.
- [x] **Variant matrices on canvas** — every axis shown for each atom (4 icon sets × 12 samples; 6 chip variants × 2 icon states; 8 avatar buckets; 3 tile accents).
- [x] **Idempotent build** — re-running `penpot-build-phase-3-components.mjs` reports `nothing to do — N shapes already in place; 4 library components.`
- [x] **3 screenshots in GCS** at `gs://ledo-pr-assets/odoo-design-system/phase-3/`
- [x] **UI-driven theme toggle** — `_penpot-ui-theme.mjs` shipped; Phase 2 dark captures now visibly re-skin (state pills go from light pastels to dark saturated tones).
- [x] CI workflows green (`test.yml`, `penpot-token-sync.yml`)

### Deferred to Phase 3b

- [ ] **Per-component variant selector in Penpot's right-panel.** The `add-component` change-op accepts `variant-id` + `variant-properties` but the full **VariantContainer** flow (one board grouping multiple variant components into a single Assets-panel entry) needs probing and a follow-up PR. The Phase 3a atoms each appear as a separate library component without a variant dropdown.
- [ ] **Real icon thumbnails.** The Phase 3a icon sampler uses **named rect placeholders** (icon name centered in an outlined square) because Penpot's `fillImage` requires uploaded media — wiring the `upload-file-media` round-trip for 48 SVGs is its own work. Designers see the icon names per set but not the glyphs. Phase 3b uploads the real SVGs.
- [ ] **OdsChip warning / success use legacy `--o-warning-*`** instead of the DTCG `color.state.*` tokens added in Phase 0. Not a Phase 3 task — flagged for the form-widget phases (5/6) that retire the legacy Odoo bootstrap colors.

### Notes / discoveries during build

- The `add-component` change-op writes its result under `data.components[<uuid>]` keyed by component UUID; `name` is searchable but not unique. The build script does name-based idempotency.
- Penpot's component change-ops use **kebab-case attribute names** in PCS (`main-instance-id`, `main-instance-page`, `variant-id`, `variant-properties`) — same convention as `applied-tokens`. Penpot returns them as camelCase on read (`mainInstanceId`, etc.).
- Penpot's `data.components` value shape was discovered empirically; not documented in the Plugin API overview. The contract test guards against schema drift across Penpot versions.
- Avatar bucket assignment in JS mirrors the SCSS `ods-bucket-index` (sum of char positions in `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` mod 8, +1). Keeping the algorithm in lockstep is a Phase 3 invariant — if the SCSS changes, the build script must too.

**Run by:** Claude (auto mode, 2026-05-18 UTC)
