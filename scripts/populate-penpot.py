#!/usr/bin/env python3
"""Populate the *Odoo 19.0 Design System* Penpot file with screenshots.

Pre-conditions
--------------
* `scripts/capture-stock-surfaces.sh` has already produced PNGs under
  `gs://ledo-pr-assets/odoo-design-system/stock-19.0/` (one per surface).
* The Penpot MCP plugin is connected to the file at
  `https://design.hz.ledoweb.com/#/workspace?team-id=442b344a-1ecc-8198-8008-0771673d374d&file-id=038df003-0f49-80b2-8008-0774e5399553`.
* The user's `PENPOT_TOKEN` env var is exported and Claude Code's MCP
  config points at `https://design.hz.ledoweb.com/mcp?userToken=<PAT>`
  with the SAME PAT used for the in-Penpot plugin.

What this script does
---------------------
1. Reads the SURFACE_MAP below.
2. For each surface, ensures the target page exists in the Penpot file
   (via REST `update-file` + `add-page` change op).
3. Hands the page→URL→caption mapping to `mcp__penpot__execute_code`
   (one tool call per surface, with a small sleep between to avoid the
   batched-uploadMediaUrl flakiness we saw on 2026-05-16).
4. Each `execute_code` call: opens the target page via `penpot.openPage`,
   uploads the image via `penpot.uploadMediaUrl(name, url)`, creates an
   image-fill Rectangle at (80, 80), and adds a Text caption below it
   citing the source surface + Odoo source paths.

This script is not directly run from the shell — it's a reference for
the per-surface payload structure. The actual execution is by Claude in
an interactive session, because `mcp__penpot__execute_code` is an MCP
tool that lives in Claude's tool list, not a stand-alone CLI.

SURFACE_MAP
-----------
Pinned to `odoo_19_review` and `ods_smoke` DBs running on the local
docker compose stack. The `route` field is what the `browse` skill
hits; the `caption` field is what lands on the Penpot canvas.
"""

import os

PENPOT_FILE_ID = "038df003-0f49-80b2-8008-0774e5399553"
PENPOT_TEAM_ID = "442b344a-1ecc-8198-8008-0771673d374d"
GCS_PREFIX = "https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/stock-19.0/"

SURFACE_MAP = [
    {
        "page_name": "04 — Apps grid (stock 19.0)",
        "image": GCS_PREFIX + "00-apps-page.png",
        "caption": (
            "Stock Odoo 19.0 — /odoo/apps  (admin@odoo_19_review @ localhost:8169)\n"
            "Source: addons/web/static/src/webclient/, addons/base/views/ir_module_views.xml"
        ),
    },
    {
        "page_name": "05 — Contacts list (stock 19.0)",
        "image": GCS_PREFIX + "contacts-list.png",
        "caption": (
            "Stock Odoo 19.0 — Contacts list (action base.action_partner_form on res.partner)\n"
            "Source: addons/web/static/src/views/list/ + addons/base/views/res_partner_views.xml"
        ),
    },
    {
        "page_name": "06 — Contacts form (stock 19.0)",
        "image": GCS_PREFIX + "contacts-form.png",
        "caption": (
            "Stock Odoo 19.0 — Contact form (res.partner record)\n"
            "Source: addons/web/static/src/views/form/form_controller.scss + base/views/res_partner_views.xml"
        ),
    },
    {
        "page_name": "07 — Users list (stock 19.0)",
        "image": GCS_PREFIX + "users-list.png",
        "caption": (
            "Stock Odoo 19.0 — Users list (res.users)\n"
            "Source: addons/base/views/res_users_views.xml"
        ),
    },
    {
        "page_name": "08 — Company form (stock 19.0)",
        "image": GCS_PREFIX + "company-form.png",
        "caption": (
            "Stock Odoo 19.0 — Company form (res.company)\n"
            "Source: addons/base/views/res_company_views.xml"
        ),
    },
    {
        "page_name": "09 — Countries list (stock 19.0)",
        "image": GCS_PREFIX + "countries-list.png",
        "caption": (
            "Stock Odoo 19.0 — Countries list (res.country)\n"
            "Source: addons/base/views/res_country_views.xml"
        ),
    },
    {
        "page_name": "10 — Settings (stock 19.0)",
        "image": GCS_PREFIX + "settings-general.png",
        "caption": (
            "Stock Odoo 19.0 — General Settings\n"
            "Source: addons/base_setup/views/res_config_settings_views.xml + "
            "addons/web/static/src/webclient/settings/"
        ),
    },
]

# The execute_code template that does the per-surface population.
# This is what Claude inlines into each mcp__penpot__execute_code call.
EXECUTE_CODE_TEMPLATE = """
await new Promise(r => setTimeout(r, 800));
const page = penpot.currentFile.pages.find(p => p.id === %(page_id)r);
penpot.openPage(page);
await new Promise(r => setTimeout(r, 400));
const media = await penpot.uploadMediaUrl(%(slug)r, %(url)r);
const rect = penpot.createRectangle();
rect.name = %(page_name)r;
rect.resize(media.width, media.height);
rect.x = 80; rect.y = 80;
rect.fills = [{ fillOpacity: 1, fillImage: media }];
const caption = penpot.createText(%(caption)r);
caption.x = 80;
caption.y = 80 + media.height + 24;
caption.resize(media.width, 60);
caption.fontSize = 14;
return { rect: rect.id, caption: caption.id, w: media.width, h: media.height };
"""


def main():
    """Pretty-print the surface map for reference."""
    print(f"Penpot file: {PENPOT_FILE_ID}")
    print(f"Workspace URL: https://design.hz.ledoweb.com/#/workspace?team-id={PENPOT_TEAM_ID}&file-id={PENPOT_FILE_ID}")
    print()
    print("Surfaces:")
    for s in SURFACE_MAP:
        print(f"  • {s['page_name']}")
        print(f"      image: {s['image']}")
        print(f"      first line of caption: {s['caption'].splitlines()[0]}")


if __name__ == "__main__":
    main()
