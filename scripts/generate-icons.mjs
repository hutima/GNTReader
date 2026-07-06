// Generate the PWA icons (192, 512, 512-maskable) by rasterising the app mark
// in public/favicon.svg with headless Chromium. favicon.svg is the single
// source of truth for the logo (all vector paths — no fonts — so it rasterises
// identically); this script only composes it onto an opaque tile at each size.
// iOS home-screen icons must be opaque, hence the white tile. Deterministic
// output — rerun `npm run icons` after editing favicon.svg, and commit the PNGs.
//
// Requires a Chromium/Chrome binary. Resolution order: $CHROME_PATH, the
// Playwright-managed Chromium under $PLAYWRIGHT_BROWSERS_PATH, then common
// names on PATH. CI does not run this (icons are committed); it is a local /
// design-time tool.
import { writeFileSync, mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');
const SVG = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf8');
const TILE = '#ffffff'; // opaque tile behind the (transparent) mark
// Embed the app's scripture face so the Α/Ω in the mark rasterise identically
// everywhere (no reliance on a system serif being installed).
const GENTIUM = join(ROOT, 'src', 'fonts', 'gentium-book-plus-greek-400-normal.woff2');
const FONT_FACE = `@font-face{font-family:'Gentium Book Plus';font-style:normal;font-weight:400;src:url('file://${GENTIUM}') format('woff2');}`;

function resolveChrome() {
  const candidates = [];
  if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH);
  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(pwRoot)) {
    for (const d of readdirSync(pwRoot)) {
      if (d.startsWith('chromium-')) candidates.push(join(pwRoot, d, 'chrome-linux', 'chrome'));
    }
  }
  candidates.push(
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  );
  for (const c of candidates) if (c && existsSync(c)) return c;
  throw new Error(
    'No Chromium/Chrome found. Set CHROME_PATH to a Chrome binary to run `npm run icons`.',
  );
}

const CHROME = resolveChrome();
const work = mkdtempSync(join(tmpdir(), 'gnt-icons-'));

/** Rasterise the mark at `size` px, the SVG drawn at `art` px centred on the tile. */
function render(size, art, outfile) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONT_FACE}
    html,body{margin:0;padding:0}
    #t{width:${size}px;height:${size}px;background:${TILE};
       display:flex;align-items:center;justify-content:center;overflow:hidden}
    svg{display:block;width:${art}px;height:${art}px}
  </style></head><body><div id="t">${SVG}</div></body></html>`;
  const htmlPath = join(work, `icon-${size}-${art}.html`);
  writeFileSync(htmlPath, html);
  execFileSync(
    CHROME,
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=ffffffff',
      // advance virtual time so the embedded web font finishes loading before capture
      '--virtual-time-budget=3000',
      `--screenshot=${join(OUT, outfile)}`,
      `--window-size=${size},${size}`,
      `file://${htmlPath}`,
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] },
  );
}

// "any" icons: the mark fills the tile (it already carries its own margin).
render(192, 192, 'icon-192.png');
render(512, 512, 'icon-512.png');
// maskable: keep the mark inside the ~80% safe zone so platform masks don't clip it.
render(512, 400, 'icon-512-maskable.png');

rmSync(work, { recursive: true, force: true });
console.log('icons written to', OUT, 'using', CHROME);
