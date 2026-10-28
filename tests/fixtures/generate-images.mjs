// Genera las imágenes abstractas del catálogo de prueba (no representan productos).
// Uso: node tests/fixtures/generate-images.mjs
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), 'catalog');

// [carpeta, archivo, tono superior, tono inferior, posición del foco de luz]
const images = [
  ['prenda-de-prueba-uno', 'imagen-1.jpg', '#2a2d31', '#121416', '38% 30%'],
  ['prenda-de-prueba-uno', 'imagen-2.jpg', '#34302a', '#141210', '62% 40%'],
  ['prenda-de-prueba-uno', 'imagen-3.jpg', '#23282c', '#0f1113', '50% 62%'],
  ['prenda-de-prueba-dos', 'imagen-1.jpg', '#3a3730', '#16140f', '45% 35%'],
  ['prenda-de-prueba-dos', 'imagen-2.jpg', '#2c3033', '#101214', '55% 55%'],
  ['prenda-de-prueba-tres', 'imagen-1.jpg', '#302c2e', '#121012', '50% 40%'],
  ['borrador-de-prueba', 'imagen-1.jpg', '#2b2b2b', '#111111', '50% 50%'],
];

for (const [folder, file, top, bottom, focus] of images) {
  const [fx, fy] = focus.split(' ');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${top}"/>
          <stop offset="1" stop-color="${bottom}"/>
        </linearGradient>
        <radialGradient id="light" cx="${fx}" cy="${fy}" r="45%">
          <stop offset="0" stop-color="#c8b38a" stop-opacity="0.28"/>
          <stop offset="1" stop-color="#c8b38a" stop-opacity="0"/>
        </radialGradient>
        <pattern id="lines" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="1" height="24" fill="#f1ece3" fill-opacity="0.035"/>
        </pattern>
      </defs>
      <rect width="1200" height="1500" fill="url(#bg)"/>
      <rect width="1200" height="1500" fill="url(#lines)"/>
      <rect width="1200" height="1500" fill="url(#light)"/>
    </svg>`;
  const output = join(root, folder, file);
  await mkdir(dirname(output), { recursive: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 78, mozjpeg: true }).toFile(output);
  console.log(`✓ ${folder}/${file}`);
}
