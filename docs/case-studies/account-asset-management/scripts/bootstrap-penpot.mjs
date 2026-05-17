#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Seed the Penpot instance at design.hz.ledoweb.com with the DMS case
// study (project + file + one page per surface + uploaded screenshots).
// See ./README.md for prereqs (PENPOT_TOKEN, PENPOT_TEAM_ID).
//
// This is semi-automated by design — it lays out a skeleton that a
// designer refines. When penpot-mcp lands in Claude, this script gets
// replaced by a declarative `surfaces.json → MCP` translator.

import {readFileSync, existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve, basename} from "node:path";
import {request} from "node:https";
import {randomUUID} from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST = process.env.PENPOT_HOST || "https://design.hz.ledoweb.com";
const TOKEN = process.env.PENPOT_TOKEN;
const TEAM_ID = process.env.PENPOT_TEAM_ID;
const DRY_RUN = process.argv.includes("--dry-run");

if (!TOKEN || !TEAM_ID) {
    console.error(
        "Need PENPOT_TOKEN and PENPOT_TEAM_ID env vars. See ./README.md.",
    );
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Penpot REST API helper. Penpot uses a JSON-RPC-shaped POST that returns
// transit-json by default; ask for plain JSON via the Accept header.

async function rpc(command, body = {}) {
    if (DRY_RUN) {
        console.log(`[dry-run] ${command}`, JSON.stringify(body).slice(0, 120));
        return {id: `dryrun-${command}-${Math.random().toString(36).slice(2, 9)}`};
    }
    const url = `${HOST}/api/rpc/command/${command}`;
    const res = await fetchJson(url, {
        method: "POST",
        headers: {
            "Authorization": `Token ${TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(body),
    });
    return res;
}

function fetchJson(url, opts) {
    return new Promise((resolveFn, rejectFn) => {
        const u = new URL(url);
        const req = request(
            {
                method: opts.method,
                host: u.host,
                path: u.pathname + u.search,
                headers: opts.headers,
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    if (res.statusCode >= 400) {
                        rejectFn(
                            new Error(
                                `${opts.method} ${url} → ${res.statusCode}\n${data}`,
                            ),
                        );
                    } else {
                        try {
                            resolveFn(data ? JSON.parse(data) : null);
                        } catch {
                            resolveFn(data);
                        }
                    }
                });
            },
        );
        req.on("error", rejectFn);
        if (opts.body) req.write(opts.body);
        req.end();
    });
}

// ---------------------------------------------------------------------------

const surfaces = JSON.parse(
    readFileSync(resolve(__dirname, "..", "surfaces.json"), "utf8"),
);
// Roadmap page is optional — DMS has one, asset-management review doesn't.
const roadmapPath = resolve(__dirname, "..", "roadmap.json");
const roadmap = existsSync(roadmapPath)
    ? JSON.parse(readFileSync(roadmapPath, "utf8"))
    : null;

async function main() {
    console.log(`Bootstrapping Penpot project on ${HOST}`);
    console.log(`  Team:    ${TEAM_ID}`);
    console.log(`  Project: ${surfaces.project}`);
    console.log(`  File:    ${surfaces.file}`);
    const pageCount = surfaces.pages.length + (roadmap ? 1 : 0);
    console.log(`  Pages:   ${pageCount}${roadmap ? " (incl. Roadmap)" : ""}`);
    if (DRY_RUN) console.log("  Mode:    DRY-RUN (no writes)\n");

    // 1. Create the project (or reuse if a same-named one exists)
    const project = await rpc("create-project", {
        name: surfaces.project,
        "team-id": TEAM_ID,
    });
    console.log(`✓ project ${project.id}`);

    // 2. Create the file inside that project
    const file = await rpc("create-file", {
        name: surfaces.file,
        "project-id": project.id,
    });
    console.log(`✓ file ${file.id}`);

    // 3. Add pages via `update-file` change-sets. Penpot's current API doesn't
    //    expose `create-page`/`rename-page` as standalone RPCs (404); pages are
    //    mutated via the file's change-log. We push one `add-page` change per
    //    surface and increment our local revn each call.
    const sessionId = randomUUID();
    const fileMeta = await rpc("get-file", {id: file.id});
    let revn = fileMeta.revn ?? 0;
    let vern = fileMeta.vern ?? 0;

    for (const page of surfaces.pages) {
        const pageId = randomUUID();
        const res = await rpc("update-file", {
            id: file.id,
            "session-id": sessionId,
            revn,
            vern,
            features: fileMeta.features || [],
            changes: [
                {
                    type: "add-page",
                    id: pageId,
                    name: page.name,
                },
            ],
        });
        revn = res?.revn ?? revn + 1;
        if (res?.vern !== undefined) vern = res.vern;
        console.log(`✓ page ${page.name}`);

        // Upload each frame's source PNG as a Penpot media object. Penpot's
        // upload endpoint accepts the image bytes; for hosted GCS sources
        // we instruct the user to import them in the UI rather than re-
        // fetching here, because the API for "ingest by URL" varies across
        // Penpot versions. Designer drags the URLs in.
        for (const frame of page.frames) {
            if (!frame.src) continue;
            console.log(
                `    · frame "${frame.label}" — drag ${frame.src} into the page`,
            );
        }

        if (page.annotation) {
            console.log(`    · annotation: ${page.annotation.slice(0, 80)}…`);
        }
    }

    // 4. Optional roadmap page — DMS has one; this case study doesn't.
    if (roadmap) {
        await rpc("create-page", {"file-id": file.id, name: "7 · Roadmap"});
        console.log(`✓ page 7 · Roadmap (${roadmap.items.length} items)`);
        for (const item of roadmap.items) {
            console.log(
                `    · #${item.rank}  ${item.title.padEnd(45)}  ` +
                    `impact=${item.impact}  effort=${item.effort}`,
            );
        }
    }

    console.log(`\nNext: open ${HOST}/#/workspace/${TEAM_ID}/${file.id}`);
    console.log(`Drag the screenshot URLs printed above into their pages.`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
