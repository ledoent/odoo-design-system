#!/usr/bin/env node
// v2: Replace the broken `image` shapes with `rect` + `fillImage` fills,
// matching DMS's placeholder rect structure plus an image fill that Penpot
// renders properly. Also adds a text node with the page's annotation.

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
                        rej(new Error(`${command} → ${r.statusCode}: ${data.slice(0, 400)}`));
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

const ROOT_FRAME = "00000000-0000-0000-0000-000000000000";

function rectChange({pageId, shapeId, name, x, y, w, h, fillImage}) {
    return {
        type: "add-obj",
        id: shapeId,
        "page-id": pageId,
        "frame-id": ROOT_FRAME,
        "parent-id": ROOT_FRAME,
        obj: {
            id: shapeId,
            type: "rect",
            name,
            x,
            y,
            width: w,
            height: h,
            "frame-id": ROOT_FRAME,
            "parent-id": ROOT_FRAME,
            selrect: {x, y, width: w, height: h, x1: x, y1: y, x2: x + w, y2: y + h},
            points: [
                {x, y},
                {x: x + w, y},
                {x: x + w, y: y + h},
                {x, y: y + h},
            ],
            transform: {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0},
            "transform-inverse": {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0},
            rotation: 0,
            fills: fillImage
                ? [{"fill-image": fillImage}]
                : [{"fill-color": "#F8F9FA", "fill-opacity": 1}],
            strokes: [
                {
                    "stroke-alignment": "inner",
                    "stroke-color": "#D6D6D6",
                    "stroke-opacity": 1,
                    "stroke-style": "solid",
                    "stroke-width": 1,
                },
            ],
        },
    };
}

const surfaces = JSON.parse(
    readFileSync(resolve(__dirname, "..", "surfaces.json"), "utf8"),
);

const fileMeta = await rpc("get-file", {id: FILE_ID});
const pageByName = new Map();
for (const pid of fileMeta.data.pages) {
    pageByName.set(fileMeta.data.pagesIndex[pid].name, pid);
}

// First: delete the broken `image` shapes we created in v1. They live in each
// page's objects under their own ids; the simplest sweep is to walk all pages
// and delete any object whose type is "image".
const deleteChanges = [];
for (const pid of fileMeta.data.pages) {
    const page = fileMeta.data.pagesIndex[pid];
    for (const [oid, obj] of Object.entries(page.objects || {})) {
        if (obj.type === "image") {
            deleteChanges.push({type: "del-obj", id: oid, "page-id": pid});
        }
    }
}
console.log(`Deleting ${deleteChanges.length} stale image shapes`);

const sessionId = randomUUID();
let revn = fileMeta.revn ?? 0;
let vern = fileMeta.vern ?? 0;
const features = fileMeta.features || [];

if (deleteChanges.length > 0) {
    const res = await rpc("update-file", {
        id: FILE_ID,
        "session-id": sessionId,
        revn,
        vern,
        features,
        changes: deleteChanges,
    });
    revn = res?.revn ?? revn + 1;
    if (res?.vern !== undefined) vern = res.vern;
}

// Now add the new rect-with-image-fill shapes.
for (const page of surfaces.pages) {
    const frame = page.frames[0];
    if (!frame?.src) continue;
    const pageId = pageByName.get(page.name);
    if (!pageId) continue;

    const slug = frame.src.split("/").pop().replace(/\.png$/i, "");

    // Upload media if not already present — `create-file-media-object-from-url`
    // is idempotent in the sense that it just creates new objects each call;
    // we keep one per page to keep things tidy.
    const media = await rpc("create-file-media-object-from-url", {
        "file-id": FILE_ID,
        url: frame.src,
        "is-local": true,
        name: slug,
    });

    const shapeId = randomUUID();
    const change = rectChange({
        pageId,
        shapeId,
        name: frame.label || slug,
        x: 80,
        y: 80,
        w: media.width,
        h: media.height,
        fillImage: {
            id: media.mediaId,
            width: media.width,
            height: media.height,
            mtype: media.mtype,
            name: slug,
        },
    });

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
        console.log(`  ${page.name}: rect+fillImage placed`);
    } catch (e) {
        console.error(`  ${page.name}: ${e.message.slice(0, 300)}`);
    }
}

console.log("done.");
