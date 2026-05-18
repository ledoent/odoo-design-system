// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Shared scaffolding for every script that talks to the Penpot REST
// API. The 6 Phase-0/Phase-1 scripts (+ tests/pages.test.mjs) used
// to each redeclare:
//
//   - the `FEATURES` array (8 entries, hand-copied per script);
//   - the `Authorization: Token <pat>` request shape;
//   - the same error message when PENPOT_TOKEN is unset;
//   - the canonical root-frame id and other Penpot magic constants.
//
// One module keeps them honest.

const HOST = process.env.PENPOT_HOST || "https://design.hz.ledoweb.com";
const TOKEN = process.env.PENPOT_TOKEN;

// Features list passed to every `get-file` / `update-file` call. Match
// what Penpot 2.15 returns — drift here causes silent data loss when
// the client doesn't request a feature the server then strips. Order
// is irrelevant; Penpot dedupes.
export const FEATURES = [
    "design-tokens/v1",
    "fdata/objects-map",
    "fdata/path-data",
    "fdata/shape-data-type",
    "components/v2",
    "layout/grid",
    "styles/v2",
    "variants/v1",
];

// Penpot stores per-page child shape ordering under a synthetic
// root-frame whose id is all-zero. New shapes added to a page set
// `frame-id`/`parent-id` to this constant unless they're nested under
// a real frame.
export const ROOT_FRAME_ID = "00000000-0000-0000-0000-000000000000";

// Default canonical file IDs (used by the snapshot / build / capture
// scripts when no `PENPOT_FILE_ID` env override is provided). Single
// source of truth so a future renaming / new design file only edits
// one place.
export const CANONICAL_FILE_ID = "038df003-0f49-80b2-8008-0774e5399553";
export const STOCK_REFERENCE_FILE_ID = "ab1caf40-8849-808b-8008-096a0fe717bb";
export const LEDO_WEB_TEAM_ID = "442b344a-1ecc-8198-8008-0771673d374d";

export function requireToken(scriptName = "this script") {
    if (!TOKEN) {
        console.error(
            `${scriptName}: set PENPOT_TOKEN (service-account PAT). ` +
            `See .env or memory/penpot_design_credentials.md.`,
        );
        process.exit(2);
    }
    return TOKEN;
}

export {HOST as PENPOT_HOST};

/**
 * POST a Penpot RPC command and return the parsed JSON response.
 * Throws on non-2xx with the response body inlined into the error message.
 *
 * @param {string} command — e.g. "get-file", "update-file", "duplicate-file"
 * @param {object} body    — the RPC payload (will be JSON-encoded)
 * @returns {Promise<any>}
 */
export async function rpc(command, body = {}) {
    requireToken();
    const r = await fetch(`${HOST}/api/rpc/command/${command}`, {
        method: "POST",
        headers: {
            "Authorization": `Token ${TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        throw new Error(
            `${command} → ${r.status}: ${(await r.text()).slice(0, 600)}`,
        );
    }
    return r.json();
}

/** Sugar over `rpc("get-file", …)` — includes FEATURES by default. */
export function getFile(fileId) {
    return rpc("get-file", {id: fileId, features: FEATURES});
}
