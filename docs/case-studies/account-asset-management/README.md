# `account_asset_management` 19.0 — visual review case study

A designer-facing review of the OCA `account_asset_management` UI surfaces, captured against the freshly-migrated 19.0 codebase from PR [#2293](https://github.com/OCA/account-financial-tools/pull/2293).

## Why

PR #2293 forward-ports `account_asset_management` from 18.0 to 19.0 and bundles three sibling fixes (#2237/#2193/#2232). Tests pass and the module installs cleanly, but no one has yet looked at the *visual* surfaces with a designer's eye. This Penpot file is the canvas: each main view becomes a page, screenshots embed as frames, and annotations capture design opportunities (consolidate columns, freeze headers, simplify wizards, etc.).

The same pattern lives at `../dms/` for the DMS module — that one is a before/after migration showcase; this one is a single-version review (no 18.0 baseline included).

## Where things live

| Artifact | Path |
|---|---|
| Penpot project (Ledo web team) | `OCA — account_asset_management 19.0 review` |
| Penpot file | `Asset Management — 19.0 visual review` (8 pages) |
| Screenshots (public GCS) | `gs://ledo-pr-assets/oca-asset-mgmt-review/*.png` |
| Demo DB used for captures | `oca_review_account_financial_tools_pr2206_19` (Odoo 19.0, port 8169) |

## How to reproduce

```bash
# 1. Confirm review DB has the module installed (existing oca-review work covers this).
docker exec odoo-db-prod-19 psql -U odoo -d oca_review_account_financial_tools_pr2206_19 \
  -c "SELECT name, state FROM ir_module_module WHERE name='account_asset_management';"

# 2. Seed demo data (3 profiles + 5 assets across states; idempotent if you skip on duplicate).
python3 scripts/seed-demo.py

# 3. Capture screenshots (writes to /tmp/asset-mgmt-shots/).
node scripts/capture-screenshots.mjs

# 4. Upload to public GCS bucket.
gcloud storage cp /tmp/asset-mgmt-shots/*.png gs://ledo-pr-assets/oca-asset-mgmt-review/

# 5. Bootstrap the Penpot project + file + pages.
PENPOT_TOKEN=$(grep '^PENPOT_TOKEN=' ../../.env | cut -d= -f2-) \
PENPOT_TEAM_ID=442b344a-1ecc-8198-8008-0771673d374d \
node scripts/bootstrap-penpot.mjs

# 6. Open the printed URL, drag each frame's GCS src into the matching page.
```

## Pages

See `surfaces.json` for the canonical manifest. Eight pages:

1. **Assets — list** (5 demo assets, mixed Draft / Running)
2. **Asset — form (open)** (validated, depreciation board visible)
3. **Asset — depreciation board** (scrolled detail)
4. **Asset Profiles — list** (3 demo profiles)
5. **Asset Profile — form** (accounts + method config)
6. **Compute Depreciation wizard**
7. **Asset Report wizard (XLS export)**
8. **Asset Groups** (taxonomy; currently empty in demo)

## Known gotchas

- **Bootstrap is not idempotent.** Re-running `bootstrap-penpot.mjs` creates a second Penpot project with the same name. Penpot's REST API has no `create-or-update` for projects. If you re-bootstrap, delete the old project via the Penpot UI first.
- **Frame placement is manual.** The bootstrap script prints "drag $URL into the page" — Penpot's `add-obj` change-set for image refs is brittle across versions and we don't automate it. Designer drops the image into Penpot's canvas manually.
- **Seed script asset-creation may need re-running** if the review DB gets refreshed. The seed is XML-RPC against port 8169, not a true demo-data fixture.
