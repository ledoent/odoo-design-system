// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// <OdsCardTile accent="ext" dataExt="pdf">  — 56px square thumbnail
// tile carrying an icon or preview image on a tinted background.
// Tint is keyed off `data-ext` (per file extension) or `data-initial`
// (per directory / record name hash).

import {Component} from "@odoo/owl";

export class OdsCardTile extends Component {
    static template = "odoo_design_system.OdsCardTile";

    static props = {
        // accent: "ext" — tint by file extension data-ext attribute
        //         "initial" — tint by first-letter hash of `name`
        //         "preview" — drop the chrome treatment so a real photo reads as a photo
        accent: {type: String, optional: true},
        dataExt: {type: String, optional: true},
        name: {type: String, optional: true},
        imgSrc: {type: String, optional: true},
        imgAlt: {type: String, optional: true},
        size: {type: [String, Number], optional: true},
        slots: {type: Object, optional: true},
    };

    static defaultProps = {
        accent: "ext",
        imgAlt: "",
    };

    get className() {
        return this.props.accent === "preview"
            ? "ods_card_tile ods_card_tile--preview"
            : "ods_card_tile";
    }

    get initial() {
        if (this.props.accent !== "initial") return null;
        return (this.props.name || "?").trim().charAt(0).toUpperCase() || "?";
    }

    get style() {
        if (this.props.size) {
            const px = typeof this.props.size === "number"
                ? `${this.props.size}px`
                : this.props.size;
            return `--ods-tile-size: ${px}`;
        }
        return "";
    }
}
