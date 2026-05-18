// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Shared-Components-page contract test for Phase 3. Asserts:
//
//   1. Each atom declared in `docs/penpot/specs/components.json` has
//      a corresponding Penpot library component (lookup by `name` in
//      `data.components`).
//   2. Each component points at an existing main-instance shape on
//      the Shared Components page.
//   3. Every specimen declared by the spec exists on the canvas with
//      the expected name (spec → canvas).
//   4. No orphan `__phase3.*` shape on the page is missing from the
//      spec (canvas → spec parity, mirroring foundations.test.mjs).
//
// Skipped automatically when `PENPOT_TOKEN` is not set.

import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";

import {getFile} from "../scripts/_penpot-rpc.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_SPEC = JSON.parse(readFileSync(resolve(ROOT, "docs/penpot/specs/pages.json"), "utf8"));
const COMPS_SPEC = JSON.parse(readFileSync(resolve(ROOT, "docs/penpot/specs/components.json"), "utf8"));

const TOKEN = process.env.PENPOT_TOKEN;
const FILE_ID = process.env.PENPOT_FILE_ID || PAGES_SPEC.file["file-id"];

// Compute the set of shape names the build script should have authored
// for each component. Mirrors the emitter logic in
// `scripts/penpot-build-phase-3-components.mjs` 1:1.
function expectedShapeNames() {
    const names = [];
    for (const comp of COMPS_SPEC.components) {
        names.push(`__phase3.${comp.id}.header`);
        names.push(`__phase3.${comp.id}.main`);
        const s = comp.specimens;
        switch (s.kind) {
            case "iconMatrix":
                for (const set of s.sets) {
                    names.push(`__phase3.${comp.id}.row.${set}.label`);
                    for (const ico of s.samples) {
                        names.push(`__phase3.${comp.id}.${set}.${ico}`);
                    }
                }
                break;
            case "chipMatrix":
                for (const row of s.rows) {
                    names.push(`__phase3.${comp.id}.row.${row.key}.label`);
                    for (const v of s.variants) {
                        names.push(`__phase3.${comp.id}.${v.key}.${row.key}`);
                    }
                }
                break;
            case "avatarRow":
                names.push(`__phase3.${comp.id}.row.label`);
                for (const nm of s.names) {
                    names.push(`__phase3.${comp.id}.${nm.toLowerCase()}`);
                    names.push(`__phase3.${comp.id}.${nm.toLowerCase()}.name`);
                }
                break;
            case "tileRow":
                names.push(`__phase3.${comp.id}.row.label`);
                for (const a of s.accents) {
                    names.push(`__phase3.${comp.id}.${a.key}`);
                    names.push(`__phase3.${comp.id}.${a.key}.caption`);
                }
                break;
            default:
                throw new Error(`unknown specimens.kind: ${s.kind}`);
        }
    }
    return names;
}

test("Shared Components page hosts all 4 atom library components", {
    skip: TOKEN ? false : "PENPOT_TOKEN not set — skipping live Penpot check.",
}, async () => {
    const file = await getFile(FILE_ID);
    const targetPid = Object.entries(file.data.pagesIndex)
        .find(([, p]) => p.name === COMPS_SPEC.page.name)?.[0];
    assert.ok(targetPid, `Shared Components page "${COMPS_SPEC.page.name}" not found`);

    const componentsByName = new Map();
    for (const [cid, c] of Object.entries(file.data.components || {})) {
        componentsByName.set(c.name, {id: cid, ...c});
    }

    const missing = [];
    const wrongMain = [];
    const page = file.data.pagesIndex[targetPid];
    const shapesByName = new Map();
    for (const [sid, s] of Object.entries(page.objects)) {
        if (s?.name) shapesByName.set(s.name, {id: sid, ...s});
    }
    const wrongType = [];
    for (const comp of COMPS_SPEC.components) {
        const found = componentsByName.get(comp.name);
        if (!found) {
            missing.push(comp.name);
            continue;
        }
        const expectedMain = shapesByName.get(`__phase3.${comp.id}.main`);
        if (!expectedMain) {
            wrongMain.push(`${comp.name}: main-instance shape __phase3.${comp.id}.main not found on canvas`);
            continue;
        }
        // Penpot's Assets-panel thumbnail renderer in
        // `frontend/src/app/main/render.cljs :: component-svg` only
        // handles `:frame` and `:group` roots — anything else crashes
        // the panel with `Error: No matching clause: <type>`. The
        // build script (this PR) and a backend write-path validator
        // both enforce this invariant; the test keeps it covered.
        if (expectedMain.type !== "frame" && expectedMain.type !== "group") {
            wrongType.push(`${comp.name}: main-instance is :${expectedMain.type} (must be :frame or :group)`);
        }
        const componentMainId = found["main-instance-id"] || found.mainInstanceId;
        if (componentMainId && componentMainId !== expectedMain.id) {
            wrongMain.push(`${comp.name}: main-instance-id mismatch (component → ${componentMainId}, canvas → ${expectedMain.id})`);
        }
    }
    assert.deepEqual(missing, [], `missing library components:\n  ${missing.join("\n  ")}`);
    assert.deepEqual(wrongMain, [], `main-instance mismatches:\n  ${wrongMain.join("\n  ")}`);
    assert.deepEqual(wrongType, [], `main-instance shape type violations:\n  ${wrongType.join("\n  ")}`);
});

test("Shared Components page carries every specimen from components.json", {
    skip: TOKEN ? false : "PENPOT_TOKEN not set — skipping live Penpot check.",
}, async () => {
    const file = await getFile(FILE_ID);
    const targetPid = Object.entries(file.data.pagesIndex)
        .find(([, p]) => p.name === COMPS_SPEC.page.name)?.[0];
    assert.ok(targetPid);
    const page = file.data.pagesIndex[targetPid];
    const names = new Set(Object.values(page.objects).map((s) => s?.name).filter(Boolean));

    const missing = [];
    for (const expected of expectedShapeNames()) {
        if (!names.has(expected)) missing.push(expected);
    }
    assert.deepEqual(missing, [], `missing shapes:\n  ${missing.join("\n  ")}`);
});

test("Shared Components page has no orphan __phase3.* shapes", {
    skip: TOKEN ? false : "PENPOT_TOKEN not set — skipping live Penpot check.",
}, async () => {
    const file = await getFile(FILE_ID);
    const targetPid = Object.entries(file.data.pagesIndex)
        .find(([, p]) => p.name === COMPS_SPEC.page.name)?.[0];
    assert.ok(targetPid);
    const page = file.data.pagesIndex[targetPid];

    // The build script's atomic shape builders add per-specimen
    // children with these suffixes (e.g. `__phase3.ods-chip.neutral`
    // → also emits `…neutral.label`, `…neutral.icon`). `.body` is
    // the rect inside each main-instance frame (a frame is required
    // because Penpot's thumbnail renderer rejects leaf shape roots).
    const SUFFIXES = [".body", ".label", ".letter", ".icon", ".spine", ".caption", ".name"];
    const expected = new Set(expectedShapeNames());

    const orphans = [];
    for (const s of Object.values(page.objects)) {
        const name = s?.name || "";
        if (!name.startsWith("__phase3.")) continue;
        if (expected.has(name)) continue;
        const matched = [...expected].some((p) => SUFFIXES.some((suf) => name === p + suf));
        if (!matched) orphans.push(name);
    }
    assert.deepEqual(orphans, [], `orphan __phase3.* shapes:\n  ${orphans.join("\n  ")}`);
});
