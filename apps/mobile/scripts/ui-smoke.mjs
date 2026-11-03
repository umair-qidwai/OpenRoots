// Real exported-app smoke test; no dictionary fixtures or simulated AI responses.
// Start scripts/serve-preview.py first. CHROME_BIN can select an installed browser.
import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const base = process.env.OPENROOTS_PREVIEW_URL ?? "http://127.0.0.1:18758";
const output = path.resolve(import.meta.dirname, "../../../docs");
const executablePath =
  process.env.CHROME_BIN ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/chromium");
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--disable-dev-shm-usage", "--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: "en-US",
  colorScheme: "light",
});
const page = await context.newPage();
const checks = [];
const screenshots = [];
const screenshotErrors = [];
async function report() {
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, "UI_VERIFICATION.json"),
    JSON.stringify(
      {
        target: "actual exported app / isolated Chromium via Playwright",
        checks,
        screenshots,
        screenshotErrors,
        scope: "No native-device or real inference claim.",
      },
      null,
      2,
    ),
  );
}
async function record(name) {
  checks.push(name);
  await report();
  console.log("PASS", name);
}
async function waitText(text) {
  await page.waitForFunction(
    (value) => document.body.innerText.includes(value),
    text,
    { timeout: 60000 },
  );
}
async function visit(route, text) {
  await page.goto(base + route, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await waitText(text);
}
async function click(text) {
  await page.getByRole("button", { name: text, exact: true }).click();
}
const body = () => page.locator("body").innerText();
async function screenshot(name) {
  try {
    await mkdir(path.join(output, "screenshots"), { recursive: true });
    await page.screenshot({
      path: path.join(output, "screenshots", name),
      timeout: 15000,
    });
    screenshots.push(name);
  } catch (error) {
    screenshotErrors.push({ name, message: error.message });
  }
  await report();
}
try {
  await visit("/", "Search the dictionaries");
  await record("startup_and_home");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await record("mobile_home_no_horizontal_overflow");
  await screenshot("home-mobile.png");
  await page.locator("input").fill("صبر");
  await click("Search the dictionaries");
  await waitText("Read full entry →");
  assert.ok((await body()).includes("صَبْرٌ"));
  await record("home_search_real_dictionary");
  assert.equal(
    await page
      .getByRole("textbox", { name: "Dictionary query", exact: true })
      .inputValue(),
    "صبر",
  );
  await screenshot("dictionary-mobile.png");
  await page
    .getByRole("button", { name: "Read full entry →", exact: true })
    .first()
    .click();
  await waitText("Translate this passage");
  const entryUrl = new URL(page.url()).pathname;
  assert.ok((await body()).includes("Edward William Lane"));
  await record("original_entry_and_attribution");
  await click("Bookmark");
  await waitText("Saved ✓");
  await record("bookmark_written");
  await visit("/saved", "An Arabic-English Lexicon");
  await record("bookmark_survives_full_reload");
  await screenshot("saved-mobile.png");
  await visit("/", "Continue reading");
  await waitText("صَبْرٌ");
  await record("home_displays_real_bookmark");
  await visit(entryUrl, "Translate this passage");
  await page
    .getByRole("button", { name: "Translate this passage", exact: true })
    .first()
    .click();
  await waitText("Translate selection");
  assert.ok((await page.locator("textarea").inputValue()).includes("صَبْرٌ"));
  await page.locator("textarea").fill("صَبْرٌ");
  assert.equal(await page.locator("textarea").inputValue(), "صَبْرٌ");
  await record("translation_source_and_exact_subset_editor");
  const passageId = new URL(page.url()).searchParams.get("passage");
  assert.ok(passageId);
  await visit(
    `${entryUrl}?passage=${encodeURIComponent(passageId)}`,
    "ORIGINAL SOURCE",
  );
  assert.equal(
    await page.evaluate(() =>
      [...document.querySelectorAll("div")].some(
        (e) =>
          getComputedStyle(e).borderTopWidth === "2px" &&
          e.innerText.includes("ORIGINAL SOURCE"),
      ),
    ),
    true,
  );
  await record("citation_highlights_actual_passage");
  await visit("/compare", "Compare with sources");
  await page.locator("textarea").fill("خوف");
  await page.locator("input").fill("خشية");
  await click("Compare with sources");
  await waitText("Add your Worker access token");
  await record("comparison_retrieval_and_truthful_missing_credentials");
  await visit("/library", "49,473");
  assert.ok((await body()).includes("CC-BY-SA-3.0-US"));
  await record("library_real_count_and_license");
  await visit("/settings", "Cloud connection");
  await click("Dark");
  await click("العربية");
  await waitText("الإعدادات");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await record("arabic_dark_mobile_layout");
  await visit("/settings", "الاتصال السحابي");
  await waitText("✓ داكن");
  await record("language_and_theme_survive_full_reload");
  await screenshot("settings-arabic-dark.png");
  console.log(
    JSON.stringify(
      { passed: checks.length, checks, screenshots, screenshotErrors },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  console.error("URL", page.url());
  console.error(await body().catch(() => "(unavailable)"));
  process.exitCode = 1;
} finally {
  await report();
  await browser.close();
}
