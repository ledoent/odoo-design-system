#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 3 — populate the "03 — Shared Components" page of the
// canonical Penpot file with vector specimens for every variant of
// the four OWL atoms (OdsIcon, OdsChip, OdsInitialsAvatar,
// OdsCardTile) AND promote a main-instance shape per atom into a
// Penpot library component so designers can drag instances onto any
// page from the Assets panel.
//
// The `add-component` change-op was discovered during the Phase 3
// probe to accept this schema:
//
//   { type: "add-component",
//     id: <uuid>, name: <string>, path: <string>,
//     main-instance-id: <uuid>, main-instance-page: <uuid>,
//     variant-id: <uuid|optional>,
//     variant-properties: [{name: <string>, value: <string>}]|optional }
//
// Phase 3a (this script) ships ONE component per atom (no variant
// containers yet). The Assets panel will show OdsIcon, OdsChip,
// OdsInitialsAvatar, OdsCardTile as draggable atoms. Variant swap
// across the full matrix lands in Phase 3b once the
// VariantContainer / `variant-id` flow is validated.
//
// Authored from `docs/penpot/specs/components.json`. Idempotent on
// re-run: shape lookup by name (`__phase3.<component>.<key>`),
// component lookup by name in `data.components`.
//
// Safety net: refuses to run without a snapshot newer than 24h.
//
// Usage:
//   PENPOT_TOKEN=<pat> node scripts/penpot-build-phase-3-components.mjs

import {randomUUID} from "node:crypto";
import {readFileSync, readdirSync, statSync} from "node:fs";
import {dirname, resolve, join} from "node:path";
import {fileURLToPath} from "node:url";

import {CANONICAL_FILE_ID, FEATURES, ROOT_FRAME_ID, getFile, rpc, requireToken} from "./_penpot-rpc.mjs";
import {makeFrame, makeRect, makeText} from "./_penpot-shapes.mjs";

requireToken("penpot-build-phase-3-components.mjs");

const FILE_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = resolve(REPO, "docs/penpot/specs/components.json");
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
const W = SPEC.page.width;
const text = (args) => makeText({fontFamily: D.fontFamily, fontId: D.fontId, ...args});

// ---------- bucket palette (read from DTCG JSON; mirrors `ods-bucket-index` in _tokens.scss) ----------

// Read `global.color.bucket.{1..8}` from the canonical DTCG token
// source so the avatar / tile colours stay in lockstep with both the
// SCSS-generated `$ods-bucket-palette` Sass map AND whatever Penpot
// resolves `color.bucket.N` to. Drift-by-hardcoding was the alternative.
const TOKENS_JSON = resolve(REPO, "odoo_design_system/static/src/tokens/design-system.dtcg.json");
const _tokens = JSON.parse(readFileSync(TOKENS_JSON, "utf8"));
const BUCKET_HEX = Array.from({length: 8}, (_, i) => {
    const t = _tokens?.global?.color?.bucket?.[String(i + 1)];
    if (!t?.$value) throw new Error(`design-system.dtcg.json missing global.color.bucket.${i + 1}`);
    return t.$value.toUpperCase();
});

function bucketForLetter(letter) {
    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let sum = 0;
    for (const ch of (letter || "?").toUpperCase()) {
        const idx = ALPHABET.indexOf(ch) + 1;
        sum += idx;
    }
    return (sum % 8) + 1;  // 1..8
}

// ---------- atomic specimens (mini-emitters per shape kind) ----------

function makeIconBox({id, name, x, y, size, iconName}) {
    // Placeholder for the icon SVG: a soft-bordered square with the
    // icon's `name` centered below as a tiny label. Phase 3b uploads
    // real icon media via Penpot's media endpoint and swaps these
    // out for `fillImage` rects.
    return [
        makeRect({
            id, name,
            x, y, w: size, h: size,
            fillColor: "#FFFFFF",
            strokeColor: "#DEE2E6",
            strokeWidth: 1,
            radius: 4,
        }),
        text({
            id: randomUUID(),
            name: `${name}.label`,
            x, y: y + size + 6, w: size, h: 14,
            content: iconName,
            fontSize: 9, fill: "#6C757D", weight: "500",
        }),
    ];
}

