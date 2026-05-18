# Phase 1 — Verification

> Status: **automation-shipped, theme-toggle pending designer ack**
> Phase: [`PHASED_BUILDOUT.md`](../PHASED_BUILDOUT.md) → Phase 1 (Penpot reset + canonical 12-page skeleton)

## What this proves

Phase 1 sets up the canonical 12-page skeleton on the Penpot file at
[`design.hz.ledoweb.com/.../file-id=038df003-0f49-80b2-8008-0774e5399553`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553):
12 pages matching [`docs/penpot/specs/pages.json`](../specs/pages.json),
all raster-free, every page authored with the same skeleton —
background rect bound to `color.surface.canvas`, page title row, an
8 px baseline-grid overlay (locked), and a theme-switcher artboard.

Stock-19.0 reference screenshots — preserved as PR-review evidence
for later phases — moved to a sibling file
[`Odoo 19.0 — Stock Reference Screenshots`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=ab1caf40-8849-808b-8008-096a0fe717bb)
in the same project.

## Automated checks (CI green)

```sh
# 1. Token + page contracts hold.
PENPOT_TOKEN=$(grep '^PENPOT_TOKEN=' .env | head -1 | cut -d= -f2-) \
    pnpm run test    # 10/10 green

# 2. SCSS regenerates byte-equal from the committed JSON.
pnpm run tokens:check    # ✓

# 3. Round-trip CI gate: Penpot ↔ committed JSON byte-equal.
PENPOT_TOKEN=… node scripts/penpot-export-tokens.mjs /tmp/p.json
diff -u odoo_design_system/static/src/tokens/design-system.dtcg.json /tmp/p.json
    # → empty
```

`tests/pages.test.mjs` (committed in this PR) is the live-Penpot
gate; it asserts the canonical file has exactly 12 pages with the
canonical names and 0 raster fills. Currently green at revn=79.

## Visual evidence

24 screenshots (12 pages × 2 themes) captured by
[`scripts/penpot-capture-phase-1.mjs`](../../scripts/penpot-capture-phase-1.mjs)
and uploaded to
`gs://ledo-pr-assets/odoo-design-system/phase-1/`. Light-theme +
dark-theme strips per page:

| # | Page | Light | Dark |
| --- | --- | --- | --- |
| 00 | Cover | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/00-cover-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/00-cover-dark.png) |
| 01 | Foundations | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/01-foundations-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/01-foundations-dark.png) |
| 02 | Iconography | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/02-iconography-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/02-iconography-dark.png) |
| 03 | Shared Components | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/03-shared-components-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/03-shared-components-dark.png) |
| 04 | 18.0 Deltas | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/04-18-0-deltas-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/04-18-0-deltas-dark.png) |
| 05 | 19.0 Deltas | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/05-19-0-deltas-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/05-19-0-deltas-dark.png) |
| 06 | Patterns | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/06-patterns-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/06-patterns-dark.png) |
| 07 | Backend Templates | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/07-backend-templates-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/07-backend-templates-dark.png) |
| 08 | Portal Templates | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/08-portal-templates-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/08-portal-templates-dark.png) |
| 09 | Reports | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/09-reports-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/09-reports-dark.png) |
| 10 | Drafts | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/10-drafts-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/10-drafts-dark.png) |
| 11 | Changelog | [light](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/11-changelog-light.png) | [dark](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/11-changelog-dark.png) |

## Verdict

- [x] Backup written: `.penpot-backups/odoo-19-0-design-system_2026-05-18T00-56-28-869Z.json` (242 KB, all 15 pre-Phase-1 pages, gitignored)
- [x] **12 raster-free canonical pages** — verified by `pnpm run test` (`tests/pages.test.mjs`)
- [x] **Stock-19.0 sibling file** populated — 11 pages with image fills + media uploads intact at file-id `ab1caf40-…`
- [x] **Page backgrounds bound to `color.surface.canvas`** via `appliedTokens.fill` per [`docs/penpot/specs/token-fill.json`](../specs/token-fill.json) — verified by inspecting the live file's `get-file` response
- [x] **24 screenshots in GCS** at `gs://ledo-pr-assets/odoo-design-system/phase-1/`
- [x] CI workflows green (`test.yml`, `penpot-token-sync.yml`)

### Known gap — theme-toggle re-skin

The `appliedTokens.fill` binding is **present on every page
background**, but the captured `*-dark.png` PNGs still render with
the light surface. Two facts confirmed during the Phase 1 PR review:

1. Penpot's REST `update-file` accepts a `set-active-token-themes`
   change op. With `themePaths: ["/dark"]` (group-prefixed path)
   the file's `$metadata.activeThemes` AND `$metadata.activeSets`
   both update correctly server-side — verified by a fresh
   `get-file` immediately after.
2. Reloading the workspace URL in Playwright after the mutation
   does NOT re-render the canvas against the new active sets. The
   Penpot SPA appears to read theme-activation state from a
   user-scoped session source (localStorage / IndexedDB) on top of
   the file's metadata, and a stale value wins.

**Follow-up** (Phase 2): drive theme activation via the in-UI
**TOKENS → THEMES → Apply** click sequence in Playwright (not REST)
so Penpot writes its own session source. Or wait for
[penpot-mcp](https://github.com/penpot/penpot-mcp) to ship a
`set-active-theme` tool that does the equivalent.

The captures are otherwise good for verifying structural parity —
the title + grid + switcher artboard land at the same place every
page, and a manual TOKENS → THEMES → Apply click in the Penpot UI
visibly re-skins the canvas (designer-confirmed). The 12-page
contract test (`tests/pages.test.mjs`) is the durable signal that
Phase 1's invariants hold.

**Run by:** Claude (auto mode, 2026-05-17 → 2026-05-18 UTC handoff)

**Notes / regressions found during implementation:**

- Penpot REST does not expose a `binfile-export` endpoint. Snapshot is the raw `get-file` JSON (242 KB for the canonical file).
- `duplicate-file` works and clones pages + media in one call — used by `scripts/penpot-split-stock-pages.mjs`.
- `penpot-export-tokens.mjs` had been returning empty sets (pre-existing bug from Phase 0) — fixed in PR #5 commit `e4e4ed5`; the round-trip is byte-equal now.
- The shape attribute name for token bindings is `appliedTokens` (camelCase JSON / `applied-tokens` kebab-case in PCS ops). The value is the group-prefixed token name (`color.surface.canvas`), NOT theme-set-prefixed.
- Penpot 2.15 accepts a non-canonical attribute name (`tokens` instead of `appliedTokens`) silently — the value is stored but not honoured for resolution. Always use `applied-tokens` in `update-file` mod-obj operations.
