// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Contract tests for Phase 4 — Backend Chrome.
//
// Assertions:
//   1. File has 12 new library components in the Chrome/** paths
//      (4 surfaces × 3 theme variants).
//   2. Each surface's 3 components share the same variant-id (one
//      variant-set per surface).
//   3. Every component has a distinct (Theme=<value>) variant property.
//   4. Every main-instance shape is a :frame (not a leaf — leaf shapes
//      crash the Assets-panel thumbnail renderer per ledoent/penpot#1).
//   5. All __phase4.* shapes are on page "07 — Backend Templates".
//   6. No orphan __phase4.* shapes are outside a frame parent.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { CANONICAL_FILE_ID, FEATURES, getFile } from "../scripts/_penpot-rpc.mjs";

if (!process.env.PENPOT_TOKEN) {
    console.log("# PENPOT_TOKEN not set — skipping live Penpot check.");
    process.exit(0);
}

const REPO      = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = resolve(REPO, "docs/penpot/specs/backend-chrome.json");
const SPEC      = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

const FILE_ID   = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const PAGE_ID   = SPEC.page.id;
const SURFACES  = SPEC.surfaces;
const THEMES    = SPEC.themes;

let passed = 0;
let failed = 0;

function ok(label, cond, detail = "") {
    if (cond) {
        console.log(`  ✓ ${label}`);
        passed++;
    } else {
        console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`);
        failed++;
    }
}

async function run() {
    console.log("\n=== Phase 4 — Backend Chrome contract tests ===\n");

    const file  = await getFile(FILE_ID, { components: true });
    const comps = Object.values(file.data?.components ?? {});
    const page  = file.data?.pagesIndex?.[PAGE_ID];
    assert.ok(page, `page ${PAGE_ID} not found`);
    const objs = page.objects ?? {};

    // --- 1. Component counts ------------------------------------------------
    console.log("1. Component counts");
    const EXPECTED_PER_SURFACE = THEMES.length; // 3
    const EXPECTED_TOTAL = SURFACES.length * EXPECTED_PER_SURFACE; // 12

    const chromeComps = comps.filter(c => c.path?.startsWith("Chrome /"));
    ok(
        `total Chrome components = ${EXPECTED_TOTAL}`,
        chromeComps.length === EXPECTED_TOTAL,
        `got ${chromeComps.length}`
    );

    for (const surface of SURFACES) {
        const surfaceComps = chromeComps.filter(
            c => c.name === surface.name && c.path === surface.path
        );
        ok(
            `${surface.name} has ${EXPECTED_PER_SURFACE} components`,
            surfaceComps.length === EXPECTED_PER_SURFACE,
            `got ${surfaceComps.length}`
        );
    }

    // --- 2. Variant-id grouping ---------------------------------------------
    console.log("\n2. Variant-id grouping");
    for (const surface of SURFACES) {
        const surfaceComps = chromeComps.filter(
            c => c.name === surface.name && c.path === surface.path
        );
        const variantIds = new Set(surfaceComps.map(c => c.variantId).filter(Boolean));
        ok(
            `${surface.name}: all variants share one variant-id`,
            variantIds.size === 1,
            variantIds.size === 0
                ? "no variant-id (components missing?)"
                : `${variantIds.size} distinct ids: ${[...variantIds].join(", ")}`
        );
    }

    // --- 3. Distinct theme variant properties --------------------------------
    console.log("\n3. Theme variant properties");
    for (const surface of SURFACES) {
        const surfaceComps = chromeComps.filter(
            c => c.name === surface.name && c.path === surface.path
        );
        const themeValues = new Set(
            surfaceComps.flatMap(c => c.variantProperties ?? [])
                .filter(p => p.name === surface.variantAxis)
                .map(p => p.value)
        );
        const expected = new Set(THEMES.map(t => t.variantLabel));
        ok(
            `${surface.name}: variant properties cover all 3 themes`,
            themeValues.size === expected.size &&
            [...expected].every(v => themeValues.has(v)),
            `got ${JSON.stringify([...themeValues])}`
        );
    }

    // --- 4. Main-instance shapes are :frame ---------------------------------
    console.log("\n4. Main-instance shape types");
    for (const comp of chromeComps) {
        const mainId = comp.mainInstanceId;
        if (!mainId) { ok(`${comp.name} has mainInstanceId`, false, "missing"); continue; }
        const shape = objs[mainId];
        ok(
            `${comp.name} [${comp.variantProperties?.map(p => p.value).join(",")}] main-instance is :frame`,
            shape?.type === "frame",
            `got type=${shape?.type}`
        );
    }

    // --- 5. All __phase4.* shapes on correct page ---------------------------
    console.log("\n5. Phase 4 shapes on correct page");
    const phase4Shapes = Object.values(objs).filter(s => s.name?.startsWith("__phase4."));

    // Expected = per surface: THEMES×(1 frame + N children + 1 label) + 1 section header
    const expectedShapeCount = SURFACES.reduce(
        (n, s) => n + THEMES.length * (s.children.length + 2) + 1, 0
    );
    ok(
        `${phase4Shapes.length} __phase4.* shapes (spec predicts ${expectedShapeCount})`,
        phase4Shapes.length === expectedShapeCount,
        `got ${phase4Shapes.length}`
    );

    // Verify no phase4 shapes on other pages
    const otherPages = Object.entries(file.data?.pagesIndex ?? {})
        .filter(([id]) => id !== PAGE_ID);
    for (const [otherId, otherPage] of otherPages) {
        const leak = Object.values(otherPage.objects ?? {}).filter(
            s => s.name?.startsWith("__phase4.")
        );
        ok(
            `no __phase4.* shapes leaked to "${otherPage.name}"`,
            leak.length === 0,
            `${leak.length} leaked`
        );
    }

    // --- 6. Orphan check + child-in-frame parenting -------------------------
    console.log("\n6. Orphan check");
    const ROOT = "00000000-0000-0000-0000-000000000000";
    const mainFrames = phase4Shapes.filter(s => s.name?.endsWith(".main"));

    // Main frames must be parented to ROOT
    const orphanedFrames = mainFrames.filter(
        s => (s.parentId ?? s["parent-id"]) !== ROOT &&
             (s.frameId  ?? s["frame-id"])  !== ROOT
    );
    ok(
        `no orphaned __phase4.*.main frames (${mainFrames.length} main frames)`,
        orphanedFrames.length === 0,
        orphanedFrames.map(s => s.name).join(", ")
    );

    // Children of each main frame must be parented to their frame (not ROOT).
    // Double-parenting (child in frame.shapes AND rootFrame.shapes) is a known
    // Penpot API bug — the phase-3b repair script hit this exact issue.
    let misparentedCount = 0;
    for (const frame of mainFrames) {
        const childIds = frame.shapes ?? frame["shapes"] ?? [];
        for (const childId of childIds) {
            const child = objs[childId];
            if (!child) continue;
            const parentId = child.parentId ?? child["parent-id"];
            if (parentId !== frame.id) {
                misparentedCount++;
                ok(
                    `child "${child.name}" parented to its frame`,
                    false,
                    `parentId=${parentId} expected=${frame.id}`
                );
            }
        }
    }
    if (misparentedCount === 0) {
        ok(`all children correctly parented to their frames`, true);
    }

    // --- summary ------------------------------------------------------------
    console.log(`\n${passed} passed, ${failed} failed.\n`);
    if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