function makeChip({id, name, x, y, label, literalBg, literalFg, withIcon, appliedTokens}) {
    const out = [];
    const chipH = 28;
    const padX = withIcon ? 28 : 12;
    const chipW = Math.max(80, label.length * 8 + padX + 12);
    out.push(makeRect({
        id, name,
        x, y, w: chipW, h: chipH,
        fillColor: literalBg, radius: 999,
        appliedTokens,
    }));
    if (withIcon) {
        // 14px circle as a placeholder for the chip icon.
        out.push(makeRect({
            id: randomUUID(), name: `${name}.icon`,
            x: x + 8, y: y + 7, w: 14, h: 14,
            fillColor: literalFg, radius: 999,
        }));
    }
    out.push(text({
        id: randomUUID(), name: `${name}.label`,
        x: x + padX, y: y + 5, w: chipW - padX - 8, h: 18,
        content: label,
        fontSize: 12, fill: literalFg, weight: "500",
    }));
    return out;
}

function makeAvatar({id, name, x, y, size, letter, bucket}) {
    const fill = BUCKET_HEX[(bucket - 1 + 8) % 8];
    return [
        makeRect({
            id, name,
            x, y, w: size, h: size,
            fillColor: fill, radius: 999,
        }),
        text({
            id: randomUUID(), name: `${name}.letter`,
            x, y: y + (size - 18) / 2, w: size, h: 18,
            content: letter,
            fontSize: Math.round(size * 0.42), fill: "#FFFFFF", weight: "600",
        }),
    ];
}

function makeTile({id, name, x, y, size, accent, labelText}) {
    // accent in {ext / initial / preview} — map to a representative
    // visual: ext = colored bar on the left + ext label;
    // initial = solid bucket-tinted square with letter;
    // preview = lighter gray with a centered glyph.
    const out = [];
    if (accent === "preview") {
        out.push(makeRect({
            id, name,
            x, y, w: size, h: size,
            fillColor: "#F1F3F5", radius: 6,
            strokeColor: "#DEE2E6", strokeWidth: 1,
        }));
        out.push(text({
            id: randomUUID(), name: `${name}.label`,
            x, y: y + (size - 22) / 2, w: size, h: 22,
            content: labelText,
            fontSize: 18, fill: "#ADB5BD", weight: "400",
        }));
    } else if (accent === "initial") {
        const b = bucketForLetter(labelText[0]);
        out.push(makeRect({
            id, name,
            x, y, w: size, h: size,
            fillColor: BUCKET_HEX[(b - 1 + 8) % 8], radius: 6,
        }));
        out.push(text({
            id: randomUUID(), name: `${name}.label`,
            x, y: y + (size - 22) / 2, w: size, h: 22,
            content: labelText,
            fontSize: 24, fill: "#FFFFFF", weight: "600",
        }));
    } else {
        // ext
        out.push(makeRect({
            id, name,
            x, y, w: size, h: size,
            fillColor: "#FFFFFF", radius: 6,
            strokeColor: "#DEE2E6", strokeWidth: 1,
        }));
        // Left accent stripe (3px)
        out.push(makeRect({
            id: randomUUID(), name: `${name}.spine`,
            x, y, w: 3, h: size,
            fillColor: "#D6336C",
        }));
        out.push(text({
            id: randomUUID(), name: `${name}.label`,
            x: x + 8, y: y + size - 26, w: size - 16, h: 18,
            content: labelText,
            fontSize: 13, fill: "#D6336C", weight: "600",
        }));
    }
    return out;
}

// ---------- section emitters ----------

function sectionHeader(comp, addObj) {
    addObj(text({
        id: randomUUID(),
        name: `__phase3.${comp.id}.header`,
        x: D.marginX, y: comp.y,
        w: W - 2 * D.marginX, h: D.sectionHeaderHeight,
        content: comp.title,
        fontSize: 11, fill: "#6C757D", weight: "600",
    }));
}

