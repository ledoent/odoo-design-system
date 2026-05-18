#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 2 — populate the "01 — Foundations" page of the canonical
// Penpot file with vector specimens for every token group:
//
//   - color swatches (brand, portal, bucket, neutral, ext, surface,
//     text, border, state — last 4 are theme-variant)
//   - spacing scale bars (width bound to spacing.* tokens)
//   - radius squircles (4 corners bound r1..r4)
//   - typography ramp (size × weight bound on text shapes)
//   - elevation deck (5 cards — shadow LITERAL, not bindable)
//   - motion timing strips (visual reference only — duration/cubic-bezier
//     not bindable types)
//
// Authored from `docs/penpot/specs/foundations.json`. Idempotent on
// re-run: shape lookup by name (`__phase2.<section>.<key>`); existing
// shapes are skipped, missing ones added.
//
// Safety net: refuses to run without a snapshot newer than 24h in
// `.penpot-backups/`. Same gate as the Phase 1 build script.
//
// Usage:
//   PENPOT_TOKEN=<pat> node scripts/penpot-build-phase-2-specimens.mjs

import {randomUUID} from "node:crypto";
import {readFileSync, readdirSync, statSync} from "node:fs";
import {dirname, resolve, join} from "node:path";
import {fileURLToPath} from "node:url";

import {CANONICAL_FILE_ID, ROOT_FRAME_ID, getFile, rpc, requireToken} from "./_penpot-rpc.mjs";

requireToken("penpot-build-phase-2-specimens.mjs");

const FILE_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = resolve(REPO, "docs/penpot/specs/foundations.json");
const BACKUPS_DIR = resolve(REPO, ".penpot-backups");
const ROOT = ROOT_FRAME_ID;

// ---------- safety net ----------

const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
let freshSnapshot = null;
try {
    for (const f of readdirSync(BACKUPS_DIR)) {
        const path = join(BACKUPS_DIR, f);
        if (!path.endsWith(".json")) continue;
        if (Date.now() - statSync(path).mtimeMs < SNAPSHOT_TTL_MS) {
            freshSnapshot = path;
            break;
        }
    }
} catch {/* dir missing */}
if (!freshSnapshot) {
    console.error("No fresh snapshot in .penpot-backups/ (<24h old).");
    console.error("Run `node scripts/penpot-snapshot.mjs` first.");
    process.exit(3);
}
console.error(`safety: using snapshot ${freshSnapshot.replace(REPO + "/", "")}`);

const SPEC = JSON.parse(readFileSync(SPEC_PATH, "utf8"));
const D = SPEC.defaults;

// ---------- shape builders (mirroring phase-1-skeleton conventions) ----------

function rectSelrect(x, y, w, h) {
    return {x, y, x1: x, y1: y, x2: x + w, y2: y + h, width: w, height: h};
}

function rectPoints(x, y, w, h) {
    return [{x, y}, {x: x + w, y}, {x: x + w, y: y + h}, {x, y: y + h}];
}

const IDENTITY_TRANSFORM = {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0};

function makeRect({id, name, x, y, w, h, fillColor, fillOpacity = 1, appliedTokens,
                   strokeColor, strokeWidth, shadow, radius}) {
    const o = {
        id, type: "rect", name,
        x, y, width: w, height: h, rotation: 0,
        "frame-id": ROOT, "parent-id": ROOT,
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
        o.shadow = [shadow];
    }
    if (typeof radius === "number") {
        o["r1"] = radius;
        o["r2"] = radius;
        o["r3"] = radius;
        o["r4"] = radius;
    }
    return o;
}

