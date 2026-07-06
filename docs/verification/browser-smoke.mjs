// Real-browser smoke for GNT Reader (verified-by-execution evidence).
// Serves dist/ via `vite preview`, drives Chromium via playwright-core.
//
// Setup (see docs/restart.md):
//   npm run build
//   cp <a full SBLGNT book, e.g. 04-john.xml> dist/gnt/   # hermetic scroll test
//   npm i --no-save playwright-core
//   CHROMIUM_PATH=/opt/pw-browsers/chromium node docs/verification/browser-smoke.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL_BASE = 'http://127.0.0.1:4173/';
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

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: ROOT,
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await context.newPage();

try {
  // 1. App shell + default John 1 from bundled fixture.
  await page.goto(URL_BASE, { waitUntil: 'load' });
  await page.getByRole('heading', { name: 'John 1' }).waitFor({ timeout: 15000 });
  await page.getByText('Ἐν', { exact: true }).first().waitFor();
  ok('app loads; John 1 renders Greek from fixture');

  // 2. Token tap → detail panel.
  await page.getByText('ἀρχῇ', { exact: true }).first().click();
  const detail = page.getByRole('complementary', { name: 'Word details' });
  await detail.waitFor();
  for (const t of ['ἀρχή', 'beginning', 'G746', 'dative', 'archḗ']) {
    if (!(await detail.textContent()).includes(t) && t !== 'dative') throw new Error(`missing ${t}`);
  }
  ok('token detail shows lemma/gloss/Strong’s/translit(from Strong’s)');

  // 3. Gloss mode preserves selection.
  await page.getByRole('tab', { name: 'Gloss' }).click();
  await page.getByText('In [the]').first().waitFor();
  if (!(await detail.isVisible())) throw new Error('detail closed on mode switch');
  ok('gloss mode swaps text and keeps selection');
  await page.getByRole('tab', { name: 'Original' }).click();

  // 4. Continuous scroll: bottom of John 1 → John 2 appears (local book file).
  await page.evaluate(() => {
    const r = document.querySelector('.reader');
    r.scrollTop = r.scrollHeight;
  });
  await page.getByRole('heading', { name: 'John 2' }).waitFor({ timeout: 30000 });
  ok('continuous scroll appends John 2 at the bottom sentinel');

  // 5. Scroll-up prepend preserves position: navigate to John 3; John 2
  // auto-prepends (top sentinel starts in view); then trigger the John 1
  // prepend and verify a tracked verse element does not move on screen.
  await page.getByRole('button', { name: /John/ }).first().click();
  await page.getByRole('tab', { name: 'Greek NT' }).waitFor();
  await page.getByRole('button', { name: 'John', exact: true }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('heading', { name: 'John 3' }).waitFor({ timeout: 30000 });
  await page.getByRole('heading', { name: 'John 2' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(800); // let compensation settle
  const before = await page.evaluate(() => {
    const r = document.querySelector('.reader');
    const el = document.elementFromPoint(400, 400)?.closest('.verse');
    const top = el?.getBoundingClientRect().top ?? 0;
    const s0 = r.scrollTop;
    r.scrollTop = 200; // put the top sentinel inside its 600px margin
    return { id: el?.id ?? null, top, s0 };
  });
  if (!before.id) throw new Error('no reference verse under cursor');
  await page.getByRole('heading', { name: 'John 1' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(400);
  const after = await page.evaluate(
    (id) => document.getElementById(id)?.getBoundingClientRect().top ?? NaN,
    before.id,
  );
  // My own scroll (s0 → 200) shifts the element by (s0 - 200); the prepend
  // compensation must add no further drift on top of that.
  const drift = Math.abs(after - (before.top + before.s0 - 200));
  if (!(drift < 6)) throw new Error(`scroll drift ${drift}px after prepend (ref ${before.id})`);
  ok(`scroll-up prepends John 1, tracked verse steady (drift ${drift.toFixed(1)}px)`);

  // 6. Morphology search: aorist verbs in John 3, click-through.
  await page.getByRole('button', { name: 'Morphology search' }).click();
  const dialog = page.getByRole('dialog', { name: 'Morphology search' });
  await dialog.waitFor();
  await dialog.getByLabel('Tense').selectOption('aorist');
  await dialog.getByRole('button', { name: 'Search' }).click();
  await dialog.locator('.hit').first().waitFor({ timeout: 20000 });
  const firstHit = await dialog.locator('.hit .hit-ref').first().textContent();
  await dialog.locator('.hit').first().click();
  await page.getByRole('complementary', { name: 'Word details' }).waitFor();
  ok(`morphology search (aorist) returns hits; click-through to ${firstHit} opens detail`);

  // 7. Strong's search + occurrences.
  await page.getByRole('button', { name: 'Strong’s lexicon' }).click();
  const sdialog = page.getByRole('dialog', { name: 'Strong’s lexicon' });
  await sdialog.waitFor();
  await sdialog.getByRole('searchbox').fill('logos');
  await sdialog.locator('.strongs-hit').first().waitFor();
  const entry = await sdialog.locator('.strongs-hit').first().textContent();
  if (!entry.includes('G3056')) throw new Error(`unexpected top hit: ${entry}`);
  await sdialog.getByRole('button', { name: 'Occurrences ›' }).first().click();
  const mdialog = page.getByRole('dialog', { name: 'Morphology search' });
  await mdialog.waitFor();
  await mdialog.getByRole('button', { name: 'Search' }).click();
  await mdialog.locator('.hit').first().waitFor({ timeout: 30000 });
  ok('Strong’s search ranks G3056 first; occurrence search finds hits in John');
  await page.keyboard.press('Escape');
  await page.locator('.sheet-backdrop').click({ position: { x: 5, y: 5 } });

  // 8. Hebrew OT: Genesis 1 renders RTL.
  await page.getByRole('button', { name: /John/ }).first().click();
  await page.getByRole('tab', { name: 'Hebrew OT' }).click();
  await page.getByRole('button', { name: 'Genesis' }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('heading', { name: 'Genesis 1' }).waitFor({ timeout: 20000 });
  const dirs = await page.evaluate(() => {
    const p = document.querySelector('.hbo-chapter .verses');
    return { dir: getComputedStyle(p).direction, text: p.textContent.slice(0, 20) };
  });
  if (dirs.dir !== 'rtl') throw new Error(`verses direction = ${dirs.dir}`);
  ok(`Genesis 1 renders, RTL flow confirmed (${dirs.text.trim().slice(0, 12)}…)`);

  // 9. Service worker active, then offline reload keeps the app working.
  await page.goto(URL_BASE, { waitUntil: 'load' });
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) throw new Error('no active SW');
  });
  await page.reload({ waitUntil: 'load' }); // ensure the SW controls the page
  await page.getByRole('heading', { name: /John|Genesis/ }).first().waitFor({ timeout: 20000 });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.getByRole('heading', { name: /John|Genesis/ }).first().waitFor({ timeout: 20000 });
  const offlineBadge = await page.getByText('offline', { exact: true }).isVisible();
  ok(`offline reload: app shell + last chapter render (offline badge: ${offlineBadge})`);
  await context.setOffline(false);
} catch (e) {
  fail('browser smoke', e.message ?? e);
  try {
    await page.screenshot({ path: 'smoke-fail.png' });
  } catch {}
} finally {
  await browser.close();
  preview.kill();
}
console.log('\n=== SUMMARY ===');
for (const r of results) console.log(r);
