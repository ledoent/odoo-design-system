#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 2 verification capture: 3 PNGs of the "01 — Foundations" page
// — one per active theme (light / dark / high-contrast) — uploaded to
//
//   gs://ledo-pr-assets/odoo-design-system/phase-2/foundations-<theme>.png
//
// Reuses the Phase 1 capture pattern: REST `set-active-token-themes`
// change op to mutate `tokensLib.$metadata.{activeThemes,activeSets}`
// server-side, then Playwright reload + screenshot. The same
// SPA-cache caveat from Phase 1 applies: state-level activation is
// authoritative, but the canvas may render the literal fallback for
// theme-variant shapes if Penpot's frontend doesn't refresh
// tokensLib between batches. Capture script writes what Penpot
// renders; do not interpret a stale-looking PNG as a Phase 2 bug
// unless the spec / `tests/foundations.test.mjs` also fails.
//
// Usage:
//   PENPOT_TOKEN=<pat> PENPOT_PASSWORD=<service-account-password> \
//       node scripts/penpot-capture-phase-2.mjs

import {randomUUID} from "node:crypto";
import {readFileSync, mkdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

import {FEATURES, PENPOT_HOST as HOST, getFile, rpc, requireToken} from "./_penpot-rpc.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_SPEC = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/pages.json"), "utf8"));
const FOUND_SPEC = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/foundations.json"), "utf8"));
const EMAIL = process.env.PENPOT_EMAIL || "hello@ledoweb.com";
const PW = process.env.PENPOT_PASSWORD;
const FILE_ID = PAGES_SPEC.file["file-id"];
const TEAM_ID = PAGES_SPEC.file["team-id"];
const OUT_DIR = "/tmp/phase2-captures";
const GCS_DIR = "gs://ledo-pr-assets/odoo-design-system/phase-2";
const THEMES = ["light", "dark", "high-contrast"];

if (!PW) {
    console.error("Set PENPOT_PASSWORD (service-account password; see .env).");
    process.exit(2);
}
requireToken("penpot-capture-phase-2.mjs");

const file0 = await getFile(FILE_ID);
const targetPid = Object.entries(file0.data.pagesIndex)
    .find(([, p]) => p.name === FOUND_SPEC.page.name)?.[0];
if (!targetPid) {
    console.error(`Foundations page "${FOUND_SPEC.page.name}" not found.`);
    process.exit(3);
}

mkdirSync(OUT_DIR, {recursive: true});
const uploads = [];

const browser = await chromium.launch({headless: true});
const ctx = await browser.newContext({viewport: {width: 1600, height: 1600}});
const page = await ctx.newPage();

await page.goto(`${HOST}/#/auth/login`);
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PW);
await page.locator('button:has-text("Continue")').click();
await page.waitForURL(/dashboard|workspace/, {timeout: 15_000});
console.error("✓ logged in");

async function setActiveTheme(themeName) {
    const head = await getFile(FILE_ID);
    await rpc("update-file", {
        id: FILE_ID,
        revn: head.revn,
        vern: head.vern ?? 0,
        "session-id": randomUUID(),
        features: FEATURES,
        changes: [{type: "set-active-token-themes", themePaths: [`/${themeName}`]}],
        skipValidate: false,
    });
    const after = await getFile(FILE_ID);
    const meta = after.data?.tokensLib?.$metadata ?? {};
    console.error(`  ↻ activeThemes=${JSON.stringify(meta.activeThemes)} activeSets=${JSON.stringify(meta.activeSets)}`);
}

const url = `${HOST}/#/workspace?team-id=${TEAM_ID}&file-id=${FILE_ID}&page-id=${targetPid}`;

for (const theme of THEMES) {
    console.error(`\n[theme: ${theme}]`);
    await setActiveTheme(theme);

    await page.goto(url);
    await page.waitForTimeout(800);
    // Force a hard reload so Penpot's SPA re-fetches the file (the
    // hash-only navigation it does internally keeps a stale tokensLib).
    await page.reload({waitUntil: "load"});
    await page.waitForTimeout(2800);
    // Zoom to fit so the captured area shows the whole tall page.
    await page.keyboard.press("Shift+1");
    await page.waitForTimeout(600);

    const localPath = `${OUT_DIR}/foundations-${theme}.png`;
    await page.screenshot({path: localPath, fullPage: false});
    console.error(`  ✓ → ${localPath}`);
    uploads.push({local: localPath, theme});
}

await browser.close();

console.error(`\nuploading ${uploads.length} PNGs to ${GCS_DIR}…`);
const targets = uploads.map((u) => u.local);
execFileSync("gcloud", ["storage", "cp", ...targets, GCS_DIR + "/"], {stdio: "inherit"});

console.error(`\nGCS URLs:`);
for (const u of uploads) {
    console.log(`https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-2/foundations-${u.theme}.png`);
}
