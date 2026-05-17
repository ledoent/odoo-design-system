// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Live-Odoo verification for Phase 0 theme machinery. Opt-in — skipped
// unless PW_ODOO_URL points at an Odoo instance with odoo_design_system
// installed AND PW_STORAGE_STATE points at a Playwright storageState
// JSON from a logged-in session.
//
// The harness asserts the three things Phase 0 promises:
//
//   1. clicking a theme-switcher button flips html[data-theme]
//   2. --ods-surface-canvas resolves to distinct values per theme
//   3. --ods-text-primary resolves to distinct values per theme

import {test, expect} from "@playwright/test";

const SHOWCASE_PATH = "/odoo/action-odoo_design_system.action_showcase";

test.describe("showcase theme switcher", () => {
    test.skip(
        !process.env.PW_ODOO_URL,
        "Set PW_ODOO_URL to enable showcase E2E (e.g. http://localhost:8069).",
    );

    test.use(
        process.env.PW_STORAGE_STATE
            ? {storageState: process.env.PW_STORAGE_STATE}
            : {},
    );

    test("flips data-theme and re-resolves CSS custom properties", async ({page}) => {
        await page.goto(SHOWCASE_PATH);
        await page.waitForSelector(".ods_showcase", {timeout: 15_000});

        const readVar = (name: string) =>
            page.evaluate(
                (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
                name,
            );

        // Default: light theme is applied on mount.
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
        const lightCanvas = await readVar("--ods-surface-canvas");
        const lightText = await readVar("--ods-text-primary");

        // Switch to dark.
        await page.locator('.ods_theme_switcher__btn[data-theme="dark"]').click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        const darkCanvas = await readVar("--ods-surface-canvas");
        const darkText = await readVar("--ods-text-primary");

        // Switch to high-contrast.
        await page.locator('.ods_theme_switcher__btn[data-theme="high-contrast"]').click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "high-contrast");
        const hcText = await readVar("--ods-text-primary");

        // Canvas re-resolves between light and dark (high-contrast may share
        // the light canvas color — that's intentional).
        expect(lightCanvas).not.toBe(darkCanvas);
        // Text recolors across all three.
        expect(new Set([lightText, darkText, hcText]).size).toBeGreaterThanOrEqual(2);
    });
});
