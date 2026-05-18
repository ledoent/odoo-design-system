#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Rebuild the canonical "Ledo Odoo Design System" Penpot file to the
// 12-page skeleton mandated by `docs/penpot/PHASED_BUILDOUT.md` →
// Phase 1. Per page authors:
//
//   - A page-background rect (full 1440×900 viewport) bound to the
//     `color.surface.canvas` design token (via the `applied-tokens`
//     PCS attribute discovered in
//     `docs/penpot/specs/token-fill.json`). A theme-set toggle
//     re-skins every page in one click.
//   - A title row at y=0 — "{index} · {name}" in 28 px / 600 weight.
//   - An 8 px baseline-grid overlay (low-opacity vertical lines from
//     y=96 to y=864, locked).
//   - A theme-switcher artboard in the top-right corner — three
//     stacked 220×40 swatches each bound to the corresponding
//     theme set's `color.surface.canvas`, labelled with the theme
//     name.
//
// Safety net: aborts unless a snapshot newer than 24 hours exists in
// `.penpot-backups/`.
//
// Idempotent on re-run: page lookup by name from
// `docs/penpot/specs/pages.json`. Existing pages are kept (rename if
// title differs); missing pages are created. Existing skeleton
// shapes (matched by stable `name` prefixes — `__phase1.bg`,
// `__phase1.title`, etc.) are reused / re-modified instead of
// duplicated.
//
// Usage:
//   PENPOT_TOKEN=<pat> node scripts/penpot-build-phase-1-skeleton.mjs

import {randomUUID} from "node:crypto";
import {readFileSync, readdirSync, statSync} from "node:fs";
import {dirname, resolve, join} from "node:path";
import {fileURLToPath} from "node:url";

const HOST = process.env.PENPOT_HOST || "https://design.hz.ledoweb.com";
const TOKEN = process.env.PENPOT_TOKEN;
const FILE_ID = process.env.PENPOT_FILE_ID || "038df003-0f49-80b2-8008-0774e5399553";

