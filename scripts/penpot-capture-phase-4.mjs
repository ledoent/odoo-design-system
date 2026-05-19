#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Phase 4 capture — one PNG of the "07 — Backend Templates" page showing
// all four surfaces (Navbar, ControlPanel, StatusBar, UserMenu) with all
// three theme variants (light / dark / high-contrast) laid out as rows.
//
// Phase 4 surfaces use hardcoded per-theme colors (NOT token-driven), so
// all three theme variants already exist as separate rows on the same page.
// No Tokens-panel theme-switching is needed — and deliberately avoided,
// since clicking the Tokens tab triggers a batch position-data update that
// fails validation on pages that have been rendered by the workspace.
//
// Uploads to:
//   gs://ledo-pr-assets/odoo-design-system/phase-4/backend-chrome-overview.png
//
// Usage:
//   PENPOT_TOKEN=<pat> PENPOT_PASSWORD=<service-account-password> \
//       node scripts/penpot-capture-phase-4.mjs

import { mkdirSync }             from "node:fs";
import { execFileSync }          from "node:child_process";
import { resolve, dirname }      from "node:path";
import { fileURLToPath }         from "node:url";
import { readFileSync }          from "node:fs";

import { chromium } from "playwright";
import { PENPOT_HOST as HOST, requireToken, getFile } from "./_penpot-rpc.mjs";

requireToken("penpot-capture-phase-4.mjs");

const REPO       = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_SPEC  = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/pages.json"), "utf8"));
const FILE_ID     = PAGES_SPEC.file["file-id"];
const TEAM_ID     = PAGES_SPEC.file["team-id"];
const PAGE_NAME   = "07 — Backend Templates";
const OUT_DIR     = "/tmp/phase4-captures";
const GCS_DIR     = "gs://ledo-pr-assets/odoo-design-system/phase-4";
// Tall viewport so zoom-to-fit reveals the full 1440×1540 design space.
const VIEWPORT    = { width: 1600, height: 1800 };

const email    = process.env.PENPOT_EMAIL || "hello@ledoweb.com";
const password = process.env.PENPOT_PASSWORD;
if (!password) { console.error("Set PENPOT_PASSWORD (from .env)."); process.exit(2); }

const file   = await getFile(FILE_ID);
const pageId = Object.entries(file.data?.pagesIndex ?? {})
    .find(([, p]) => p.name === PAGE_NAME)?.[0];
if (!pageId) { console.error(`Page "${PAGE_NAME}" not found.`); process.exit(3); }

mkdirSync(OUT_DIR, { recursive: true });

const wsUrl = `${HOST}/#/workspace?team-id=${TEAM_ID}&file-id=${FILE_ID}&page-id=${pageId}`;
const localPath = `${OUT_DIR}/backend-chrome-overview.png`;

const browser = await chromium.launch({ headless: true });
try {
    const ctx  = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();

    await page.goto(`${HOST}/#/auth/login`);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button:has-text("Continue")').click();
    await page.waitForURL(/dashboard|workspace/, { timeout: 15_000 });
    console.error("✓ logged in");

    await page.goto(wsUrl);
    await page.waitForSelector('[class*="viewport"], canvas, .workspace-content', { timeout: 20_000 })
        .catch(() => {});
    await page.waitForTimeout(5000);

    // Zoom to fit — frames the entire page in the canvas viewport.
    await page.keyboard.press("Shift+1");
    await page.waitForTimeout(1500);

    await page.screenshot({ path: localPath, fullPage: false });
    console.error(`✓ → ${localPath}`);
} finally {
    await browser.close();
}

console.error(`\nuploading to ${GCS_DIR}…`);
execFileSync("gcloud", ["storage", "cp", localPath, GCS_DIR + "/"], { stdio: "inherit" });

const gcsBase = GCS_DIR.replace(/^gs:\/\//, "https://storage.googleapis.com/");
console.log(`${gcsBase}/backend-chrome-overview.png`);
