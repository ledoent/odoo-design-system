import {chromium} from "playwright";
import {readFileSync, mkdirSync, existsSync} from "node:fs";
import {dirname} from "node:path";

const BASE = "https://design.hz.ledoweb.com";
const FILE = "ab1caf40-8849-808b-8008-08c57843b42e";
const TEAM = "442b344a-1ecc-8198-8008-0771673d374d";
const SRC = "/tmp/asset-mgmt-shots";
const OUT = "/tmp/penpot-proof";
mkdirSync(OUT, {recursive: true});

const PAGES = [
    ["481c9ac7-f6f8-4a3f-86be-b9fc6e7bd57d", "01-assets-list"],
    ["a5672241-80f8-4415-bf4b-603a4d7eda68", "02-asset-form-open"],
    ["860d9710-3813-4900-8d55-420cf73bda88", "03-asset-depreciation-board"],
    ["9f44a5ef-a7e0-4e9e-b39b-8dc967426822", "04-asset-profiles"],
    ["31c44b96-3e52-4467-9327-820db5ce55b3", "05-profile-form"],
    ["677578cb-e43d-4d07-8151-d26315d6462b", "06-compute-wizard"],
    ["e86dd679-2917-4dae-9890-508961d55fea", "07-report-wizard"],
    ["8ad2da5f-e3e9-4de6-a5a3-55d51e5b8afe", "08-asset-groups"],
];

const env = readFileSync("/Users/dkendall/projects/ledoent/oca/oca-design-system/.env", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))[1];

const browser = await chromium.launch({headless: true});
const ctx = await browser.newContext({viewport: {width: 1440, height: 900}});
const page = await ctx.newPage();
page.setDefaultTimeout(30_000);

// Login
await page.goto(`${BASE}/#/auth/login`, {waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);
await page.fill('input[name="email"]', get("PENPOT_EMAIL"));
await page.fill('input[name="password"]', get("PENPOT_PASSWORD"));
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
console.log("logged in");

for (const [pid, slug] of PAGES) {
    console.log(`→ ${slug}`);
    await page.goto(
        `${BASE}/#/workspace?team-id=${TEAM}&file-id=${FILE}&page-id=${pid}`,
        {waitUntil: "domcontentloaded"},
    );
    await page.waitForTimeout(4500);
    // setInputFiles on the hidden image-upload input
    const input = page.locator("input#image-upload");
    const imgPath = `${SRC}/${slug}.png`;
    if (!existsSync(imgPath)) {
        console.log(`  missing ${imgPath}`);
        continue;
    }
    try {
        await input.setInputFiles(imgPath);
        await page.waitForTimeout(4000);
        // Zoom to fit
        await page.keyboard.press("1");
        await page.waitForTimeout(1500);
        await page.screenshot({path: `${OUT}/${slug}.png`});
        console.log(`  uploaded + captured`);
    } catch (e) {
        console.log(`  failed: ${e.message.slice(0, 200)}`);
    }
}

await browser.close();
console.log("done.");
