# Phase 2 — Verification

> Status: **automation-shipped, theme-toggle visual re-skin carried forward from Phase 1**
> Phase: [`PHASED_BUILDOUT.md`](../PHASED_BUILDOUT.md) → Phase 2 (Foundations page vector specimens)

## What this proves

Phase 2 fills the "01 — Foundations" page of the canonical Penpot file at
[`design.hz.ledoweb.com/.../file-id=038df003-…`](https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553)
with **184 vector specimens** — one for every bindable token in the
DTCG source — declared in [`docs/penpot/specs/foundations.json`](../specs/foundations.json)
and authored by [`scripts/penpot-build-phase-2-specimens.mjs`](../../../scripts/penpot-build-phase-2-specimens.mjs).
Every theme-variant token is bound via `appliedTokens` (no hex hard-codes for
`color.surface.*`, `color.text.*`, `color.border.*`, `color.state.*`); theme-invariant
tokens (brand, portal, bucket, neutral, ext, spacing, radius, typography) are
likewise bound by their PCS attribute key (`fill`, `stroke-color`, `r1..r4`,
`width`, `font-size`, `font-weight`).

The Phase 1 known gap — Penpot's SPA caches `tokensLib` past a Playwright
`page.reload()` — persists into Phase 2 captures. State-level activation
is authoritative (verified by `get-file` after each REST call) but the
visual canvas does not re-resolve `appliedTokens` for theme-variant shapes
across a Playwright session.

## Automated checks (CI green)

```sh
# 1. Phase 1 + Phase 2 page/specimen contracts hold.
PENPOT_TOKEN=$(grep '^PENPOT_TOKEN=' .env | head -1 | cut -d= -f2-) \
    pnpm run test    # 12/12 green (pages.test.mjs + foundations.test.mjs)

# 2. SCSS regenerates byte-equal from the committed JSON.
pnpm run tokens:check    # ✓

# 3. Round-trip CI gate: Penpot ↔ committed JSON byte-equal.
PENPOT_TOKEN=… node scripts/penpot-export-tokens.mjs /tmp/p.json
diff -u odoo_design_system/static/src/tokens/design-system.dtcg.json /tmp/p.json
    # → empty
```

`tests/foundations.test.mjs` (committed in this PR) is the live-Penpot
gate for Phase 2. It asserts every shape declared in
`docs/penpot/specs/foundations.json` exists on the Foundations page,
carries the expected shape type, and carries the expected
`appliedTokens` map (normalising kebab-case spec keys to the camelCase
that Penpot returns on read). Currently green; Penpot revn ≥ 120.

## Visual evidence

Three full-page screenshots (one per active theme) captured by
[`scripts/penpot-capture-phase-2.mjs`](../../../scripts/penpot-capture-phase-2.mjs):

| Theme | URL |
| --- | --- |
| light         | [foundations-light.png](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-2/foundations-light.png) |
| dark          | [foundations-dark.png](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-2/foundations-dark.png) |
| high-contrast | [foundations-high-contrast.png](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-2/foundations-high-contrast.png) |

