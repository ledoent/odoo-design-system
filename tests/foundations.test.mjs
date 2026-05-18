// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Foundations-page contract test: every specimen declared in
// `docs/penpot/specs/foundations.json` must exist on the canonical
// Penpot file's "01 — Foundations" page with the correct shape type
// and `appliedTokens` map. Enforces Phase 2's "no hex hard-codes for
// theme-variant tokens" invariant by asserting each spec item's
// shape carries its expected token binding.
//
// Skipped automatically when `PENPOT_TOKEN` is not set, so CI without
// the secret degrades gracefully.

import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";

import {getFile} from "../scripts/_penpot-rpc.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_SPEC = JSON.parse(readFileSync(resolve(ROOT, "docs/penpot/specs/pages.json"), "utf8"));
const FOUND_SPEC = JSON.parse(readFileSync(resolve(ROOT, "docs/penpot/specs/foundations.json"), "utf8"));

const TOKEN = process.env.PENPOT_TOKEN;
const FILE_ID = process.env.PENPOT_FILE_ID || PAGES_SPEC.file["file-id"];

// Build the list of (shape-name, expected-appliedTokens) pairs from the
// spec. Mirrors the build script's emitter naming (`__phase2.<section>.<key>`
// and `.label`/`.bg`/`.fg` suffixes).
function expectedShapes() {
    const out = [];
    for (const section of FOUND_SPEC.sections) {
        out.push({name: `__phase2.${section.id}.header`, type: "text", tokens: null});
        for (const item of section.items) {
            const base = `__phase2.${section.id}.${item.key}`;
            switch (section.kind) {
                case "swatchRow":
                    out.push({name: base, type: "rect", tokens: {fill: item.tokenName}});
                    out.push({name: `${base}.label`, type: "text", tokens: null});
                    break;
                case "borderRow":
                    out.push({name: base, type: "rect", tokens: {"stroke-color": item.tokenName}});
                    out.push({name: `${base}.label`, type: "text", tokens: null});
                    break;
                case "pillRow":
                    out.push({name: `${base}-bg`, type: "rect", tokens: {fill: item.bgToken}});
                    out.push({name: `${base}-fg`, type: "text", tokens: {fill: item.fgToken}});
                    break;
                case "spacingScale":
                    out.push({name: `${base}.label`, type: "text", tokens: null});
                    if (item.literalWidth > 0) {
                        out.push({name: base, type: "rect", tokens: {width: item.tokenName}});
                    }
                    break;
                case "radiusRow":
                    out.push({
                        name: base, type: "rect",
                        tokens: {r1: item.tokenName, r2: item.tokenName, r3: item.tokenName, r4: item.tokenName},
                    });
                    out.push({name: `${base}.label`, type: "text", tokens: null});
                    break;
                case "typeRamp":
                    out.push({name: `${base}.label`, type: "text", tokens: null});
                    out.push({name: base, type: "text", tokens: {"font-size": item.tokenName}});
                    break;
                case "weightRamp":
                    out.push({name: `${base}.label`, type: "text", tokens: null});
                    out.push({name: base, type: "text", tokens: {"font-weight": item.tokenName}});
                    break;
                case "elevationDeck":
                    // Literal shadow only — no token binding (Penpot tokensLib
                    // doesn't support shadow as a bindable type).
                    out.push({name: base, type: "rect", tokens: null});
                    out.push({name: `${base}.label`, type: "text", tokens: null});
                    break;
                case "motionStrips":
                    out.push({name: `${base}.label`, type: "text", tokens: null});
                    if (item.type === "duration") {
                        out.push({name: base, type: "rect", tokens: null});
                    }
                    break;
                default:
                    throw new Error(`unknown section kind: ${section.kind}`);
            }
        }
    }
    return out;
}

test("Foundations page carries every specimen from foundations.json", {
    skip: TOKEN ? false : "PENPOT_TOKEN not set — skipping live Penpot check.",
}, async () => {
    const file = await getFile(FILE_ID);
    const targetPid = Object.entries(file.data.pagesIndex)
        .find(([, p]) => p.name === FOUND_SPEC.page.name)?.[0];
    assert.ok(targetPid, `Foundations page "${FOUND_SPEC.page.name}" not found in canonical file`);

    const page = file.data.pagesIndex[targetPid];
    const byName = new Map();
    for (const [sid, s] of Object.entries(page.objects)) {
        if (s?.name) byName.set(s.name, {id: sid, ...s});
    }

    const expected = expectedShapes();
    const missing = [];
    const wrongType = [];
    const wrongTokens = [];

    for (const e of expected) {
        const shape = byName.get(e.name);
        if (!shape) {
            missing.push(e.name);
            continue;
        }
        if (shape.type !== e.type) {
            wrongType.push(`${e.name}: expected ${e.type}, got ${shape.type}`);
            continue;
        }
        if (e.tokens) {
            // Penpot stores appliedTokens keys in camelCase on read
            // even when we send PCS kebab-case in `applied-tokens` ops
            // (e.g. `stroke-color` → `strokeColor`, `font-size` → `fontSize`).
            // Normalize the expected keys to match.
            const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            const actual = shape.appliedTokens || {};
            for (const [k, v] of Object.entries(e.tokens)) {
                const key = camel(k);
                if (actual[key] !== v) {
                    wrongTokens.push(`${e.name}: expected ${key}=${v}, got ${key}=${actual[key] ?? "<missing>"}`);
                }
            }
        }
    }

    assert.deepEqual(missing, [], `missing shapes:\n  ${missing.join("\n  ")}`);
    assert.deepEqual(wrongType, [], `wrong shape types:\n  ${wrongType.join("\n  ")}`);
    assert.deepEqual(wrongTokens, [], `wrong token bindings:\n  ${wrongTokens.join("\n  ")}`);
});

test("Foundations page contains no raster fills", {
    skip: TOKEN ? false : "PENPOT_TOKEN not set — skipping live Penpot check.",
}, async () => {
    const file = await getFile(FILE_ID);
    const targetPid = Object.entries(file.data.pagesIndex)
        .find(([, p]) => p.name === FOUND_SPEC.page.name)?.[0];
    assert.ok(targetPid);
    const page = file.data.pagesIndex[targetPid];
    const offenders = [];
    for (const [sid, s] of Object.entries(page.objects)) {
        if (s.type === "image") offenders.push(`${s.name || sid}: type=image`);
        for (const f of s.fills || []) {
            if (f.fillImage || f["fill-image"]) {
                offenders.push(`${s.name || sid}: fillImage`);
                break;
            }
        }
    }
    assert.deepEqual(offenders, [], `raster fills found:\n  ${offenders.join("\n  ")}`);
});

test("Foundations page has no orphan __phase2.* shapes (every shape on canvas is in the spec)", {
    skip: TOKEN ? false : "PENPOT_TOKEN not set — skipping live Penpot check.",
}, async () => {
    const file = await getFile(FILE_ID);
    const targetPid = Object.entries(file.data.pagesIndex)
        .find(([, p]) => p.name === FOUND_SPEC.page.name)?.[0];
    assert.ok(targetPid);
    const page = file.data.pagesIndex[targetPid];
    const expectedNames = new Set(expectedShapes().map((e) => e.name));
    const orphans = [];
    for (const s of Object.values(page.objects)) {
        const name = s?.name || "";
        if (!name.startsWith("__phase2.")) continue;
        if (!expectedNames.has(name)) orphans.push(name);
    }
    assert.deepEqual(
        orphans, [],
        `orphan __phase2.* shapes on Foundations (rename in spec or delete from canvas):\n  ${orphans.join("\n  ")}`,
    );
});
