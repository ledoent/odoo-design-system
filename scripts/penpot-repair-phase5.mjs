#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 5 repair — fixes three design-quality issues in the live file:
//
//   1. BooleanToggle thumb x position (build script placed all thumbs at
//      frameX+18, the mid-track dead zone):
//        off states (empty / error / readonly) → frameX + 4
//        on  states (filled / focused)         → frameX + 20
//
//   2. One2Many list-header fill: constant #dee2e6 (was containerBorder-
//      driven — turned blue in Focused, red in Error, transparent in Readonly).
//
//   3. Icon / caret / tag-chip fills: constant #adb5bd (was containerBorder-
//      driven — same blue/red/transparent problem).
//      Targets: date.icon, datetime.icon, selection.caret, many2one.icon,
//               image.icon, many2many-tags.tag
//
// Usage:
//   PENPOT_TOKEN=… node scripts/penpot-repair-phase5.mjs

import { randomUUID } from "node:crypto";
import {
    CANONICAL_FILE_ID, FEATURES, getFile, rpc, requireToken,
} from "./_penpot-rpc.mjs";

requireToken("penpot-repair-phase5.mjs");

const FILE_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const PAGE_ID = "2426b3eb-e4fd-46f0-9ccd-eb5b3eefd66b";

const OFF_STATES = new Set(["empty", "error", "readonly"]);

function modObjOp(shapeId, operations) {
    return { type: "mod-obj", "page-id": PAGE_ID, id: shapeId, operations };
}

function moveX(shape, newX) {
    // Only update x — Penpot recomputes the geometric envelope server-side.
    return [{ type: "set", attr: "x", val: newX }];
}

function setFillOps(color) {
    return [{ type: "set", attr: "fills", val: [{ "fill-color": color, "fill-opacity": 1 }] }];
}

async function run() {
    console.error("Loading file…");
    const file = await getFile(FILE_ID);
    const page = file.data?.pagesIndex?.[PAGE_ID];
    if (!page) { console.error(`Page ${PAGE_ID} not found`); process.exit(1); }

    const objs = page.objects ?? {};
    const changes = [];
    let fixed = 0;

    // --- 1. BooleanToggle thumb x --------------------------------------------
    console.error("\n1. BooleanToggle thumb positions");
    for (const [id, shape] of Object.entries(objs)) {
        const m = shape.name?.match(/^__phase5\.boolean-toggle\.(\w+)\.thumb$/);
        if (!m) continue;
        const stateName = m[1];
        const frameRef = shape["frame-id"] ?? shape.frameId;
        const frame = objs[frameRef];
        if (!frame) { console.error(`  WARN: no frame for ${shape.name} (frameId=${frameRef})`); continue; }

        const relX   = OFF_STATES.has(stateName) ? 4 : 20;
        const newAbsX = frame.x + relX;
        if (Math.abs((shape.x ?? 0) - newAbsX) < 0.5) {
            console.error(`  skip ${shape.name} (already correct)`);
            continue;
        }
        console.error(`  fix ${shape.name}: x ${shape.x} → ${newAbsX} (${stateName}=${OFF_STATES.has(stateName) ? "off" : "on"})`);
        changes.push(modObjOp(id, moveX(shape, newAbsX)));
        fixed++;
    }

    // --- 2. One2Many header: constant #dee2e6 fill ---------------------------
    console.error("\n2. One2Many header fills");
    for (const [id, shape] of Object.entries(objs)) {
        if (!shape.name?.match(/^__phase5\.one2many\.\w+\.header$/)) continue;
        const current = shape.fills?.[0]?.["fill-color"];
        if (current === "#dee2e6") { console.error(`  skip ${shape.name}`); continue; }
        console.error(`  fix ${shape.name}: ${current ?? "none"} → #dee2e6`);
        changes.push(modObjOp(id, setFillOps("#dee2e6")));
        fixed++;
    }

    // --- 3. Icon / caret / tag-chip: constant #adb5bd fill ------------------
    console.error("\n3. Icon / caret / tag-chip fills");
    const ICON_RE = /^__phase5\.(date|datetime|selection|many2one|image)\.\w+\.(icon|caret)$/;
    const TAG_RE  = /^__phase5\.many2many-tags\.\w+\.tag$/;

    for (const [id, shape] of Object.entries(objs)) {
        if (!ICON_RE.test(shape.name) && !TAG_RE.test(shape.name)) continue;
        const current = shape.fills?.[0]?.["fill-color"];
        if (current === "#adb5bd") { console.error(`  skip ${shape.name}`); continue; }
        console.error(`  fix ${shape.name}: ${current ?? "none"} → #adb5bd`);
        changes.push(modObjOp(id, setFillOps("#adb5bd")));
        fixed++;
    }

    if (fixed === 0) {
        console.error("\nNothing to repair — all shapes already correct.");
        return;
    }

    // Split: thumb x-moves go in a separate call because Penpot's validator
    // can reject selrect/points in mod-obj — x-only ops are simpler and safer.
    const thumbChanges = changes.filter(c => {
        const name = objs[c.id]?.name ?? "";
        return name.includes("boolean-toggle") && name.endsWith(".thumb");
    });
    const fillChanges = changes.filter(c => !thumbChanges.includes(c));

    async function sendBatch(label, batch) {
        if (batch.length === 0) return;
        console.error(`\nSending ${batch.length} ${label} ops…`);
        const fresh = await getFile(FILE_ID);
        await rpc("update-file", {
            id: FILE_ID,
            "session-id": randomUUID(),
            revn: fresh.revn ?? 0,
            vern: fresh.vern ?? 0,
            features: FEATURES,
            changes: batch,
            skipValidate: false,
        });
        console.error(`  ✓ ${label} done`);
    }

    await sendBatch("fill", fillChanges);
    await sendBatch("thumb-x", thumbChanges);
    console.error(`\n✓ repaired ${fixed} shapes`);
}

run().catch(err => { console.error(err); process.exit(1); });
