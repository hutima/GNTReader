// Real-browser smoke for the vocabulary-progress feature (PR 3
// feat/vocabulary-progress). Verifies the CLAUDE.md rule that interactive UI
// (here: a modal opened from a Settings button, and a mark-known button that
// must update a percentage live without refetch) is exercised in a real
// browser, not just Vitest/happy-dom.
//
// Setup (mirrors docs/verification/browser-smoke.mjs):
//   npm run build
//   npm i --no-save playwright-core   # library only; browser is preinstalled
//   node docs/verification/progress-smoke.mjs
//
// Runs the same checks at two viewports: a mobile/touch viewport (390x844,
// where Settings/DetailPanel render as bottom sheets) and a desktop viewport
// (1280x900, side-panel layout) — CLAUDE.md notes some chrome (sheet grabber)
// is hidden >=768px, so both are covered even though this feature itself is
// not a swipe gesture.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = process.env.PORT ?? '4322';
const URL_BASE = `http://127.0.0.1:${PORT}/`;
const SCREENSHOT_DIR =
  process.env.SCREENSHOT_DIR ??
  '/tmp/claude-0/-home-user-GNTReader/138f9b59-2fcb-58bd-90bd-1dc6c77f0907/scratchpad/pr3';

const results = [];
const ok = (name) => {
  results.push(`PASS ${name}`);
  console.log(`PASS ${name}`);
};
const fail = (name, e) => {
  results.push(`FAIL ${name}: ${e}`);
  console.log(`FAIL ${name}: ${e}`);
  process.exitCode = 1;
};

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', PORT], {
  cwd: ROOT,
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

async function runAt(label, viewportOpts, shotPrefix) {
  const context = await browser.newContext(viewportOpts);
  const page = await context.newPage();
  try {
    await page.goto(URL_BASE, { waitUntil: 'load' });
    await page.getByRole('heading', { name: 'John 1' }).waitFor({ timeout: 15000 });

    // First launch shows the tutorial overlay (fresh context, no
    // localStorage) — dismiss it before interacting with anything else.
    const skipTour = page.getByRole('button', { name: 'Skip tour' });
    if (await skipTour.isVisible().catch(() => false)) {
      await skipTour.click();
    }

    // 1. Open Settings, then the Vocabulary progress modal.
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).waitFor();
    await page.getByRole('button', { name: 'Vocabulary progress' }).click();
    const progressDialog = page.getByRole('dialog', { name: 'Vocabulary progress' });
    await progressDialog.waitFor();
    ok(`[${label}] Vocabulary progress button opens the modal`);

    // 2. Both testament groups render with real (non-placeholder) numbers.
    await progressDialog.getByText('Greek New Testament').waitFor({ timeout: 20000 });
    await progressDialog.getByText('Hebrew Old Testament').waitFor({ timeout: 20000 });
    await progressDialog.getByText('John').first().waitFor();
    await progressDialog.getByText('Genesis').first().waitFor();
    const bodyText = await progressDialog.textContent();
    if (/NaN/.test(bodyText)) throw new Error('modal text contains NaN');
    if (!/\d[\d,]* \/ [\d,]* tokens/.test(bodyText)) {
      throw new Error(`no "N / M tokens" fraction found in modal text: ${bodyText.slice(0, 400)}`);
    }
    const johnRow = progressDialog.locator('.progress-book-row', { hasText: 'John' }).first();
    const johnStatsBefore = (await johnRow.locator('.progress-book-stats').textContent()) ?? '';
    ok(`[${label}] both testament groups show real token counts (John: "${johnStatsBefore.trim()}")`);

    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
    await progressDialog.waitFor({ state: 'hidden' }).catch(() => {});

    // Close Settings too, so the reader/detail panel is reachable underneath.
    // Settings has no Escape handler of its own — dismiss via its backdrop,
    // same as docs/verification/browser-smoke.mjs step 7.
    const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
    if (await settingsDialog.isVisible().catch(() => false)) {
      await page.locator('.sheet-backdrop').click({ position: { x: 5, y: 5 } });
      await settingsDialog.waitFor({ state: 'hidden' }).catch(() => {});
    }

    // 3. Mark a word known via the detail-panel button, then confirm the
    // book percentage changes in the (reopened) modal WITHOUT a reload.
    await page.getByText('Ἐν', { exact: true }).first().click();
    // Desktop renders an <aside aria-label="Word details"> (implicit
    // "complementary" role); mobile renders a bottom sheet with
    // role="dialog" aria-label="Word details" — match on the attribute
    // directly so one selector covers both layouts.
    const detail = page.locator('[aria-label="Word details"]');
    await detail.first().waitFor({ timeout: 10000 });
    const markButton = page.getByRole('button', { name: 'Mark word known' }).first();
    await markButton.waitFor({ timeout: 10000 });
    await markButton.click();
    await page.getByRole('button', { name: '✓ Word known' }).first().waitFor({ timeout: 5000 });
    ok(`[${label}] "Mark word known" button marks Ἐν's lexeme known`);

    // Close the detail panel/sheet before reopening Settings.
    const closeDetail = page.getByRole('button', { name: 'Close details' }).first();
    if (await closeDetail.isVisible().catch(() => false)) await closeDetail.click();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).waitFor();
    await page.getByRole('button', { name: 'Vocabulary progress' }).click();
    const progressDialog2 = page.getByRole('dialog', { name: 'Vocabulary progress' });
    await progressDialog2.waitFor();
    const johnRow2 = progressDialog2.locator('.progress-book-row', { hasText: 'John' }).first();
    await johnRow2.waitFor();
    const johnStatsAfter = (await johnRow2.locator('.progress-book-stats').textContent()) ?? '';
    if (johnStatsAfter === johnStatsBefore) {
      throw new Error(`John's stats did not change after marking a word known (still "${johnStatsAfter}")`);
    }
    ok(`[${label}] John's progress updated live, no reload: "${johnStatsBefore.trim()}" -> "${johnStatsAfter.trim()}"`);

    await page.screenshot({ path: join(SCREENSHOT_DIR, `${shotPrefix}-progress-modal.png`) });
  } catch (e) {
    fail(`[${label}] vocabulary progress smoke`, e.message ?? e);
    try {
      await page.screenshot({ path: join(SCREENSHOT_DIR, `${shotPrefix}-FAIL.png`) });
    } catch {}
  } finally {
    await context.close();
  }
}

try {
  await runAt('mobile 390x844', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, 'mobile');
  await runAt('desktop 1280x900', { viewport: { width: 1280, height: 900 } }, 'desktop');
} finally {
  await browser.close();
  preview.kill();
}

console.log('\n=== SUMMARY ===');
for (const r of results) console.log(r);
