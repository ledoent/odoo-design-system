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

import {CANONICAL_FILE_ID, FEATURES, ROOT_FRAME_ID, getFile, rpc, requireToken} from "./_penpot-rpc.mjs";
import {makeRect, makeText} from "./_penpot-shapes.mjs";

requireToken("penpot-build-phase-1-skeleton.mjs");

const FILE_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
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
const ROOT = ROOT_FRAME_ID;
const VIEW_W = 1440;
const VIEW_H = 900;

// Shape builders live in `_penpot-shapes.mjs` — same source consumed
// by Phase 2's specimen builder. See that module for the full
// signatures; `makeRect({locked: true})` and `makeText({fontSize,
// fill, weight})` are the only forms Phase 1 needs.

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
    //    Three 220×40 swatches showing the LITERAL surface.canvas fill
    //    each theme resolves to. We can't bind these via
    //    `appliedTokens.fill` because Penpot's per-shape token
    //    resolution always uses the currently-active theme — there's
    //    no "use theme-light for this shape, theme-dark for that one"
    //    mechanism. The fills below are the literal hex values from
    //    `odoo_design_system/static/src/tokens/design-system.dtcg.json`
    //    so editing those in Penpot's Tokens panel won't drift this
    //    spot-check; a follow-up phase can swap to library-color
    //    references if Penpot ships per-shape theme overrides.
    if (!existingNames.has("__phase1.switch.light")) {
        const sx = VIEW_W - 240 - 24;
        const sy = 32;
        const themes = [
            {name: "light",         fillColor: "#FFFFFF", textColor: "#495057"},
            {name: "dark",          fillColor: "#0F1115", textColor: "#F8F9FA"},
            {name: "high-contrast", fillColor: "#FFFFFF", textColor: "#000000"},
        ];
        themes.forEach((t, idx) => {
            const yy = sy + idx * 44;
            addObj(makeRect({
                id: randomUUID(), name: `__phase1.switch.${t.name}`,
                x: sx, y: yy, w: 220, h: 40, fillColor: t.fillColor,
            }));
            addObj(makeText({
                id: randomUUID(), name: `__phase1.switch-label.${t.name}`,
                x: sx + 10, y: yy + 12, w: 200, h: 16,
                content: t.name,
                fontSize: 11, fill: t.textColor, weight: "500",
            }));
        });
    }

    return changes;
}

// ---------- main ----------

const file = await getFile(FILE_ID);
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
const after = await getFile(FILE_ID);
revn = after.revn;

// Pass 2.5: purge non-DS-authored shapes left over from pre-Phase-1
// content. Pages renamed-in-place (`mod-page`) keep their shape list;
// clear anything that doesn't match the `__phase<N>.*` convention so
// the canvas is reduced to the design-system skeleton (Phase 1) plus
// whatever later phases have added (Phase 2 specimens, etc.).
const PHASE_NAME_RE = /^__phase\d+\./;
const purgeChanges = [];
for (const spec of targetPages) {
    const pid = pageIdByTargetName.get(spec.name);
    const page = after.data.pagesIndex[pid];
    if (!page) continue;
    for (const [oid, obj] of Object.entries(page.objects || {})) {
        if (oid === ROOT) continue;
        if (PHASE_NAME_RE.test(obj.name || "")) continue;
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

const final = await getFile(FILE_ID);
console.error(
    `\nfinal: ${Object.keys(final.data.pagesIndex).length} pages, ` +
    `${Object.values(final.data.pagesIndex).reduce((a, p) => a + Object.keys(p.objects || {}).length, 0)} shapes total, revn=${final.revn}`,
);
