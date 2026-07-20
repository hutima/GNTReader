// Real-browser smoke for the "Word study" detail-panel section (PR
// feat/lexeme-word-study). Vitest/happy-dom does not run real layout or
// <details> disclosure toggling faithfully enough to trust for this, so this
// drives actual Chromium (CLAUDE.md's real-browser rule) at both a desktop
// (side-panel) and a mobile (bottom-sheet) viewport, tapping λόγος in the
// bundled John 1 fixture and asserting the section renders total, bars,
// "Other", and the full table.
//
// Setup:
//   npm run build
//   npm install --no-save playwright-core   # library only; browser preinstalled
//   node docs/verification/wordstudy-smoke.mjs   # run from repo root
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 4321;
const URL_BASE = `http://127.0.0.1:${PORT}/`;
const SHOT_DIR = '/tmp/claude-0/-home-user-GNTReader/138f9b59-2fcb-58bd-90bd-1dc6c77f0907/scratchpad/pr2';
mkdirSync(SHOT_DIR, { recursive: true });

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

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], {
  cwd: ROOT,
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 5000));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

async function checkAtViewport(label, viewportOpts, screenshotName) {
  const context = await browser.newContext(viewportOpts);
  // First-launch tutorial modal (src/ui/TutorialModal.tsx) covers the whole
  // screen with a .modal-backdrop that intercepts clicks; seed it as
  // already-seen (same key/value the unit tests' setup.ts uses) so it never
  // opens and blocks the token tap below.
  await context.addInitScript(() => {
    window.localStorage.setItem('gr:tutorialSeen', 'on');
  });
  const page = await context.newPage();
  try {
    await page.goto(URL_BASE, { waitUntil: 'load' });
    await page.getByRole('heading', { name: 'John 1' }).waitFor({ timeout: 15000 });

    // John 1:1's first λόγος ("the Word") — surface text, bundled fixture.
    await page.getByText('λόγος', { exact: true }).first().click();
    const detail = viewportOpts.isMobile
      ? page.getByRole('dialog', { name: 'Word details' })
      : page.getByRole('complementary', { name: 'Word details' });
    await detail.waitFor();
    ok(`${label}: detail panel opens on λόγος tap`);

    const section = detail.getByRole('region', { name: 'Word study' });
    await section.waitFor({ timeout: 10000 });
    // The section itself renders immediately (loading state); wait for the
    // async fetch of public/wordstudy/gnt.json to resolve into the "ready"
    // state (total-occurrences line) before asserting on content.
    await section.locator('.ws-total').waitFor({ timeout: 10000 });
    const text = await section.textContent();
    if (!text.includes('in the Greek NT')) throw new Error(`no total line: ${text?.slice(0, 200)}`);
    if (!text.includes('Derived from')) throw new Error(`no derivation row: ${text?.slice(0, 200)}`);
    if (!text.includes('word')) throw new Error(`no gloss bar: ${text?.slice(0, 200)}`);
    if (!text.includes('Other')) throw new Error(`no "Other" bucket: ${text?.slice(0, 200)}`);
    ok(`${label}: word study shows total + derivation + gloss bars + Other`);

    // λόγος is derived from λέγω (G3004) — click through to Strong's.
    await section.getByRole('button', { name: 'G3004' }).click();
    const strongsDialog = page.getByRole('dialog', { name: 'Strong’s lexicon' });
    await strongsDialog.waitFor({ timeout: 10000 });
    if (!(await strongsDialog.textContent()).includes('G3004')) {
      throw new Error('derived-from link did not open G3004 in Strong’s lexicon');
    }
    ok(`${label}: "Derived from" G3004 link opens Strong’s lexicon`);
    // Close Strong's by tapping its backdrop (StrongsPanel.tsx: onClick ->
    // openPanel('none')) — the detail panel stays mounted underneath the
    // whole time, so no need to re-select the token. On mobile the detail
    // sheet's OWN backdrop (pointer-events: none, per CSS) is also in the
    // DOM, so pick the topmost (last-mounted) .sheet-backdrop, not the first.
    await page.locator('.sheet-backdrop').last().click({ position: { x: 5, y: 5 } });
    await strongsDialog.waitFor({ state: 'hidden', timeout: 10000 });

    const summary = detail.locator('.ws-details summary');
    await summary.click();
    const table = detail.locator('.ws-table');
    await table.waitFor();
    const rowCount = await table.locator('tbody tr').count();
    if (rowCount < 1) throw new Error('expanded table has no rows');
    ok(`${label}: "All N glosses" disclosure expands an accessible table (${rowCount} rows)`);

    // Whole-page fullPage screenshots don't capture the detail panel's OWN
    // scroll region (`.detail.side`/`.detail.sheet` are `overflow-y: auto`
    // internally), so shoot the panel element itself to show the bars/table
    // too, alongside a full-viewport shot for overall layout context.
    await page.screenshot({ path: join(SHOT_DIR, `layout-${screenshotName}`) });
    await table.scrollIntoViewIfNeeded();
    await detail.screenshot({ path: join(SHOT_DIR, screenshotName) });
  } catch (e) {
    fail(`${label}: word study smoke`, e.message ?? e);
    try {
      await page.screenshot({ path: join(SHOT_DIR, `FAIL-${screenshotName}`) });
    } catch {}
  } finally {
    await context.close();
  }
}

try {
  await checkAtViewport('desktop 1280x900', { viewport: { width: 1280, height: 900 } }, 'desktop-1280x900.png');
  await checkAtViewport(
    'mobile 390x844',
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    'mobile-390x844.png',
  );
} finally {
  await browser.close();
  preview.kill();
}

console.log('\n=== SUMMARY ===');
for (const r of results) console.log(r);