function mainInstance(comp, addObj) {
    // The "main instance" — referenced by `add-component` as
    // `main-instance-id`. Penpot only accepts `:frame` or `:group` as
    // a component root (see `frontend/src/app/main/render.cljs ::
    // component-svg`'s `case` block); a bare `:rect` crashed the
    // Assets-panel thumbnail with `Error: No matching clause: rect`
    // (the original Phase 3a bug). We wrap the kind-specific shapes
    // in a `:frame` and point the component at the frame's id.
    //
    // Naming convention:
    //   `__phase3.<comp>.main`       — the frame (this is the
    //                                   add-component main-instance-id)
    //   `__phase3.<comp>.main.body`  — the primary visual rect inside
    //   `__phase3.<comp>.main.label` — text label inside (if any)
    //   `…main.letter`/`…main.icon`/`…main.spine` — kind-specific extras
    const frameId = randomUUID();
    const frameName = `__phase3.${comp.id}.main`;
    const baseX = D.marginX, baseY = comp.y + D.sectionContentOffset;
    const m = comp.main;
    const rx = (args) => makeRect({...args, frameId});
    const tx = (args) => text({...args, frameId});
    const children = [];
    let frameW, frameH;

    switch (m.kind) {
        case "icon": {
            const size = m.size;
            children.push(rx({
                id: randomUUID(), name: `${frameName}.body`,
                x: baseX, y: baseY, w: size, h: size,
                fillColor: "#FFFFFF", strokeColor: "#DEE2E6", strokeWidth: 1, radius: 4,
            }));
            children.push(tx({
                id: randomUUID(), name: `${frameName}.label`,
                x: baseX, y: baseY + size + 6, w: size, h: 14,
                content: m.name,
                fontSize: 9, fill: "#6C757D", weight: "500",
            }));
            frameW = size;
            frameH = size + 20;
            break;
        }
        case "chip": {
            const chipH = 28;
            const padX = 12;
            const chipW = Math.max(80, m.label.length * 8 + padX + 12);
            children.push(rx({
                id: randomUUID(), name: `${frameName}.body`,
                x: baseX, y: baseY, w: chipW, h: chipH,
                fillColor: "#F1F3F5", radius: 999,
            }));
            children.push(tx({
                id: randomUUID(), name: `${frameName}.label`,
                x: baseX + padX, y: baseY + 5, w: chipW - padX - 8, h: 18,
                content: m.label,
                fontSize: 12, fill: "#212529", weight: "500",
            }));
            frameW = chipW;
            frameH = chipH;
            break;
        }
        case "avatar": {
            const size = m.size || 40;
            const fill = BUCKET_HEX[(m.bucket - 1 + 8) % 8];
            children.push(rx({
                id: randomUUID(), name: `${frameName}.body`,
                x: baseX, y: baseY, w: size, h: size,
                fillColor: fill, radius: 999,
            }));
            children.push(tx({
                id: randomUUID(), name: `${frameName}.letter`,
                x: baseX, y: baseY + (size - 18) / 2, w: size, h: 18,
                content: m.letter,
                fontSize: Math.round(size * 0.42), fill: "#FFFFFF", weight: "600",
            }));
            frameW = size;
            frameH = size;
            break;
        }
        case "tile": {
            const size = 96;
            if (m.accent === "preview") {
                children.push(rx({
                    id: randomUUID(), name: `${frameName}.body`,
                    x: baseX, y: baseY, w: size, h: size,
                    fillColor: "#F1F3F5", radius: 6,
                    strokeColor: "#DEE2E6", strokeWidth: 1,
                }));
                children.push(tx({
                    id: randomUUID(), name: `${frameName}.label`,
                    x: baseX, y: baseY + (size - 22) / 2, w: size, h: 22,
                    content: m.label, fontSize: 18, fill: "#ADB5BD", weight: "400",
                }));
            } else if (m.accent === "initial") {
                const b = bucketForLetter(m.label[0]);
                children.push(rx({
                    id: randomUUID(), name: `${frameName}.body`,
                    x: baseX, y: baseY, w: size, h: size,
                    fillColor: BUCKET_HEX[(b - 1 + 8) % 8], radius: 6,
                }));
                children.push(tx({
                    id: randomUUID(), name: `${frameName}.label`,
                    x: baseX, y: baseY + (size - 22) / 2, w: size, h: 22,
                    content: m.label, fontSize: 24, fill: "#FFFFFF", weight: "600",
                }));
            } else {  // ext
                children.push(rx({
                    id: randomUUID(), name: `${frameName}.body`,
                    x: baseX, y: baseY, w: size, h: size,
                    fillColor: "#FFFFFF", radius: 6,
                    strokeColor: "#DEE2E6", strokeWidth: 1,
                }));
                children.push(rx({
                    id: randomUUID(), name: `${frameName}.spine`,
                    x: baseX, y: baseY, w: 3, h: size,
                    fillColor: "#D6336C",
                }));
                children.push(tx({
                    id: randomUUID(), name: `${frameName}.label`,
                    x: baseX + 8, y: baseY + size - 26, w: size - 16, h: 18,
                    content: m.label, fontSize: 13, fill: "#D6336C", weight: "600",
                }));
            }
            frameW = size;
            frameH = size;
            break;
        }
        default:
            throw new Error(`unknown main.kind: ${m.kind}`);
    }

    addObj(makeFrame({
        id: frameId, name: frameName,
        x: baseX, y: baseY, w: frameW, h: frameH,
        children: children.map((c) => c.id),
    }));
    children.forEach(addObj);
}

