#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 5 — Build form field widgets + chrome surfaces + sale.order mock
//            on "07 — Backend Templates".
//
// Creates:
//   60 field widget components  (12 widgets × 5 states, path "Form / Fields")
//   3  chrome components        (Sheet, FieldGroup, NotebookTab, path "Form / Chrome")
//   1  sale.order mock frame    (visual composition, prefix __phase5.mock.*)
//
// Idempotent: re-runs skip any component/shape that already exists by name.
//
// Usage:
//   PENPOT_TOKEN=<pat> node scripts/penpot-build-phase-5-form-widgets.mjs

import { randomUUID }                        from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, join }            from "node:path";
import { fileURLToPath }                     from "node:url";

import {
    CANONICAL_FILE_ID, FEATURES, ROOT_FRAME_ID,
    getFile, rpc, requireToken,
} from "./_penpot-rpc.mjs";
import { makeFrame, makeRect, makeText } from "./_penpot-shapes.mjs";

requireToken("penpot-build-phase-5-form-widgets.mjs");

const FILE_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const REPO    = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC    = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/form-widgets.json"), "utf8"));
const BACKUPS = resolve(REPO, ".penpot-backups");
const ROOT    = ROOT_FRAME_ID;

// --- safety: require a fresh (<24 h) snapshot --------------------------------
const TTL = 24 * 60 * 60 * 1000;
let snapshot = null;
try {
    for (const f of readdirSync(BACKUPS)) {
        const p = join(BACKUPS, f);
        if (p.endsWith(".json") && Date.now() - statSync(p).mtimeMs < TTL) {
            snapshot = p; break;
        }
    }
} catch { /* dir missing */ }
if (!snapshot) {
    console.error("No fresh snapshot in .penpot-backups/ (<24h old). Run `node scripts/penpot-snapshot.mjs` first.");
    process.exit(3);
}
console.error(`safety: ${snapshot.replace(REPO + "/", "")}`);

const PAGE_ID  = SPEC.page.id;
const D        = SPEC.defaults;
const STATES   = SPEC.states;
const WIDGETS  = SPEC.widgets;
const CHROME   = SPEC.chrome;
const MOCK     = SPEC.mock;

