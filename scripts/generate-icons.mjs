// public/icon.svg から PWA 用の PNG を作る。生成物は commit する。
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  await writeFile(new URL(`../public/${name}`, import.meta.url), png);
  console.log(`${name} (${size}px)`);
}
