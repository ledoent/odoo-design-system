#!/usr/bin/env node
// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// CI/pre-commit gate. Re-runs `style-dictionary build` and compares the
// regenerated SCSS to the checked-in version. Exits non-zero if anyone
// forgot to re-run `pnpm run tokens` after editing
// `design-system.dtcg.json`.
//
// We avoid the temp-dir / wrapper config trick: just run the build,
// stat the modified files, compare against git's view of HEAD, then
// reset any drift the build introduced. The build is idempotent.

import {execSync} from "node:child_process";

const TARGETS = [
    "odoo_design_system/static/src/scss/_tokens.generated.scss",
    "dist/brand_variables.scss",
];

// Run the build (rewrites the files unconditionally).
execSync("pnpm run tokens", {stdio: "inherit"});

// Use `git diff --exit-code` against HEAD. Non-zero means drift.
let drift = false;
for (const f of TARGETS) {
    try {
        execSync(`git diff --exit-code --no-color -- "${f}"`, {stdio: "pipe"});
        console.log(`✓ ${f} matches the JSON source`);
    } catch {
        console.error(`✗ ${f} is out of sync with design-system.dtcg.json`);
        console.error(`  Run \`pnpm run tokens\` and commit the result.`);
        execSync(`git --no-pager diff --no-color -- "${f}"`, {stdio: "inherit"});
        drift = true;
    }
}

if (drift) {
    process.exit(1);
}