function iconMatrix(comp, addObj) {
    const s = comp.specimens;
    const cell = s.iconSize + 28;  // square + label below
    const labelW = s.rowLabelWidth;
    // Main instance occupies x in [marginX, marginX+48]; specimen
    // matrix starts to the right.
    const matrixX = D.marginX + 120;
    const baseY = comp.y + D.sectionContentOffset;
    s.sets.forEach((setName, row) => {
        const y = baseY + row * (s.iconSize + 32);
        addObj(text({
            id: randomUUID(),
            name: `__phase3.${comp.id}.row.${setName}.label`,
            x: matrixX, y: y + 6, w: labelW, h: 14,
            content: setName,
            fontSize: 10, fill: "#6C757D", weight: "500",
        }));
        s.samples.forEach((icoName, col) => {
            const x = matrixX + labelW + col * (s.iconSize + 12);
            makeIconBox({
                id: randomUUID(),
                name: `__phase3.${comp.id}.${setName}.${icoName}`,
                x, y, size: s.iconSize, iconName: icoName,
            }).forEach(addObj);
        });
    });
}

function chipMatrix(comp, addObj) {
    const s = comp.specimens;
    const colW = 160;
    const rowH = 56;
    const matrixX = D.marginX + 200;  // past main instance
    const baseY = comp.y + D.sectionContentOffset;
    s.rows.forEach((row, ri) => {
        const y = baseY + ri * rowH;
        addObj(text({
            id: randomUUID(),
            name: `__phase3.${comp.id}.row.${row.key}.label`,
            x: matrixX, y: y + 8, w: s.rowLabelWidth, h: 14,
            content: row.label,
            fontSize: 10, fill: "#6C757D", weight: "500",
        }));
        s.variants.forEach((v, ci) => {
            const x = matrixX + s.rowLabelWidth + ci * colW;
            makeChip({
                id: randomUUID(),
                name: `__phase3.${comp.id}.${v.key}.${row.key}`,
                x, y, label: v.label,
                literalBg: v.literalBg, literalFg: v.literalFg, withIcon: row.withIcon,
            }).forEach(addObj);
        });
    });
}

function avatarRow(comp, addObj) {
    const s = comp.specimens;
    const matrixX = D.marginX + 200;
    const y = comp.y + D.sectionContentOffset;
    addObj(text({
        id: randomUUID(),
        name: `__phase3.${comp.id}.row.label`,
        x: matrixX, y: y + 12, w: s.rowLabelWidth, h: 14,
        content: "buckets 1..8",
        fontSize: 10, fill: "#6C757D", weight: "500",
    }));
    s.names.forEach((nm, i) => {
        const letter = nm[0];
        const x = matrixX + s.rowLabelWidth + i * (s.size + 12);
        makeAvatar({
            id: randomUUID(),
            name: `__phase3.${comp.id}.${nm.toLowerCase()}`,
            x, y, size: s.size, letter, bucket: bucketForLetter(letter),
        }).forEach(addObj);
        addObj(text({
            id: randomUUID(),
            name: `__phase3.${comp.id}.${nm.toLowerCase()}.name`,
            x, y: y + s.size + 6, w: s.size, h: 14,
            content: nm,
            fontSize: 10, fill: "#6C757D", weight: "500",
        }));
    });
}

