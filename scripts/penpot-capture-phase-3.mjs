#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 3 verification capture: 3 PNGs of the "03 — Shared Components"
// page — one per active theme (light / dark / high-contrast) —
// uploaded to
//
//   gs://ledo-pr-assets/odoo-design-system/phase-3/components-<theme>.png
//
// Drives theme activation via `setActiveThemeViaUI` (the UI-driven
// helper that fixes the Phase 1/2 SPA cache gap).
//
// Usage:
//   PENPOT_TOKEN=<pat> PENPOT_PASSWORD=<service-account-password> \
//       node scripts/penpot-capture-phase-3.mjs

import {readFileSync, mkdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

import {PENPOT_HOST as HOST, getFile, requireToken} from "./_penpot-rpc.mjs";
import {setActiveThemeViaUI} from "./_penpot-ui-theme.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_SPEC = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/pages.json"), "utf8"));
const COMPS_SPEC = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/components.json"), "utf8"));
const EMAIL = process.env.PENPOT_EMAIL || "hello@ledoweb.com";
const PW = process.env.PENPOT_PASSWORD;
const FILE_ID = PAGES_SPEC.file["file-id"];
const TEAM_ID = PAGES_SPEC.file["team-id"];
const OUT_DIR = "/tmp/phase3-captures";
const GCS_DIR = "gs://ledo-pr-assets/odoo-design-system/phase-3";
const THEMES = ["light", "dark", "high-contrast"];

if (!PW) {
    console.error("Set PENPOT_PASSWORD (service-account password; see .env).");
    process.exit(2);
}
requireToken("penpot-capture-phase-3.mjs");

const file0 = await getFile(FILE_ID);
const targetPid = Object.entries(file0.data.pagesIndex)
    .find(([, p]) => p.name === COMPS_SPEC.page.name)?.[0];
if (!targetPid) {
    console.error(`Shared Components page "${COMPS_SPEC.page.name}" not found.`);
    process.exit(3);
}

mkdirSync(OUT_DIR, {recursive: true});
const uploads = [];

const browser = await chromium.launch({headless: true});
const ctx = await browser.newContext({viewport: {width: 1600, height: 1200}});
const page = await ctx.newPage();

await page.goto(`${HOST}/#/auth/login`);
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PW);
await page.locator('button:has-text("Continue")').click();
await page.waitForURL(/dashboard|workspace/, {timeout: 15_000});
console.error("✓ logged in");

const url = `${HOST}/#/workspace?team-id=${TEAM_ID}&file-id=${FILE_ID}&page-id=${targetPid}`;
await page.goto(url);
await page.waitForTimeout(3000);
await page.keyboard.press("Shift+1");
await page.waitForTimeout(400);

for (const theme of THEMES) {
    console.error(`\n[theme: ${theme}]`);
    const r = await setActiveThemeViaUI(page, theme);
    console.error(`  ↻ ${JSON.stringify(r)}`);
    await page.waitForTimeout(1500);

    const localPath = `${OUT_DIR}/components-${theme}.png`;
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
    console.log(`https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-3/components-${u.theme}.png`);
}
