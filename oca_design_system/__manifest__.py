# Copyright 2026 Ledo / Subteno — design system seed for OCA UI work.
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).

{
    "name": "OCA Design System (Odoo 19)",
    "summary": "Shared OWL components + CSS tokens for OCA UI consistency",
    "version": "19.0.1.0.0",
    "category": "Tools",
    "license": "LGPL-3",
    "website": "https://github.com/ledoent/oca-design-system",
    "author": "Ledo, Odoo Community Association (OCA)",
    "depends": ["web"],
    "data": [
        "views/menu.xml",
    ],
    "assets": {
        "web.assets_backend": [
            # SCSS — tokens must concatenate first, then component styles.
            "oca_design_system/static/src/scss/_tokens.scss",
            "oca_design_system/static/src/scss/components.scss",
            "oca_design_system/static/src/scss/showcase.scss",
            # OWL components
            "oca_design_system/static/src/components/chip/chip.esm.js",
            "oca_design_system/static/src/components/chip/chip.xml",
            "oca_design_system/static/src/components/initials_avatar/initials_avatar.esm.js",
            "oca_design_system/static/src/components/initials_avatar/initials_avatar.xml",
            "oca_design_system/static/src/components/card_tile/card_tile.esm.js",
            "oca_design_system/static/src/components/card_tile/card_tile.xml",
            # Showcase client action
            "oca_design_system/static/src/showcase/showcase.esm.js",
            "oca_design_system/static/src/showcase/showcase.xml",
        ],
        "web.assets_frontend": [
            # Tokens are also available on the portal/website side so OCA
            # frontend modules can consume `--oca-accent` etc.
            "oca_design_system/static/src/scss/_tokens.scss",
        ],
    },
    "installable": True,
    "application": False,
}
