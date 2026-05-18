// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Shared-Components-page contract test for Phase 3 + Phase 3b. Asserts:
//
//   1. Each atom declared in `docs/penpot/specs/components.json` has
//      AT LEAST ONE Penpot library component with the matching name.
//   2. Atoms with a variant matrix (chipMatrix / avatarRow / tileRow)
//      have one library component per matrix cell, all sharing a
//      single `variant-id` and with distinct `variant-properties`.
//   3. Every component's main-instance shape is a `:frame` (or
//      `:group`) — Penpot's Assets-panel thumbnail renderer crashes
//      on any other root shape type (ledoent/penpot#1).
//   4. No orphan `__phase3*` shape on the page is missing from the
//      spec (canvas → spec parity).
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

// Atoms with a Phase-3b variant matrix. Each entry yields the expected
// component count for that atom + the per-variant cell metadata used to
// rebuild the canvas shape names (frame + body/label/letter/etc.). The
// `isMain` flag marks the cell whose visual is the canonical Phase-3a
// `__phase3.<id>.main` frame, not a Phase-3b emit.
function variantCells(comp) {
    const s = comp.specimens;
    const main = comp.main;
    if (s.kind === "chipMatrix") {
        const cells = [];
        for (const row of s.rows) {
            for (const v of s.variants) {
                const isMain = v.key === main.variant && row.withIcon === false && !main.withIcon;
                cells.push({key: `${v.key}.${row.key}`, isMain, props: [
                    {name: "Variant", value: v.label},
                    {name: "With Icon", value: row.withIcon ? "Yes" : "No"},
                ]});
            }
        }
        return cells;
    }
    if (s.kind === "avatarRow") {
        return s.names.map((nm) => ({
            key: nm.toLowerCase(),
            isMain: nm[0] === main.letter,
            props: [{name: "Name", value: nm}],
        }));
    }
    if (s.kind === "tileRow") {
        return s.accents.map((a) => ({
            key: a.key,
            isMain: a.key === main.accent,
            props: [{name: "Accent", value: a.label}],
        }));
    }
    return null;  // iconMatrix — no variants this phase
}

// Compute the set of shape names the Phase-3 + Phase-3b build scripts
// should have authored for each component. Atoms in scope of Phase-3b
// emit one frame per matrix cell (`__phase3b.<id>.<cellKey>.main`)
// plus a small set of child shapes inside. Atoms with no Phase-3b
// variants (currently only OdsIcon) still carry their full Phase-3a
// specimen rectangle grid.
function expectedShapeNames() {
    const names = [];
    for (const comp of COMPS_SPEC.components) {
        names.push(`__phase3.${comp.id}.header`);
        names.push(`__phase3.${comp.id}.main`);
        const cells = variantCells(comp);
        if (cells) {
            // Phase-3b: each non-main cell becomes its own frame. The
            // main cell reuses the canonical `__phase3.<id>.main`
            // frame (already pushed above), so we skip it here.
            for (const cell of cells) {
                if (cell.isMain) continue;
                names.push(`__phase3b.${comp.id}.${cell.key}.main`);
            }
            // Row-header labels from Phase 3a stay on the canvas as
            // visual context for the variant matrix.
            const s = comp.specimens;
            if (s.kind === "chipMatrix") {
                for (const row of s.rows) names.push(`__phase3.${comp.id}.row.${row.key}.label`);
            } else if (s.kind === "avatarRow" || s.kind === "tileRow") {
                names.push(`__phase3.${comp.id}.row.label`);
            }
            continue;
        }
        // No variants — fall back to Phase-3a specimens.
        const s = comp.specimens;
        if (s.kind === "iconMatrix") {
            for (const set of s.sets) {
                names.push(`__phase3.${comp.id}.row.${set}.label`);
                for (const ico of s.samples) {
                    names.push(`__phase3.${comp.id}.${set}.${ico}`);
                }
            }
        }
    }
    return names;
}

function propsKey(props) {
    return (props || []).map((p) => `${p.name}=${p.value}`).sort().join("|");
}

