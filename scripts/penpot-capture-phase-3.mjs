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
// All Playwright + theme-toggle + GCS-upload glue lives in
// `scripts/_penpot-capture.mjs`; this script just supplies the
// per-phase config.
//
// Usage:
//   PENPOT_TOKEN=<pat> PENPOT_PASSWORD=<service-account-password> \
//       node scripts/penpot-capture-phase-3.mjs

import {readFileSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";

import {captureThemesOfPage} from "./_penpot-capture.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_SPEC = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/pages.json"), "utf8"));
const COMPS_SPEC = JSON.parse(readFileSync(resolve(REPO, "docs/penpot/specs/components.json"), "utf8"));

await captureThemesOfPage({
    fileId: PAGES_SPEC.file["file-id"],
    teamId: PAGES_SPEC.file["team-id"],
    pageName: COMPS_SPEC.page.name,
    outDir: "/tmp/phase3-captures",
    gcsDir: "gs://ledo-pr-assets/odoo-design-system/phase-3",
    filenamePrefix: "components",
    viewport: {width: 1600, height: 1200},
});
