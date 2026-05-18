// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Shared Playwright capture runner for per-phase verification PNGs.
// Phase 2 (`penpot-capture-phase-2.mjs`) and Phase 3
// (`penpot-capture-phase-3.mjs`) each used to inline the same ~90
// lines of login + theme-toggle + screenshot + GCS-upload glue. This
// module owns the glue; per-phase callers just pass the page name
// and output dirs.
//
// Theme activation goes through `setActiveThemeViaUI` because
// Penpot's REST `set-active-token-themes` mutates `$metadata`
// correctly but the SPA caches theme resolution per session — see
// `_penpot-ui-theme.mjs` for the dialog click sequence that
// invalidates the cache and re-renders the canvas.

import {mkdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright";

import {PENPOT_HOST as HOST, getFile, requireToken} from "./_penpot-rpc.mjs";
import {setActiveThemeViaUI} from "./_penpot-ui-theme.mjs";

const DEFAULT_THEMES = ["light", "dark", "high-contrast"];

/**
 * Capture one PNG per theme of a single page in the canonical
 * Penpot file. Uploads all PNGs to GCS in one batch and prints the
 * resulting public HTTPS URLs to stdout.
 *
 * @param {object} args
 * @param {string} args.fileId       — Penpot file UUID
 * @param {string} args.teamId       — Penpot team UUID
 * @param {string} args.pageName     — target page name (e.g. "01 — Foundations")
 * @param {string} args.outDir       — local /tmp dir for the PNGs
 * @param {string} args.gcsDir       — `gs://…` destination prefix
 * @param {string} args.filenamePrefix — PNG filename stem (e.g. "foundations" or "components")
 * @param {string[]} [args.themes]   — theme names to capture (default light/dark/high-contrast)
 * @param {{width:number,height:number}} [args.viewport] — Playwright viewport (default 1600×1600)
 */
export async function captureThemesOfPage({
    fileId, teamId, pageName, outDir, gcsDir, filenamePrefix,
    themes = DEFAULT_THEMES,
    viewport = {width: 1600, height: 1600},
}) {
    requireToken("captureThemesOfPage");
    const email = process.env.PENPOT_EMAIL || "hello@ledoweb.com";
    const password = process.env.PENPOT_PASSWORD;
    if (!password) {
        console.error("Set PENPOT_PASSWORD (service-account password; see .env).");
        process.exit(2);
    }

    const file = await getFile(fileId);
    const pageId = Object.entries(file.data.pagesIndex)
        .find(([, p]) => p.name === pageName)?.[0];
    if (!pageId) {
        console.error(`page "${pageName}" not found in file ${fileId}.`);
        process.exit(3);
    }

    mkdirSync(outDir, {recursive: true});
    const uploads = [];

    const browser = await chromium.launch({headless: true});
    try {
        const ctx = await browser.newContext({viewport});
        const page = await ctx.newPage();

        await page.goto(`${HOST}/#/auth/login`);
        await page.locator('input[type="email"]').fill(email);
        await page.locator('input[type="password"]').fill(password);
        await page.locator('button:has-text("Continue")').click();
        await page.waitForURL(/dashboard|workspace/, {timeout: 15_000});
        console.error("✓ logged in");

        await page.goto(`${HOST}/#/workspace?team-id=${teamId}&file-id=${fileId}&page-id=${pageId}`);
        await page.waitForTimeout(3000);
        // Shift+1 = "zoom to fit" in Penpot's keymap — frames the
        // entire (potentially tall) page in the viewport before capture.
        await page.keyboard.press("Shift+1");
        await page.waitForTimeout(400);

        for (const theme of themes) {
            console.error(`\n[theme: ${theme}]`);
            const r = await setActiveThemeViaUI(page, theme);
            console.error(`  ↻ ${JSON.stringify(r)}`);
            // Penpot's renderer commits the new theme on the next
            // paint; give it a moment in case of debounce.
            await page.waitForTimeout(1500);

            const localPath = `${outDir}/${filenamePrefix}-${theme}.png`;
            await page.screenshot({path: localPath, fullPage: false});
            console.error(`  ✓ → ${localPath}`);
            uploads.push({local: localPath, theme});
        }
    } finally {
        await browser.close();
    }

    console.error(`\nuploading ${uploads.length} PNGs to ${gcsDir}…`);
    const targets = uploads.map((u) => u.local);
    execFileSync("gcloud", ["storage", "cp", ...targets, gcsDir + "/"], {stdio: "inherit"});

    const gcsBase = gcsDir.replace(/^gs:\/\//, "https://storage.googleapis.com/");
    console.error(`\nGCS URLs:`);
    for (const u of uploads) {
        console.log(`${gcsBase}/${filenamePrefix}-${u.theme}.png`);
    }
    return uploads;
}
