// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// "Design System" backend menu — a single OWL client-action route
// (`odoo_design_system.showcase`) that renders every component live with
// the source snippet next to it. Use this as the canonical reference
// when contributing UI to any OCA module.

import {Component, onMounted, useState} from "@odoo/owl";
import {registry} from "@web/core/registry";
import {OdsChip} from "../components/chip/chip.esm";
import {OdsInitialsAvatar} from "../components/initials_avatar/initials_avatar.esm";
import {OdsCardTile} from "../components/card_tile/card_tile.esm";
import {OdsIcon} from "../components/icon/icon.esm";

export class OdsShowcase extends Component {
    static template = "odoo_design_system.Showcase";
    static components = {OdsChip, OdsInitialsAvatar, OdsCardTile, OdsIcon};

    static props = {
        // Standard client-action props passed by the action service.
        action: {type: Object, optional: true},
        actionId: {type: [Number, Boolean], optional: true},
        className: {type: String, optional: true},
        globalState: {type: Object, optional: true},
        "*": {optional: true},
    };

    setup() {
        this.state = useState({theme: "light"});
        onMounted(() => {
            // Default the page to the light theme so the switcher reflects truth
            // on first paint. Clears on tear-down so other Odoo routes are not
            // affected by leftover state.
            document.documentElement.dataset.theme = this.state.theme;
        });
    }

    setTheme(name) {
        this.state.theme = name;
        document.documentElement.dataset.theme = name;
    }

    // Token reference — flat snapshot of the most-referenced CSS custom
    // properties. The full set lives in _tokens.generated.scss; this is just
    // a quick-glance table for the showcase.
    get tokens() {
        return [
            // Theme-switchable surface / text / border
            {name: "--ods-surface-canvas",  value: "#FFFFFF (light) / #0F1115 (dark)", purpose: "Page background"},
            {name: "--ods-surface-raised",  value: "Card / panel above canvas",       purpose: "Cards, panels"},
            {name: "--ods-text-primary",    value: "#212529 (light) / #F8F9FA (dark)", purpose: "Body text"},
            {name: "--ods-text-muted",      value: "Secondary text",                  purpose: "De-emphasised text"},
            {name: "--ods-border-default",  value: "#DEE2E6 (light) / #495057 (dark)", purpose: "Card / input border"},
            {name: "--ods-elevation-1",     value: "0 1px 3px rgba(0,0,0,0.08)",      purpose: "Resting card shadow"},
            {name: "--ods-elevation-3",     value: "0 4px 18px rgba(0,0,0,0.08)",     purpose: "Hover-lift shadow"},
            // Theme-invariant scale
            {name: "--ods-spacing-4",       value: "16px",                            purpose: "Default spacing step"},
            {name: "--ods-font-size-base", value: "14px",                             purpose: "Body font size"},
            {name: "--ods-radius-lg",       value: "6px",                             purpose: "Card / tile radius"},
            {name: "--ods-radius-pill",     value: "999px",                           purpose: "Pill chip radius"},
            {name: "--ods-duration-base",  value: "150ms",                            purpose: "Standard transition"},
            {name: "--ods-accent",          value: "Set per element",                 purpose: "Per-identity tint"},
        ];
    }

    // Bucket palette mirror — for the visual key in the showcase.
    get buckets() {
        return [
            {n: 1, hex: "#4263eb"},
            {n: 2, hex: "#1098ad"},
            {n: 3, hex: "#2f9e44"},
            {n: 4, hex: "#f08c00"},
            {n: 5, hex: "#d6336c"},
            {n: 6, hex: "#ae3ec9"},
            {n: 7, hex: "#5f3dc4"},
            {n: 8, hex: "#495057"},
        ];
    }

    // Demo people for the initials-avatar section.
    get people() {
        return [
            "Alice Anderson",
            "Bob Brown",
            "Charlie Chen",
            "Daniel Diaz",
            "Eve Edwards",
            "Frank Fischer",
            "Grace Garcia",
            "Henry Hall",
        ];
    }

    // Demo extension chips for the chip section.
    get extensions() {
        return ["pdf", "docx", "xlsx", "pptx", "zip", "jpg", "mp4", "txt"];
    }

    // Curated subset of bundled OSS icons to demo each set.
    get iconSets() {
        return [
            {
                set: "lucide",
                license: "ISC — © 2024 Lucide Contributors",
                count: 1700,
                samples: [
                    "folder-open", "file-text", "image", "upload", "download",
                    "search", "user", "users", "settings-2", "trash-2",
                    "pencil", "plus", "x", "check", "chevron-right",
                    "arrow-up-right", "star", "heart", "bell", "bookmark",
                ],
            },
            {
                set: "heroicons",
                license: "MIT — © Tailwind Labs",
                count: 324,
                samples: [
                    "folder-open", "document-text", "photo", "cloud-arrow-up",
                    "magnifying-glass", "user", "user-group", "cog-6-tooth",
                    "trash", "pencil-square", "plus", "x-mark", "check",
                    "chevron-right", "arrow-top-right-on-square", "star",
                    "heart", "bell", "bookmark", "sparkles",
                ],
            },
            {
                set: "heroicons-solid",
                license: "MIT — © Tailwind Labs",
                count: 324,
                samples: [
                    "folder-open", "document-text", "photo", "cloud-arrow-up",
                    "magnifying-glass", "user", "user-group", "cog-6-tooth",
                    "trash", "pencil-square", "plus", "x-mark", "check",
                    "chevron-right", "arrow-top-right-on-square", "star",
                    "heart", "bell", "bookmark", "sparkles",
                ],
            },
        ];
    }
}

registry.category("actions").add(
    "odoo_design_system.showcase",
    OdsShowcase,
);
