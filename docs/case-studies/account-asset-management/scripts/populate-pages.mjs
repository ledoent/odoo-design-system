#!/usr/bin/env node
// Populate the Penpot file with image shapes — one image per page.
//
// Penpot's `create-file-media-object-from-url` ingests a GCS URL into the
// file's media library; `update-file` with an `add-obj` change places a
// rectangle filled with that image on the canvas.

import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {request} from "node:https";
import {randomUUID} from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST = "https://design.hz.ledoweb.com";
const TOKEN = process.env.PENPOT_TOKEN;
const FILE_ID = process.argv[2] || "ab1caf40-8849-808b-8008-08c57843b42e";

if (!TOKEN) {
    console.error("Need PENPOT_TOKEN");
    process.exit(1);
}

async function rpc(command, body = {}) {
    const url = `${HOST}/api/rpc/command/${command}`;
    return new Promise((res, rej) => {
        const u = new URL(url);
        const req = request(
            {
                method: "POST",
                host: u.host,
                path: u.pathname + u.search,
                headers: {
                    Authorization: `Token ${TOKEN}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            },
            (r) => {
                let data = "";
                r.on("data", (c) => (data += c));
                r.on("end", () => {
                    if (r.statusCode >= 400) {
                        rej(new Error(`${command} → ${r.statusCode}: ${data.slice(0, 500)}`));
                    } else {
                        try {
                            res(data ? JSON.parse(data) : null);
                        } catch {
                            res(data);
                        }
                    }
                });
            },
        );
        req.on("error", rej);
        req.write(JSON.stringify(body));
        req.end();
    });
}

const surfaces = JSON.parse(
    readFileSync(resolve(__dirname, "..", "surfaces.json"), "utf8"),
);

// Build a page-name → page-id map by fetching the file.
const fileMeta = await rpc("get-file", {id: FILE_ID});
const pageByName = new Map();
for (const pid of fileMeta.data.pages) {
    pageByName.set(fileMeta.data.pagesIndex[pid].name, pid);
}

const sessionId = randomUUID();
let revn = fileMeta.revn ?? 0;
let vern = fileMeta.vern ?? 0;
const features = fileMeta.features || [];

console.log(`Populating ${FILE_ID}, ${surfaces.pages.length} pages`);

for (const page of surfaces.pages) {
    const frame = page.frames[0];
    if (!frame?.src) {
        console.log(`  ${page.name}: no src, skipping`);
        continue;
    }
    const pageId = pageByName.get(page.name);
    if (!pageId) {
        console.log(`  ${page.name}: page not found in file, skipping`);
        continue;
    }

    // 1. Upload media from URL
    const slug = frame.src.split("/").pop().replace(/\.png$/i, "");
    const media = await rpc("create-file-media-object-from-url", {
        "file-id": FILE_ID,
        url: frame.src,
        "is-local": true,
        name: slug,
    });

    // 2. Add an image shape sized to the media's dimensions, anchored at (80, 80).
    const shapeId = randomUUID();
    // The page-id "frame" — in Penpot, the page itself is a root frame whose id
    // is the same as the page-id. Add-obj parents to it directly.
    const w = media.width;
    const h = media.height;
    const change = {
        type: "add-obj",
        id: shapeId,
        "page-id": pageId,
        "frame-id": pageId,
        obj: {
            id: shapeId,
            type: "image",
            name: frame.label || slug,
            x: 80,
            y: 80,
            width: w,
            height: h,
            "frame-id": pageId,
            "parent-id": pageId,
            "selrect": {x: 80, y: 80, width: w, height: h, x1: 80, y1: 80, x2: 80 + w, y2: 80 + h},
            points: [
                {x: 80, y: 80},
                {x: 80 + w, y: 80},
                {x: 80 + w, y: 80 + h},
                {x: 80, y: 80 + h},
            ],
            transform: {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0},
            "transform-inverse": {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0},
            rotation: 0,
            metadata: {
                id: media.mediaId,
                width: w,
                height: h,
                mtype: media.mtype,
            },
            "proportion-lock": true,
            proportion: w / h,
            fills: [],
            strokes: [],
        },
    };

    try {
        const res = await rpc("update-file", {
            id: FILE_ID,
            "session-id": sessionId,
            revn,
            vern,
            features,
            changes: [change],
        });
        revn = res?.revn ?? revn + 1;
        if (res?.vern !== undefined) vern = res.vern;
        console.log(`  ${page.name}: image placed (media=${media.mediaId})`);
    } catch (e) {
        console.error(`  ${page.name}: ${e.message.slice(0, 300)}`);
    }
}

console.log("done.");
