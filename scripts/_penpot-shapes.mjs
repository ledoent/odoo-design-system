// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Shape builders for Penpot `add-obj` change ops. Penpot 2.15 expects
// rects and texts to carry a full geometric envelope (selrect, points,
// transform pair) alongside the bare x/y/width/height — re-computing
// the envelope manually at each call site invites geometric-validator
// 500s and silent drift between scripts.
//
// Phase 1 (`penpot-build-phase-1-skeleton.mjs`) and Phase 2
// (`penpot-build-phase-2-specimens.mjs`) both author shapes; before
// this module they each carried near-identical `makeRect` / `makeText`
// inline. Now both import from here.
//
// Conventions:
//
//   - All shapes set `frame-id` and `parent-id` to `ROOT_FRAME_ID`
//     (synthetic page-root frame). Nested-frame shapes are not a
//     phase-2 concern yet.
//   - Fill / stroke / shadow are PCS kebab-case on write; Penpot
//     normalises them to camelCase on read.
//   - `applied-tokens` on the shape uses kebab-case keys
//     (`stroke-color`, `font-size`, `font-weight`); Penpot returns
//     them as camelCase (`strokeColor`, `fontSize`, `fontWeight`).
//     `docs/penpot/specs/token-fill.json` documents the supported keys.
//   - Shadows are normalised here from a flat literal
//     `{offset-x, offset-y, blur, spread, color, opacity}` into the
//     full Penpot shape `{id, style, ..., hidden, color: {color,
//     opacity}}`.

import {randomUUID} from "node:crypto";

import {ROOT_FRAME_ID} from "./_penpot-rpc.mjs";

const IDENTITY_TRANSFORM = {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0};

export function rectSelrect(x, y, w, h) {
    return {x, y, x1: x, y1: y, x2: x + w, y2: y + h, width: w, height: h};
}

export function rectPoints(x, y, w, h) {
    return [{x, y}, {x: x + w, y}, {x: x + w, y: y + h}, {x, y: y + h}];
}

/**
 * Build a Penpot rect change-op `obj`.
 *
 * @param {object} args
 * @param {string} args.id           — UUID (caller provides; allows
 *                                     idempotent name → id lookup).
 * @param {string} args.name         — `__phaseN.<section>.<key>` per convention.
 * @param {number} args.x, args.y, args.w, args.h
 * @param {string|null} [args.fillColor] — 6-digit hex (Penpot rejects
 *                                         8-digit alpha). `null` → no fill.
 * @param {number} [args.fillOpacity=1]
 * @param {object} [args.appliedTokens] — `{key: "<group.prefixed.token>"}`.
 * @param {string} [args.strokeColor]   — hex; emits `strokes` array.
 * @param {number} [args.strokeWidth=2]
 * @param {object} [args.shadow]        — flat literal (see header doc).
 * @param {number} [args.radius]        — uniform corner radius (sets r1..r4).
 * @param {boolean} [args.locked=false] — sets `blocked: true`.
 * @param {string} [args.frameId=ROOT_FRAME_ID]  — owning frame (defaults
 *                                     to page root; override when
 *                                     nesting inside a Penpot frame).
 * @param {string} [args.parentId=frameId|ROOT]  — z-order parent; almost
 *                                     always equal to `frameId`.
 */
export function makeRect({
    id, name, x, y, w, h,
    fillColor, fillOpacity = 1, appliedTokens,
    strokeColor, strokeWidth, shadow, radius, locked = false,
    frameId = ROOT_FRAME_ID, parentId,
}) {
    const o = {
        id, type: "rect", name,
        x, y, width: w, height: h, rotation: 0,
        "frame-id": frameId, "parent-id": parentId || frameId,
        fills: fillColor === null
            ? []
            : [{"fill-color": fillColor, "fill-opacity": fillOpacity}],
        selrect: rectSelrect(x, y, w, h),
        points: rectPoints(x, y, w, h),
        transform: IDENTITY_TRANSFORM,
        "transform-inverse": IDENTITY_TRANSFORM,
    };
    if (appliedTokens) o["applied-tokens"] = appliedTokens;
    if (strokeColor) {
        o.strokes = [{
            "stroke-style": "solid",
            "stroke-alignment": "inner",
            "stroke-width": strokeWidth || 2,
            "stroke-color": strokeColor,
            "stroke-opacity": 1,
        }];
    }
    if (shadow) {
        o.shadow = [normaliseShadow(shadow)];
    }
    if (typeof radius === "number") {
        o["r1"] = radius;
        o["r2"] = radius;
        o["r3"] = radius;
        o["r4"] = radius;
    }
    if (locked) o.blocked = true;
    return o;
}

