#!/usr/bin/env node
// Final cleanup: delete the broken rect-with-fillImage shapes left over from
// populate-pages-v2.mjs (they have a 10% opacity inherited from somewhere and
// just clutter the layer list). The UI-uploaded image shapes from
// drop-images-via-ui.mjs are the canonical content on each page.

import {request} from "node:https";
import {randomUUID} from "node:crypto";

const HOST = "https://design.hz.ledoweb.com";
const TOKEN = process.env.PENPOT_TOKEN;
const FILE_ID = "ab1caf40-8849-808b-8008-08c57843b42e";

async function rpc(command, body = {}) {
    return new Promise((res, rej) => {
        const u = new URL(`${HOST}/api/rpc/command/${command}`);
        const req = request(
            {
                method: "POST",
                host: u.host,
                path: u.pathname,
                headers: {
                    Authorization: `Token ${TOKEN}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            },
            (r) => {
                let d = "";
                r.on("data", (c) => (d += c));
                r.on("end", () =>
                    r.statusCode >= 400
                        ? rej(new Error(`${command} → ${r.statusCode}: ${d.slice(0, 300)}`))
                        : res(d ? JSON.parse(d) : null),
                );
            },
        );
        req.on("error", rej);
        req.write(JSON.stringify(body));
        req.end();
    });
}

const file = await rpc("get-file", {id: FILE_ID});
const sessionId = randomUUID();
let revn = file.revn ?? 0;
let vern = file.vern ?? 0;
const features = file.features || [];

// Identify shapes to delete: any rect on a page that has a fill-image but isn't
// the UI-uploaded image (UI uploads create type=image shapes, not rect).
const dels = [];
for (const pid of file.data.pages) {
    const page = file.data.pagesIndex[pid];
    for (const [oid, obj] of Object.entries(page.objects || {})) {
        if (obj.type === "rect" && (obj.fills || []).some((f) => f.fillImage || f["fill-image"])) {
            dels.push({type: "del-obj", id: oid, "page-id": pid});
        }
    }
}
console.log(`Deleting ${dels.length} broken rect-fillImage shapes`);

if (dels.length > 0) {
    await rpc("update-file", {
        id: FILE_ID,
        "session-id": sessionId,
        revn,
        vern,
        features,
        changes: dels,
    });
}
console.log("done.");
