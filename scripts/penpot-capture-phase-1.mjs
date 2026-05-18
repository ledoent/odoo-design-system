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
import {execFileSync} from "node:child_process";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/pages.json"), "utf8"));
const HOST = process.env.PENPOT_HOST || "https://design.hz.ledoweb.com";
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

function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function getPageIds(token) {
    // Look up the 12 page IDs in the order they appear in the file.
    const r = await fetch(`${HOST}/api/rpc/command/get-file`, {
        method: "POST",
        headers: {
            "Authorization": `Token ${token}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify({
            id: FILE_ID,
            features: [
                "design-tokens/v1", "fdata/objects-map", "fdata/path-data",
                "fdata/shape-data-type", "components/v2", "layout/grid",
                "styles/v2", "variants/v1",
            ],
        }),
    });
    if (!r.ok) throw new Error(`get-file → ${r.status}`);
    const file = await r.json();
    return file.data.pages.map((pid) => ({
        id: pid,
        name: file.data.pagesIndex[pid].name,
    }));
}

const REST_TOKEN = process.env.PENPOT_TOKEN;
if (!REST_TOKEN) {
    console.error("Set PENPOT_TOKEN to look up page IDs.");
    process.exit(2);
}
const pages = await getPageIds(REST_TOKEN);
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

// Helper: switch active theme via Penpot's THEMES dropdown.
// The Penpot 2.15 UI exposes a theme picker at TOKENS → THEMES.
async function setTheme(themeName) {
    // Open Tokens tab.
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tokens');
        btn?.click();
    });
    await page.waitForTimeout(400);

    // Open the THEMES dropdown by clicking its "No theme active" / current-theme button.
    await page.evaluate(() => {
        const themeDropdown = [...document.querySelectorAll('button, [role="combobox"], [class*="theme-select"]')]
            .find((el) => /No theme active|theme-/.test(el.textContent || ''));
        themeDropdown?.click();
    });
    await page.waitForTimeout(400);

    // Pick the named theme.
    const clicked = await page.evaluate((name) => {
        const items = [...document.querySelectorAll('[role="option"], li, [class*="theme-option"], button')];
        const t = items.find((el) => el.textContent.trim() === name);
        t?.click();
        return !!t;
    }, themeName);
    if (!clicked) {
        // Fallback: directly toggle the set's active checkbox via the SETS panel.
        const setName = `theme-${themeName}`;
        await page.evaluate((sn) => {
            const cb = document.querySelector(`#token-set-item-${sn} [role="checkbox"]`);
            if (cb && cb.getAttribute('aria-checked') === 'false') cb.click();
        }, setName);
    }
    await page.waitForTimeout(800);
}

for (const theme of ["light", "dark"]) {
    console.error(`\n[theme: ${theme}]`);
    await setTheme(theme);

    for (const p of pages) {
        const slug = slugify(p.name);
        const url = `${HOST}/#/workspace?team-id=${TEAM_ID}&file-id=${FILE_ID}&page-id=${p.id}`;
        await page.goto(url);
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
