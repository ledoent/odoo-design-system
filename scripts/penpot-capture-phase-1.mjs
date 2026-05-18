#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 1 verification capture: 12 canonical pages × 2 themes (light
// + dark) = 24 PNGs. Drives Penpot via Playwright (the UI is the only
// reliable way to activate a theme set against shape-level
// appliedTokens.fill bindings; REST has no documented theme-toggle
// command). Uploads to GCS.
//
// Output:
//   - /tmp/phase1-captures/<slug>-<theme>.png  (local)
//   - gs://ledo-pr-assets/odoo-design-system/phase-1/<slug>-<theme>.png
//
// Prints the embed URLs at the end so the verification doc can copy
// them in. Re-runnable; overwrites both local + GCS.
//
// Usage:
//   PENPOT_TOKEN=<pat> PENPOT_PASSWORD=<service-account password> \
//       node scripts/penpot-capture-phase-1.mjs

import {readFileSync, mkdirSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

import {PENPOT_HOST as HOST, getFile, rpc, requireToken} from "./_penpot-rpc.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/pages.json"), "utf8"));
const EMAIL = process.env.PENPOT_EMAIL || "hello@ledoweb.com";
const PW = process.env.PENPOT_PASSWORD;
const FILE_ID = SPEC.file["file-id"];
const TEAM_ID = SPEC.file["team-id"];
const OUT_DIR = "/tmp/phase1-captures";
const GCS_DIR = "gs://ledo-pr-assets/odoo-design-system/phase-1";

if (!PW) {
    console.error("Set PENPOT_PASSWORD (service-account password; see .env).");
    process.exit(2);
}
requireToken("penpot-capture-phase-1.mjs");

function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const pages = (await getFile(FILE_ID)).data.pages.map((pid) => ({
    id: pid,
    name: null,  // filled below
}));
const file0 = await getFile(FILE_ID);
for (const p of pages) p.name = file0.data.pagesIndex[p.id].name;
console.error(`pages: ${pages.length}`);

mkdirSync(OUT_DIR, {recursive: true});
const uploads = [];

const browser = await chromium.launch({headless: true});
const ctx = await browser.newContext({viewport: {width: 1600, height: 1100}});
const page = await ctx.newPage();

// Login.
await page.goto(`${HOST}/#/auth/login`);
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PW);
await page.locator('button:has-text("Continue")').click();
await page.waitForURL(/dashboard|workspace/, {timeout: 15000});
console.error("✓ logged in");

// Mutate `tokensLib.$metadata.activeThemes` (and `activeSets`)
// server-side via the `set-active-token-themes` change op. This is
// the path Penpot's UI takes when you click TOKENS → THEMES → Apply,
// and it's what makes the canvas re-render `appliedTokens.fill`
// bindings. Toggling SETS-list checkboxes alone updates `activeSets`
// without `activeThemes` and Penpot's renderer keeps the bindings on
// their fallback `fills` value.
//
// Penpot stores theme identifiers as paths: `{group}/{name}`. For
// ungrouped themes (the Phase 0 default) the group is empty so the
// path is `/{name}` — `/light`, `/dark`, `/high-contrast`. Sending
// just `light` is silently accepted but populates only `activeThemes`
// and leaves `activeSets` empty, which breaks the re-skin.
async function setActiveTheme(themeName) {
    const head = await getFile(FILE_ID);
    await rpc("update-file", {
        id: FILE_ID,
        revn: head.revn,
        vern: head.vern ?? 0,
        sessionId: randomUUID(),
        changes: [{type: "set-active-token-themes", themePaths: [`/${themeName}`]}],
        skipValidate: false,
    });
    const after = await getFile(FILE_ID);
    const meta = after.data?.tokensLib?.$metadata ?? {};
    console.error(`  ↻ activeThemes=${JSON.stringify(meta.activeThemes)} activeSets=${JSON.stringify(meta.activeSets)}`);
}

for (const theme of ["light", "dark"]) {
    console.error(`\n[theme: ${theme}]`);
    await setActiveTheme(theme);

    let firstPage = true;
    for (const p of pages) {
        const slug = slugify(p.name);
        const url = `${HOST}/#/workspace?team-id=${TEAM_ID}&file-id=${FILE_ID}&page-id=${p.id}`;
        await page.goto(url);
        // Penpot is an SPA — hash-based navigation between pages does
        // NOT refetch tokensLib. After mutating activeThemes via REST,
        // force one full reload at the start of each theme batch so the
        // frontend picks up the new state.
        if (firstPage) {
            await page.waitForTimeout(800);
            await page.reload({waitUntil: "load"});
            firstPage = false;
        }
        // Wait for the canvas to receive and apply the activeThemes
        // mutation. Penpot websocket pushes the new state; ~2.5s is the
        // observed worst case.
        await page.waitForTimeout(2800);
        // Zoom to fit (`Shift + 1`) so the captured area shows the whole frame.
        await page.keyboard.press("Shift+1");
        await page.waitForTimeout(600);

        const localPath = `${OUT_DIR}/${slug}-${theme}.png`;
        await page.screenshot({path: localPath, fullPage: false});
        console.error(`  ✓ ${p.name} → ${localPath}`);
        uploads.push({local: localPath, slug, theme});
    }
}

await browser.close();

// Upload all local PNGs to GCS in one batch.
console.error(`\nuploading ${uploads.length} PNGs to ${GCS_DIR}…`);
const targets = uploads.map((u) => u.local);
execFileSync("gcloud", ["storage", "cp", ...targets, GCS_DIR + "/"], {stdio: "inherit"});

console.error(`\nGCS URLs:`);
for (const u of uploads) {
    console.log(`https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-1/${u.slug}-${u.theme}.png`);
}
