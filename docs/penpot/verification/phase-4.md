# Phase 4 — Verification

> Status: **shipped — 4 chrome surfaces live as Penpot library components; 3 theme variants each**
> Phase: [`PHASED_BUILDOUT.md`](../PHASED_BUILDOUT.md) → Phase 4 (Backend chrome)

## What this proves

Phase 4 vectorizes the persistent OWL shell that wraps every Odoo backend view and promotes
each surface into a Penpot library component with three theme variants. The result lives on
page "07 — Backend Templates" of the canonical design-system file at
[`design.hz.ledoweb.com/.../file-id=038df003-…`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553&page-id=2426b3eb-e4fd-46f0-9ccd-eb5b3eefd66b).

Bullet truth:

- 12 entries added to `data.components` (4 surfaces × 3 themes), all under `Chrome / Navigation`
  or `Chrome / Controls` paths.
- Each surface's 3 variants share a `variant-id` so Penpot's Assets panel collapses them into
  one variant-set entry with a `Theme` property selector.
- 175 `__phase4.*` shapes on page "07 — Backend Templates" — 0 on any other page.
- Every component's `main-instance-id` points at a `:frame` shape (not a leaf), preventing
  Assets-panel thumbnail-renderer crashes.

## OWL source traceability

| Surface | Penpot component | OWL source |
|---|---|---|
| `Navbar` | `Chrome / Navigation > Navbar` | `addons/web/static/src/webclient/navbar/` |
| `ControlPanel` | `Chrome / Controls > ControlPanel` | `addons/web/static/src/search/control_panel/control_panel.js` |
| `StatusBar` | `Chrome / Controls > StatusBar` | `addons/web/static/src/views/form/status_bar/` |
| `UserMenu` | `Chrome / Navigation > UserMenu` | `addons/web/static/src/webclient/user_menu/` |

## Automated checks (CI green)

```sh
# All Phase 1 / 2 / 3 / 4 contracts hold.
PENPOT_TOKEN=… pnpm run test
    # - pages.test.mjs (12 pages, 0 rasters)
    # - foundations.test.mjs (184 specimens)
    # - components.test.mjs (4 atoms in components index)
    # - backend-chrome.test.mjs (38/38 green — see below)
```

`tests/backend-chrome.test.mjs` asserts:

1. **Component counts**: 12 Chrome components total; each surface has exactly 3.
2. **Variant-id grouping**: all 3 variants of a surface share one `variant-id`.
3. **Theme variant properties**: `Navbar`, `ControlPanel`, `StatusBar`, `UserMenu` each expose
   `Theme = Light | Dark | High Contrast` variant properties.
4. **Main-instance type**: every `mainInstanceId` resolves to a `:frame` on the page.
5. **Shape location**: 175 `__phase4.*` shapes on page 07; 0 leaked to any other page.
6. **Orphan check**: no `__phase4.*.main` frame is parented outside the root frame.

Full run output:

```
=== Phase 4 — Backend Chrome contract tests ===

1. Component counts
  ✓ total Chrome components = 12
  ✓ Navbar has 3 components
  ✓ ControlPanel has 3 components
  ✓ StatusBar has 3 components
  ✓ UserMenu has 3 components

2. Variant-id grouping
  ✓ Navbar: all variants share one variant-id
  ✓ ControlPanel: all variants share one variant-id
  ✓ StatusBar: all variants share one variant-id
  ✓ UserMenu: all variants share one variant-id

3. Theme variant properties
  ✓ Navbar: variant properties cover all 3 themes
  ✓ ControlPanel: variant properties cover all 3 themes
  ✓ StatusBar: variant properties cover all 3 themes
  ✓ UserMenu: variant properties cover all 3 themes

4. Main-instance shape types
  ✓ UserMenu [Light] main-instance is :frame
  ✓ ControlPanel [Light] main-instance is :frame
  ... (12 total)

5. Phase 4 shapes on correct page
  ✓ 175 __phase4.* shapes found on page "07 — Backend Templates"
  ✓ no __phase4.* shapes leaked to "03 — Shared Components"
  ... (11 pages checked)

6. Orphan check
  ✓ no orphaned __phase4.*.main frames (12 main frames)

38 passed, 0 failed.
```

## Visual evidence

One full-page screenshot of page "07 — Backend Templates" captured by
[`scripts/penpot-capture-phase-4.mjs`](../../../scripts/penpot-capture-phase-4.mjs).
The page displays all four surfaces with all three theme variants (light / dark / high-contrast)
as separate rows, so a single screenshot contains complete evidence for all 12 components.

| Capture | URL |
|---|---|
| All surfaces · all themes | [backend-chrome-overview.png](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-4/backend-chrome-overview.png) |

### Why no per-theme toggle screenshots (unlike Phase 2/3)

Phase 4 surfaces use **hardcoded per-theme colors** (not token-driven fills). Three separate
rows exist on the page for each surface — one row per theme. Token-based re-rendering is not
needed and was not implemented.

Clicking the Penpot Tokens tab on this page triggers a batch `mod-obj` request that sets
`position-data = []` for every text shape. Penpot's validator rejects this on shapes whose
`position-data` was auto-saved by the workspace renderer without the required `fills` entries
(`schema:position-data` requires `[:vector {:min 1} schema:position-data-entry]` with `fills`
present in every entry). The batch fails with HTTP 500 `"invalid shape found"`. This is a
known Penpot 2.15 issue; it does not affect Phase 4's visual correctness since the theme
variants are already rendered as separate rows.

## Dimension verification

The Playwright dimension diff against the live Odoo backend (`/odoo`) is **deferred**. It
requires a running Odoo instance in the CI environment. Phase 4 marks this as a future task
(see `PHASED_BUILDOUT.md` Phase 4 deferred items).

## Verdict

- [x] **12 Chrome components in `data.components`** — 4 surfaces × 3 themes. Verified by
  `tests/backend-chrome.test.mjs` (38/38 green) and visible in the Penpot Assets panel
  under `Chrome / Navigation` and `Chrome / Controls`.
- [x] **Variant-set grouping** — each surface's three theme variants are reachable via a
  single Assets-panel entry with a `Theme` property dropdown.
- [x] **Idempotent build** — `penpot-build-phase-4-backend-chrome.mjs` reports
  `nothing to do — N shapes already in place; 12 library components` on a second run.
- [x] **1 screenshot in GCS** at `gs://ledo-pr-assets/odoo-design-system/phase-4/`
- [x] **175 shapes on page 07; 0 orphans; 0 leaks to other pages**

### Deferred to Phase 4b

- [ ] **Dimension diff vs live Odoo backend.** Open Odoo at `/odoo` in one headless viewport,
  Penpot frame in another, assert `abs(odoo_dim - penpot_dim) < 4px` on navbar height,
  control-panel height, status-bar height. Blocked on Odoo instance in CI.
- [ ] **Token-driven color bindings.** Phase 4 uses hardcoded fills matching the theme color
  tokens. A Phase 4b pass should bind fills to `color.*` tokens so a single theme set
  switch re-skins all 12 components — removing the need for 3 separate variant rows.

**Run by:** Claude (auto mode, 2026-05-18 UTC)
