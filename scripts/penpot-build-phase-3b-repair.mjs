#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 3b data-integrity repair.
//
// Bug: the Phase 3a + 3b build scripts emit `add-obj` change-ops for
// frame children with `"parent-id": ROOT` in the change-op envelope
// while the shape obj's own `frame-id` already points at the enclosing
// frame. Penpot's `add-shape` ([common/src/app/common/types/
// shape_tree.cljc]) uses the change-op envelope's `parent-id` as the
// authoritative value, OVERWRITING the obj's own frame-id and appending
// the shape ID to that parent's `shapes` array. Net result:
//
//   - Child's stored `frame-id` / `parent-id` = ROOT (overwritten by
//     the change-op envelope; NOT the new frame the build script
//     intended).
//   - New frame's `shapes` array contains the child id (set by the
//     `makeFrame()` helper at creation time).
//   - Root Frame's `shapes` array ALSO contains the child id (appended
//     by Penpot in response to the change-op envelope).
//
// Workspace load tripped `validate-shape` in `changes.cljc:475` →
// `:data-validation` assertion → "Internal Error" SPA screen.
//
// Repair principle: the FRAME's `shapes` array is the intended truth
// (the build script set it explicitly to the children's UUIDs). For
// each over-claimed child:
//
//   1. mod-obj on the child to set `frame-id` + `parent-id` to the
//      claiming frame's UUID.
//   2. mod-obj on Root Frame to filter the over-claimed IDs out of its
//      `shapes` array.
//
// Both operations are emitted in a single `update-file` batch so the
// repair is atomic from the file's perspective.
//
// Re-running once clean is a true no-op.
//
// Usage:
//   PENPOT_TOKEN=<pat> node scripts/penpot-build-phase-3b-repair.mjs [--dry-run]

import {randomUUID} from "node:crypto";
import {readFileSync, readdirSync, statSync} from "node:fs";
import {dirname, resolve, join} from "node:path";
import {fileURLToPath} from "node:url";

import {CANONICAL_FILE_ID, FEATURES, ROOT_FRAME_ID, getFile, rpc, requireToken} from "./_penpot-rpc.mjs";

requireToken("penpot-build-phase-3b-repair.mjs");

const FILE_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BACKUPS_DIR = resolve(REPO, ".penpot-backups");
const DRY_RUN = process.argv.includes("--dry-run");
const PAGE_NAME = "03 — Shared Components";
const ROOT = ROOT_FRAME_ID;

// Snapshot-freshness gate.
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
let freshSnapshot = null;
try {
    for (const f of readdirSync(BACKUPS_DIR)) {
        const path = join(BACKUPS_DIR, f);
        if (!path.endsWith(".json")) continue;
        if (Date.now() - statSync(path).mtimeMs < SNAPSHOT_TTL_MS) {
            freshSnapshot = path;
            break;
        }
    }
} catch {/* dir missing */}
if (!freshSnapshot) {
    console.error("No fresh snapshot in .penpot-backups/ (<24h old).");
    console.error("Run `node scripts/penpot-snapshot.mjs` first.");
    process.exit(3);
}
console.error(`safety: using snapshot ${freshSnapshot.replace(REPO + "/", "")}`);
console.error(`mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"}`);

const file = await getFile(FILE_ID);
const {revn} = file;
const vern = file.vern || 0;

const targetPageId = Object.entries(file.data.pagesIndex)
    .find(([, p]) => p.name === PAGE_NAME)?.[0];
if (!targetPageId) {
    console.error(`page "${PAGE_NAME}" not found`);
    process.exit(4);
}
const page = file.data.pagesIndex[targetPageId];
const objects = page.objects;

// Find the page-root frame on this page (its frameId points at itself
// or it's the `ROOT_FRAME_ID` literal — Penpot reserves this UUID).
const pageRootId = Object.entries(objects).find(([, s]) => s.id === ROOT)
    ? ROOT
    : Object.entries(objects).find(([sid, s]) => sid === ROOT)?.[0];
const pageRoot = objects[pageRootId];
if (!pageRoot) {
    console.error(`could not locate page-root frame on page "${PAGE_NAME}"`);
    process.exit(5);
}

