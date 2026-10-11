// npm run build; npm i --no-save playwright-core
// CHROMIUM_PATH=/path/to/chromium node docs/verification/text-selection.mjs
// Native iOS/Android selection handles and the OS Copy menu still require
// physical-device verification: desktop Chromium's emulated long-press does
// not select even a plain <p>. The checks below do not claim otherwise.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4319'], { stdio: 'ignore' });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const pass = (name) => console.log(`PASS ${name}`);
try {
  await new Promise((r) => setTimeout(r, 1000));
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(() => localStorage.setItem('gr:tutorialSeen', 'on'));
  const page = await context.newPage();
  await page.route('https://**', (route) => route.abort()); // bundled scripture fixtures
  await page.goto('http://127.0.0.1:4319');
  const words = page.locator('.verse-text').first().locator('.token');
  await words.first().waitFor();
  assert.equal(await words.first().evaluate((e) => getComputedStyle(e).userSelect), 'text');
  await words.nth(1).tap();
  await page.locator('.token.selected').waitFor();
  assert.equal(await page.locator('.token.selected').count(), 1);
  assert.ok(await page.locator('.token[class*="syn-"]').count() > 1);
  await page.getByRole('button', { name: 'Close details' }).click();
  pass('default touch tap opens details and highlights syntax');

  async function doubleTap(locator) {
    await locator.tap();
    await page.waitForTimeout(70);
    await locator.tap();
    await page.waitForTimeout(350);
  }
  await doubleTap(words.nth(1));
  assert.equal(await words.nth(1).locator('.under').count(), 0);
  assert.equal(await page.locator('.token.selected').count(), 0);
  assert.equal(await page.locator('.detail').count(), 0);
  await doubleTap(words.nth(1));
  assert.equal(await words.nth(1).locator('.under').count(), 1);
  assert.equal(await page.locator('.token.selected').count(), 0);
  pass('quick touch double-tap marks and unmarks without opening details');

  const cdp = await context.newCDPSession(page);
  async function hold(locator) {
    const b = await locator.boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
    await page.waitForTimeout(750);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100);
  }
  await hold(words.nth(1).locator('.grc'));
  assert.equal(await page.locator('.token.selected').count(), 0);
  assert.equal(await words.nth(1).locator('.under').count(), 1);
  assert.equal(await page.locator('.gloss-bubble').count(), 0);
  pass('default touch hold does not open details, mark known, or reveal a gloss');

  // Real pointer drag, not Selection.addRange: prove selectable text flows
  // across formerly separate buttons and the resulting copy is clean.
  const first = await words.first().locator('.grc').boundingBox();
  const last = await words.nth(4).locator('.grc').boundingBox();
  await page.mouse.move(first.x, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width, last.y + last.height / 2, { steps: 15 });
  await page.mouse.up();
  assert.ok((await page.evaluate(() => getSelection().toString())).includes('λόγος'));
  assert.equal(await page.locator('.token.selected').count(), 0);
  await page.keyboard.press('Control+c');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'Ἐν ἀρχῇ ἦν ὁ λόγος');
  pass('drag selects across words; real clipboard contains Greek without glosses');
  await page.evaluate(() => getSelection().removeAllRanges());

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const holdSetting = page.getByRole('group', { name: 'Press and hold', exact: true });
  assert.equal(await holdSetting.getByRole('button', { name: 'Select text' }).getAttribute('aria-pressed'), 'true');
  await holdSetting.getByRole('button', { name: 'Mark / gloss' }).click();
  await page.locator('.sheet-backdrop').click({ position: { x: 2, y: 2 } });
  await page.reload();
  await words.first().waitFor();
  assert.equal(await words.first().evaluate((e) => getComputedStyle(e).userSelect), 'none');
  await hold(words.nth(1));
  assert.equal(await words.nth(1).locator('.under').count(), 0);
  assert.equal(await page.locator('.token.selected').count(), 0);
  await hold(words.nth(1));
  assert.equal(await words.nth(1).locator('.under').count(), 1);
  pass('legacy preference persists after reload; touch hold marks and unmarks');

  await page.getByRole('tab', { name: 'Original', exact: true }).click();
  const b = await words.nth(1).boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.gloss-bubble').count(), 1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.locator('.gloss-bubble').count(), 0);
  pass('legacy Original-view hold reveals and dismisses gloss');
  await doubleTap(words.nth(1));
  assert.ok((await words.nth(1).getAttribute('class')).includes('known'));
  assert.equal(await page.locator('.token.selected').count(), 0);
  await doubleTap(words.nth(1));
  assert.ok(!(await words.nth(1).getAttribute('class')).includes('known'));
  pass('Original view double-tap toggles known while legacy hold reveals gloss');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await holdSetting.getByRole('button', { name: 'Select text' }).click();
  await page.locator('.sheet-backdrop').click({ position: { x: 2, y: 2 } });
  await page.reload();
  await words.first().waitFor();
  assert.equal(await words.first().evaluate((e) => getComputedStyle(e).userSelect), 'text');
  await words.nth(1).tap();
  await page.locator('.token.selected').waitFor();
  assert.equal(await page.locator('.token.selected').count(), 1);
  pass('restoring selection survives reload and keeps tap syntax');
  await page.screenshot({ path: '/tmp/gnt-selection-verified.png' });
} finally {
  await browser.close();
  server.kill();
}
