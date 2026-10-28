// Draws the Altura Bank mark and writes the favicon and the PWA icons to public/.
// Run with: node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BRAND = [0x0f, 0x3d, 0x5e];
const WHITE = [0xff, 0xff, 0xff];

// The mark on a 32 x 32 grid, the same shape as the favicon path.
const MARK = [
  [8, 23],
  [16, 9],
  [24, 23],
  [19.5, 23],
  [16, 16.8],
  [12.5, 23],
];

const FAVICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" rx="8" fill="#0f3d5e"/>' +
  '<path d="M8 23 16 9l8 14h-4.5L16 16.8 12.5 23z" fill="#fff"/></svg>\n';

const SAMPLES = 4;

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insideRoundedRect(x, y, radius) {
  const cx = Math.min(Math.max(x, radius), 32 - radius);
  const cy = Math.min(Math.max(y, radius), 32 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function draw(size, { rounded }) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = 32 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let background = 0;
      let mark = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) * scale;
          const y = (py + (sy + 0.5) / SAMPLES) * scale;
          if (rounded && !insideRoundedRect(x, y, 8)) continue;
          background++;
          if (insidePolygon(x, y, MARK)) mark++;
        }
      }
      const total = SAMPLES * SAMPLES;
      const offset = (py * size + px) * 4;
      const markShare = background === 0 ? 0 : mark / background;
      for (let c = 0; c < 3; c++) {
        pixels[offset + c] = Math.round(BRAND[c] + (WHITE[c] - BRAND[c]) * markShare);
      }
      pixels[offset + 3] = Math.round((background / total) * 255);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const icons = [
  { file: 'icon-192.png', size: 192, rounded: true },
  { file: 'icon-512.png', size: 512, rounded: true },
  { file: 'icon-maskable-512.png', size: 512, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, rounded: false },
];

const publicDir = new URL('../public/', import.meta.url);

writeFileSync(new URL('favicon.svg', publicDir), FAVICON);
console.log('public/favicon.svg');

for (const { file, size, rounded } of icons) {
  writeFileSync(new URL(file, publicDir), encodePng(size, draw(size, { rounded })));
  console.log(`public/${file} (${size}x${size})`);
}
