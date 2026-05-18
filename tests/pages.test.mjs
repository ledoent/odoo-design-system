// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Page contract test: the canonical Penpot file's pages must match
// `docs/penpot/specs/pages.json` exactly (names + order) and contain
// zero raster fills (Phase 1's raster-free invariant).
//
// Skipped automatically when `PENPOT_TOKEN` is not set, so CI without
// the secret degrades gracefully. CI runners with the secret (the
// PR + nightly workflow) run the live check.

import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";

import {ROOT_FRAME_ID, getFile} from "../scripts/_penpot-rpc.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = JSON.parse(readFileSync(resolve(ROOT, "docs/penpot/specs/pages.json"), "utf8"));

const TOKEN = process.env.PENPOT_TOKEN;
const FILE_ID = process.env.PENPOT_FILE_ID || SPEC.file["file-id"];

test("canonical Penpot file matches docs/penpot/specs/pages.json", {
    skip: TOKEN ? false : "PENPOT_TOKEN not set — skipping live Penpot check.",
}, async () => {
    const file = await getFile(FILE_ID);
    const pagesIndex = file?.data?.pagesIndex || {};
    const pageOrder = file?.data?.pages || [];

    // 1. Count parity.
    assert.equal(
        pageOrder.length,
        SPEC.pages.length,
        `expected ${SPEC.pages.length} pages, found ${pageOrder.length}`,
    );

    // 2. Name + order parity.
    pageOrder.forEach((pid, i) => {
        const got = pagesIndex[pid]?.name;
        const want = SPEC.pages[i]?.name;
        assert.equal(got, want, `pages[${i}]: expected '${want}', got '${got}'`);
    });

    // 3. Raster-free invariant: no shape on any canonical page should be
    //    of type `image` or carry a fill containing `fillImage`.
    let rasterCount = 0;
    const rasterLocations = [];
    for (const pid of pageOrder) {
        const page = pagesIndex[pid];
        for (const [oid, obj] of Object.entries(page?.objects || {})) {
            if (oid === ROOT_FRAME_ID) continue;
            const isImage = obj?.type === "image";
            const hasImageFill = Array.isArray(obj?.fills)
                && obj.fills.some((f) => f && (f.fillImage || f["fill-image"]));
            if (isImage || hasImageFill) {
                rasterCount++;
                rasterLocations.push(`${page.name} / ${obj.name || oid}`);
            }
        }
    }
    assert.equal(
        rasterCount, 0,
        `expected 0 raster fills, found ${rasterCount}:\n  - ${rasterLocations.slice(0, 10).join("\n  - ")}`,
    );
});
