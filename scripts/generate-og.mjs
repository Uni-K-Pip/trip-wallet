// public/icon.svg のモチーフを流用して OGP 用の og.png を作る。生成物は commit する。
// アイコンとは用途も寸法も別なので generate-icons.mjs とは分けてある。
// この画像はアプリの動作には使わないので、Service Worker の precache からは外してある
// (vite.config.ts の globIgnores)。
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { extractGroup } from './svg.mjs';

const WIDTH = 1200;
const HEIGHT = 630;
const TEXT_X = 440;

// 総称名(sans-serif)だけを渡すと librsvg が等幅フォントに解決することがある。
// 日本語が出る実在のフォント名を必ず先頭に置く。
const FONT = 'Yu Gothic, Meiryo, Segoe UI, sans-serif';

const base = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const defs = base.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
const motif = extractGroup(base, 'motif');
if (!defs || !motif) {
  throw new Error('public/icon.svg の構造が変わっています(<defs> と <g id="motif"> が必要)');
}

// motif は 512 四方の座標系で、中身は x:104..408 / y:120..384 に描かれている。
// 0.88 倍すると中心が (225.3, 221.8) に来るので、そこから (235, 315) へ寄せる。
const MOTIF_SCALE = 0.88;
const MOTIF_X = 235 - 256 * MOTIF_SCALE;
const MOTIF_Y = 315 - 252 * MOTIF_SCALE;

const lines = [
  { y: 235, size: 78, weight: '700', fill: '#ffffff', text: 'Trip Wallet' },
  { y: 303, size: 32, weight: '400', fill: '#e0e7ff', text: '海外旅行の支出を、その日の為替レートで記録' },
  { y: 350, size: 29, weight: '400', fill: '#a5b4fc', text: 'Travel expenses, converted at the rate of the day' },
  { y: 440, size: 25, weight: '400', fill: '#9aa0d8', text: '端末内に保存 · オフライン対応 · 無料' },
  { y: 478, size: 23, weight: '400', fill: '#9aa0d8', text: 'On-device · Offline · Free' },
  { y: 545, size: 24, weight: '400', fill: '#7c83c4', text: 'uni-k-pip.github.io/trip-wallet' },
];

const text = lines
  .map(
    (l) =>
      `<text x="${TEXT_X}" y="${l.y}" font-family="${FONT}" font-size="${l.size}" font-weight="${l.weight}" fill="${l.fill}">${l.text}</text>`,
  )
  .join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
${defs}
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
<g transform="translate(${MOTIF_X.toFixed(1)} ${MOTIF_Y.toFixed(1)}) scale(${MOTIF_SCALE})">${motif}</g>
${text}
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(new URL('../public/og.png', import.meta.url), png);
console.log(`og.png (${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(1)} KB)`);
