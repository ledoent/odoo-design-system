#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Split the canonical "Ledo Odoo Design System" Penpot file:
//
//   - Keep the 4 non-stock pages on the canonical file
//     (Overview + 3 Tokens pages).
//   - Move the 11 stock-19.0 screenshot pages (their image-fill
//     rects + media uploads) to a new sibling file titled
//     "Odoo 19.0 — Stock Reference Screenshots" in the same
//     project.
//
// How:
//   1. `duplicate-file` against the canonical file (REST RPC; clones
//      pages + media intact). The duplicate is created in the source
//      file's project automatically.
//   2. Rename + delete on each side:
//      - Canonical: delete the 11 stock pages.
//      - Sibling:   delete the 4 non-stock pages.
//
// Idempotency:
//   - If a sibling file with the target name already exists in the
//     project, we *do not* create another. We adopt it and proceed.
//   - `del-page` on a page that's already gone is a no-op (we skip
//      by name match against the current state).
//
// Usage:
//   PENPOT_TOKEN=<pat> node scripts/penpot-split-stock-pages.mjs

import {randomUUID} from "node:crypto";
import {CANONICAL_FILE_ID, FEATURES, rpc, getFile, requireToken} from "./_penpot-rpc.mjs";

requireToken("penpot-split-stock-pages.mjs");

const CANONICAL_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const SIBLING_NAME = "Odoo 19.0 — Stock Reference Screenshots";
const STOCK_PAGE_RE = /\(stock 19\.0\)\s*$/;

// Find an existing sibling file by name in the source file's project.
async function findExistingSibling(projectId, name) {
    const files = await rpc("get-project-files", {"project-id": projectId});
    return files.find((f) => f.name === name) || null;
}

const canonical = await getFile(CANONICAL_ID);
const projectId = canonical.projectId;
console.error(`canonical: '${canonical.name}'  revn=${canonical.revn}  project=${projectId}`);

// 1. Get (or create via duplicate) the sibling.
let sibling = await findExistingSibling(projectId, SIBLING_NAME);
if (sibling) {
    console.error(`sibling already exists: '${sibling.name}' id=${sibling.id}`);
    sibling = await getFile(sibling.id);
} else {
    console.error(`creating sibling via duplicate-file…`);
    sibling = await rpc("duplicate-file", {"file-id": CANONICAL_ID, name: SIBLING_NAME});
    // duplicate-file's response is a partial file record; re-fetch for the full data.
    sibling = await getFile(sibling.id);
    console.error(`✓ duplicated → '${sibling.name}' id=${sibling.id}`);
}

// 2. Build the page lists.
const stockPageIds = (canonical.data?.pages || []).filter(
    (pid) => STOCK_PAGE_RE.test(canonical.data.pagesIndex[pid]?.name || ""),
);
const nonStockPageIds = (canonical.data?.pages || []).filter(
    (pid) => !STOCK_PAGE_RE.test(canonical.data.pagesIndex[pid]?.name || ""),
);
console.error(`canonical: ${nonStockPageIds.length} non-stock + ${stockPageIds.length} stock pages`);

const siblingStock = (sibling.data?.pages || []).filter(
    (pid) => STOCK_PAGE_RE.test(sibling.data.pagesIndex[pid]?.name || ""),
);
const siblingNonStock = (sibling.data?.pages || []).filter(
    (pid) => !STOCK_PAGE_RE.test(sibling.data.pagesIndex[pid]?.name || ""),
);
console.error(`sibling:   ${siblingNonStock.length} non-stock (will delete) + ${siblingStock.length} stock (will keep)`);

// 3. Apply deletions. update-file `changes` takes an array of PCS ops.
async function deletePages(fileId, fileRevn, fileVern, pageIds, label) {
    if (!pageIds.length) {
        console.error(`${label}: nothing to delete.`);
        return fileRevn;
    }
    const changes = pageIds.map((pid) => ({type: "del-page", id: pid}));
    const resp = await rpc("update-file", {
        id: fileId,
        "session-id": randomUUID(),
        revn: fileRevn,
        vern: fileVern || 0,
        features: FEATURES,
        changes,
    });
    const newRevn = (resp.lagged && resp.lagged[resp.lagged.length - 1]?.revn) || resp.revn;
    console.error(`${label}: deleted ${pageIds.length} pages, revn ${fileRevn} → ${newRevn}`);
    return newRevn;
}

// On canonical: delete the stock pages.
await deletePages(CANONICAL_ID, canonical.revn, canonical.vern || 0, stockPageIds, "canonical");

// On sibling: delete the non-stock pages.
await deletePages(sibling.id, sibling.revn, sibling.vern || 0, siblingNonStock, "sibling");

// 4. Verify final state.
const canonicalAfter = await getFile(CANONICAL_ID);
const siblingAfter = await getFile(sibling.id);
console.error(`\nFinal state:`);
console.error(`  canonical (${canonicalAfter.name}): ${Object.keys(canonicalAfter.data.pagesIndex).length} pages, revn=${canonicalAfter.revn}`);
for (const pid of canonicalAfter.data.pages) {
    console.error(`    • ${canonicalAfter.data.pagesIndex[pid]?.name}`);
}
console.error(`  sibling (${siblingAfter.name}): ${Object.keys(siblingAfter.data.pagesIndex).length} pages, revn=${siblingAfter.revn}`);
for (const pid of siblingAfter.data.pages) {
    console.error(`    • ${siblingAfter.data.pagesIndex[pid]?.name}`);
}

process.stdout.write(sibling.id + "\n");
