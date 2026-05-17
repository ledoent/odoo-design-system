# Copyright 2026 Ledo / Subteno — design system seed for OCA UI work.
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

{
    "name": "OCA Design System (Odoo 19)",
    "summary": "Shared OWL components + CSS tokens for OCA UI consistency",
    "version": "19.0.3.0.0",
    "category": "Tools",
    "license": "LGPL-3",
    "website": "https://github.com/ledoent/odoo-design-system",
    "author": "Ledo, Odoo Community Association (OCA)",
    "depends": ["web"],
    "data": [
        "views/menu.xml",
    ],
    "assets": {
        "web.assets_backend": [
            # SCSS — `_tokens.generated.scss` carries the palette maps + :root
            # CSS variables (regenerated from `static/src/tokens/design-system.dtcg.json`
            # by `pnpm run tokens`); `_tokens.scss` adds the hand-written
            # hash helpers + mixins that consume those maps. Order matters:
            # the generated maps must be in scope before the helpers reference
            # them. `components.scss` then consumes the mixins.
            "odoo_design_system/static/src/scss/_tokens.generated.scss",
            "odoo_design_system/static/src/scss/_tokens.scss",
            "odoo_design_system/static/src/scss/components.scss",
            "odoo_design_system/static/src/scss/showcase.scss",
            # OWL components
            "odoo_design_system/static/src/components/chip/chip.esm.js",
            "odoo_design_system/static/src/components/chip/chip.xml",
            "odoo_design_system/static/src/components/initials_avatar/initials_avatar.esm.js",
            "odoo_design_system/static/src/components/initials_avatar/initials_avatar.xml",
            "odoo_design_system/static/src/components/card_tile/card_tile.esm.js",
            "odoo_design_system/static/src/components/card_tile/card_tile.xml",
            "odoo_design_system/static/src/components/icon/icon.esm.js",
            "odoo_design_system/static/src/components/icon/icon.xml",
            # Showcase client action
            "odoo_design_system/static/src/showcase/showcase.esm.js",
            "odoo_design_system/static/src/showcase/showcase.xml",
        ],
        "web.assets_frontend": [
            # Tokens are also available on the portal/website side so OCA
            # frontend modules can consume `--ods-accent` etc.
            "odoo_design_system/static/src/scss/_tokens.generated.scss",
            "odoo_design_system/static/src/scss/_tokens.scss",
        ],
    },
    "installable": True,
    "application": False,
}
