# Phase 0 — Verification

> Status: **draft** (run the steps below, paste verdict + screenshot URLs at the bottom).
> Phase: [`PHASED_BUILDOUT.md`](../PHASED_BUILDOUT.md) → Phase 0 (tokens + theme machinery)

## What this proves

`data-theme` on `<html>` is the only switch the generated SCSS reads.
Toggling it must visibly re-skin the showcase without any reload, and
the Penpot file's Tokens panel must hold three theme overlay sets. If
both hold, Phase 0 is done; subsequent phases can rely on token-driven
re-skin behavior.

## Pre-flight

```sh
# 1. Start local Odoo 19 (the doodba dev image).
cd /Users/dkendall/projects/ledoent/erp
make dev                                                  # Odoo on :8069

# 2. Install / upgrade the module (after the manifest bump to 19.0.3.0.0).
make update-module-prod MODULE=odoo_design_system         # or via Apps UI

# 3. Confirm the route loads (logged-in session in your browser):
#    http://localhost:8069/odoo/action-odoo_design_system.action_showcase
```

## Automated path — Playwright

Pre-flight: capture an authenticated session once into a storageState
file. Skip if your Odoo dev DB allows anonymous access to the showcase.

```sh
# Capture a logged-in cookie jar for the dev DB.
pnpm exec playwright open \
    --save-storage=/tmp/odoo-storage.json \
    http://localhost:8069/web/login
# … log in via the browser window, then close it.
```

Then run the spec from this repo's root:

```sh
PW_ODOO_URL=http://localhost:8069 \
PW_STORAGE_STATE=/tmp/odoo-storage.json \
    pnpm run test:e2e
```

Source: [`tests/e2e/showcase.theme.spec.ts`](../../../tests/e2e/showcase.theme.spec.ts).
It asserts:

1. `html[data-theme]` flips when each switcher button is clicked.
2. `--ods-surface-canvas` resolves to a different value in dark mode.
3. `--ods-text-primary` resolves to at least two distinct values across
   the three themes.

If the spec passes, the Odoo-side wiring is healthy.

## Manual path — `/browse` (Claude harness) or DevTools

The `/browse` skill ships a Playwright daemon. Drive the same flow
without writing a spec:

```
browse goto http://localhost:8069/odoo/action-odoo_design_system.action_showcase
browse wait .ods_showcase
browse screenshot /tmp/pr-<N>/showcase-light.png
browse js "document.querySelector('.ods_theme_switcher__btn[data-theme=\"dark\"]').click()"
browse screenshot /tmp/pr-<N>/showcase-dark.png
browse js "document.querySelector('.ods_theme_switcher__btn[data-theme=\"high-contrast\"]').click()"
browse screenshot /tmp/pr-<N>/showcase-hc.png

# Read computed CSS vars across themes:
browse js "(() => {
    const r = document.documentElement;
    const read = name => getComputedStyle(r).getPropertyValue(name).trim();
    const out = {};
    for (const t of ['light', 'dark', 'high-contrast']) {
        r.dataset.theme = t;
        out[t] = {canvas: read('--ods-surface-canvas'), text: read('--ods-text-primary')};
    }
    r.dataset.theme = 'light';
    return JSON.stringify(out, null, 2);
})()"
```

Expected (canvas may equal across light + high-contrast — the dark
canvas is the proof):

```json
{
  "light":         {"canvas": "#ffffff", "text": "#212529"},
  "dark":          {"canvas": "#0f1115", "text": "#f8f9fa"},
  "high-contrast": {"canvas": "#ffffff", "text": "#000000"}
}
```

## Penpot side

Open the canonical file in your browser:

```
https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553&layout=tokens
```

In the **Tokens** sidebar (left, third tab) check for:

- 4 sets in `$metadata.tokenSetOrder`: `global`, `theme-light`, `theme-dark`, `theme-high-contrast`
- Themes dropdown lists `light` / `dark` / `high-contrast`
- Total token count ≥ 120 (current actual: 181 — 106 global + 25 × 3 themes)

Take a single screenshot of the panel for the PR body:

```
browse goto "https://design.hz.ledoweb.com/#/workspace?team-id=…&file-id=…&layout=tokens"
browse screenshot /tmp/pr-<N>/penpot-tokens-panel.png
```

## Upload + embed

```sh
gcloud storage cp /tmp/pr-<N>/*.png \
    gs://ledo-pr-assets/oca-design-system/pr-<N>/
```