if (!TOKEN) {
    console.error("Set PENPOT_TOKEN (service-account PAT, see .env or memory/penpot_design_credentials.md).");
    process.exit(2);
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_JSON = resolve(REPO, "docs/penpot/specs/pages.json");
const BACKUPS_DIR = resolve(REPO, ".penpot-backups");

// Safety net: refuse to run without a recent local snapshot.
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
let freshSnapshot = null;
try {
    for (const f of readdirSync(BACKUPS_DIR)) {
        const path = join(BACKUPS_DIR, f);
        if (!path.endsWith(".json")) continue;
        const age = Date.now() - statSync(path).mtimeMs;
        if (age < SNAPSHOT_TTL_MS) {
            freshSnapshot = path;
            break;
        }
    }
} catch {/* dir missing */}
if (!freshSnapshot) {
    console.error("No fresh snapshot in .penpot-backups/ (<24h old).");
    console.error("Run `pnpm run penpot:snapshot` first.");
    process.exit(3);
}
console.error(`safety: using snapshot ${freshSnapshot.replace(REPO + "/", "")}`);

const PAGES_SPEC = JSON.parse(readFileSync(PAGES_JSON, "utf8"));
const FEATURES = [
    "design-tokens/v1", "fdata/objects-map", "fdata/path-data",
    "fdata/shape-data-type", "components/v2", "layout/grid",
    "styles/v2", "variants/v1",
];
const ROOT = "00000000-0000-0000-0000-000000000000";
const VIEW_W = 1440;
const VIEW_H = 900;

async function rpc(command, body = {}) {
    const r = await fetch(`${HOST}/api/rpc/command/${command}`, {
        method: "POST",
        headers: {
            "Authorization": `Token ${TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${command} → ${r.status}: ${(await r.text()).slice(0, 600)}`);
    return r.json();
}

// ---------- shape builders ----------

function makeRect({id, name, x, y, w, h, fillColor, appliedTokens, locked = false}) {
    const o = {
        id, type: "rect", name,
        x, y, width: w, height: h, rotation: 0,
        "frame-id": ROOT, "parent-id": ROOT,
        fills: [{"fill-color": fillColor, "fill-opacity": 1}],
        selrect: {x, y, x1: x, y1: y, x2: x + w, y2: y + h, width: w, height: h},
        points: [{x, y}, {x: x + w, y}, {x: x + w, y: y + h}, {x, y: y + h}],
        transform: {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0},
        "transform-inverse": {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0},
    };
    if (appliedTokens) o["applied-tokens"] = appliedTokens;
    if (locked) o.blocked = true;
    return o;
}

function makeText({id, name, x, y, w, h, content, fontSize = 14, fill = "#212529", weight = "400"}) {
    return {
        id, type: "text", name,
        x, y, width: w, height: h, rotation: 0,
        "frame-id": ROOT, "parent-id": ROOT, "grow-type": "auto-height",
        fills: [{"fill-color": fill, "fill-opacity": 1}],
        content: {
            type: "root",
            children: [{
                type: "paragraph-set",
                children: [{
                    type: "paragraph",
                    children: [{
                        text: content,
                        "font-family": "sourcesanspro",
                        "font-id": "gfont-sourcesanspro",
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
        selrect: {x, y, x1: x, y1: y, x2: x + w, y2: y + h, width: w, height: h},
        points: [{x, y}, {x: x + w, y}, {x: x + w, y: y + h}, {x, y: y + h}],
        transform: {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0},
        "transform-inverse": {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0},
    };
}

// Page layout: returns an ordered list of (id, change) tuples ready to feed
// to `update-file` for one page.
function skeletonChanges(pageId, pageIndex, pageName, existingNames = new Set()) {
    const changes = [];
    const addObj = (obj) => changes.push({
        type: "add-obj", id: obj.id, "page-id": pageId,
        "frame-id": ROOT, "parent-id": ROOT, obj,
    });

    // 1. Background rect bound to color.surface.canvas (full viewport, locked).
    if (!existingNames.has("__phase1.bg")) {
        addObj(makeRect({
            id: randomUUID(), name: "__phase1.bg",
            x: 0, y: 0, w: VIEW_W, h: VIEW_H,
            fillColor: "#FFFFFF",
            appliedTokens: {fill: "color.surface.canvas"},
            locked: true,
        }));
    }

    // 2. Title (top of page, above the grid).
    if (!existingNames.has("__phase1.title")) {
        addObj(makeText({
            id: randomUUID(), name: "__phase1.title",
            x: 64, y: 32, w: VIEW_W - 128, h: 48,
            content: `${String(pageIndex).padStart(2, "0")} · ${pageName.replace(/^\d+\s*—\s*/, "")}`,
            fontSize: 28, fill: "#212529", weight: "600",
        }));
    }

    // 3. 8px baseline grid overlay (vertical-line strips, locked).
    if (!existingNames.has("__phase1.grid.0")) {
        const gridTop = 96, gridBottom = 864, step = 8;
        let i = 0;
        for (let yy = gridTop; yy <= gridBottom; yy += step) {
            addObj(makeRect({
                id: randomUUID(), name: `__phase1.grid.${i}`,
                x: 64, y: yy, w: VIEW_W - 128, h: 1,
                fillColor: "#E9ECEF",
                locked: true,
            }));
            i++;
        }
    }

    // 4. Theme-switcher artboard (top-right corner, 240×140).
    //    Three 220×40 swatches, each bound to a theme's
    //    color.surface.canvas. Penpot resolves each binding against
    //    the active theme set; this lets the page double as a visible
    //    spot-check of the active theme.
    if (!existingNames.has("__phase1.switch.light")) {
        const sx = VIEW_W - 240 - 24;
        const sy = 32;
        const themes = [
            {name: "light", token: "color.surface.canvas",
             label: "theme-light surface.canvas", fillColor: "#FFFFFF"},
            {name: "dark", token: "color.surface.canvas",
             label: "theme-dark surface.canvas", fillColor: "#0F1115"},
            {name: "high-contrast", token: "color.surface.canvas",
             label: "theme-high-contrast surface.canvas", fillColor: "#FFFFFF"},
        ];
        themes.forEach((t, idx) => {
            const yy = sy + idx * 44;
            addObj(makeRect({
                id: randomUUID(), name: `__phase1.switch.${t.name}`,
                x: sx, y: yy, w: 220, h: 40,
                fillColor: t.fillColor,
                appliedTokens: {fill: t.token},
            }));
            addObj(makeText({
                id: randomUUID(), name: `__phase1.switch-label.${t.name}`,
                x: sx + 10, y: yy + 12, w: 200, h: 16,
                content: t.name,
                fontSize: 11, fill: idx === 1 ? "#F8F9FA" : "#495057", weight: "500",
            }));
        });
    }

    return changes;
}

// ---------- main ----------

const file = await rpc("get-file", {id: FILE_ID, features: FEATURES});
let revn = file.revn;
const vern = file.vern || 0;
console.error(`canonical revn=${revn}, ${Object.keys(file.data.pagesIndex).length} pages currently`);

const targetPages = PAGES_SPEC.pages;
const existingByName = new Map();
for (const pid of file.data.pages) {
    const name = file.data.pagesIndex[pid]?.name || "";
    existingByName.set(name, pid);
}

// Pass 1: ensure all 12 target pages exist; rename / create as needed.
let pageChanges = [];
const pageIdByTargetName = new Map();
for (const spec of targetPages) {
    const existing = existingByName.get(spec.name);
    if (existing) {
        pageIdByTargetName.set(spec.name, existing);
        continue;
    }
    // Try to find a prior-name match (`00 — Overview` → still `00 — Cover`?).
    // Match by index prefix.
    const prefix = String(spec.index).padStart(2, "0") + " — ";
    const oldEntry = [...existingByName.entries()].find(([n]) => n.startsWith(prefix));
    if (oldEntry) {
        // rename
        pageChanges.push({type: "mod-page", id: oldEntry[1], name: spec.name});
        pageIdByTargetName.set(spec.name, oldEntry[1]);
        existingByName.delete(oldEntry[0]);
    } else {
        // create
        const newId = randomUUID();
        pageChanges.push({type: "add-page", id: newId, name: spec.name});
        pageIdByTargetName.set(spec.name, newId);
    }
}

// Pass 2: delete any pages that aren't in the spec (Phase 1 forces 12 pages).
for (const [name, pid] of existingByName) {
    if (!pageIdByTargetName.has(name) && !targetPages.some((p) => p.name === name)) {
        pageChanges.push({type: "del-page", id: pid});
    }
}

if (pageChanges.length) {
    console.error(`page-level changes: ${pageChanges.length}`);
    const r = await rpc("update-file", {
        id: FILE_ID, "session-id": randomUUID(), revn, vern, features: FEATURES,
        changes: pageChanges,
    });
    revn = (r.lagged && r.lagged[r.lagged.length - 1]?.revn) || r.revn;
    console.error(`✓ page-level changes applied; revn → ${revn}`);
}

// Re-fetch to get the canonical state with all 12 pages.
const after = await rpc("get-file", {id: FILE_ID, features: FEATURES});
revn = after.revn;

// Pass 2.5: purge any non-skeleton shapes left over from pre-Phase-1
// content. Pages that were renamed-in-place (`mod-page`) keep their
// shape list; clear anything that doesn't match the `__phase1.*` name
// convention so the canvas is reduced to just the skeleton.
const purgeChanges = [];
for (const spec of targetPages) {
    const pid = pageIdByTargetName.get(spec.name);
    const page = after.data.pagesIndex[pid];
    if (!page) continue;
    for (const [oid, obj] of Object.entries(page.objects || {})) {
        if (oid === ROOT) continue;
        if ((obj.name || "").startsWith("__phase1.")) continue;
        purgeChanges.push({type: "del-obj", "page-id": pid, id: oid});
    }
}
if (purgeChanges.length) {
    const r = await rpc("update-file", {
        id: FILE_ID, "session-id": randomUUID(), revn, vern, features: FEATURES,
        changes: purgeChanges,
    });
    revn = (r.lagged && r.lagged[r.lagged.length - 1]?.revn) || r.revn;
    console.error(`✓ purged ${purgeChanges.length} non-skeleton shapes; revn → ${revn}`);
}

// Pass 3: per-page skeleton authoring.
for (const spec of targetPages) {
    const pid = pageIdByTargetName.get(spec.name);
    const page = after.data.pagesIndex[pid];
    const existingNames = new Set(
        Object.values(page?.objects || {}).map((o) => o.name),
    );
    const changes = skeletonChanges(pid, spec.index, spec.name, existingNames);
    if (!changes.length) {
        console.error(`  ${spec.name}: skeleton already populated`);
        continue;
    }
    const r = await rpc("update-file", {
        id: FILE_ID, "session-id": randomUUID(), revn, vern, features: FEATURES,
        changes,
    });
    revn = (r.lagged && r.lagged[r.lagged.length - 1]?.revn) || r.revn;
    console.error(`  ${spec.name}: +${changes.length} shapes  revn → ${revn}`);
}

const final = await rpc("get-file", {id: FILE_ID, features: FEATURES});
console.error(
    `\nfinal: ${Object.keys(final.data.pagesIndex).length} pages, ` +
    `${Object.values(final.data.pagesIndex).reduce((a, p) => a + Object.keys(p.objects || {}).length, 0)} shapes total, revn=${final.revn}`,
);