function tileRow(comp, addObj) {
    const s = comp.specimens;
    const matrixX = D.marginX + 200;
    const y = comp.y + D.sectionContentOffset;
    addObj(text({
        id: randomUUID(),
        name: `__phase3.${comp.id}.row.label`,
        x: matrixX, y: y + 12, w: s.rowLabelWidth, h: 14,
        content: "accent",
        fontSize: 10, fill: "#6C757D", weight: "500",
    }));
    s.accents.forEach((a, i) => {
        const x = matrixX + s.rowLabelWidth + i * (s.size + 24);
        makeTile({
            id: randomUUID(),
            name: `__phase3.${comp.id}.${a.key}`,
            x, y, size: s.size, accent: a.key, labelText: a.labelText,
        }).forEach(addObj);
        addObj(text({
            id: randomUUID(),
            name: `__phase3.${comp.id}.${a.key}.caption`,
            x, y: y + s.size + 6, w: s.size, h: 14,
            content: a.label,
            fontSize: 10, fill: "#6C757D", weight: "500",
        }));
    });
}

const EMITTERS = {
    iconMatrix, chipMatrix, avatarRow, tileRow,
};

// ---------- main ----------

const file = await getFile(FILE_ID);
const {revn} = file;
const vern = file.vern || 0;

const targetPageId = Object.entries(file.data.pagesIndex)
    .find(([, p]) => p.name === SPEC.page.name)?.[0];
if (!targetPageId) {
    console.error(`Shared Components page "${SPEC.page.name}" not found.`);
    process.exit(4);
}
const targetPage = file.data.pagesIndex[targetPageId];
const existingNames = new Set(Object.values(targetPage.objects).map((s) => s.name));
const mainInstanceIdByCompId = new Map();
for (const [sid, s] of Object.entries(targetPage.objects)) {
    for (const comp of SPEC.components) {
        if (s.name === `__phase3.${comp.id}.main`) {
            mainInstanceIdByCompId.set(comp.id, sid);
            break;
        }
    }
}
const existingComponents = file.data.components || {};
const componentByName = new Map();
for (const [cid, c] of Object.entries(existingComponents)) {
    componentByName.set(c.name, {id: cid, ...c});
}
console.error(
    `Shared Components page-id=${targetPageId.slice(0, 8)}…, ` +
    `${existingNames.size} existing shapes, ${componentByName.size} existing components`
);

// ---------- repair pass ----------
//
// Phase 3a's initial build pointed `add-component.main-instance-id` at
// a bare `:rect`, which crashes Penpot's Assets-panel thumbnail with
// `Error: No matching clause: rect`. For each component whose existing
// `__phase3.<id>.main` shape isn't a frame, delete the leaf shape +
// every `__phase3.<id>.main.*` sibling so `mainInstance()` below can
// re-emit them inside a `:frame`. The component itself is repointed
// with `mod-component` further down.
const delObjChanges = [];
const repairComponentIds = new Set();
for (const comp of SPEC.components) {
    const sid = mainInstanceIdByCompId.get(comp.id);
    if (!sid) continue;
    const shape = targetPage.objects[sid];
    if (!shape || shape.type === "frame") continue;
    console.error(
        `repair: ${comp.name} main-instance ${sid.slice(0, 8)}… is :${shape.type}; ` +
        `wrapping in a frame`
    );
    repairComponentIds.add(comp.id);
    const prefix = `__phase3.${comp.id}.main`;
    for (const [otherId, s] of Object.entries(targetPage.objects)) {
        if (s?.name === prefix || (s?.name && s.name.startsWith(prefix + "."))) {
            delObjChanges.push({type: "del-obj", "page-id": targetPageId, id: otherId});
            existingNames.delete(s.name);
        }
    }
    mainInstanceIdByCompId.delete(comp.id);
}