Page-level structure visible in light, stacked top-to-bottom (exact
counts are derived from `docs/penpot/specs/foundations.json` — the
build emits one shape per spec item plus per-row labels and per-section
headers, totalling ~180 shapes at the spec's current size):

- nine color sections — brand, portal, bucket, neutral scale, file
  extension, surface, text, border, state pills
- spacing scale (bars + labels)
- radius scale (squircles + labels)
- typography size ramp (text + label rows)
- typography weight specimens (text + label rows)
- elevation deck (cards + labels)
- motion timing strips (duration bars + labels)

Theme-variant sections (surface, text, border, state, elevation) carry
the right `appliedTokens` bindings — verified by `tests/foundations.test.mjs`
and visible in the Penpot Design panel — but the live captures render
their literal fallback fills (see Known gap below).

## Verdict

- [x] Backup written: `.penpot-backups/odoo-19-0-design-system_2026-05-18T02-44-29-564Z.json` (2.2 MB, all 12 pages at revn=119, gitignored)
- [x] **184 specimens authored** on Foundations page — all matching `docs/penpot/specs/foundations.json` per `tests/foundations.test.mjs`
- [x] **Theme-variant tokens bound, not hard-coded** — `color.surface.*`, `color.text.*`, `color.border.*`, `color.state.*` shapes carry `appliedTokens.{fill,stroke-color}` pointing at the right token name
- [x] **Theme-invariant tokens bound** — brand/portal/bucket/neutral/ext/spacing/radius/typography use `fill`, `width`, `r1..r4`, `font-size`, `font-weight` bindings
- [x] **Elevation literal-shadowed** — Penpot's tokensLib doesn't accept `shadow` as a bindable token type, so elevation cards carry literal `shadow` arrays with values pulled from the DTCG JSON's `theme-light.elevation.*`. Phase 3+ revisits once Penpot ships shadow bindings.
- [x] **Motion section literal-only** — `duration` and `cubicBezier` are not in Penpot's `TokenType` enum; the section is text-and-bar reference, with values pulled from the DTCG JSON's `global.motion.*`.
- [x] 3 screenshots in GCS at `gs://ledo-pr-assets/odoo-design-system/phase-2/`
- [x] CI workflows green (`test.yml`, `penpot-token-sync.yml`)
- [x] Idempotent build — re-running `scripts/penpot-build-phase-2-specimens.mjs` reports `nothing to do — N shapes already in place.`

### Known gap — theme-toggle visual re-skin (carried from Phase 1)

The `appliedTokens` bindings are present on every theme-variant shape;
the build script + tests verify this at the data layer. Driving the
canvas to actually **render** those shapes against a non-light theme
remains brittle:

1. Penpot REST `update-file` with `set-active-token-themes` (path
   format `/<themeName>`) correctly mutates `$metadata.activeThemes`
   AND `$metadata.activeSets` server-side — verified after every call.
2. Playwright's `page.reload({waitUntil: "load"})` between theme batches
   does NOT cause the Penpot SPA to re-resolve `appliedTokens` for the
   newly-active theme. The captured `*-dark.png` and
   `*-high-contrast.png` render with the literal fallback fills.

**Follow-up** (still tracked in Phase 2/3 docs):

- Drive activation via in-UI TOKENS → THEMES → Apply click (Penpot's
  own button writes the SPA's per-session source).
- Or capture each theme with a fresh `browser.newContext()` (no shared
  cache).
- Or wait for [penpot-mcp](https://github.com/penpot/penpot-mcp) to ship
  a `set-active-theme` tool that does the equivalent.

A manual TOKENS → THEMES → Apply click in Penpot's UI **does** visibly
re-skin every Foundations specimen — designer-confirmed. The contract
test (`tests/foundations.test.mjs`) is the durable signal that the data
layer is correct; the visual capture is the brittle part.

**Run by:** Claude (auto mode, 2026-05-18 UTC)

**Notes / discoveries during build:**

- Penpot **silently normalises** `applied-tokens` keys on read:
  `stroke-color` → `strokeColor`, `font-size` → `fontSize`,
  `font-weight` → `fontWeight`. The test compensates by camel-casing
  expected keys before comparison.
- Penpot's rect fill-color validator rejects 8-digit hex with alpha
  (e.g. `#0000007F`). The `color.surface.overlay` swatch uses a
  representative `#3D3D3D` literal fill alongside its
  `appliedTokens.fill` binding to keep the value resolution honest
  while still passing schema validation.
- Penpot's rect `shadow` schema requires `{id, style, offset-x, offset-y,
  blur, spread, hidden, color: {color, opacity}}` — `color` is a nested
  object, not a flat hex. The build script's `elevationDeck()` emitter
  reshapes the spec's flat literal into this canonical form.
- The Phase 1 `__phase1.bg` rect is `locked`/`blocked` — attempting to
  `mod-obj` it (to grow the canvas to 2520 px tall) triggers a
  server-side rect validator. Phase 2 leaves it alone; specimens
  render past y=900 on Penpot's infinite canvas without issue.
