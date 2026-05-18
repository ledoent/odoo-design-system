#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 3b — Promote each matrix cell on the 03 — Shared Components
// page from a "specimen" rect into a full Penpot library component
// linked to its sibling variants via `variant-id`. Designers then drag
// a single "OdsChip" / "OdsCardTile" / "OdsInitialsAvatar" from the
// Assets panel and pick variant axes via the property dropdown that
// Penpot renders for any component carrying `variant-properties`.
//
// The schema discovered in Phase 3a's probe + verified by
// `scripts/penpot-probe-variant.mjs` against the live file:
//
//   { type: "mod-component", id: <uuid>,
//     "variant-id": <variant-set-uuid>,
//     "variant-properties": [{name: <string>, value: <string>}, ...] }
//
//   { type: "add-component", id: <uuid>, name: <string>, path: <string>,
//     "main-instance-id": <frame-uuid>, "main-instance-page": <page-uuid>,
//     "variant-id": <variant-set-uuid>,
//     "variant-properties": [{name: <string>, value: <string>}, ...] }
//
// Constraints carried over from Phase 3a:
//   - Every main-instance MUST be a `:frame` (rect/leaf shapes crash
//     the Assets-panel thumbnail; see ledoent/penpot#1).
//   - Components inside the same variant set share `name` (the
//     dropdown label) and `path` (the Assets-panel grouping) but
//     differ in their `variant-properties` tuple.
//
// Variant-id derivation is stable: derived from comp.id via the same
// "uuid v5 namespace" trick (here: a deterministic FNV-1a → bytes →
// uuid format). Re-running mints the same variant-id, so subsequent
// runs find their work via the existing `componentByVariantTuple`
// lookup and emit zero changes.
//
// Scope of THIS phase: OdsChip (12), OdsInitialsAvatar (8 names),
// OdsCardTile (3 accents) — 23 variant components total + 3
// mod-component repoints on the canonical Phase-3a records. OdsIcon's
// 48-cell matrix is deferred to a separate phase — too many components
// for one push.
//
// Usage:
//   PENPOT_TOKEN=<pat> node scripts/penpot-build-phase-3b-variants.mjs

import {randomUUID} from "node:crypto";
import {readFileSync, readdirSync, statSync} from "node:fs";
import {dirname, resolve, join} from "node:path";
import {fileURLToPath} from "node:url";

import {CANONICAL_FILE_ID, FEATURES, ROOT_FRAME_ID, getFile, rpc, requireToken} from "./_penpot-rpc.mjs";
import {makeFrame, makeRect, makeText} from "./_penpot-shapes.mjs";

requireToken("penpot-build-phase-3b-variants.mjs");

const FILE_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = resolve(REPO, "docs/penpot/specs/components.json");
const BACKUPS_DIR = resolve(REPO, ".penpot-backups");
const ROOT = ROOT_FRAME_ID;

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
const text = (args) => makeText({fontFamily: D.fontFamily, fontId: D.fontId, ...args});

