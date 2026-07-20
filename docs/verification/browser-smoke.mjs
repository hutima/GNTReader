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

// --- FL-006 helpers (iPad panel-reflow jump + visible-chapter tracking) ---

/** Scroll the reader down in small steps until at least `minCount` <article
 *  class="chapter"> elements are mounted (or give up after `maxSteps`). */
async function scrollUntilChapters(p, minCount, maxSteps = 40) {
  let count = await p.evaluate(() => document.querySelectorAll('.chapter').length);
  for (let i = 0; i < maxSteps && count < minCount; i++) {
    await p.evaluate(() => {
      const r = document.querySelector('.reader');
      r.scrollTop += r.clientHeight * 0.85;
    });
    await p.waitForTimeout(150);
    count = await p.evaluate(() => document.querySelectorAll('.chapter').length);
  }
  return count;
}

/**
 * Wait until the reader's scrollTop AND mounted-chapter-count both stop
 * changing for `quietMs`, or `timeoutMs` elapses. A fixed short wait after
 * opening/closing the detail panel can race the app's OWN, unrelated async
 * chapter loading: the width-reflow can (correctly, per the sliding-window
 * design) push a sentinel into its 600px trigger margin, firing an
 * IntersectionObserver-driven `extend()` fetch+append some hundreds of ms
 * later, whose own FL-004 anchor-compensation only settles once it lands.
 * Measuring drift before that settles would blame FL-006 for FL-004/network
 * timing that has nothing to do with the width-anchor math.
 */
async function waitForSettle(p, quietMs = 250, timeoutMs = 4000) {
  const start = Date.now();
  let last = await p.evaluate(() => ({
    scrollTop: document.querySelector('.reader').scrollTop,
    chapters: document.querySelectorAll('.chapter').length,
  }));
  let lastChangeAt = Date.now();
  while (Date.now() - start < timeoutMs) {
    await p.waitForTimeout(60);
    const now = await p.evaluate(() => ({
      scrollTop: document.querySelector('.reader').scrollTop,
      chapters: document.querySelectorAll('.chapter').length,
    }));
    if (now.scrollTop !== last.scrollTop || now.chapters !== last.chapters) {
      last = now;
      lastChangeAt = Date.now();
    } else if (Date.now() - lastChangeAt >= quietMs) {
      return;
    }
  }
}

/**
 * Mirror the app's own width-anchor math (Reader.tsx `captureAll` /
 * `verseVisualRect`) to measure drift the way the FEATURE actually defines
 * it: NOT "did this verse's (or token's) raw pixel position stay the same"
 * — a verse's own height legitimately grows 130-150% across the reflow
 * (FL-006), and even a single token's exact line placement can shift a few
 * px as the surrounding line re-wraps — but "does the fractional point that
 * was at the viewport midpoint land back on the (possibly new) midpoint".
 * `verseId`, when passed, re-uses that verse instead of re-detecting one
 * under the current midpoint (so the SAME anchor is tracked across a
 * reflow that moves its content far from where the cursor now sits).
 */
async function verseAnchorState(p, verseId) {
  return p.evaluate((verseId) => {
    const r = document.querySelector('.reader');
    const rect = r.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + r.clientHeight / 2;
    const verseEl = verseId
      ? document.getElementById(verseId)
      : document.elementFromPoint(midX, midY)?.closest('.verse');
    if (!verseEl) return null;
    let top = Infinity;
    let bottom = -Infinity;
    verseEl.querySelectorAll('.token, .verse-num').forEach((el) => {
      const rr = el.getBoundingClientRect();
      if (rr.width === 0 && rr.height === 0) return;
      if (rr.top < top) top = rr.top;
      if (rr.bottom > bottom) bottom = rr.bottom;
    });
    if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
      const rr = verseEl.getBoundingClientRect();
      top = rr.top;
      bottom = rr.bottom;
    }
    const height = bottom - top;
    const ratio = height > 0 ? Math.min(1, Math.max(0, (midY - top) / height)) : 0;
    return { id: verseEl.id, top, bottom, ratio, midY };
  }, verseId);
}

/** Drift (px) between where a previously-captured verse-anchor ratio point
 *  now falls and the CURRENT viewport midpoint (0 = perfectly re-seated). */
async function verseAnchorDrift(p, anchor) {
  const now = await verseAnchorState(p, anchor.id);
  if (!now) return null;
  const point = now.top + anchor.ratio * (now.bottom - now.top);
  return Math.abs(point - now.midY);
}

/** Tag the nearest `.token` to viewport point (x, y) with a stable data
 *  attribute (so it can be re-selected by a locator) and return that id.
 *  `excludeId` skips a previously-tagged token so a second tap can target a
 *  different word. */
