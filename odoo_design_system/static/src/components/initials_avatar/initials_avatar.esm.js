// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// <OdsInitialsAvatar name="Mitchell Admin"/> — circle with the
// first-letter initial; tint hashed from the alphabet bucket palette.

import {Component} from "@odoo/owl";

export class OdsInitialsAvatar extends Component {
    static template = "odoo_design_system.OdsInitialsAvatar";

    static props = {
        name: {type: String, optional: true},
        // Override the displayed letter independently of the name (e.g. when
        // the data only exposes initials, not a full name).
        letter: {type: String, optional: true},
        title: {type: String, optional: true},
        size: {type: [String, Number], optional: true},
    };

    static defaultProps = {
        name: "",
    };

    get initial() {
        const raw = this.props.letter || this.props.name || "?";
        return raw.trim().charAt(0).toUpperCase() || "?";
    }

    get title() {
        return this.props.title || this.props.name;
    }

    get style() {
        if (this.props.size) {
            const px = typeof this.props.size === "number"
                ? `${this.props.size}px`
                : this.props.size;
            return `--ods-avatar-size: ${px}`;
        }
        return "";
    }
}
