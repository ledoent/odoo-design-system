#!/usr/bin/env node
// Penpot 2.15 places UI-uploaded media with blend opacity = 0.1 (10%) by
// default — dims the image and looks broken in the rendered file. Walk every
// page and bump the opacity of any rect carrying a fill-image back to 1.0.

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

const changes = [];
for (const pid of file.data.pages) {
    const page = file.data.pagesIndex[pid];
    for (const [oid, obj] of Object.entries(page.objects || {})) {
        const hasImageFill = (obj.fills || []).some((f) => f.fillImage || f["fill-image"]);
        if (hasImageFill && (obj.opacity == null || obj.opacity < 1.0)) {
            changes.push({
                type: "mod-obj",
                id: oid,
                "page-id": pid,
                operations: [
                    {
                        type: "set",
                        attr: "opacity",
                        val: 1.0,
                    },
                ],
            });
        }
    }
}

console.log(`Bumping opacity to 1.0 on ${changes.length} image shapes`);

if (changes.length > 0) {
    await rpc("update-file", {
        id: FILE_ID,
        "session-id": sessionId,
        revn,
        vern,
        features,
        changes,
    });
}
console.log("done.");