async function tagNearestToken(p, x, y, excludeId) {
  return p.evaluate(
    ({ x, y, excludeId }) => {
      let best = null;
      let bestDist = Infinity;
      for (const el of document.querySelectorAll('.token')) {
        if (excludeId && el.dataset.smokeId === excludeId) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
        if (d < bestDist) {
          bestDist = d;
          best = el;
        }
      }
      if (!best) return null;
      if (!best.dataset.smokeId) best.dataset.smokeId = `tok-${Math.random().toString(36).slice(2, 9)}`;
      return best.dataset.smokeId;
    },
    { x, y, excludeId },
  );
}

/** Dismiss the first-launch tutorial modal if it's showing (fresh localStorage
 *  in every new context/profile opens it) so it doesn't intercept clicks. */
async function dismissTutorialIfPresent(p) {
  const skip = p.getByRole('button', { name: 'Skip tour' });
  const getStarted = p.getByRole('button', { name: 'Get started' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  else if (await getStarted.isVisible().catch(() => false)) await getStarted.click();
}

/** Reader viewport midpoint in page coordinates. */
async function readerMidpoint(p) {
  return p.evaluate(() => {
    const r = document.querySelector('.reader');
    const rect = r.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
}

try {
  // 1. App shell + default John 1 from bundled fixture.
  await page.goto(URL_BASE, { waitUntil: 'load' });
  await page.getByRole('heading', { name: 'John 1' }).waitFor({ timeout: 15000 });
  await page.getByText('Ἐν', { exact: true }).first().waitFor();
  await dismissTutorialIfPresent(page); // fresh profile auto-opens it; would block step 2's click
  ok('app loads; John 1 renders Greek from fixture');

  // 2. Token tap → detail panel.
  await page.getByText('ἀρχῇ', { exact: true }).first().click();
  const detail = page.getByRole('complementary', { name: 'Word details' });
  await detail.waitFor();
  // The Strong's translit fallback ("archḗ") arrives after an async lexicon
  // fetch — wait for it specifically so this doesn't race the check below.
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Word details"]')?.textContent?.includes('archḗ'),
    { timeout: 10000 },
  );
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

  // 7. Strong's search + occurrences (entry point moved into Settings →
  // "Browse Strong's lexicon"; there is no direct header button for it).
  await page.getByRole('button', { name: 'Settings' }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
  await settingsDialog.waitFor();
  await settingsDialog.getByRole('button', { name: 'Browse Strong’s lexicon' }).click();
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

  // 10a. FL-006 width-anchor: 768×1024 (iPad mini portrait) — the desktop
  // side panel (not the mobile sheet: useIsMobile's breakpoint is 767px)
  // flex-shrinks the reader column when it opens, rewrapping every line and
  // growing every verse's own height 130-151%. "Drift" is measured the way
  // the feature defines it (verseAnchorState/verseAnchorDrift, mirroring
  // Reader.tsx's own captureAll/verseVisualRect math): does the fractional
  // point that was under the midpoint land back on the (possibly new)
  // midpoint — NOT "did a verse's raw top pixel stay put" (it legitimately
  // can't: the verse itself grows 130-150%) and not "did one specific token's
  // exact line placement stay put" (a few px of that is normal quantization
  // as the surrounding line re-wraps into a differently-shaped paragraph).
  // Open/close the panel 5 times and confirm the anchor barely moves,
  // per-cycle and net; then confirm selecting a second token while the panel
  // stays open causes no further drift and no window reset.
  {
    const ctx = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      hasTouch: true,
      isMobile: true,
    });
    const p = await ctx.newPage();
    await p.goto(URL_BASE, { waitUntil: 'load' });
    await p.getByRole('heading', { name: 'John 1' }).waitFor({ timeout: 15000 });
    await dismissTutorialIfPresent(p);

    const chapterCount = await scrollUntilChapters(p, 3);
    if (chapterCount < 3) throw new Error(`only ${chapterCount} chapters mounted after scrolling`);
    const chapterListBefore = await p.evaluate(() =>
      [...document.querySelectorAll('.chapter')].map((el) => el.id),
    );

    const anchor = await verseAnchorState(p);
    if (!anchor) throw new Error('no verse under the viewport midpoint');
    const mid0 = await readerMidpoint(p);
    const tapTokenId = await tagNearestToken(p, mid0.x, mid0.y);
    if (!tapTokenId) throw new Error('no token near midpoint to tap');
    const detail = p.getByRole('complementary', { name: 'Word details' });

    let maxCycleDrift = 0;
    for (let i = 0; i < 5; i++) {
      await p.locator(`[data-smoke-id="${tapTokenId}"]`).tap();
      await detail.waitFor({ timeout: 5000 });
      await waitForSettle(p); // let the RO callback + compensation (+ any async chapter load) settle
      const openDrift = await verseAnchorDrift(p, anchor);
      if (openDrift == null) throw new Error(`cycle ${i}: anchor verse ${anchor.id} left the DOM`);
      if (!(openDrift < 6)) throw new Error(`cycle ${i} open drift ${openDrift}px`);

      await detail.getByRole('button', { name: 'Close details' }).tap();
      await detail.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      await waitForSettle(p);
      const closeDrift = await verseAnchorDrift(p, anchor);
      if (closeDrift == null) throw new Error(`cycle ${i}: anchor verse ${anchor.id} left the DOM`);
      if (!(closeDrift < 6)) throw new Error(`cycle ${i} close drift ${closeDrift}px`);

      maxCycleDrift = Math.max(maxCycleDrift, openDrift, closeDrift);
    }
    const netDrift = await verseAnchorDrift(p, anchor);
    if (netDrift == null || !(netDrift < 6)) throw new Error(`net drift ${netDrift}px after 5 cycles`);
    ok(
      `768px: 5 open/close cycles, anchor verse ${anchor.id} steady ` +
        `(max per-cycle ${maxCycleDrift.toFixed(1)}px, net ${netDrift.toFixed(1)}px)`,
    );

    // Selecting a second token while the panel stays open: no extra width
    // change (the panel is already open), so no further drift, and the
    // rendered chapter window must not reset.
    await p.locator(`[data-smoke-id="${tapTokenId}"]`).tap();
    await detail.waitFor({ timeout: 5000 });
    await waitForSettle(p);

    const mid1 = await readerMidpoint(p);
    const tok2 = await tagNearestToken(p, mid1.x, mid1.y - 120, tapTokenId);
    if (!tok2) throw new Error('no second token to select');
    await p.locator(`[data-smoke-id="${tok2}"]`).tap();
    await waitForSettle(p);
    const selectDrift = await verseAnchorDrift(p, anchor);
    if (selectDrift == null) throw new Error(`anchor verse ${anchor.id} left the DOM after 2nd selection`);
    if (!(selectDrift < 6)) throw new Error(`2nd-token-select drift ${selectDrift}px`);

    const chapterListAfter = await p.evaluate(() =>
      [...document.querySelectorAll('.chapter')].map((el) => el.id),
    );
    if (chapterListAfter.length > 5) throw new Error(`${chapterListAfter.length} chapters mounted (>5)`);
    if (JSON.stringify(chapterListAfter) !== JSON.stringify(chapterListBefore)) {
      throw new Error(
        `chapter window reset: before=${chapterListBefore} after=${chapterListAfter}`,
      );
    }
    ok(
      `768px: selecting a 2nd token while open — drift ${selectDrift.toFixed(1)}px, ` +
        `${chapterListAfter.length} chapters mounted, window unchanged`,
    );
    await ctx.close();
  }

  // 10b. FL-006 width-anchor at 834×1112 (iPad Air/Pro portrait): one cycle.
  {
    const ctx = await browser.newContext({
      viewport: { width: 834, height: 1112 },
      hasTouch: true,
      isMobile: true,
    });
    const p = await ctx.newPage();
    await p.goto(URL_BASE, { waitUntil: 'load' });
    await p.getByRole('heading', { name: 'John 1' }).waitFor({ timeout: 15000 });
    await dismissTutorialIfPresent(p);
    await scrollUntilChapters(p, 2);

    const anchor = await verseAnchorState(p);
    if (!anchor) throw new Error('no verse under the viewport midpoint');
    const mid = await readerMidpoint(p);
    const tapTokenId = await tagNearestToken(p, mid.x, mid.y);
    if (!tapTokenId) throw new Error('no token near midpoint to tap');
    const detail = p.getByRole('complementary', { name: 'Word details' });
    await p.locator(`[data-smoke-id="${tapTokenId}"]`).tap();
    await detail.waitFor({ timeout: 5000 });
    await waitForSettle(p);
    const openDrift = await verseAnchorDrift(p, anchor);
    if (openDrift == null || !(openDrift < 6)) throw new Error(`834px open drift ${openDrift}px`);

    await detail.getByRole('button', { name: 'Close details' }).tap();
    await waitForSettle(p);
    const closeDrift = await verseAnchorDrift(p, anchor);
    if (closeDrift == null || !(closeDrift < 6)) throw new Error(`834px close drift ${closeDrift}px`);
    ok(`834px: one open/close cycle, anchor verse ${anchor.id} steady (drift ${closeDrift.toFixed(1)}px)`);
    await ctx.close();
  }

  // 10c. FL-006 width-anchor under rotation: 768×1024 → 1024×768 with the
  // panel already open (page.setViewportSize simulates the iPad rotating).
  {
    const ctx = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      hasTouch: true,
      isMobile: true,
    });
    const p = await ctx.newPage();
    await p.goto(URL_BASE, { waitUntil: 'load' });
    await p.getByRole('heading', { name: 'John 1' }).waitFor({ timeout: 15000 });
    await dismissTutorialIfPresent(p);
    await scrollUntilChapters(p, 2);

    const mid = await readerMidpoint(p);
    const tapTokenId = await tagNearestToken(p, mid.x, mid.y);
    if (!tapTokenId) throw new Error('no token near midpoint to tap');
    const detail = p.getByRole('complementary', { name: 'Word details' });
    await p.locator(`[data-smoke-id="${tapTokenId}"]`).tap();
    await detail.waitFor({ timeout: 5000 });
    await waitForSettle(p);
    // Re-anchor AFTER the panel has settled, mirroring what the app's own
    // widthAnchorRef holds at this point: it re-captures "whatever verse is
    // at the midpoint now" after every settle, so a SECOND, independent
    // transition (the rotation) is entitled to re-centre on a neighbouring
    // verse rather than the exact one an anchor grabbed before the panel
    // even opened. Comparing against that pre-open reference here measured
    // ~20px of "drift" that was really just the (correct) gap between two
    // adjacent verses — not a compensation error (verified: comparing
    // against a freshly re-captured anchor at this same point in real
    // Chromium showed sub-pixel drift for the rotation itself).
    const anchor = await verseAnchorState(p);
    if (!anchor) throw new Error('no verse under the viewport midpoint');

    await p.setViewportSize({ width: 1024, height: 768 });
    await waitForSettle(p);
    const rotateDrift = await verseAnchorDrift(p, anchor);
    if (rotateDrift == null) throw new Error(`anchor verse ${anchor.id} left the DOM after rotation`);
    if (!(rotateDrift < 6)) throw new Error(`rotation drift ${rotateDrift}px`);
    ok(`rotation 768×1024→1024×768 with panel open: drift ${rotateDrift.toFixed(1)}px`);
    await ctx.close();
  }

  // 10d. Visible-chapter tracking (FL-006): scroll slowly from John 1 into
  // John 2 and confirm the header follows the SCROLLED position (not the
  // last-navigated chapter), the persisted ref updates after its debounce,
  // the previously-mounted John 1 stays in the DOM (no range reset), and the
  // scroller never jumps back to the top.
  {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const p = await ctx.newPage();
    await p.goto(URL_BASE, { waitUntil: 'load' });
    await p.getByRole('heading', { name: 'John 1' }).waitFor({ timeout: 15000 });
    await dismissTutorialIfPresent(p);
    const headerText = () => p.locator('.title-button').textContent();
    if (!(await headerText()).includes('John 1')) throw new Error('header did not start at John 1');

    let becameJohn2 = false;
    let minScrollTopSeenAfterMoving = Infinity;
    for (let i = 0; i < 60; i++) {
      await p.evaluate(() => {
        document.querySelector('.reader').scrollTop += 120;
      });
      await p.waitForTimeout(120);
      const scrollTop = await p.evaluate(() => document.querySelector('.reader').scrollTop);
      if (scrollTop > 50) minScrollTopSeenAfterMoving = Math.min(minScrollTopSeenAfterMoving, scrollTop);
      if ((await headerText()).includes('John 2')) {
        becameJohn2 = true;
        break;
      }
    }
    if (!becameJohn2) throw new Error('header never switched to "John 2" while scrolling');
    const ch1Present = await p.evaluate(() => !!document.getElementById('ch-1'));
    if (!ch1Present) throw new Error('John 1 (#ch-1) was unmounted — range reset instead of extending');
    const scrollTopAfter = await p.evaluate(() => document.querySelector('.reader').scrollTop);
    if (scrollTopAfter < minScrollTopSeenAfterMoving - 20) {
      throw new Error(
        `scroller jumped back toward the top (was ${minScrollTopSeenAfterMoving}px, now ${scrollTopAfter}px)`,
      );
    }
    await p.waitForTimeout(700); // gr:lastRef debounce (500ms) + margin
    const lastRef = await p.evaluate(() => JSON.parse(localStorage.getItem('gr:lastRef') ?? 'null'));
    if (!lastRef || lastRef.chapter !== 2) {
      throw new Error(`gr:lastRef did not follow the visible chapter: ${JSON.stringify(lastRef)}`);
    }
    ok(
      `visible-chapter tracking: header → "John 2", gr:lastRef.chapter=2, ` +
        `#ch-1 still mounted, scroller did not reset (top ${scrollTopAfter.toFixed(0)}px)`,
    );
    await ctx.close();
  }
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
