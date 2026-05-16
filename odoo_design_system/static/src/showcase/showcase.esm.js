// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// "Design System" backend menu — a single OWL client-action route
// (`odoo_design_system.showcase`) that renders every component live with
// the source snippet next to it. Use this as the canonical reference
// when contributing UI to any OCA module.

import {Component} from "@odoo/owl";
import {registry} from "@web/core/registry";
import {OdsChip} from "../components/chip/chip.esm";
import {OdsInitialsAvatar} from "../components/initials_avatar/initials_avatar.esm";
import {OdsCardTile} from "../components/card_tile/card_tile.esm";

export class OdsShowcase extends Component {
    static template = "odoo_design_system.Showcase";
    static components = {OdsChip, OdsInitialsAvatar, OdsCardTile};

    static props = {
        // Standard client-action props passed by the action service.
        action: {type: Object, optional: true},
        actionId: {type: [Number, Boolean], optional: true},
        className: {type: String, optional: true},
        globalState: {type: Object, optional: true},
        "*": {optional: true},
    };

    // Token reference — kept in sync with _tokens.scss and components.scss.
    get tokens() {
        return [
            {name: "--ods-accent", value: "var(--o-gray-500, #adb5bd)", purpose: "Per-identity tint (set per element)"},
            {name: "--ods-card-radius", value: "6px", purpose: "Standard tile / card radius"},
            {name: "--ods-card-shadow", value: "0 1px 3px rgba(0,0,0,0.08)", purpose: "Resting card shadow"},
            {name: "--ods-card-shadow-hover", value: "0 4px 18px rgba(0,0,0,0.08)", purpose: "Hover-lift shadow"},
            {name: "--ods-chip-radius", value: "999px", purpose: "Pill chip radius"},
            {name: "--ods-tile-size", value: "56px", purpose: "Square tile edge"},
            {name: "--ods-avatar-size", value: "22px", purpose: "Initials circle edge"},
            {name: "--ods-spine-width", value: "3px", purpose: "Card accent spine width"},
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
}

registry.category("actions").add(
    "odoo_design_system.showcase",
    OdsShowcase,
);
