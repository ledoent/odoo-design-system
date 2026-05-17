#!/usr/bin/env node
// Capture account_asset_management UI screenshots for the visual-review case
// study. Drives Playwright against the local 19.0 stack (port 8169) running
// against the oca_review_account_financial_tools_pr2206_19 DB, which has been
// seeded by ./seed-demo.py.
//
// Outputs to /tmp/asset-mgmt-shots/. Upload to GCS after.

import {chromium} from "playwright";
import {mkdirSync} from "node:fs";
import {join} from "node:path";

const BASE = "http://localhost:8169";
const DB = "oca_review_account_financial_tools_pr2206_19";
const OUT = "/tmp/asset-mgmt-shots";
mkdirSync(OUT, {recursive: true});

// Action IDs are seeded into the DB at install — these are stable per-build
// per the ir_model_data query in seed-demo's sibling docs. The query was:
//   SELECT module || '.' || name, res_id FROM ir_model_data
//   WHERE module='account_asset_management' AND model='ir.actions.act_window';
const ACTIONS = {
    assets: 299,
    profiles: 302,
    compute: 298,
    report: 304,
    groups: 301,
};

async function closeDialogIfAny(page) {
    try {
        const btn = page.locator("button:has-text('Close')").first();
        if (await btn.isVisible({timeout: 500}).catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(500);
        }
    } catch {}
}

async function shot(page, slug) {
    await page.screenshot({path: join(OUT, `${slug}.png`)});
    console.log(`  → ${slug}.png`);
}

(async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({viewport: {width: 1440, height: 900}});
    const page = await ctx.newPage();
    page.setDefaultTimeout(30_000);

    // login
    await page.goto(`${BASE}/web/login?db=${DB}`, {waitUntil: "domcontentloaded"});
    await page.fill('input[name="login"]', "admin");
    await page.fill('input[name="password"]', "admin");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    await closeDialogIfAny(page);

    // 1. Assets list view
    console.log("01-assets-list");
    await page.goto(`${BASE}/odoo/action-${ACTIONS.assets}?view_type=list`, {waitUntil: "domcontentloaded"});
    await closeDialogIfAny(page);
    await page.waitForTimeout(4000);
    await shot(page, "01-assets-list");

    // 2. Asset form — open (validated) one
    console.log("02-asset-form-open");
    try {
        // Click first non-draft row (validated Sprinter)
        await page.locator(".o_data_row").nth(0).click({timeout: 5000});
        await page.waitForTimeout(3500);
        await closeDialogIfAny(page);
        await shot(page, "02-asset-form-open");
    } catch (e) {
        console.log("  skipped:", e.message);
    }

    // 3. Depreciation board (scrolled view of the same form)
    console.log("03-asset-depreciation-board");
    try {
        await page.evaluate(() => window.scrollTo(0, 600));
        await page.waitForTimeout(1500);
        await shot(page, "03-asset-depreciation-board");
    } catch (e) {
        console.log("  skipped:", e.message);
    }

    // 4. Asset profiles
    console.log("04-asset-profiles");
    await page.goto(`${BASE}/odoo/action-${ACTIONS.profiles}?view_type=list`, {waitUntil: "domcontentloaded"});
    await closeDialogIfAny(page);
    await page.waitForTimeout(4000);
    await shot(page, "04-asset-profiles");

    // 5. Profile form drill-in
    console.log("05-profile-form");
    try {
        await page.locator(".o_data_row").nth(0).click({timeout: 5000});
        await page.waitForTimeout(3500);
        await closeDialogIfAny(page);
        await shot(page, "05-profile-form");
    } catch (e) {
        console.log("  skipped:", e.message);
    }

    // 6. Compute depreciation wizard
    console.log("06-compute-wizard");
    await page.goto(`${BASE}/odoo/action-${ACTIONS.compute}`, {waitUntil: "domcontentloaded"});
    await page.waitForTimeout(4000);
    await closeDialogIfAny(page);
    await shot(page, "06-compute-wizard");

    // 7. Report wizard
    console.log("07-report-wizard");
    await page.goto(`${BASE}/odoo/action-${ACTIONS.report}`, {waitUntil: "domcontentloaded"});
    await page.waitForTimeout(4000);
    await closeDialogIfAny(page);
    await shot(page, "07-report-wizard");

    // 8. Asset groups (taxonomy)
    console.log("08-asset-groups");
    await page.goto(`${BASE}/odoo/action-${ACTIONS.groups}?view_type=list`, {waitUntil: "domcontentloaded"});
    await page.waitForTimeout(4000);
    await closeDialogIfAny(page);
    await shot(page, "08-asset-groups");

    await browser.close();
    console.log("done.");
})().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