// ---------- stable variant-id (FNV-1a → v4-shaped uuid) --------------------
function variantIdFor(seed) {
    const bytes = new Uint8Array(16);
    let h = 0x811c9dc5n;
    const P = 0x01000193n;
    const data = new TextEncoder().encode(`phase-5:${seed}`);
    for (let i = 0; i < 16; i++) {
        for (const b of data) { h = BigInt.asUintN(32, (h ^ BigInt(b)) * P); }
        bytes[i] = Number((h >> BigInt(i % 24)) & 0xffn);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// ---------- color resolution -------------------------------------------------
// Resolves a colorKey from a state object.  Returns null when key is null or
// the state value is null (→ no fill / no stroke in shape builder).
function stateColor(state, key) {
    if (!key) return null;
    if (!(key in state)) throw new Error(`state "${state.name}" has no color key "${key}"`);
    return state[key];
}

// ---------- change-op envelope -----------------------------------------------
function addObjOp(obj, pageId) {
    return {
        type:        "add-obj",
        id:          obj.id,
        "page-id":   pageId,
        "frame-id":  obj["frame-id"] ?? ROOT,
        "parent-id": obj["parent-id"] ?? obj["frame-id"] ?? ROOT,
        obj,
    };
}

// ---------- shape builders for widget variant frames -------------------------
// Builds one (frame + children) for a widget × state combination.
function buildWidgetVariant(widget, state, frameY, frameX) {
    const frameId  = randomUUID();
    const childIds = [];
    const shapes   = [];

    for (const ch of widget.children) {
        const id   = randomUUID();
        childIds.push(id);
        const fill  = stateColor(state, ch.colorKey);
        const bord  = stateColor(state, ch.borderKey ?? null);
        // Invisible stand-in for null fill on text (no transparent text support in makeText)
        const textFill = fill ?? "#f8f9fa";

        const base = {
            x: (ch.x ?? 0) + frameX,
            y: (ch.y ?? 0) + frameY,
            w: ch.w,
            h: ch.h,
        };

        if (ch.type === "rect") {
            shapes.push(makeRect({
                id,
                name:         `__phase5.${widget.id}.${state.name}.${ch.role}`,
                ...base,
                fillColor:    fill,
                strokeColor:  bord,
                strokeWidth:  1,
                radius:       ch.radius,
                frameId,
                parentId: frameId,
            }));
        } else {
            shapes.push(makeText({
                id,
                name:       `__phase5.${widget.id}.${state.name}.${ch.role}`,
                ...base,
                content:    ch.content,
                fontSize:   ch.fontSize ?? 13,
                fill:       textFill,
                weight:     ch.weight ?? "400",
                fontFamily: D.fontFamily,
                fontId:     D.fontId,
                frameId,
                parentId: frameId,
            }));
        }
    }

    const frame = makeFrame({
        id:       frameId,
        name:     `__phase5.${widget.id}.${state.name}.main`,
        x:        frameX,
        y:        frameY,
        w:        widget.width,
        h:        widget.height,
        children: childIds,
        fillColor: null,
    });

    return { frameId, allShapes: [frame, ...shapes] };
}

// ---------- shape builders for chrome surfaces (fixed colors) ---------------
function buildChromeFrame(surf, frameY) {
    const frameId  = randomUUID();
    const childIds = [];
    const shapes   = [];

    for (const ch of surf.children) {
        const id = randomUUID();
        childIds.push(id);
        const base = { x: ch.x, y: ch.y + frameY, w: ch.w, h: ch.h };

        if (ch.type === "rect") {
            shapes.push(makeRect({
                id,
                name:        `__phase5.chrome.${surf.id}.${ch.role}`,
                ...base,
                fillColor:   ch.fillColor ?? null,
                strokeColor: ch.strokeColor ?? null,
                strokeWidth: ch.strokeWidth ?? 1,
                radius:      ch.radius,
                shadow:      ch.shadow ? {
                    "offset-x": 0, "offset-y": 4,
                    blur: 12, spread: 0, color: "#000000", opacity: 0.08,
                } : null,
                frameId,
                parentId: frameId,
            }));
        } else {
            shapes.push(makeText({
                id,
                name:       `__phase5.chrome.${surf.id}.${ch.role}`,
                ...base,
                content:    ch.content,
                fontSize:   ch.fontSize ?? 14,
                fill:       ch.fill ?? "#212529",
                weight:     ch.weight ?? "400",
                fontFamily: D.fontFamily,
                fontId:     D.fontId,
                frameId,
                parentId: frameId,
            }));
        }
    }

    const frame = makeFrame({
        id:       frameId,
        name:     `__phase5.chrome.${surf.id}.main`,
        x:        0,
        y:        frameY,
        w:        surf.width,
        h:        surf.height,
        children: childIds,
        fillColor: null,
    });

    return { frameId, allShapes: [frame, ...shapes] };
}

// ---------- shape builder for the sale.order mock ---------------------------
function buildMockFrame(mockY) {
    const frameId  = randomUUID();
    const childIds = [];
    const shapes   = [];

    for (const ch of MOCK.children) {
        const id = randomUUID();
        childIds.push(id);
        const base = { x: ch.x, y: ch.y + mockY, w: ch.w, h: ch.h };

        if (ch.type === "rect") {
            shapes.push(makeRect({
                id,
                name:        `__phase5.mock.${MOCK.id}.${ch.role}`,
                ...base,
                fillColor:   ch.fillColor ?? null,
                strokeColor: ch.strokeColor ?? null,
                strokeWidth: ch.strokeWidth ?? 1,
                radius:      ch.radius,
                frameId,
                parentId: frameId,
            }));
        } else {
            shapes.push(makeText({
                id,
                name:       `__phase5.mock.${MOCK.id}.${ch.role}`,
                ...base,
                content:    ch.content,
                fontSize:   ch.fontSize ?? 13,
                fill:       ch.fill ?? "#212529",
                weight:     ch.weight ?? "400",
                fontFamily: D.fontFamily,
                fontId:     D.fontId,
                frameId,
                parentId: frameId,
            }));
        }
    }

    const frame = makeFrame({
        id:       frameId,
        name:     `__phase5.mock.${MOCK.id}.main`,
        x:        0,
        y:        mockY,
        w:        MOCK.width,
        h:        MOCK.height,
        children: childIds,
        fillColor: null,
    });

    return { frameId, allShapes: [frame, ...shapes] };
}

// ---------- main -------------------------------------------------------------
async function main() {
    const file  = await getFile(FILE_ID);
    const { revn } = file;
    const vern = file.vern ?? 0;
    const page  = file.data?.pagesIndex?.[PAGE_ID];
    if (!page) { console.error(`Page ${PAGE_ID} not found.`); process.exit(1); }

    const existingComps  = Object.values(file.data?.components ?? {});
    const existingNames  = new Map(Object.values(page.objects ?? {}).map(s => [s.name, s]));

    const allChanges = [];
    let addedComps = 0, skippedComps = 0, addedShapes = 0;

    // ── Dynamic sectionY start ───────────────────────────────────────────────
    // Start below the bottommost Phase 4 shape to avoid overlap.
    const phase4Shapes = Object.values(page.objects ?? {})
        .filter(s => s.name?.startsWith("__phase4."));
    const phase4Bottom = phase4Shapes.length > 0
        ? Math.max(...phase4Shapes.map(s => (s.y ?? 0) + (s.height ?? s.h ?? 0)))
        : 1590;
    let sectionY = Math.ceil(phase4Bottom) + D.sectionGap;
    console.error(`phase4 bottom y=${phase4Bottom}  →  Phase 5 starts at sectionY=${sectionY}`);

    // Helper: emit a section header text (idempotent)
    function pushHeader(id, name, x, y, content) {
        if (existingNames.has(name)) return;
        allChanges.push(addObjOp(makeText({
            id, name, x, y, w: 800, h: D.sectionHeaderHeight,
            content, fontSize: 11, fill: "#6C757D", weight: "400",
            fontFamily: D.fontFamily, fontId: D.fontId,
        }), PAGE_ID));
        addedShapes++;
    }

    // Helper: emit a state-label text above a variant frame (idempotent)
    function pushLabel(id, name, x, y, content) {
        if (existingNames.has(name)) return;
        allChanges.push(addObjOp(makeText({
            id, name, x, y, w: 200, h: 14,
            content, fontSize: 12, fill: "#6C757D", weight: "400",
            fontFamily: D.fontFamily, fontId: D.fontId,
        }), PAGE_ID));
        addedShapes++;
    }

    // ── Chrome surfaces (wide, single variant, no State axis) ────────────────
    for (const surf of CHROME) {
        const headerName = `__phase5.section.chrome.${surf.id}.header`;
        const contentY   = sectionY + D.sectionHeaderHeight + D.sectionContentOffset;

        pushHeader(randomUUID(), headerName, D.marginX, sectionY,
            `${surf.name.toUpperCase()}  ·  ${surf.source}`);

        const alreadyExists = existingComps.some(
            c => c.name === surf.name && c.path === surf.path
        );
        if (alreadyExists) {
            skippedComps++;
        } else {
            const { frameId, allShapes } = buildChromeFrame(surf, contentY);
            for (const s of allShapes) allChanges.push(addObjOp(s, PAGE_ID));
            addedShapes += allShapes.length;

            allChanges.push({
                type:                "add-component",
                id:                  randomUUID(),
                name:                surf.name,
                path:                surf.path,
                "main-instance-id":  frameId,
                "main-instance-page": PAGE_ID,
            });
            addedComps++;
        }

        sectionY = contentY + surf.height + D.sectionGap;
    }

    // ── Field widgets (narrow, 5 state variants laid out horizontally) ────────
    for (const widget of WIDGETS) {
        const variantId  = variantIdFor(widget.id);
        const headerName = `__phase5.section.${widget.id}.header`;
        const contentY   = sectionY + D.sectionHeaderHeight + D.sectionContentOffset;

        pushHeader(randomUUID(), headerName, D.marginX, sectionY,
            `${widget.name.toUpperCase()}  ·  ${widget.source}`);

        // 5 states side-by-side; start at x=0 so 5 × (maxWidth+variantGap) ≤ 1440
        let variantOffsetX = 0;

        for (const state of STATES) {
            const existsAlready = existingComps.some(
                c => c.name === widget.name &&
                     c.path === widget.path &&
                     (c.variantProperties ?? []).some(
                         p => p.name === widget.variantAxis && p.value === state.variantLabel
                     )
            );

            const labelName = `__phase5.${widget.id}.${state.name}.label`;
            pushLabel(randomUUID(), labelName,
                variantOffsetX, contentY - 20, state.variantLabel);

            if (existsAlready) {
                skippedComps++;
            } else {
                const { frameId, allShapes } = buildWidgetVariant(
                    widget, state, contentY, variantOffsetX
                );
                for (const s of allShapes) allChanges.push(addObjOp(s, PAGE_ID));
                addedShapes += allShapes.length;

                allChanges.push({
                    type:                "add-component",
                    id:                  randomUUID(),
                    name:                widget.name,
                    path:                widget.path,
                    "main-instance-id":  frameId,
                    "main-instance-page": PAGE_ID,
                    "variant-id":        variantId,
                    "variant-properties": [{ name: widget.variantAxis, value: state.variantLabel }],
                });
                addedComps++;
            }

            variantOffsetX += widget.width + D.variantGap;
        }

        sectionY = contentY + widget.height + D.sectionGap;
    }

    // ── sale.order mock ───────────────────────────────────────────────────────
    const mockHeaderName = `__phase5.section.mock.header`;
    const mockContentY   = sectionY + D.sectionHeaderHeight + D.sectionContentOffset;

    pushHeader(randomUUID(), mockHeaderName, D.marginX, sectionY, MOCK.sectionLabel);

    if (!existingNames.has(`__phase5.mock.${MOCK.id}.main`)) {
        const { allShapes } = buildMockFrame(mockContentY);
        for (const s of allShapes) allChanges.push(addObjOp(s, PAGE_ID));
        addedShapes += allShapes.length;
    } else {
        console.error(`  mock already present — skipping`);
    }

    // ── Ship ──────────────────────────────────────────────────────────────────
    if (allChanges.length === 0) {
        console.log(`nothing to do — all ${skippedComps} components already in place.`);
        return;
    }

    console.error(
        `shipping: ${allChanges.length} change ops ` +
        `(${addedComps} new components, ${addedShapes} shapes, ${skippedComps} skipped) revn=${revn}`
    );

    const resp = await rpc("update-file", {
        id:          FILE_ID,
        "session-id": randomUUID(),
        revn, vern,
        features:    FEATURES,
        changes:     allChanges,
        skipValidate: false,
    });

    console.log(`Done. ${addedComps} components, ${addedShapes} shapes added. revn → ${resp.revn ?? "?"}`);
}

main().catch(err => { console.error(err); process.exit(1); });
