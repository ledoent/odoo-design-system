#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Pull the DTCG token export from Penpot and write it to a tempfile.
// The CI workflow at .github/workflows/penpot-token-sync.yml diffs the
// output against odoo_design_system/static/src/tokens/design-system.dtcg.json
// and fails the PR if they diverge — Penpot is the source of truth.
//
// Usage:
//   PENPOT_HOST=https://design.hz.ledoweb.com \
//   PENPOT_TOKEN=<service-account PAT> \
//   PENPOT_FILE_ID=038df003-0f49-80b2-8008-0774e5399553 \
//   node scripts/penpot-export-tokens.mjs > /tmp/penpot-tokens.json
//
// Default values match the canonical "Ledo Odoo Design System" file. Override
// per-run if you keep a fork.

import {writeFileSync} from "node:fs";

const HOST = process.env.PENPOT_HOST || "https://design.hz.ledoweb.com";
const TOKEN = process.env.PENPOT_TOKEN;
const FILE_ID = process.env.PENPOT_FILE_ID || "038df003-0f49-80b2-8008-0774e5399553";
const OUT = process.argv[2]; // optional path; defaults to stdout

if (!TOKEN) {
    console.error("Set PENPOT_TOKEN (service-account PAT, see .env or memory/penpot_design_credentials.md).");
    process.exit(2);
}

const FEATURES = [
    "design-tokens/v1", "fdata/objects-map", "fdata/path-data",
    "fdata/shape-data-type", "components/v2", "layout/grid",
    "styles/v2", "variants/v1",
];

async function rpc(command, body = {}) {
    const r = await fetch(`${HOST}/api/rpc/command/${command}`, {
        method: "POST",
        headers: {
            "Authorization": `Token ${TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${command} → ${r.status}: ${await r.text()}`);
    return r.json();
}

const file = await rpc("get-file", {id: FILE_ID, features: FEATURES});
const lib = file?.data?.tokensLib;
if (!lib) {
    console.error(`File ${FILE_ID} has no tokensLib. Import the DTCG JSON first.`);
    process.exit(3);
}

// Penpot's tokens-lib structure → DTCG-compatible JSON.
// tokens-lib keys: <set-name>, $themes, $metadata.
function dtcgFromSet(set) {
    const out = {};
    for (const [name, tok] of Object.entries(set.tokens || {})) {
        const path = name.split(".");
        let node = out;
        for (let i = 0; i < path.length - 1; i++) {
            node[path[i]] ??= {};
            node = node[path[i]];
        }
        node[path[path.length - 1]] = {
            "$value": tok.value ?? tok.resolvedValue,
            "$type": tok.type,
            ...(tok.description ? {"$description": tok.description} : {}),
        };
    }
    return out;
}

const result = {};
for (const [setName, set] of Object.entries(lib)) {
    if (setName.startsWith("$")) continue; // metadata
    result[setName] = dtcgFromSet(set);
}
result.$themes = lib.$themes ?? [];
result.$metadata = lib.$metadata ?? {tokenSetOrder: Object.keys(result).filter(k => !k.startsWith("$"))};

const json = JSON.stringify(result, null, 2);
if (OUT) {
    writeFileSync(OUT, json + "\n");
    console.error(`wrote ${OUT}`);
} else {
    process.stdout.write(json + "\n");
}