/**
 * Build a Penpot text change-op `obj`.
 *
 * @param {object} args
 * @param {string} args.id, args.name
 * @param {number} args.x, args.y, args.w, args.h
 * @param {string} args.content       — the visible text.
 * @param {number} [args.fontSize=14]
 * @param {string} [args.fill="#212529"] — hex; sets both shape `fills`
 *                                         and run `fill-color`.
 * @param {string} [args.weight="400"]
 * @param {string} [args.fontFamily="sourcesanspro"]
 * @param {string} [args.fontId="gfont-sourcesanspro"]
 * @param {object} [args.appliedTokens]
 * @param {"auto-width"|"auto-height"|"fixed"} [args.growType="auto-height"]
 */
export function makeText({
    id, name, x, y, w, h, content,
    fontSize = 14, fill = "#212529", weight = "400",
    fontFamily = "sourcesanspro", fontId = "gfont-sourcesanspro",
    appliedTokens, growType = "auto-height",
    frameId = ROOT_FRAME_ID, parentId,
}) {
    const o = {
        id, type: "text", name,
        x, y, width: w, height: h, rotation: 0,
        "frame-id": frameId, "parent-id": parentId || frameId,
        "grow-type": growType,
        fills: [{"fill-color": fill, "fill-opacity": 1}],
        content: {
            type: "root",
            children: [{
                type: "paragraph-set",
                children: [{
                    type: "paragraph",
                    children: [{
                        text: content,
                        "font-family": fontFamily,
                        "font-id": fontId,
                        "font-size": String(fontSize),
                        "font-style": "normal",
                        "font-weight": weight,
                        "text-decoration": "none",
                        "text-transform": "none",
                        "fill-color": fill,
                        "fill-opacity": 1,
                    }],
                }],
            }],
        },
        selrect: rectSelrect(x, y, w, h),
        points: rectPoints(x, y, w, h),
        transform: IDENTITY_TRANSFORM,
        "transform-inverse": IDENTITY_TRANSFORM,
    };
    if (appliedTokens) o["applied-tokens"] = appliedTokens;
    return o;
}

/**
 * Build a Penpot frame change-op `obj`. Frames are the only shape type
 * (along with `:group`) that Penpot's Assets-panel thumbnail renderer
 * accepts as a component's `main-instance` root — see
 * `frontend/src/app/main/render.cljs :: component-svg` `case` block.
 * Pointing `add-component.main-instance-id` at a bare `:rect` crashed
 * the panel with `Error: No matching clause: rect` (PR
 * `ledoent/penpot#1`). Phase 3a now always wraps the main instance in a
 * frame, and the validator in `ctkl/add-component` rejects bad writes.
 *
 * @param {object} args
 * @param {string} args.id          — UUID (caller-provided for idempotency).
 * @param {string} args.name        — `__phaseN.<section>.<key>`.
 * @param {number} args.x, args.y, args.w, args.h
 * @param {string[]} args.children  — ordered child shape IDs (top-most last).
 *                                    Each child shape MUST be emitted with
 *                                    `frameId: <frame-id>` so Penpot wires the
 *                                    `frame-id` / `parent-id` correctly.
 * @param {string|null} [args.fillColor=null] — frame fill; `null` → transparent.
 */
export function makeFrame({
    id, name, x, y, w, h, children,
    fillColor = null,
}) {
    return {
        id, type: "frame", name,
        x, y, width: w, height: h, rotation: 0,
        "frame-id": ROOT_FRAME_ID, "parent-id": ROOT_FRAME_ID,
        shapes: children,
        fills: fillColor === null
            ? []
            : [{"fill-color": fillColor, "fill-opacity": 1}],
        strokes: [],
        selrect: rectSelrect(x, y, w, h),
        points: rectPoints(x, y, w, h),
        transform: IDENTITY_TRANSFORM,
        "transform-inverse": IDENTITY_TRANSFORM,
        "hide-fill-on-export": false,
        "show-content": true,
        "hide-in-viewer": false,
        "proportion-lock": false,
    };
}

/**
 * Normalise a flat shadow literal `{offset-x, offset-y, blur, spread,
 * color, opacity}` into Penpot's full schema with nested color object
 * and required `id`/`style`/`hidden` fields. Returns `null` for falsy
 * input (a sentinel for elevation-0 / no shadow).
 */
export function normaliseShadow(s) {
    if (!s) return null;
    return {
        id: randomUUID(),
        style: s.style || "drop-shadow",
        "offset-x": s["offset-x"],
        "offset-y": s["offset-y"],
        blur: s.blur,
        spread: s.spread,
        hidden: false,
        color: {color: s.color, opacity: s.opacity},
    };
}
