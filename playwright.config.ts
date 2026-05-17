// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Opt-in Playwright config for live-Odoo showcase tests. CI does not run
// these by default — set `PW_ODOO_URL` (e.g. http://localhost:8069) and an
// authenticated session (cookies fed via Playwright's storage state, or
// use Odoo's anonymous /web route if your DB allows it) before running:
//
//     pnpm run test:e2e
//
// Tests live under `tests/e2e/`.

import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
    testDir: "tests/e2e",
    timeout: 30_000,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? "line" : "list",
    use: {
        baseURL: process.env.PW_ODOO_URL || "http://localhost:8069",
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    projects: [
        {name: "chromium", use: {...devices["Desktop Chrome"]}},
    ],
});