PR body then embeds via:

```
https://storage.googleapis.com/ledo-pr-assets/oca-design-system/pr-<N>/showcase-light.png
https://storage.googleapis.com/ledo-pr-assets/oca-design-system/pr-<N>/showcase-dark.png
https://storage.googleapis.com/ledo-pr-assets/oca-design-system/pr-<N>/showcase-hc.png
https://storage.googleapis.com/ledo-pr-assets/oca-design-system/pr-<N>/penpot-tokens-panel.png
```

## Verdict

**Run by:** Claude (dkendall@ledoweb.com session), 2026-05-17 — Phase 0 implementation.

### Pre-merge evidence (committed)

- [x] `pnpm run tokens` produces SCSS with 3 theme blocks (`:root,[data-theme=light]`, `[data-theme=dark]`, `[data-theme=high-contrast]`)
- [x] `pnpm run tokens:check` ✓ green (idempotent re-run produces no diff after stage)
- [x] `pnpm run test` ✓ all 9 token + SCSS contract tests pass
- [x] DTCG JSON shape: 4 sets / 181 tokens (`global=106`, `theme-light=25`, `theme-dark=25`, `theme-high-contrast=25`); meets the ≥120 threshold
- [x] Dart-sass compiles `_tokens.generated.scss` + `showcase.scss` to clean CSS

### Standalone-preview screenshots (gs://ledo-pr-assets/oca-design-system/phase-0/)

Captured against a static HTML page that consumes the dart-sass-compiled
output of `_tokens.generated.scss` + `showcase.scss`. This validates the
**SCSS contract** — that `data-theme` on `<html>` is the only switch
needed to re-skin every `--ods-*` consumer — independently of Odoo.

- Light: https://storage.googleapis.com/ledo-pr-assets/oca-design-system/phase-0/showcase-light.png
- Dark:  https://storage.googleapis.com/ledo-pr-assets/oca-design-system/phase-0/showcase-dark.png
- High contrast: https://storage.googleapis.com/ledo-pr-assets/oca-design-system/phase-0/showcase-hc.png

Live-DOM token reads at the time of capture:

```json
{
  "light":         {"canvas": "#ffffff", "text": "#212529", "elevation-1": "0px 1px 3px 0px rgba(0, 0, 0, 0.08)"},
  "dark":          {"canvas": "#0f1115", "text": "#f8f9fa", "elevation-1": "0px 1px 3px 0px rgba(0, 0, 0, 0.40)"},
  "high-contrast": {"canvas": "#ffffff", "text": "#000000", "border": "#000000", "elevation-1": "0px 0px 0px 1.5px #000000"}
}
```

### Still pending before merge

- [ ] Live Odoo run: `make dev` in `ledoent/erp`, upgrade `odoo_design_system` to `19.0.3.0.0`, run `PW_ODOO_URL=http://localhost:8069 pnpm run test:e2e` ([showcase.theme.spec.ts](../../../tests/e2e/showcase.theme.spec.ts)). Requires deploy auth (docker rebuild or container hot-patch) that this session did not have.
- [ ] Penpot seed: open the file's Tokens panel, **SETS → kebab menu → Import JSON**, drop `design-system.dtcg.json` in (see [`docs/penpot/README.md` → Bulk-importing the JSON](../README.md)). Then re-run `node scripts/penpot-export-tokens.mjs odoo_design_system/static/src/tokens/design-system.dtcg.json` to canonicalize. Screenshot the Tokens panel.
- [ ] `penpot-token-sync.yml` green against the pushed JSON.

### Notes / regressions found during implementation

- DTCG token references in a multi-set file must be fully-qualified (`{global.color.neutral.500}`, not `{color.neutral.500}`). Style-dictionary v5 reports the bare paths as "not defined."
- Style-dictionary's reference parser interprets `{...}` inside `$description` as a token reference. Avoided by phrasing descriptions without curly braces (e.g. "Legacy alias of radius.lg" instead of "should reference {radius.lg}").
- `$themes` and `$metadata` at JSON root needed a custom `json-strip-meta` parser registered in `style-dictionary.config.js`; style-dictionary otherwise warns/errors on the non-token entries.
- Pre-existing `_tokens.generated.scss` had stale `--ods-card-lift-*` lines from a previously-deleted `motion.*` group. Phase 0 reconciles that as a side effect of the regen.
