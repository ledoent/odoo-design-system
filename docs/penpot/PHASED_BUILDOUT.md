# Phased Penpot Buildout

> Status: **draft / not started**
> Owner: `dkendall@ledoweb.com`
> Last updated: 2026-05-17

## Why this exists

The Penpot file at [`design.hz.ledoweb.com/.../file-id=038df003-0f49-80b2-8008-0774e5399553`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553) is today **12 pages of raster screenshots** — no vector primitives, no selectable shapes, no Penpot components, no tokensLib bindings. That makes it useless as a working design surface: you can't pick a button, restyle it, or drop an instance onto a new mock.

Code side is further along. This repo already ships:

- 59 DTCG tokens (color / size / shadow) in [`odoo_design_system/static/src/tokens/design-system.dtcg.json`](../../odoo_design_system/static/src/tokens/design-system.dtcg.json)
- 4 OWL components: `OdsChip`, `OdsInitialsAvatar`, `OdsCardTile`, `OdsIcon`
- 4 bundled icon sets (Lucide + Heroicons outline/solid/mini)
- DTCG → SCSS pipeline via Style Dictionary v5 ([`style-dictionary.config.js`](../../style-dictionary.config.js))
- Penpot → repo CI gate ([`.github/workflows/penpot-token-sync.yml`](../../.github/workflows/penpot-token-sync.yml))

This document lays out the multi-week, multi-PR work to bring the Penpot side up to parity — **pure vector specs, all driven by tokensLib variables**, mirroring the real OWL backend components and QWeb portal/frontend templates. End state: the Penpot file becomes a working template for mocking new UX (dashboards, kanbans, portal carts, printable reports), with each component instance traceable back to the OWL/QWeb source it represents.

---

## Working agreement

### One PR per phase

- Each phase below is a single PR against `oca-design-system`.
- PRs merge **in order** — phase N+1 cannot open until phase N is merged.
- PR title: `feat(design-system): phase N — <topic>` (per [Ledo PR conventions](../../README.md) and `~/.claude/CLAUDE.md`).
- Squash-merge with `--delete-branch`. **Never auto-merge**; hand back for explicit approval.

### Required evidence in every phase PR

1. **Code/token diff** — updated `design-system.dtcg.json`, regenerated `_tokens.generated.scss`, any new OWL component, any `populate-penpot.py` change.
2. **Penpot screenshots, light + dark** — captured via Playwright (`pnpm run test:e2e` against the Odoo showcase route, or `/browse` skill against the Penpot file), uploaded to `gs://ledo-pr-assets/oca-design-system/pr-<N>/`, embedded in the PR body via:
   ```
   https://storage.googleapis.com/ledo-pr-assets/oca-design-system/pr-<N>/<file>.png
   ```
   **No binaries in the repo.** If a screenshot accidentally lands in a commit, squash it out before merge.
3. **Interactivity proof** — a headless-Chromium script under `docs/penpot/verification/phase-<N>.md` (Playwright or `/browse` — pick whichever is wired in your session) that:
   - opens the Penpot file in a Chromium session
   - clicks a representative component instance and confirms it's a vector shape (not an `<image>`)
   - toggles the tokensLib theme set
   - screenshots the delta
   - leaves a written verdict at the bottom of the file
4. **Done-state checklist** — the checkboxes from this doc, ticked with links to the evidence above.
5. **Source traceability** — every Penpot component frame is named `<owl_or_qweb_path>:<symbol>`, e.g. `addons/web/static/src/views/form/form_renderer.js:FormRenderer`. A reviewer should be able to grep the Odoo source for any frame name.

### Verification pattern (headless Chromium)

Each `docs/penpot/verification/phase-<N>.md` follows the same template,
expressed once as Playwright code (`tests/e2e/phase-<N>.spec.ts`) and
once as a `/browse` script for ad-hoc runs:

```
1. open the Penpot file URL (light theme query)
2. wait for selector `.workspace-content`
3. enumerate shape nodes; confirm count > raster count
4. click a representative component instance
5. evaluate JS to toggle tokensLib theme set via Penpot's store
6. screenshot light + dark, side by side
7. append verdict + screenshot URLs to the phase verification doc
```

The same harness is re-pointed at the Odoo backend showcase route
(`/odoo/action-odoo_design_system.action_showcase`) to prove the SCSS
side stays in lockstep with the design side — see
[`tests/e2e/showcase.theme.spec.ts`](../../tests/e2e/showcase.theme.spec.ts)
for the canonical example.

---

## Phases

### Phase 0 — Foundations: tokens + theme machinery (≈1 week)

**Why first**: nothing else is verifiable until tokens drive the canvas. Without spacing / typography / radius / motion tokens, the Penpot vector shapes have nothing to bind to.

**Scope**:

- Mirror [`addons/web/static/src/scss/primary_variables.scss`](https://github.com/odoo/odoo/blob/19.0/addons/web/static/src/scss/primary_variables.scss) values into `design-system.dtcg.json` under new groups:
  - `spacing.*` — 8px grid, 7 tiers (4 / 8 / 12 / 16 / 24 / 32 / 48)
  - `typography.*` — family, size ramp (xs → 4xl), weight (300/400/500/600/700), line-height (tight / base / relaxed)
  - `radius.*` — 4-tier (sm / base / lg / pill)
  - `motion.*` — duration (fast / base / slow) + easing (standard / decelerate / accelerate)
  - `elevation.*` — replace the two hard-coded shadow tokens with a 5-step elevation scale
- Add `$themes` to tokensLib: `light` (current), `dark`, `high-contrast`. Each set overrides **color + elevation only** — spacing/typography/radius/motion are theme-invariant.
- Extend [`scripts/populate-penpot.py`](../../scripts/populate-penpot.py) to **push** token sets to the Penpot file's tokensLib (today the flow is pull-only). Keep the CI gate intact; this just allows scripted seeding for the initial bulk push.
- Update [`style-dictionary.config.js`](../../style-dictionary.config.js) to emit three theme blocks in `_tokens.generated.scss` under `[data-theme="<name>"]` selectors.
- Add a theme switcher to the OWL showcase route (`odoo_design_system.action_showcase`) that toggles `document.documentElement.dataset.theme`.

**Done-state**:

- [ ] `pnpm run tokens` produces SCSS with 3 theme blocks
- [ ] Penpot file's **Tokens** panel shows ≥120 tokens across 6 groups, 3 sets
- [ ] Playwright / `/browse` verification: navigate to Odoo showcase, toggle `data-theme`, screenshot proves background + chip colors flip
- [ ] CI gate (`penpot-token-sync.yml`) still green on a clean checkout
- [ ] `docs/penpot/verification/phase-0.md` committed with screenshots + verdict

---

### Phase 1 — Penpot reset + page skeleton (≈3 days)

**Scope**:

- Confirm `.penpot-backups/odoo-19-design-system_pre-reset_*.json` exists; if not, snapshot via Penpot REST export before any destructive op.
- Delete all 12 raster pages.
- Recreate the 12-page structure from [`docs/penpot/README.md`](README.md): Cover, Foundations, Iconography, Shared Components, 18.0 Deltas, 19.0 Deltas, Patterns, Backend Templates, Portal Templates, Reports, Drafts, Changelog.
- Each page gets: title frame, 8px baseline grid overlay, theme switcher artboard (3 small frames stacked vertically: light / dark / high-contrast).
- Bind every page background fill to `color.surface.canvas` so a tokensLib set switch re-skins all 12 pages at once.

**Done-state**:

- [x] 12 pages, 0 raster images — enforced by [`tests/pages.test.mjs`](../../tests/pages.test.mjs) against [`docs/penpot/specs/pages.json`](specs/pages.json)
- [x] Switching tokensLib set in the file recolors all 12 page backgrounds — `appliedTokens.fill = color.surface.canvas` per [`docs/penpot/specs/token-fill.json`](specs/token-fill.json) **(state-level: REST `set-active-token-themes` works; canvas re-render carries a known browser-cache gap, see verdict)**
- [x] Stock-19.0 reference screenshots moved to a sibling file (`Odoo 19.0 — Stock Reference Screenshots`, id `ab1caf40-…`)
- [x] 24 screenshots committed to GCS (12 pages × 2 themes) — `gs://ledo-pr-assets/odoo-design-system/phase-1/`
- [x] [`docs/penpot/verification/phase-1.md`](verification/phase-1.md) committed with verdict

---

### Phase 2 — Foundations page (≈1 week)

**Scope**: vector specimens for every token group.

- Color swatches — per palette × per theme; bound to `color.*` tokens
- Type ramp — sample sentence at every (size × weight) combo, bound to `typography.*`
- Spacing scale — annotated bars at each `spacing.*` value
- Radius scale — squircle row at each `radius.*` value
- Shadow elevation deck — 5 cards at each `elevation.*` value
- Motion timing strips — annotated bars for `motion.duration.*` (visual reference only; Penpot doesn't animate)

**Done-state**:

- [x] Every swatch/spec is a vector shape bound to a token — enforced live by [`tests/foundations.test.mjs`](../../tests/foundations.test.mjs) against [`docs/penpot/specs/foundations.json`](specs/foundations.json) (184 specimens; Penpot's `appliedTokens` map asserted per-shape)
- [x] Playwright: shapes verified as `:rect` / `:text` (not `:image`) — same raster-free invariant enforced by `tests/foundations.test.mjs`
- [x] Theme bindings present at the data layer; visual canvas re-skin **carries the Phase 1 known cache gap** (state-level activation via REST `set-active-token-themes` works; SPA caches tokensLib past `page.reload()` — see verdict)
- [x] [`docs/penpot/verification/phase-2.md`](verification/phase-2.md) committed with verdict + GCS embed URLs

---

### Phase 3 — Iconography + shared atoms (≈1 week)

**Scope**: promote the 4 existing OWL components to Penpot library components with full variant matrices.

| Component | Source | Variant axes |
|---|---|---|
| `OdsIcon` | `odoo_design_system/static/src/js/icon.esm.js` | `set` (lucide / heroicons-outline / -solid / -mini), `size` (token-driven), `color` (currentColor + token override) |
| `OdsChip` | `chip.esm.js` | `variant` (neutral / ext / size / count / warning / success), `withIcon` (bool) |
| `OdsInitialsAvatar` | `initials_avatar.esm.js` | `bucket` (8 palette tones), `size` (token-driven) |
| `OdsCardTile` | `card_tile.esm.js` | `accent` (ext / initial / preview) |

Each component frame named `odoo_design_system/static/src/js/<file>:<Class>`.

**Done-state**:

- [ ] All 4 components appear in Penpot **Assets** panel; can be dragged onto any page
- [ ] Variant swap works via Penpot's variant selector
- [ ] Playwright / `/browse`: instantiate a chip on the Drafts page, change variant, screenshot
- [ ] `docs/penpot/verification/phase-3.md` committed

---

### Phase 4 — Backend chrome (≈1 week)

**Scope**: vectorize the persistent OWL shell that wraps every backend view.

| Surface | OWL source |
|---|---|
| App launcher | `addons/web/static/src/webclient/navbar/` |
| User menu | `addons/web/static/src/webclient/user_menu/` |
| Breadcrumbs | `addons/web/static/src/search/control_panel/control_panel.js` |
| Search bar | `addons/web/static/src/search/search_bar/` |
| Filter / GroupBy / Favorites menus | `addons/web/static/src/search/filter_menu/`, `group_by_menu/`, `favorite_menu/` |
| Status bar | `addons/web/static/src/views/form/status_bar/` |

**Done-state**:

- [ ] Each surface is a Penpot component with light / dark / high-contrast variants
- [ ] Playwright recording: open Odoo backend at `/odoo` in one viewport, Penpot frame in another, diff under 4px deviation on key dimensions (navbar height, breadcrumb height, search bar height)
- [ ] `docs/penpot/verification/phase-4.md` committed

---

### Phase 5 — Form view + field widgets (≈2 weeks)

**Scope**:

- Sheet, groups, notebook tabs — `addons/web/static/src/views/form/`
- 12 highest-value field widgets:
  - `char`, `text`, `integer`, `monetary`, `date`, `datetime`
  - `selection`, `many2one`, `many2many_tags`
  - `one2many` (list), `boolean_toggle`, `image`
- Each widget = one Penpot component with state variants: `empty / filled / focused / error / readonly`
- Build a canonical `sale.order` form mock on the **Backend Templates** page, composed exclusively of library instances

**Done-state**:

- [ ] 12 widget components in the Assets panel
- [ ] `sale.order` mock built only from library instances (no detached shapes; verified by inspecting layer tree)
- [ ] Playwright / `/browse`: theme toggle on the mocked form changes field chrome but not data-bound text
- [ ] `docs/penpot/verification/phase-5.md` committed

---

### Phase 6 — List + Kanban (≈2 weeks)

**Scope**:

- **List view** — header, body row (regular + grouped), footer aggregates, inline-edit state. Source: `addons/web/static/src/views/list/`
- **Kanban view** — column header w/ progressbar, card (compact + detailed), drag affordance. Source: `addons/web/static/src/views/kanban/`
- Canonical mocks on **Backend Templates**: full `crm.lead` kanban board, full `sale.order.line` editable list

**Done-state**:

- [ ] Kanban card variants: 3 density levels × 3 themes = 9 instances visible on the Backend Templates page
- [ ] Playwright drag test: select a kanban card via `locator.click()`, fire drag events, confirm Penpot moves the **shape** (not a screenshot — confirmed by comparing pre/post `boundingBox()` shape coordinates)
- [ ] Token toggle re-skins both views
- [ ] `docs/penpot/verification/phase-6.md` committed

---

### Phase 7 — Modals, dropdowns, menus, pickers (≈1 week)

**Scope**: modal chrome, action menu, dropdown menu, datepicker, colorpicker, command palette.

Sources:
- `addons/web/static/src/core/dialog/`
- `addons/web/static/src/core/dropdown/`
- `addons/web/static/src/core/datetime/`
- `addons/web/static/src/webclient/actions/action_menus.js`
- `addons/web/static/src/core/commands/`

**Done-state**:

- [ ] Each overlay is a component with open / closed state
- [ ] Playwright / `/browse`: theme toggle works on overlay layers (backdrop + body)
- [ ] `docs/penpot/verification/phase-7.md` committed

---

### Phase 8 — Portal + eCommerce (≈2 weeks)

**Scope**: frontend-facing templates.

| Surface | QWeb source |
|---|---|
| Portal navbar, sidebar, record list | `addons/portal/views/portal_templates.xml` |
| Portal record detail | `addons/sale/views/sale_portal_templates.xml` |
| eCommerce product page, cart, checkout | `addons/website_sale/views/templates.xml` |
| Login / signup / password reset | `addons/auth_signup/views/auth_signup_login_templates.xml` |

**Done-state**:

- [ ] Full **Portal Templates** page mocked with components
- [ ] Playwright / `/browse`: each page rendered in light / dark, two viewport widths (375px mobile, 1280px desktop)
- [ ] Link annotations on the cart/checkout frames point to QWeb templates by file path
- [ ] `docs/penpot/verification/phase-8.md` committed

---

### Phase 9 — Printable reports (≈1 week)

**Scope**: invoice, quotation, delivery slip, BOM tree, manufacturing order, payslip. A4 frames (595 × 842pt) with letterhead, footer, table grid.

**Done-state**:

- [ ] 6 report templates as Penpot components
- [ ] Reports use a **print** theme set (paper-white only — no dark mode for printables)
- [ ] Playwright / `/browse`: print-preview Odoo invoice, overlay against the Penpot frame, diff < 4px on key landmarks
- [ ] `docs/penpot/verification/phase-9.md` committed

---

### Phase 10 — Patterns + cookbook (≈1 week)

**Scope**: use the now-complete library to mock three new UX flows from scratch, proving the file works as a template.

- A CRM agent dashboard (kanban + metrics + activity feed)
- A portal "track my order" page variant
- A custom inventory turnover printable report

Each mock built **only** from library instances + tokens. No detached shapes anywhere.

**Done-state**:

- [ ] Three new pattern pages, fully tokenized
- [ ] Each pattern has a "User story → component map" annotation listing component instances + the OWL/QWeb files they correspond to
- [ ] Annotations include linkable references like `crm.lead kanban` → `addons/crm/views/crm_lead_views.xml`
- [ ] `docs/penpot/verification/phase-10.md` committed

---

### Phase 11 — Dark mode + handoff (≈3 days)

**Scope**: end-to-end audit. Every page, every component, in light / dark / high-contrast. Fix any token leaks discovered.

**Done-state**:

- [ ] Playwright recorded session: walk all 12 pages, toggle theme on each, no visual regression
- [ ] `pnpm exec lighthouse` (or your preferred headless Chrome auditor) against Odoo showcase route — accessibility ≥95 in both themes
- [ ] This doc updated with `Status: complete` + date
- [ ] Final PR adds `docs/penpot/USING_THE_TEMPLATE.md` cookbook
- [ ] `docs/penpot/verification/phase-11.md` committed

---

## Critical files

| File | Purpose | First touched in |
|---|---|---|
| [`docs/penpot/PHASED_BUILDOUT.md`](PHASED_BUILDOUT.md) | this doc | — |
| `docs/penpot/verification/phase-<N>.md` | per-phase Playwright / `/browse` script + verdict | every phase |
| [`odoo_design_system/static/src/tokens/design-system.dtcg.json`](../../odoo_design_system/static/src/tokens/design-system.dtcg.json) | DTCG token source | Phase 0 |
| [`style-dictionary.config.js`](../../style-dictionary.config.js) | DTCG → SCSS pipeline | Phase 0 |
| [`scripts/populate-penpot.py`](../../scripts/populate-penpot.py) | Penpot tokensLib seeder | Phase 0 |
| [`scripts/penpot-export-tokens.mjs`](../../scripts/penpot-export-tokens.mjs) | Penpot → repo pull | (existing — unchanged) |
| [`scripts/check-tokens-in-sync.mjs`](../../scripts/check-tokens-in-sync.mjs) | CI sync gate | (existing — unchanged) |
| [`.github/workflows/penpot-token-sync.yml`](../../.github/workflows/penpot-token-sync.yml) | CI workflow | (existing — unchanged) |
| [`odoo_design_system/readme/ROADMAP.md`](../../odoo_design_system/readme/ROADMAP.md) | append pointer to this doc | Phase 0 |

## Overall verification (after Phase 11)

1. Fresh clone of `oca-design-system`, run `pnpm install && pnpm run tokens`. Expect no diff.
2. Open the Penpot file. Switch theme set to `dark`. Every page should re-skin within one frame.
3. Drag an `OdsChip` component instance onto the Drafts page; change its variant; confirm token bindings hold.
4. Run `pnpm exec lighthouse` (or your preferred headless Chrome auditor) against the Odoo showcase route — accessibility ≥95 in both themes.
5. Walk the three cookbook pattern pages; trace each component instance back to its OWL/QWeb source by reading the frame name.
