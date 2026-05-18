// Copyright 2026 Ledo / Subteno.
// License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl).
//
// Playwright driver for Penpot's `TOKENS → THEMES → EDIT → toggle`
// flow. Phase 0 discovered that REST `set-active-token-themes`
// mutates `$metadata.activeThemes` + `activeSets` correctly but the
// Penpot 2.15 SPA does NOT re-render `appliedTokens.fill` bindings
// after a hash-only nav OR a full page reload — the runtime appears
// to cache theme-resolution state per session. Clicking the in-UI
// **Edit themes** dialog forces the renderer to invalidate, so this
// helper drives that exact click sequence.
//
// Penpot UI structure (discovered live 2026-05-18 against
// design.hz.ledoweb.com, Penpot 2.15.3):
//
//   1. Left sidebar has three tabs: LAYERS / ASSETS / TOKENS.
//   2. Inside TOKENS tab, top section is THEMES with an "EDIT"
//      button next to the active-theme dropdown.
//   3. Clicking EDIT opens a "Themes list" dialog with one
//      <div role="…"> per theme. Each row carries `aria-checked`
//      ("true" when the theme is active, "false" otherwise).
//   4. The row's clickable toggle is the <div> itself; clicking
//      flips `aria-checked` and triggers the canvas re-render.
//   5. Dialog has a "Close" button at the bottom.
//
// Usage (inside an authenticated Playwright session, page already
// pointed at the file workspace URL):
//
//   import {setActiveThemeViaUI} from "./_penpot-ui-theme.mjs";
//   await setActiveThemeViaUI(page, "dark");
//   // Canvas now renders against theme-dark sets.

const THEME_NAMES = new Set(["light", "dark", "high-contrast"]);

/**
 * Drive Penpot's UI to activate `themeName` as the only enabled
 * theme. Deactivates any others that happen to be on.
 *
 * Assumptions:
 *   - `page` is already logged in and pointing at a workspace URL.
 *   - The file's tokensLib has themes named "light", "dark",
 *     "high-contrast" (Phase 0 convention).
 *
 * Side effects on the file:
 *   - Mutates `tokensLib.$metadata.activeThemes` server-side.
 *   - Re-renders the canvas client-side immediately.
 *
 * @param {import('playwright').Page} page
 * @param {"light"|"dark"|"high-contrast"} themeName
 */
export async function setActiveThemeViaUI(page, themeName) {
    if (!THEME_NAMES.has(themeName)) {
        throw new Error(`unknown theme: ${themeName} (expected one of ${[...THEME_NAMES].join(", ")})`);
    }

    // 1. Open the TOKENS tab. Penpot lazily mounts the tab's content,
    //    so a click is required even when the tab is already visible.
    await page.evaluate(() => {
        const tab = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Tokens");
        if (tab) tab.click();
    });
    await page.waitForTimeout(500);

    // 2. Click EDIT next to the THEMES section.
    const editClicked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => /^EDIT$/i.test(b.textContent.trim()));
        if (!btn) return false;
        btn.click();
        return true;
    });
    if (!editClicked) {
        throw new Error("THEMES → EDIT button not found (Penpot UI may have changed; see _penpot-ui-theme.mjs)");
    }
    await page.waitForTimeout(600);

    // 3. In the dialog, find the theme rows. Each row is a DIV with
    //    `aria-checked` and `textContent === <theme-name>`. Click the
    //    target if it's not already active; deactivate others.
    const result = await page.evaluate((target) => {
        // The dialog is the nearest ancestor that has role=dialog OR a
        // class containing "modal". Fall back to scanning document if
        // both come up empty (some Penpot versions skip role=dialog).
        const dialog = document.querySelector('[role="dialog"], [class*="modal"]') || document;
        const themeRows = [...dialog.querySelectorAll('div[aria-checked]')]
            .filter((row) => {
                const t = row.textContent.trim();
                return t === "light" || t === "dark" || t === "high-contrast";
            });
        if (!themeRows.length) return {error: "no theme rows visible in dialog"};
        const changes = [];
        for (const row of themeRows) {
            const name = row.textContent.trim();
            const checked = row.getAttribute("aria-checked") === "true";
            const wantActive = name === target;
            if (checked !== wantActive) {
                row.click();
                changes.push({name, was: checked, now: wantActive});
            }
        }
        return {changes, rowCount: themeRows.length};
    }, themeName);

    if (result.error) {
        throw new Error(`setActiveThemeViaUI: ${result.error}`);
    }
    await page.waitForTimeout(800);

    // 4. Close the dialog.
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => /^Close$/i.test(b.textContent.trim()));
        if (btn) btn.click();
    });
    await page.waitForTimeout(800);

    return result;
}

/**
 * Quick visual proof: read the resolved background color of the
 * Phase 1 background rect (`__phase1.bg`) on the currently-visible
 * page. Caller asserts the value differs between themes (e.g.
 * `#ffffff` for `light` vs `#0f1115` for `dark`).
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string | null>} computed background-color or null
 *     if the rect isn't in the DOM (page hasn't rendered yet).
 */
export async function readPhase1BgFill(page) {
    return page.evaluate(() => {
        // Penpot renders shapes as <rect> elements in an SVG layer.
        // The Phase 1 background rect's name lives in a `data-name`
        // attribute on its wrapper group.
        const wrap = document.querySelector('[data-name="__phase1.bg"], [data-id*="__phase1.bg"]');
        if (!wrap) return null;
        const rect = wrap.querySelector("rect") || wrap;
        return getComputedStyle(rect).fill || rect.getAttribute("fill");
    });
}
