// Genera las imágenes abstractas de los datos de prueba (no representan productos ni
// campañas reales). Solo crea las que falten; con --force las regenera todas.
// Uso: node tests/fixtures/generate-images.mjs [--force]
import { access, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = dirname(fileURLToPath(import.meta.url));
const force = process.argv.includes('--force');

const PRODUCT = { width: 1200, height: 1500 };
const WIDE = { width: 2400, height: 1100 };

// [ruta relativa, tono superior, tono inferior, posición del foco de luz, tamaño]
const images = [
  ['catalog/prenda-de-prueba-uno/imagen-1.jpg', '#2a2d31', '#121416', '38% 30%', PRODUCT],
  ['catalog/prenda-de-prueba-uno/imagen-2.jpg', '#34302a', '#141210', '62% 40%', PRODUCT],
  ['catalog/prenda-de-prueba-uno/imagen-3.jpg', '#23282c', '#0f1113', '50% 62%', PRODUCT],
  ['catalog/prenda-de-prueba-dos/imagen-1.jpg', '#3a3730', '#16140f', '45% 35%', PRODUCT],
  ['catalog/prenda-de-prueba-dos/imagen-2.jpg', '#2c3033', '#101214', '55% 55%', PRODUCT],
  ['catalog/prenda-de-prueba-tres/imagen-1.jpg', '#302c2e', '#121012', '50% 40%', PRODUCT],
  ['catalog/prenda-de-prueba-cuatro/imagen-1.jpg', '#26292b', '#0d0f10', '58% 32%', PRODUCT],
  ['catalog/prenda-de-prueba-cuatro/imagen-2.jpg', '#2f2b26', '#11100e', '42% 58%', PRODUCT],
  ['catalog/borrador-de-prueba/imagen-1.jpg', '#2b2b2b', '#111111', '50% 50%', PRODUCT],
  ['campaign/portada-de-prueba.jpg', '#24272a', '#0a0b0c', '36% 44%', WIDE],
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

for (const [file, top, bottom, focus, { width, height }] of images) {
  const output = join(root, file);
  if (!force && (await exists(output))) continue;
  const [fx, fy] = focus.split(' ');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
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
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect width="${width}" height="${height}" fill="url(#lines)"/>
      <rect width="${width}" height="${height}" fill="url(#light)"/>
    </svg>`;
  await mkdir(dirname(output), { recursive: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 78, mozjpeg: true }).toFile(output);
  console.log(`✓ ${file}`);
}
