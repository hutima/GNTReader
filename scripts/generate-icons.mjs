// Generate the PWA icons (192, 512, 512-maskable) without any image
// dependency: a hand-rolled PNG encoder drawing a rounded-rect "α" glyph
// approximation as flat pixels. Deterministic output — rerun `npm run icons`
// only when changing the design, and commit the PNGs.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const BG = [0x1f, 0x29, 0x33, 255]; // slate
const FG = [0xf5, 0xf7, 0xfa, 255]; // near-white

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
}

function png(width, height, pixels /* RGBA rows */) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Draw the icon at `size`; maskable keeps art inside the 40%-radius safe zone. */
function drawIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };
  const radius = maskable ? 0 : size * 0.18;
  const inside = (x, y) => {
    if (!radius) return true;
    const rx = Math.max(radius - x, x - (size - 1 - radius), 0);
    const ry = Math.max(radius - y, y - (size - 1 - radius), 0);
    return rx * rx + ry * ry <= radius * radius;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) put(x, y, inside(x, y) ? BG : [0, 0, 0, 0]);

  // A stylized alpha: a circle plus a tail stroke, drawn as filled discs.
  const scale = maskable ? 0.62 : 0.8; // maskable safe zone
  const cx = size * 0.46;
  const cy = size * 0.54;
  const R = size * 0.21 * scale;
  const thick = size * 0.07 * scale;
  const disc = (x0, y0, r, color) => {
    for (let y = Math.floor(y0 - r); y <= y0 + r; y++)
      for (let x = Math.floor(x0 - r); x <= x0 + r; x++) {
        const d = (x - x0) ** 2 + (y - y0) ** 2;
        if (d <= r * r) put(x, y, color);
      }
  };
  // ring
  for (let a = 0; a < 360; a += 0.5) {
    const rad = (a * Math.PI) / 180;
    disc(cx + R * Math.cos(rad), cy + R * Math.sin(rad), thick / 2, FG);
  }
  // tail: from ring's right edge sweeping down-right
  const tx0 = cx + R;
  const ty0 = cy - R * 0.5;
  const tx1 = cx + R * 1.7;
  const ty1 = cy + R;
  for (let t = 0; t <= 1; t += 0.01) {
    const x = tx0 + (tx1 - tx0) * t;
    const y = ty0 + (ty1 - ty0) * (t * t * 0.4 + t * 0.6);
    disc(x, y, thick / 2, FG);
  }
  return png(size, size, px);
}

writeFileSync(join(OUT, 'icon-192.png'), drawIcon(192));
writeFileSync(join(OUT, 'icon-512.png'), drawIcon(512));
writeFileSync(join(OUT, 'icon-512-maskable.png'), drawIcon(512, { maskable: true }));
console.log('icons written to', OUT);
