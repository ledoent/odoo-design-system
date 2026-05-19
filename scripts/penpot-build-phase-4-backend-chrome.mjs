#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 4 — Build backend chrome surfaces on "07 — Backend Templates".
//
// Creates 4 chrome surfaces × 3 theme variants = 12 Penpot library
// components, each as a :frame housing child rects + text nodes.
//
// Surfaces:
//   Navbar       (1440×46)   Chrome / Navigation
//   ControlPanel (1440×44)   Chrome / Controls
//   StatusBar    (1440×32)   Chrome / Controls
//   UserMenu     (240×296)   Chrome / Navigation
//
// Each variant is registered as a library component with a
// Theme=<label> variant-property. Components in the same surface share
// a stable variant-id derived from the surface id via FNV-1a.
//
// Idempotent: re-runs detect existing components by name+path+Theme
// and skip them. section headers + variant labels are also idempotent
// via name lookup.
//
// Usage:
//   PENPOT_TOKEN=<pat> node scripts/penpot-build-phase-4-backend-chrome.mjs

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
    CANONICAL_FILE_ID, FEATURES, ROOT_FRAME_ID,
    getFile, rpc, requireToken,
} from "./_penpot-rpc.mjs";
import { makeFrame, makeRect, makeText, rectSelrect, rectPoints } from "./_penpot-shapes.mjs";

requireToken("penpot-build-phase-4-backend-chrome.mjs");

const FILE_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const REPO    = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC    = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/backend-chrome.json"), "utf8"));
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
const THEMES   = SPEC.themes;
const SURFACES = SPEC.surfaces;