function makeText({id, name, x, y, w, h, content, fontSize = 14, fill = "#212529",
                   weight = "400", appliedTokens, growType = "auto-height"}) {
    const o = {
        id, type: "text", name,
        x, y, width: w, height: h, rotation: 0,
        "frame-id": ROOT, "parent-id": ROOT, "grow-type": growType,
        fills: [{"fill-color": fill, "fill-opacity": 1}],
        content: {
            type: "root",
            children: [{
                type: "paragraph-set",
                children: [{
                    type: "paragraph",
                    children: [{
                        text: content,
                        "font-family": D.fontFamily,
                        "font-id": D.fontId,
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

// ---------- section emitters ----------

function sectionHeader(section, addObj) {
    addObj(makeText({
        id: randomUUID(),
        name: `__phase2.${section.id}.header`,
        x: D.marginX, y: section.y,
        w: 1440 - 2 * D.marginX, h: D.sectionHeaderHeight,
        content: section.title,
        fontSize: 11, fill: "#6C757D", weight: "600",
    }));
}

function swatchRow(section, addObj) {
    const sw = section.swatchWidth || D.swatchWidth;
    const sh = D.swatchHeight;
    const gap = D.swatchGap;
    const baseY = section.y + D.sectionContentOffset;
    section.items.forEach((item, i) => {
        const x = D.marginX + i * (sw + gap);
        addObj(makeRect({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}`,
            x, y: baseY, w: sw, h: sh,
            fillColor: item.literalFill,
            appliedTokens: {fill: item.tokenName},
        }));
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}.label`,
            x, y: baseY + sh + D.labelOffset, w: sw, h: D.labelHeight,
            content: item.label, fontSize: 11, fill: "#495057", weight: "500",
        }));
    });
}

function borderRow(section, addObj) {
    const sw = D.swatchWidth + 24;
    const sh = D.swatchHeight;
    const gap = D.swatchGap;
    const baseY = section.y + D.sectionContentOffset;
    section.items.forEach((item, i) => {
        const x = D.marginX + i * (sw + gap);
        addObj(makeRect({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}`,
            x, y: baseY, w: sw, h: sh,
            fillColor: "#FFFFFF",
            strokeColor: item.literalStroke,
            strokeWidth: 2,
            appliedTokens: {"stroke-color": item.tokenName},
        }));
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}.label`,
            x, y: baseY + sh + D.labelOffset, w: sw, h: D.labelHeight,
            content: item.label, fontSize: 11, fill: "#495057", weight: "500",
        }));
    });
}

function pillRow(section, addObj) {
    const pw = 144;
    const ph = D.swatchHeight;
    const gap = D.swatchGap;
    const baseY = section.y + D.sectionContentOffset;
    section.items.forEach((item, i) => {
        const x = D.marginX + i * (pw + gap);
        addObj(makeRect({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}-bg`,
            x, y: baseY, w: pw, h: ph,
            fillColor: item.literalBg,
            radius: 999,
            appliedTokens: {fill: item.bgToken},
        }));
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}-fg`,
            x: x + 16, y: baseY + (ph - 20) / 2, w: pw - 32, h: 20,
            content: item.label, fontSize: 13, fill: item.literalFg, weight: "600",
            appliedTokens: {fill: item.fgToken},
        }));
    });
}

function spacingScale(section, addObj) {
    const rowH = 28;
    const labelW = 120;
    const baseY = section.y + D.sectionContentOffset;
    section.items.forEach((item, i) => {
        const y = baseY + i * rowH;
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}.label`,
            x: D.marginX, y, w: labelW, h: 18,
            content: item.label, fontSize: 11, fill: "#495057", weight: "500",
        }));
        if (item.literalWidth > 0) {
            addObj(makeRect({
                id: randomUUID(),
                name: `__phase2.${section.id}.${item.key}`,
                x: D.marginX + labelW + 16, y: y + 4, w: item.literalWidth, h: 16,
                fillColor: "#495057",
                appliedTokens: {width: item.tokenName},
            }));
        }
    });
}

function radiusRow(section, addObj) {
    const sw = 120;
    const sh = 96;
    const gap = D.swatchGap;
    const baseY = section.y + D.sectionContentOffset;
    section.items.forEach((item, i) => {
        const x = D.marginX + i * (sw + gap);
        addObj(makeRect({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}`,
            x, y: baseY, w: sw, h: sh,
            fillColor: "#DEE2E6",
            radius: item.literalRadius,
            appliedTokens: {
                r1: item.tokenName,
                r2: item.tokenName,
                r3: item.tokenName,
                r4: item.tokenName,
            },
        }));
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}.label`,
            x, y: baseY + sh + D.labelOffset, w: sw, h: D.labelHeight,
            content: item.label, fontSize: 11, fill: "#495057", weight: "500",
        }));
    });
}

function typeRamp(section, addObj) {
    const rowH = section.rowHeight || 56;
    const labelW = 120;
    const baseY = section.y + D.sectionContentOffset;
    section.items.forEach((item, i) => {
        const y = baseY + i * rowH;
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}.label`,
            x: D.marginX, y, w: labelW, h: 18,
            content: item.label, fontSize: 11, fill: "#495057", weight: "500",
        }));
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}`,
            x: D.marginX + labelW + 16, y: y - 2, w: 1440 - 2 * D.marginX - labelW - 16, h: rowH,
            content: item.sample,
            fontSize: item.literalSize,
            weight: section.fontWeight || "400",
            fill: "#212529",
            appliedTokens: {"font-size": item.tokenName},
        }));
    });
}

function weightRamp(section, addObj) {
    const rowH = section.rowHeight || 36;
    const labelW = 160;
    const baseY = section.y + D.sectionContentOffset;
    section.items.forEach((item, i) => {
        const y = baseY + i * rowH;
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}.label`,
            x: D.marginX, y, w: labelW, h: 18,
            content: item.label, fontSize: 11, fill: "#495057", weight: "500",
        }));
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}`,
            x: D.marginX + labelW + 16, y: y - 2, w: 1440 - 2 * D.marginX - labelW - 16, h: rowH,
            content: item.sample,
            fontSize: section.fontSize || 18,
            weight: item.literalWeight,
            fill: "#212529",
            appliedTokens: {"font-weight": item.tokenName},
        }));
    });
}

function elevationDeck(section, addObj) {
    const cw = 200;
    const ch = 96;
    const gap = 32;
    const baseY = section.y + D.sectionContentOffset;
    section.items.forEach((item, i) => {
        const x = D.marginX + i * (cw + gap);
        const s = item.literalShadow;
        const shadow = s ? {
            id: randomUUID(),
            style: s.style || "drop-shadow",
            "offset-x": s["offset-x"],
            "offset-y": s["offset-y"],
            blur: s.blur,
            spread: s.spread,
            hidden: false,
            color: {color: s.color, opacity: s.opacity},
        } : undefined;
        addObj(makeRect({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}`,
            x, y: baseY, w: cw, h: ch,
            fillColor: "#FFFFFF",
            radius: 6,
            shadow,
        }));
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}.label`,
            x, y: baseY + ch + D.labelOffset, w: cw, h: D.labelHeight,
            content: item.label, fontSize: 11, fill: "#495057", weight: "500",
        }));
    });
}

function motionStrips(section, addObj) {
    const rowH = 20;
    const labelW = 460;
    const baseY = section.y + D.sectionContentOffset;
    section.items.forEach((item, i) => {
        const y = baseY + i * rowH;
        addObj(makeText({
            id: randomUUID(),
            name: `__phase2.${section.id}.${item.key}.label`,
            x: D.marginX, y, w: labelW, h: 16,
            content: item.label, fontSize: 11, fill: "#495057", weight: "500",
        }));
        if (item.type === "duration") {
            // Bar width scales with duration value (visual reference; max 600ms → 600px).
            addObj(makeRect({
                id: randomUUID(),
                name: `__phase2.${section.id}.${item.key}`,
                x: D.marginX + labelW + 16, y: y + 2, w: item.value, h: 12,
                fillColor: "#6C757D",
            }));
        }
    });
}

const EMITTERS = {
    swatchRow, borderRow, pillRow, spacingScale, radiusRow,
    typeRamp, weightRamp, elevationDeck, motionStrips,
};

// ---------- main ----------

const file = await getFile(FILE_ID);
let revn = file.revn;
const vern = file.vern || 0;

const targetPageId = Object.entries(file.data.pagesIndex)
    .find(([, p]) => p.name === SPEC.page.name)?.[0];
if (!targetPageId) {
    console.error(`Foundations page not found (looking for "${SPEC.page.name}").`);
    process.exit(4);
}
const targetPage = file.data.pagesIndex[targetPageId];
const existingNames = new Set(Object.values(targetPage.objects).map((s) => s.name));
console.error(`Foundations page-id=${targetPageId.slice(0, 8)}…, ${existingNames.size} existing shapes`);

// Phase 1's `__phase1.bg` rect (1440×900, locked) stays in place. The
// new specimens render *past* y=900 on Penpot's infinite canvas —
// resizing the locked bg trips a server-side rect validator and a
// taller background isn't required for the specimens to be visible.
const bgChanges = [];

// Step B: collect add-obj changes per section.
const addChanges = [];
let added = 0, skipped = 0;
for (const section of SPEC.sections) {
    const emitter = EMITTERS[section.kind];
    if (!emitter) {
        console.error(`unknown section kind: ${section.kind}`);
        process.exit(5);
    }
    const localChanges = [];
    const addObj = (obj) => {
        if (existingNames.has(obj.name)) {
            skipped++;
            return;
        }
        localChanges.push({
            type: "add-obj", id: obj.id, "page-id": targetPageId,
            "frame-id": ROOT, "parent-id": ROOT, obj,
        });
        existingNames.add(obj.name);
        added++;
    };
    // Section header label (text shape).
    if (!existingNames.has(`__phase2.${section.id}.header`)) {
        sectionHeader(section, addObj);
    } else {
        skipped++;
    }
    emitter(section, addObj);
    addChanges.push(...localChanges);
}

if (bgChanges.length === 0 && addChanges.length === 0) {
    console.error(`nothing to do — ${skipped} shapes already in place.`);
    process.exit(0);
}

// Step C: ship the changes in one update-file call.
const sessionId = randomUUID();
const allChanges = [...bgChanges, ...addChanges];
console.error(`shipping ${bgChanges.length} mod + ${addChanges.length} add changes (revn=${revn})`);
const resp = await rpc("update-file", {
    id: FILE_ID, revn, vern, sessionId,
    changes: allChanges, skipValidate: false,
});
console.error(`✓ revn → ${resp.revn ?? "?"}; added ${added} shapes, skipped ${skipped}`);
