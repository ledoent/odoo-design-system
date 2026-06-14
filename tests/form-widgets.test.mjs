// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Contract tests for Phase 5 — Form Field Widgets.
//
// Assertions:
//   1. 60 "Form / Fields" components (12 widgets × 5 states) in the file.
//   2. 3  "Form / Chrome" components (Sheet, FieldGroup, NotebookTab).
//   3. All 5 state variants of each widget share one variant-id.
//   4. Each widget exposes all 5 state variant-property values.
//   5. Every main-instance shape is a :frame (not a leaf).
//   6. All __phase5.* shapes are on page "07 — Backend Templates".
//   7. No orphan __phase5.*.main frames; all children correctly parented.
//
// Skipped automatically when PENPOT_TOKEN is not set.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { CANONICAL_FILE_ID, FEATURES, getFile } from "../scripts/_penpot-rpc.mjs";

const TOKEN = process.env.PENPOT_TOKEN;
if (!TOKEN) {
    console.log("# PENPOT_TOKEN not set — skipping live Penpot check.");
    process.exit(0);
}

const REPO      = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = resolve(REPO, "docs/penpot/specs/form-widgets.json");
const SPEC      = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

const FILE_ID  = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const PAGE_ID  = SPEC.page.id;
const STATES   = SPEC.states;
const WIDGETS  = SPEC.widgets;
const CHROME   = SPEC.chrome;
const MOCK     = SPEC.mock;

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
    console.log("\n=== Phase 5 — Form Widgets contract tests ===\n");

    const file = await getFile(FILE_ID, { components: true });
    const comps = Object.values(file.data?.components ?? {});
    const page  = file.data?.pagesIndex?.[PAGE_ID];
    if (!page) { console.error(`page ${PAGE_ID} not found`); process.exit(1); }
    const objs = page.objects ?? {};

    // --- 1. Component counts -------------------------------------------------
    console.log("1. Component counts");
    const fieldComps  = comps.filter(c => c.path === "Form / Fields");
    const chromeComps = comps.filter(c => c.path === "Form / Chrome");

    const expectedFieldTotal  = WIDGETS.length * STATES.length;
    const expectedChromeTotal = CHROME.length;

    ok(
        `total Form / Fields components = ${expectedFieldTotal}`,
        fieldComps.length === expectedFieldTotal,
        `got ${fieldComps.length}`
    );
    ok(
        `total Form / Chrome components = ${expectedChromeTotal}`,
        chromeComps.length === expectedChromeTotal,
        `got ${chromeComps.length}`
    );
    for (const widget of WIDGETS) {
        const wc = fieldComps.filter(c => c.name === widget.name);
        ok(
            `${widget.name} has ${STATES.length} components`,
            wc.length === STATES.length,
            `got ${wc.length}`
        );
    }
    for (const surf of CHROME) {
        ok(
            `${surf.name} exists in Form / Chrome`,
            chromeComps.some(c => c.name === surf.name),
            "not found"
        );
    }

    // --- 2. Variant-id grouping (field widgets only) -------------------------
    console.log("\n2. Variant-id grouping");
    for (const widget of WIDGETS) {
        const wc = fieldComps.filter(c => c.name === widget.name);
        const variantIds = new Set(wc.map(c => c.variantId).filter(Boolean));
        ok(
            `${widget.name}: all ${STATES.length} variants share one variant-id`,
            variantIds.size === 1,
            variantIds.size === 0
                ? "no variant-id"
                : `${variantIds.size} distinct ids`
        );
    }

    // --- 3. State variant properties -----------------------------------------
    console.log("\n3. State variant properties");
    const expectedLabels = new Set(STATES.map(s => s.variantLabel));
    for (const widget of WIDGETS) {
        const wc = fieldComps.filter(c => c.name === widget.name);
        const actualLabels = new Set(
            wc.flatMap(c => c.variantProperties ?? [])
              .filter(p => p.name === widget.variantAxis)
              .map(p => p.value)
        );
        ok(
            `${widget.name}: variant properties cover all ${STATES.length} states`,
            actualLabels.size === expectedLabels.size &&
            [...expectedLabels].every(v => actualLabels.has(v)),
            `got ${JSON.stringify([...actualLabels])}`
        );
    }

    // --- 4. Main-instance shape types ----------------------------------------
    console.log("\n4. Main-instance shape types");
    const allPhase5Comps = [...fieldComps, ...chromeComps];
    for (const comp of allPhase5Comps) {
        const mainId = comp.mainInstanceId;
        if (!mainId) { ok(`${comp.name} has mainInstanceId`, false, "missing"); continue; }
        const shape = objs[mainId];
        const stateLabel = (comp.variantProperties ?? []).map(p => p.value).join(",") || "–";
        ok(
            `${comp.name} [${stateLabel}] main-instance is :frame`,
            shape?.type === "frame",
            `got type=${shape?.type}`
        );
    }

    // --- 5. Phase 5 shapes on correct page -----------------------------------
    console.log("\n5. Phase 5 shapes on correct page");
    const phase5Shapes = Object.values(objs).filter(s => s.name?.startsWith("__phase5."));

    // Expected shape count formula (mirrors build script logic):
    //   widgets: STATES.length × (widget.children.length + 2) + 1  per widget
    //   chrome:  surf.children.length + 2                           per surface
    //   mock:    MOCK.children.length + 2   (frame + section header)
    const widgetShapes = WIDGETS.reduce(
        (n, w) => n + STATES.length * (w.children.length + 2) + 1, 0
    );
    const chromeShapes = CHROME.reduce(
        (n, s) => n + s.children.length + 2, 0
    );
    const mockShapes = MOCK.children.length + 2;  // frame + children + section header (__phase5.section.mock.header counts as __phase5.*)
    const expectedTotal = widgetShapes + chromeShapes + mockShapes;

    ok(
        `${phase5Shapes.length} __phase5.* shapes (spec predicts ${expectedTotal})`,
        phase5Shapes.length === expectedTotal,
        `got ${phase5Shapes.length}`
    );

    const otherPages = Object.entries(file.data?.pagesIndex ?? {})
        .filter(([id]) => id !== PAGE_ID);
    for (const [, otherPage] of otherPages) {
        const leak = Object.values(otherPage.objects ?? {})
            .filter(s => s.name?.startsWith("__phase5."));
        ok(
            `no __phase5.* shapes leaked to "${otherPage.name}"`,
            leak.length === 0,
            `${leak.length} leaked`
        );
    }

    // --- 6. Mock shape count -------------------------------------------------
    console.log("\n6. Mock shape count");
    const mockShapesOnPage = phase5Shapes.filter(s => s.name?.startsWith("__phase5.mock."));
    // Expected: 1 main frame + MOCK.children.length children.
    // The section header is named __phase5.section.mock.header (prefix __phase5.section.*,
    // not __phase5.mock.*), so it is not counted here — it IS in the overall __phase5.* total.
    const expectedMockCount = MOCK.children.length + 1;
    ok(
        `${mockShapesOnPage.length} __phase5.mock.* shapes (spec: ${expectedMockCount})`,
        mockShapesOnPage.length === expectedMockCount,
        `got ${mockShapesOnPage.length}`
    );

    // --- 7. Orphan check + child parenting -----------------------------------
    console.log("\n7. Orphan check");
    const ROOT_ID = "00000000-0000-0000-0000-000000000000";
    const mainFrames = phase5Shapes.filter(s => s.name?.endsWith(".main"));

    const orphaned = mainFrames.filter(
        s => (s.parentId ?? s["parent-id"]) !== ROOT_ID &&
             (s.frameId  ?? s["frame-id"])  !== ROOT_ID
    );
    ok(
        `no orphaned __phase5.*.main frames (${mainFrames.length} main frames)`,
        orphaned.length === 0,
        orphaned.map(s => s.name).join(", ")
    );

    let misparented = 0;
    for (const frame of mainFrames) {
        const childIds = frame.shapes ?? [];
        for (const childId of childIds) {
            const child = objs[childId];
            if (!child) continue;
            const parentId = child.parentId ?? child["parent-id"];
            if (parentId !== frame.id) {
                misparented++;
                ok(`child "${child.name}" parented to its frame`, false,
                    `parentId=${parentId} expected=${frame.id}`);
            }
        }
    }
    if (misparented === 0) {
        ok(`all children correctly parented to their frames`, true);
    }

    // --- summary -------------------------------------------------------------
    console.log(`\n${passed} passed, ${failed} failed.\n`);
    if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