test("Shared Components page hosts every atom + variant from components.json", {
    skip: TOKEN ? false : "PENPOT_TOKEN not set — skipping live Penpot check.",
}, async () => {
    const file = await getFile(FILE_ID);
    const targetPid = Object.entries(file.data.pagesIndex)
        .find(([, p]) => p.name === COMPS_SPEC.page.name)?.[0];
    assert.ok(targetPid, `Shared Components page "${COMPS_SPEC.page.name}" not found`);

    const componentsByName = new Map();
    for (const [cid, c] of Object.entries(file.data.components || {})) {
        if (!componentsByName.has(c.name)) componentsByName.set(c.name, []);
        componentsByName.get(c.name).push({id: cid, ...c});
    }

    const page = file.data.pagesIndex[targetPid];
    const shapesById = new Map();
    for (const [sid, s] of Object.entries(page.objects)) {
        shapesById.set(sid, s);
    }

    const missing = [];
    const wrongType = [];
    const missingMain = [];
    const wrongVariant = [];

    for (const comp of COMPS_SPEC.components) {
        const records = componentsByName.get(comp.name) || [];
        const cells = variantCells(comp);
        const expectedCount = cells ? cells.length : 1;
        if (records.length === 0) {
            missing.push(`${comp.name}: no library components on file`);
            continue;
        }
        if (records.length !== expectedCount) {
            missing.push(`${comp.name}: expected ${expectedCount} component(s), got ${records.length}`);
        }

        // Renderer-contract invariant: every main-instance must be :frame.
        // The thumbnail renderer crashes the Assets panel on anything else
        // (ledoent/penpot#1; pair fix in scripts/_penpot-shapes.mjs makeFrame).
        for (const r of records) {
            const mainId = r["main-instance-id"] || r.mainInstanceId;
            if (!mainId) {
                missingMain.push(`${comp.name} (${r.id.slice(0, 8)}…): no main-instance-id`);
                continue;
            }
            const main = shapesById.get(mainId);
            if (!main) {
                missingMain.push(`${comp.name} (${r.id.slice(0, 8)}…): main-instance ${mainId.slice(0, 8)}… not on page`);
                continue;
            }
            if (main.type !== "frame" && main.type !== "group") {
                wrongType.push(`${comp.name} (${r.id.slice(0, 8)}…): main-instance is :${main.type} (must be :frame or :group)`);
            }
        }

        // Variant-set invariant: when this atom has variants, every
        // record shares one variant-id AND the set of variant-property
        // tuples matches the spec exactly.
        if (!cells) continue;
        const variantIds = new Set(records.map((r) => r.variantId || r["variant-id"]).filter(Boolean));
        if (variantIds.size !== 1) {
            wrongVariant.push(`${comp.name}: ${variantIds.size} distinct variant-ids (must be 1)`);
        }
        const expectedTuples = new Set(cells.map((cell) => propsKey(cell.props)));
        const actualTuples = new Set(records.map((r) => propsKey(r.variantProperties || r["variant-properties"] || [])));
        for (const t of expectedTuples) {
            if (!actualTuples.has(t)) wrongVariant.push(`${comp.name}: missing variant ${t}`);
        }
        for (const t of actualTuples) {
            if (!expectedTuples.has(t)) wrongVariant.push(`${comp.name}: unexpected variant ${t}`);
        }
    }
    assert.deepEqual(missing,       [], `count mismatches:\n  ${missing.join("\n  ")}`);
    assert.deepEqual(missingMain,   [], `main-instance issues:\n  ${missingMain.join("\n  ")}`);
    assert.deepEqual(wrongType,     [], `main-instance shape type violations:\n  ${wrongType.join("\n  ")}`);
    assert.deepEqual(wrongVariant,  [], `variant-property mismatches:\n  ${wrongVariant.join("\n  ")}`);
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

test("Shared Components page has no double-parented shapes", {
    skip: TOKEN ? false : "PENPOT_TOKEN not set — skipping live Penpot check.",
}, async () => {
    // Phase 3a + 3b build scripts initially emitted add-obj change-ops
    // with `parent-id: ROOT` in the envelope while the obj's own
    // frame-id pointed at a new frame. Penpot's add-shape uses the
    // envelope authoritatively, so children ended up referenced by
    // both Root Frame's `shapes` array AND the new frame's `shapes`
    // — Penpot's workspace-load validate-shape tripped and rendered
    // "Internal Error". `scripts/penpot-build-phase-3b-repair.mjs`
    // fixed the existing damage; the build scripts now propagate
    // obj.frame-id into the envelope. This test keeps both invariants
    // covered.
    const file = await getFile(FILE_ID);
    const targetPid = Object.entries(file.data.pagesIndex)
        .find(([, p]) => p.name === COMPS_SPEC.page.name)?.[0];
    assert.ok(targetPid);
    const page = file.data.pagesIndex[targetPid];

    const refCount = new Map();
    for (const [sid, s] of Object.entries(page.objects)) {
        for (const childId of s.shapes || []) {
            if (!refCount.has(childId)) refCount.set(childId, []);
            refCount.get(childId).push({sid: sid.slice(0, 8), name: s.name || s.type});
        }
    }
    const multiParent = [];
    for (const [cid, parents] of refCount) {
        if (parents.length > 1) {
            const child = page.objects[cid];
            multiParent.push(
                `${cid.slice(0, 8)} (${child?.name || child?.type}) ` +
                `in ${parents.length} parents: ${parents.map((p) => p.name).join(", ")}`
            );
        }
    }
    assert.deepEqual(multiParent, [], `shapes with multiple parents:\n  ${multiParent.join("\n  ")}`);
});
