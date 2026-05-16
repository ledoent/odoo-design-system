// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// <OdsIcon name="folder-open" set="lucide" size="20"/>
//
// Renders an SVG glyph from one of the bundled OSS icon sets:
//
//   set="lucide"           — Lucide (ISC), ~1700 line icons, 24×24 source
//   set="heroicons"        — Heroicons outline (MIT), 24×24
//   set="heroicons-solid"  — Heroicons solid (MIT), 24×24
//   set="heroicons-mini"   — Heroicons mini-solid (MIT), 20×20
//
// The glyph itself is fetched via plain <img> against the addon's
// static path, so the SVG is cacheable by the browser and the CSS
// `currentColor` rules in each set carry the OWL component's color.

import {Component} from "@odoo/owl";

const SET_PATHS = {
    "lucide": "/odoo_design_system/static/icons/lucide",
    "heroicons": "/odoo_design_system/static/icons/heroicons/outline",
    "heroicons-solid": "/odoo_design_system/static/icons/heroicons/solid",
    "heroicons-mini": "/odoo_design_system/static/icons/heroicons/mini",
};

export class OdsIcon extends Component {
    static template = "odoo_design_system.OdsIcon";

    static props = {
        name: {type: String},
        set: {type: String, optional: true},
        size: {type: [String, Number], optional: true},
        title: {type: String, optional: true},
        class: {type: String, optional: true},
    };

    static defaultProps = {
        set: "lucide",
        size: 20,
    };

    get url() {
        const base = SET_PATHS[this.props.set] || SET_PATHS.lucide;
        return `${base}/${this.props.name}.svg`;
    }

    get style() {
        const px =
            typeof this.props.size === "number"
                ? `${this.props.size}px`
                : this.props.size;
        return `width: ${px}; height: ${px}`;
    }

    get className() {
        return ["ods_icon", `ods_icon--${this.props.set}`, this.props.class || ""]
            .filter(Boolean)
            .join(" ");
    }
}
