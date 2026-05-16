// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// <OcaChip> — neutral label pill with tonal variants. Reads
// --oca-accent from the nearest ancestor (or from data-ext on itself).

import {Component} from "@odoo/owl";

export class OcaChip extends Component {
    static template = "oca_design_system.OcaChip";

    // variant: neutral (default) | ext | size | count | warning | success
    // icon:    optional Font Awesome class, rendered before the label
    // dataExt: when variant=ext, drives the --oca-accent tint via data-ext attr
    static props = {
        variant: {type: String, optional: true},
        icon: {type: String, optional: true},
        label: {type: [String, Number], optional: true},
        dataExt: {type: String, optional: true},
        slots: {type: Object, optional: true},
    };

    static defaultProps = {
        variant: "neutral",
    };

    get className() {
        const base = "oca_chip";
        const variant = this.props.variant;
        return variant && variant !== "neutral" ? `${base} ${base}--${variant}` : base;
    }
}