// For each child, find the non-root frame whose `shapes` array claims
// it. That's its intended parent.
const claimingFrame = new Map();   // childId -> frameId
for (const [fid, f] of Object.entries(objects)) {
    if (f.type !== "frame") continue;
    if (fid === pageRootId) continue;
    for (const cid of f.shapes || []) {
        // First non-root claim wins; if two non-root frames claim the same
        // child, that's a deeper bug and we'd need a different repair.
        if (!claimingFrame.has(cid)) claimingFrame.set(cid, fid);
    }
}

// Identify over-claimed children: in pageRoot.shapes AND in a non-root
// frame's shapes.
const overClaimed = [];
for (const cid of pageRoot.shapes || []) {
    if (claimingFrame.has(cid)) {
        overClaimed.push({childId: cid, intendedParent: claimingFrame.get(cid)});
    }
}

console.error(`\nfound ${overClaimed.length} over-claimed children on page "${PAGE_NAME}"`);
if (overClaimed.length === 0) {
    console.error("nothing to do.");
    process.exit(0);
}

// Group by intended parent for legible logging.
const byParent = new Map();
for (const {childId, intendedParent} of overClaimed) {
    if (!byParent.has(intendedParent)) byParent.set(intendedParent, []);
    byParent.get(intendedParent).push(childId);
}
for (const [pid, kids] of byParent) {
    const p = objects[pid];
    console.error(`  → ${pid.slice(0, 8)}… (${p?.name || p?.type}): claims ${kids.length} children that Root also lists`);
    for (const k of kids) {
        const ks = objects[k];
        console.error(`     - ${k.slice(0, 8)}… (${ks?.name || ks?.type})`);
    }
}

// Two change-op flavours:
//
//   - `mod-obj :assign` per child to set `parent-id` + `frame-id` to
//     the intended new frame. We use `:assign` instead of `:set`
//     because `:assign` applies Penpot's `decode-shape-attrs`
//     (sm/json-transformer) over the supplied value map — this
//     coerces string UUIDs into UUID instances so the shape passes
//     its post-op `validate-shape` check. `:set` stores `val`
//     verbatim and was rejected with `:data-validation` for storing
//     a string where the shape schema wanted a UUID.
//
//   - `mod-obj :assign` on the page-root frame to set `shapes` to
//     the cleaned list (without the over-claimed IDs). Without this
//     Root Frame's `shapes` array would keep pointing at children
//     that no longer think they belong there.
//
// (mov-objects was tried first and silently no-op'd against this
// file — likely because the new frame's `shapes` array already
// contained the children and Penpot's add-to-parent dedupe combined
// with some other path made the change a net-zero operation. The
// mod-obj :assign route is explicit about what's being written.)
const overClaimedIds = new Set(overClaimed.map((o) => o.childId));
const cleanedRootShapes = (pageRoot.shapes || []).filter((cid) => !overClaimedIds.has(cid));

const changes = [];
for (const {childId, intendedParent} of overClaimed) {
    changes.push({
        type: "mod-obj",
        id: childId,
        "page-id": targetPageId,
        operations: [{
            type: "assign",
            value: {"parent-id": intendedParent, "frame-id": intendedParent},
            "ignore-touched": true,
            "ignore-geometry": true,
        }],
    });
}
changes.push({
    type: "mod-obj",
    id: pageRootId,
    "page-id": targetPageId,
    operations: [{
        type: "assign",
        value: {shapes: cleanedRootShapes},
        "ignore-touched": true,
        "ignore-geometry": true,
    }],
});

console.error(
    `\nshipping ${changes.length} change-ops ` +
    `(${overClaimed.length} per-child mod-obj :assign + 1 page-root :shapes prune)`
);

if (DRY_RUN) {
    console.error("DRY-RUN — not shipping. Re-run without --dry-run to apply.");
    process.exit(0);
}

const resp = await rpc("update-file", {
    id: FILE_ID, revn, vern,
    "session-id": randomUUID(),
    features: FEATURES,
    changes,
    skipValidate: false,
});
console.error(`✓ revn → ${resp.revn ?? "?"}; repaired ${overClaimed.length} children`);