// ---------- stable variant-id (FNV-1a → v4-shaped uuid) --------------------
function variantIdFor(seed) {
    const bytes = new Uint8Array(16);
    let h = 0x811c9dc5n;
    const P = 0x01000193n;
    const data = new TextEncoder().encode(`phase-4:${seed}`);
    for (let i = 0; i < 16; i++) {
        for (const b of data) { h = BigInt.asUintN(32, (h ^ BigInt(b)) * P); }
        bytes[i] = Number((h >> BigInt(i % 24)) & 0xffn);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// ---------- shape builders --------------------------------------------------
// Resolve a hex color from a theme by key (handles null colorKey → no fill)
function themeColor(theme, key) {
    if (!key) return null;
    return theme[key] ?? "#000000";
}

// Build an add-obj change-op with correct envelope fields.
// The envelope `frame-id` and `parent-id` are authoritative in Penpot's
// add-shape handler — they determine parent wiring regardless of obj fields.
function addObjOp(obj, pageId) {
    return {
        type: "add-obj",
        id: obj.id,
        "page-id": pageId,
        "frame-id": obj["frame-id"] ?? ROOT,
        "parent-id": obj["parent-id"] ?? obj["frame-id"] ?? ROOT,
        obj,
    };
}

// Build all shapes (frame + children) for one surface variant.
// Returns { frameId, allShapes[] } where allShapes[0] is the frame.
function buildVariant(surface, theme, frameY, frameX = 0) {
    const frameId  = randomUUID();
    const childIds = [];
    const shapes   = [];

    for (const ch of surface.children) {
        const id   = randomUUID();
        childIds.push(id);
        const fill = themeColor(theme, ch.colorKey);
        const bord = themeColor(theme, ch.borderKey ?? null);

        const base = {
            x: (ch.x ?? 0) + frameX,
            y: (ch.y ?? 0) + frameY,
            w: ch.w,
            h: ch.h,
        };

        if (ch.type === "rect") {
            shapes.push(makeRect({
                id, name: `__phase4.${surface.id}.${theme.name}.${ch.role}`,
                ...base,
                fillColor:    fill,
                fillOpacity:  ch.opacity ?? 1,
                strokeColor:  bord,
                strokeWidth:  1,
                radius:       ch.radius,
                shadow:       ch.shadow ? {
                    "offset-x": 0, "offset-y": 4,
                    blur: 12, spread: 0, color: "#000000", opacity: 0.12,
                } : null,
                frameId, parentId: frameId,
            }));
        } else {
            shapes.push(makeText({
                id, name: `__phase4.${surface.id}.${theme.name}.${ch.role}`,
                ...base,
                content:    ch.content,
                fontSize:   ch.fontSize ?? 14,
                fill:       fill ?? "#212529",
                weight:     ch.weight ?? "400",
                fontFamily: D.fontFamily,
                fontId:     D.fontId,
                frameId, parentId: frameId,
            }));
        }
    }

    const frame = makeFrame({
        id: frameId,
        name: `__phase4.${surface.id}.${theme.name}.main`,
        x: frameX, y: frameY,
        w: surface.width, h: surface.height,
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

    // Index what already exists
    const existingComps = Object.values(file.data?.components ?? {});
    const existingNames = new Map(
        Object.values(page.objects ?? {}).map(s => [s.name, s])
    );

    const allChanges = [];
    let addedComps = 0, skippedComps = 0;

    // Phase 1 skeleton occupies y=0–127. Wide surfaces (navbar/control/status)
    // stack vertically; UserMenu is narrow and uses horizontal layout.
    let sectionY = 128;

    function pushText(id, name, x, y, w, h, content, color = "#6C757D", size = 11) {
        if (existingNames.has(name)) return;
        allChanges.push(addObjOp(makeText({
            id, name,
            x, y, w, h, content,
            fontSize: size, fill: color, weight: "400",
            fontFamily: D.fontFamily, fontId: D.fontId,
        }), PAGE_ID));
    }

    for (const surface of SURFACES) {
        const isWide = surface.width >= 1000;
        const variantId = variantIdFor(surface.id);

        // Section header
        pushText(
            randomUUID(),
            `__phase4.section.${surface.id}.header`,
            D.marginX, sectionY, 600, D.sectionHeaderHeight,
            `${surface.name.toUpperCase()}  ·  ${surface.source}`
        );

        const contentY = sectionY + D.sectionHeaderHeight + D.sectionContentOffset;

        // Wide surfaces: stack theme variants vertically on the left edge (x=0)
        // Narrow surfaces: stack side-by-side horizontally from marginX
        let variantOffsetX = isWide ? 0 : D.marginX;
        let variantOffsetY = contentY;

        for (const theme of THEMES) {
            const existsAlready = existingComps.some(
                c => c.name === surface.name &&
                     c.path === surface.path &&
                     (c.variantProperties ?? []).some(
                         p => p.name === surface.variantAxis && p.value === theme.variantLabel
                     )
            );
            if (existsAlready) {
                skippedComps++;
                if (isWide) variantOffsetY += surface.height + D.variantGap;
                else        variantOffsetX += surface.width  + D.variantGap;
                continue;
            }

            // Variant label
            const labelKey = `__phase4.${surface.id}.${theme.name}.label`;
            const labelX   = isWide ? D.marginX        : variantOffsetX;
            const labelY   = isWide ? variantOffsetY - 20 : contentY - 20;
            pushText(randomUUID(), labelKey, labelX, labelY, 200, 14, theme.variantLabel);

            // Build frame + children
            const { frameId, allShapes } = buildVariant(
                surface, theme,
                variantOffsetY,   // y
                isWide ? 0 : variantOffsetX   // x offset for narrow surfaces
            );

            for (const s of allShapes) allChanges.push(addObjOp(s, PAGE_ID));

            // Register library component
            allChanges.push({
                type: "add-component",
                id: randomUUID(),
                name: surface.name,
                path: surface.path,
                "main-instance-id": frameId,
                "main-instance-page": PAGE_ID,
                "variant-id": variantId,
                "variant-properties": [{ name: surface.variantAxis, value: theme.variantLabel }],
            });
            addedComps++;

            if (isWide) variantOffsetY += surface.height + D.variantGap;
            else        variantOffsetX += surface.width  + D.variantGap;
        }

        // Advance sectionY past all variants for this surface
        if (isWide) {
            sectionY = variantOffsetY + D.sectionGap;
        } else {
            sectionY = contentY + surface.height + D.sectionGap;
        }
    }

    if (allChanges.length === 0) {
        console.log(`nothing to do — all ${skippedComps} components already in place.`);
        return;
    }

    console.error(
        `shipping: ${allChanges.length} change ops ` +
        `(${addedComps} new components, ${skippedComps} skipped) revn=${revn}`
    );

    const resp = await rpc("update-file", {
        id: FILE_ID,
        "session-id": randomUUID(),
        revn, vern,
        features: FEATURES,
        changes: allChanges,
        skipValidate: false,
    });

    console.log(`Done. ${addedComps} components added to "${SPEC.page.name}". revn → ${resp.revn ?? "?"}`);
}

main().catch(err => { console.error(err); process.exit(1); });
