// public/icon.svg から PWA 用の PNG を作る。生成物は commit する。
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { extractGroup } from './svg.mjs';

const base = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');

// maskable は Android がアイコンを円や角丸にくり抜くので、モチーフをセーフゾーン
// (中央 80%)の内側に収める必要がある。SVG を 2 枚手で管理すると片方の更新を
// 忘れるため、ここでラッパーを組み立てて base の defs とモチーフを流用する。
const defs = base.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
const motif = extractGroup(base, 'motif');
if (!defs || !motif) {
  throw new Error('public/icon.svg の構造が変わっています(<defs> と <g id="motif"> が必要)');
}

// translate(64 64) scale(0.75) で 0..512 が 64..448 に移る = 中央 75%。
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
${defs}
<rect width="512" height="512" fill="url(#bg)"/>
<rect width="512" height="512" fill="url(#glow)"/>
<g transform="translate(64 64) scale(0.75)">${motif}</g>
</svg>`;

const targets = [
  ['icon-192.png', 192, base],
  ['icon-512.png', 512, base],
  ['apple-touch-icon.png', 180, base],
  ['icon-maskable-512.png', 512, maskable],
];

for (const [name, size, source] of targets) {
  // compressionLevel の既定は 6。可逆なので 9 にしても見た目は変わらず、サイズだけ縮む。
  const png = await sharp(Buffer.from(source))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(new URL(`../public/${name}`, import.meta.url), png);
  console.log(`${name} (${size}px)`);
}