// Stable variant-id per atom: derive from comp.id so re-runs match.
// Uses a simple FNV-1a → 16-byte hash → uuid v4-shaped string. Not a
// real v5 (no namespace), but deterministic enough for our needs.
function variantIdFor(compId) {
    const bytes = new Uint8Array(16);
    let h = 0x811c9dc5n;
    const FNV_PRIME = 0x01000193n;
    const data = new TextEncoder().encode(`phase-3b:${compId}`);
    for (let i = 0; i < 16; i++) {
        for (const b of data) {
            h = BigInt.asUintN(32, h ^ BigInt(b));
            h = BigInt.asUintN(32, h * FNV_PRIME);
        }
        bytes[i] = Number((h >> BigInt(i % 24)) & 0xffn);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;  // v4 shape
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

// ---------- bucket palette (mirrors penpot-build-phase-3-components.mjs) ----------

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
    return (sum % 8) + 1;
}

// ---------- variant-shape emitters (one per kind) ----------

// Each emitter returns:
//   {children: [<shape-obj>...], width, height}
// Children are pre-frameId'd and ready to be wrapped in a frame.

function emitChipVariant({frameId, baseX, baseY, variant, row}) {
    const chipH = 28;
    const padX = row.withIcon ? 28 : 12;
    const chipW = Math.max(80, variant.label.length * 8 + padX + 12);
    const children = [];
    children.push(makeRect({
        id: randomUUID(), name: `body`,
        x: baseX, y: baseY, w: chipW, h: chipH,
        fillColor: variant.literalBg, radius: 999,
        frameId,
    }));
    if (row.withIcon) {
        children.push(makeRect({
            id: randomUUID(), name: `icon`,
            x: baseX + 8, y: baseY + 7, w: 14, h: 14,
            fillColor: variant.literalFg, radius: 999,
            frameId,
        }));
    }
    children.push(text({
        id: randomUUID(), name: `label`,
        x: baseX + padX, y: baseY + 5, w: chipW - padX - 8, h: 18,
        content: variant.label,
        fontSize: 12, fill: variant.literalFg, weight: "500",
        frameId,
    }));
    return {children, width: chipW, height: chipH};
}

function emitAvatarVariant({frameId, baseX, baseY, name, size}) {
    const letter = name[0];
    const bucket = bucketForLetter(letter);
    const fill = BUCKET_HEX[(bucket - 1 + 8) % 8];
    const children = [];
    children.push(makeRect({
        id: randomUUID(), name: `body`,
        x: baseX, y: baseY, w: size, h: size,
        fillColor: fill, radius: 999,
        frameId,
    }));
    children.push(text({
        id: randomUUID(), name: `letter`,
        x: baseX, y: baseY + (size - 18) / 2, w: size, h: 18,
        content: letter,
        fontSize: Math.round(size * 0.42), fill: "#FFFFFF", weight: "600",
        frameId,
    }));
    return {children, width: size, height: size};
}

function emitTileVariant({frameId, baseX, baseY, accent, size}) {
    const children = [];
    if (accent.key === "preview") {
        children.push(makeRect({
            id: randomUUID(), name: `body`,
            x: baseX, y: baseY, w: size, h: size,
            fillColor: "#F1F3F5", radius: 6,
            strokeColor: "#DEE2E6", strokeWidth: 1,
            frameId,
        }));
        children.push(text({
            id: randomUUID(), name: `label`,
            x: baseX, y: baseY + (size - 22) / 2, w: size, h: 22,
            content: accent.labelText,
            fontSize: 18, fill: "#ADB5BD", weight: "400",
            frameId,
        }));
    } else if (accent.key === "initial") {
        const b = bucketForLetter(accent.labelText[0]);
        children.push(makeRect({
            id: randomUUID(), name: `body`,
            x: baseX, y: baseY, w: size, h: size,
            fillColor: BUCKET_HEX[(b - 1 + 8) % 8], radius: 6,
            frameId,
        }));
        children.push(text({
            id: randomUUID(), name: `label`,
            x: baseX, y: baseY + (size - 22) / 2, w: size, h: 22,
            content: accent.labelText,
            fontSize: 24, fill: "#FFFFFF", weight: "600",
            frameId,
        }));
    } else {  // ext
        children.push(makeRect({
            id: randomUUID(), name: `body`,
            x: baseX, y: baseY, w: size, h: size,
            fillColor: "#FFFFFF", radius: 6,
            strokeColor: "#DEE2E6", strokeWidth: 1,
            frameId,
        }));
        children.push(makeRect({
            id: randomUUID(), name: `spine`,
            x: baseX, y: baseY, w: 3, h: size,
            fillColor: accent.literalAccent || "#D6336C",
            frameId,
        }));
        children.push(text({
            id: randomUUID(), name: `label`,
            x: baseX + 8, y: baseY + size - 26, w: size - 16, h: 18,
            content: accent.labelText,
            fontSize: 13, fill: accent.literalAccent || "#D6336C", weight: "600",
            frameId,
        }));
    }
    return {children, width: size, height: size};
}

// Per-kind enumeration. Returns an array of cells, each with:
//   {variantProps, emit: (frameId, baseX, baseY) => {children,width,height},
//    coords: {x, y}, cellName, oldNames: [...legacy shape names to delete],
//    isMain: bool}
function enumerateVariants(comp) {
    const s = comp.specimens;
    const main = comp.main;
    const matrixX0 = D.marginX + 200;
    const matrixY0 = comp.y + D.sectionContentOffset;
    const labelW = s.rowLabelWidth || 140;

    if (s.kind === "chipMatrix") {
        const colW = 160, rowH = 56;
        const cells = [];
        for (let ri = 0; ri < s.rows.length; ri++) {
            const row = s.rows[ri];
            for (let vi = 0; vi < s.variants.length; vi++) {
                const variant = s.variants[vi];
                const isMain = variant.key === main.variant && row.withIcon === false && !main.withIcon;
                const oldName = `__phase3.${comp.id}.${variant.key}.${row.key}`;
                cells.push({
                    variantProps: [
                        {name: "Variant", value: variant.label},
                        {name: "With Icon", value: row.withIcon ? "Yes" : "No"},
                    ],
                    coords: {x: matrixX0 + labelW + vi * colW, y: matrixY0 + ri * rowH},
                    cellName: `__phase3b.${comp.id}.${variant.key}.${row.key}`,
                    oldNames: [oldName, `${oldName}.label`, `${oldName}.icon`],
                    isMain,
                    emit: (frameId, baseX, baseY) =>
                        emitChipVariant({frameId, baseX, baseY, variant, row}),
                });
            }
        }
        return cells;
    }
    if (s.kind === "avatarRow") {
        const size = s.size;
        const cells = [];
        for (let i = 0; i < s.names.length; i++) {
            const name = s.names[i];
            const letter = name[0];
            const isMain = letter === main.letter;
            const oldName = `__phase3.${comp.id}.${name.toLowerCase()}`;
            cells.push({
                variantProps: [{name: "Name", value: name}],
                coords: {x: matrixX0 + labelW + i * (size + 12), y: matrixY0},
                cellName: `__phase3b.${comp.id}.${name.toLowerCase()}`,
                oldNames: [oldName, `${oldName}.letter`, `${oldName}.name`],
                isMain,
                emit: (frameId, baseX, baseY) =>
                    emitAvatarVariant({frameId, baseX, baseY, name, size}),
            });
        }
        return cells;
    }
    if (s.kind === "tileRow") {
        const size = s.size;
        const cells = [];
        for (let i = 0; i < s.accents.length; i++) {
            const accent = s.accents[i];
            const isMain = accent.key === main.accent;
            const oldName = `__phase3.${comp.id}.${accent.key}`;
            cells.push({
                variantProps: [{name: "Accent", value: accent.label}],
                coords: {x: matrixX0 + labelW + i * (size + 24), y: matrixY0},
                cellName: `__phase3b.${comp.id}.${accent.key}`,
                oldNames: [oldName, `${oldName}.label`, `${oldName}.spine`, `${oldName}.caption`],
                isMain,
                emit: (frameId, baseX, baseY) =>
                    emitTileVariant({frameId, baseX, baseY, accent, size}),
            });
        }
        return cells;
    }
    return null;  // iconMatrix — deferred
}

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
const objects = targetPage.objects;
const existingNames = new Map();   // name → {id, type}
for (const [sid, s] of Object.entries(objects)) {
    if (s?.name) existingNames.set(s.name, {id: sid, type: s.type});
}
const componentsList = file.data.components || {};

// Build a (name, propertiesKey) → component lookup. propertiesKey is
// the joined "n1=v1|n2=v2" string of the component's variant-properties.
function propsKey(props) {
    return (props || []).map((p) => `${p.name}=${p.value}`).sort().join("|");
}
const componentByVariantTuple = new Map();
for (const [cid, c] of Object.entries(componentsList)) {
    const k = `${c.name}::${propsKey(c.variantProperties || c["variant-properties"] || [])}`;
    componentByVariantTuple.set(k, {id: cid, ...c});
}

const delObjChanges = [];
const addObjChanges = [];
const addCompChanges = [];
const modCompChanges = [];

for (const comp of SPEC.components) {
    const cells = enumerateVariants(comp);
    if (!cells) {
        console.error(`skip: ${comp.name} (kind=${comp.specimens.kind} not in phase-3b scope)`);
        continue;
    }
    const variantId = variantIdFor(comp.id);
    console.error(`\n${comp.name} (${cells.length} variants) variant-id=${variantId}`);

    for (const cell of cells) {
        const tupleKey = `${comp.name}::${propsKey(cell.variantProps)}`;
        const existing = componentByVariantTuple.get(tupleKey);

        // For every cell — main OR not — delete the legacy Phase-3a
        // matrix-cell specimen shapes. The main cell's visual is now
        // the canonical `__phase3.<id>.main` frame; the matrix cell's
        // old rect/text duplicates are redundant.
        for (const oldName of cell.oldNames) {
            const found = existingNames.get(oldName);
            if (found) {
                delObjChanges.push({type: "del-obj", "page-id": targetPageId, id: found.id});
                existingNames.delete(oldName);
            }
        }

        if (cell.isMain) {
            // The canonical Phase-3a record (no variant-id yet) is
            // looked up via the empty-tuple key. If a component with
            // the *exact* expected variant-properties already exists,
            // we're already done. The earlier fall-back to
            // `Object.values().find(...)` was DANGEROUS — it could
            // grab a sibling variant after Phase-3b had partially run
            // and overwrite its variant-properties.
            if (existing) {
                const currentVid = existing.variantId || existing["variant-id"];
                if (currentVid === variantId) {
                    console.error(`  main: ${propsKey(cell.variantProps)} already correct — skip`);
                    continue;
                }
            }
            const canonical = componentByVariantTuple.get(`${comp.name}::`);
            if (!canonical) {
                console.error(`  main: no empty-tuple ${comp.name} canonical (already migrated?) — skip`);
                continue;
            }
            modCompChanges.push({
                type: "mod-component",
                id: canonical.id,
                "variant-id": variantId,
                "variant-properties": cell.variantProps,
            });
            console.error(`  main: mod ${canonical.id.slice(0, 8)}… → ${propsKey(cell.variantProps)}`);
            continue;
        }

        if (existing) {
            console.error(`  skip: ${propsKey(cell.variantProps)} already a component (${existing.id.slice(0, 8)}…)`);
            continue;
        }

        const frameId = randomUUID();
        const frameName = `${cell.cellName}.main`;
        const {children, width, height} = cell.emit(frameId, cell.coords.x, cell.coords.y);
        for (const c of children) {
            c.name = `${frameName}.${c.name}`;
        }
        const frame = makeFrame({
            id: frameId, name: frameName,
            x: cell.coords.x, y: cell.coords.y, w: width, h: height,
            children: children.map((c) => c.id),
        });
        addObjChanges.push({type: "add-obj", id: frame.id, "page-id": targetPageId,
                            "frame-id": ROOT, "parent-id": ROOT, obj: frame});
        for (const child of children) {
            addObjChanges.push({type: "add-obj", id: child.id, "page-id": targetPageId,
                                "frame-id": ROOT, "parent-id": ROOT, obj: child});
        }
        addCompChanges.push({
            type: "add-component",
            id: randomUUID(),
            name: comp.name,
            path: comp.path,
            "main-instance-id": frameId,
            "main-instance-page": targetPageId,
            "variant-id": variantId,
            "variant-properties": cell.variantProps,
        });
        console.error(`  new: ${propsKey(cell.variantProps)}  frame=${frameId.slice(0, 8)}…`);
    }
}

if (delObjChanges.length === 0 && addObjChanges.length === 0
    && addCompChanges.length === 0 && modCompChanges.length === 0) {
    console.error(`nothing to do.`);
    process.exit(0);
}

const allChanges = [...delObjChanges, ...addObjChanges, ...addCompChanges, ...modCompChanges];
console.error(
    `shipping: ${delObjChanges.length} del-obj + ${addObjChanges.length} add-obj + ` +
    `${addCompChanges.length} add-component + ${modCompChanges.length} mod-component ` +
    `(revn=${revn})`
);
const resp = await rpc("update-file", {
    id: FILE_ID, revn, vern,
    "session-id": randomUUID(),
    features: FEATURES,
    changes: allChanges,
    skipValidate: false,
});
console.error(`✓ revn → ${resp.revn ?? "?"}`);