// Collect add-obj changes per component (header + main + specimen matrix).
const addObjChanges = [];
let added = 0, skipped = 0;
const mainInstanceShapeId = new Map();
for (const comp of SPEC.components) {
    const emitter = EMITTERS[comp.specimens.kind];
    if (!emitter) {
        console.error(`unknown specimens.kind: ${comp.specimens.kind}`);
        process.exit(5);
    }
    const addObj = (obj) => {
        if (existingNames.has(obj.name)) {
            skipped++;
            if (obj.name === `__phase3.${comp.id}.main`) {
                mainInstanceShapeId.set(comp.id, mainInstanceIdByCompId.get(comp.id));
            }
            return;
        }
        // The change-op envelope's `frame-id` / `parent-id` are
        // AUTHORITATIVE — Penpot's add-shape uses them to wire the
        // new shape into its parent's `shapes` array AND overwrites
        // the obj's own frame-id/parent-id with these values. So we
        // mirror the obj's own intent here: a top-level frame still
        // lands at ROOT (its frame-id is ROOT), while children inside
        // a new frame land at the new frame (their frame-id was set
        // by makeRect/makeText/makeFrame's `frameId` arg). The prior
        // hard-coded ROOT envelope put children at ROOT in Penpot's
        // tree even though the obj said it belonged in the new frame
        // — a data-integrity bug fixed by penpot-build-phase-3b-
        // repair.mjs.
        const envFrameId = obj["frame-id"] || ROOT;
        const envParentId = obj["parent-id"] || envFrameId;
        addObjChanges.push({
            type: "add-obj", id: obj.id, "page-id": targetPageId,
            "frame-id": envFrameId, "parent-id": envParentId, obj,
        });
        existingNames.add(obj.name);
        added++;
        if (obj.name === `__phase3.${comp.id}.main`) {
            mainInstanceShapeId.set(comp.id, obj.id);
        }
    };
    if (!existingNames.has(`__phase3.${comp.id}.header`)) {
        sectionHeader(comp, addObj);
    } else {
        skipped++;
    }
    mainInstance(comp, addObj);
    emitter(comp, addObj);
}

// Collect add-component / mod-component changes per atom.
//
// - New component: emit `add-component` pointing at the freshly emitted
//   frame.
// - Existing component whose recorded `main-instance-id` no longer
//   matches the canonical `__phase3.<id>.main` shape (e.g. a repaired
//   rect-based main was just deleted and replaced with a frame): emit
//   `mod-component` to repoint. Penpot's `ctkl/mod-component`
//   implementation accepts `:main-instance-id` even though the malli
//   schema in `changes.cljc` doesn't list it explicitly (open map by
//   default).
const addComponentChanges = [];
const modComponentChanges = [];
for (const comp of SPEC.components) {
    const mainShapeId = mainInstanceShapeId.get(comp.id);
    const existing = componentByName.get(comp.name);
    if (!existing) {
        if (!mainShapeId) {
            console.error(`no main-instance shape known for ${comp.id} — skipping component promotion`);
            continue;
        }
        addComponentChanges.push({
            type: "add-component",
            id: randomUUID(),
            name: comp.name,
            path: comp.path,
            "main-instance-id": mainShapeId,
            "main-instance-page": targetPageId,
        });
        continue;
    }
    if (!mainShapeId) {
        console.error(`${comp.name} exists but main-instance shape missing — skipping mod`);
        continue;
    }
    const currentMain = existing.mainInstanceId || existing["main-instance-id"];
    if (currentMain === mainShapeId) continue;  // already correct, idempotent
    modComponentChanges.push({
        type: "mod-component",
        id: existing.id,
        "main-instance-id": mainShapeId,
        "main-instance-page": targetPageId,
    });
}

if (delObjChanges.length === 0 && addObjChanges.length === 0
    && addComponentChanges.length === 0 && modComponentChanges.length === 0) {
    console.error(`nothing to do — ${skipped} shapes already in place; ${componentByName.size} library components.`);
    process.exit(0);
}

// Order matters: del-obj first (frees up the slot for the repaired
// shapes), then add-obj (frame + children), then component repointing.
const allChanges = [...delObjChanges, ...addObjChanges, ...addComponentChanges, ...modComponentChanges];
console.error(
    `shipping ${delObjChanges.length} del-obj + ${addObjChanges.length} add-obj + ` +
    `${addComponentChanges.length} add-component + ${modComponentChanges.length} mod-component ` +
    `(revn=${revn}; repair=${repairComponentIds.size})`
);
const resp = await rpc("update-file", {
    id: FILE_ID, revn, vern,
    "session-id": randomUUID(),
    features: FEATURES,
    changes: allChanges,
    skipValidate: false,
});
console.error(
    `✓ revn → ${resp.revn ?? "?"}; ` +
    `+${added} shapes, +${addComponentChanges.length} components, ` +
    `~${modComponentChanges.length} repointed, ` +
    `-${delObjChanges.length} deleted, ${skipped} skipped`
);
