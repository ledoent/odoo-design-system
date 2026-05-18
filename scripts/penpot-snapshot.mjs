#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Snapshot a Penpot file's full `data` blob to local disk before any
// destructive op. Penpot self-hosted does not expose a working
// `export-binfile` REST endpoint (tried — 400 / 404 / 405), so the
// snapshot is the deserialized JSON returned by `get-file`. That is
// enough to:
//
//   - Read every page and shape that existed at snapshot time.
//   - Re-create deleted shapes via REST `update-file` if a Phase
//     ever lands an irreversible mistake.
//   - Diff Penpot state across phases.
//
// Usage:
//   PENPOT_TOKEN=<pat> node scripts/penpot-snapshot.mjs [out-path]
//
//   Defaults: `out-path` → `.penpot-backups/<file-slug>_<ISO>.json`.
//
//   `pnpm run penpot:snapshot` is the same call with no args.
//
// Env overrides:
//   PENPOT_HOST     (default: https://design.hz.ledoweb.com)
//   PENPOT_FILE_ID  (default: 038df003-0f49-80b2-8008-0774e5399553 — canonical file)
//
// Exits non-zero on auth / network / missing-file errors.

import {mkdirSync, writeFileSync, statSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {CANONICAL_FILE_ID, getFile, requireToken} from "./_penpot-rpc.mjs";

requireToken("penpot-snapshot.mjs");

const FILE_ID = process.env.PENPOT_FILE_ID || CANONICAL_FILE_ID;

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function defaultOutPath(file) {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = slugify(file.name || "penpot-file");
    return resolve(repoRoot, `.penpot-backups/${slug}_${stamp}.json`);
}

const argOut = process.argv[2];

const file = await getFile(FILE_ID);
const out = argOut ? resolve(argOut) : defaultOutPath(file);

mkdirSync(dirname(out), {recursive: true});

// Snapshot the whole RPC response (data + metadata: revn, vern, modifiedAt,
// projectId). Restore tooling needs revn to reattach.
writeFileSync(out, JSON.stringify(file, null, 2) + "\n");

const {size} = statSync(out);
const pageCount = Object.keys(file?.data?.pagesIndex || {}).length;
const objCount = Object.values(file?.data?.pagesIndex || {})
    .reduce((acc, p) => acc + Object.keys(p.objects || {}).length, 0);

console.error(
    `wrote ${out}`,
    `(${(size / 1024).toFixed(0)} KB, ${pageCount} pages, ${objCount} shapes, revn=${file.revn})`,
);
process.stdout.write(out + "\n");
