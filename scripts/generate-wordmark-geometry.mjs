#!/usr/bin/env node
/*
 * Genera la geometría del wordmark dimensional (EXPLORACIÓN, no es un logotipo oficial)
 * a partir de la tipografía del logotipo provisional: Archivo variable, peso 640,
 * anchura 125 % (los mismos valores que `.masthead` en src/styles/base.css).
 *
 * Salida: src/scripts/wordmark-geometry.json, con, por letra:
 *   - contours: contornos exteriores y huecos aplanados (curvas → segmentos);
 *   - insets:   los mismos contornos desplazados hacia dentro el ancho del bisel;
 *   - triangles: triangulación de la cara frontal (índices sobre los insets).
 * La extrusión, los biseles y las normales se construyen en el navegador
 * (src/scripts/wordmark-3d.ts). Unidades: altura de mayúscula = 1, y hacia arriba.
 *
 * Uso: node scripts/generate-wordmark-geometry.mjs
 * Usa `fontkitten`, que ya instala Astro para su API de fuentes (no es una dependencia
 * nueva). Solo hay que volver a ejecutarlo si cambia la tipografía del logotipo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { create } = await import(require.resolve('fontkitten'));

const WORD = 'KYRO';
const SETTINGS = { wght: 640, wdth: 125 };
/** Espacio extra entre letras, en unidades de la fuente (1000 por eme). */
const TRACKING = 70;
/** Ancho del bisel, en unidades de la fuente. */
const BEVEL = 22;
/** Longitud máxima de cada segmento al aplanar curvas, en unidades de la fuente. */
const MAX_SEGMENT = 14;

// ---------- Fuente ----------

const buffer = readFileSync(resolve(root, 'src/assets/fonts/archivo-latin-variable.woff2'));
const font = create(buffer);
const ids = font.glyphsForString(WORD).map((glyph) => glyph.id);
const coords = font.fvar.axis.map((axis) => SETTINGS[axis.axisTag.trim()] ?? axis.defaultValue);

// fontkitten no aplica las variaciones a los contornos de un WOFF2: se instancia la
// fuente con las coordenadas y se aplican los deltas (gvar) a los puntos a mano.
const Stream = font.stream.constructor;
const instance = new font.constructor(new Stream(new Uint8Array(buffer)), coords);
const capHeight = font.capHeight;

function glyphAt(id) {
  instance.getGlyph(id);
  const base = instance._transformedGlyphs[id];
  if (!base.varied) {
    const Point = base.points[0].constructor;
    const points = base.points.map((p) => new Point(p.onCurve, p.endContour, p.x, p.y));
    // Cuatro puntos "fantasma" al final, como exige la tabla gvar.
    for (let i = 0; i < 4; i++) points.push(new Point(true, true, 0, 0));
    instance._variationProcessor.transformPoints(id, points);
    base.points = points.slice(0, -4);
    base.varied = true;
    instance._glyphs[id] = undefined;
  }
  return instance.getGlyph(id);
}

// ---------- Contornos ----------

function flatten(commands) {
  const contours = [];
  let current = [];
  let pen = [0, 0];
  const push = (x, y) => current.push([x, y]);
  for (const { command, args } of commands) {
    if (command === 'moveTo') {
      if (current.length) contours.push(current);
      current = [];
      pen = [args[0], args[1]];
      push(...pen);
    } else if (command === 'lineTo') {
      pen = [args[0], args[1]];
      push(...pen);
    } else if (command === 'quadraticCurveTo') {
      const [cx, cy, x, y] = args;
      const length = Math.hypot(cx - pen[0], cy - pen[1]) + Math.hypot(x - cx, y - cy);
      const steps = Math.max(2, Math.ceil(length / MAX_SEGMENT));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const a = (1 - t) ** 2;
        const b = 2 * (1 - t) * t;
        const c = t ** 2;
        push(a * pen[0] + b * cx + c * x, a * pen[1] + b * cy + c * y);
      }
      pen = [x, y];
    } else if (command === 'closePath') {
      if (current.length) contours.push(current);
      current = [];
    } else {
      throw new Error(`Comando de trazado no previsto: ${command}`);
    }
  }
  if (current.length) contours.push(current);
  return contours.map(clean);
}

/** Quita puntos repetidos (incluido el de cierre) y puntos alineados. */
function clean(points) {
  const out = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 1e-6) out.push(point);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) < 1e-6) out.pop();
  return out.filter((p, i) => {
    const a = out[(i - 1 + out.length) % out.length];
    const b = out[(i + 1) % out.length];
    const cross = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    return Math.abs(cross) > 1e-3;
  });
}

const signedArea = (poly) =>
  poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;

/**
 * Desplaza un contorno hacia el interior del relleno. En TrueType el relleno queda
 * siempre a la derecha del sentido de avance (exteriores en sentido horario, huecos
 * al revés), así que "hacia dentro" es la normal derecha de cada lado.
 */
function inset(poly, distance) {
  const n = poly.length;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + n) % n];
    const b = poly[(i + 1) % n];
    const n0 = rightNormal(a, p);
    const n1 = rightNormal(p, b);
    let mx = n0[0] + n1[0];
    let my = n0[1] + n1[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    const scale = distance / Math.max(mx * n0[0] + my * n0[1], 0.35);
    return [p[0] + mx * scale, p[1] + my * scale];
  });
}

function rightNormal(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l];
}

// ---------- Triangulación (recorte de orejas con puentes a los huecos) ----------

function triangulate(outer, holes) {
  // Exterior en sentido antihorario y huecos en horario, con índices originales.
  const verts = [];
  const ring = (poly, ccw) => {
    const start = verts.length;
    poly.forEach((p) => verts.push(p));
    const idx = poly.map((_, i) => start + i);
    return signedArea(poly) > 0 === ccw ? idx : idx.reverse();
  };
  let polygon = ring(outer, true);
  const holeRings = holes.map((hole) => ring(hole, false));
  holeRings.sort((a, b) => Math.max(...b.map((i) => verts[i][0])) - Math.max(...a.map((i) => verts[i][0])));

  for (const hole of holeRings) {
    // Vértice del hueco más a la derecha y vértice visible más cercano del polígono.
    const mPos = hole.reduce((best, i, k) => (verts[i][0] > verts[hole[best]][0] ? k : best), 0);
    const m = verts[hole[mPos]];
    const edges = [...ringEdges(polygon), ...holeRings.flatMap(ringEdges)];
    let best = -1;
    let bestDist = Infinity;
    polygon.forEach((vi, k) => {
      const p = verts[vi];
      const d = Math.hypot(p[0] - m[0], p[1] - m[1]);
      if (d >= bestDist) return;
      const blocked = edges.some(([a, b]) => {
        if (a === vi || b === vi || a === hole[mPos] || b === hole[mPos]) return false;
        return segmentsCross(m, p, verts[a], verts[b]);
      });
      if (!blocked) {
        best = k;
        bestDist = d;
      }
    });
    if (best < 0) throw new Error('No se encontró un puente hacia el hueco');
    const holeLoop = [...hole.slice(mPos), ...hole.slice(0, mPos), hole[mPos]];
    polygon = [...polygon.slice(0, best + 1), ...holeLoop, ...polygon.slice(best)];
  }

  const triangles = [];
  const remaining = [...polygon];
  let guard = 0;
  while (remaining.length > 3 && guard++ < 20000) {
    let clipped = false;
    for (let k = 0; k < remaining.length; k++) {
      const ia = remaining[(k - 1 + remaining.length) % remaining.length];
      const ib = remaining[k];
      const ic = remaining[(k + 1) % remaining.length];
      const [a, b, c] = [verts[ia], verts[ib], verts[ic]];
      if (cross(a, b, c) <= 1e-9) continue;
      const inside = remaining.some((iv) => {
        if (iv === ia || iv === ib || iv === ic) return false;
        const p = verts[iv];
        if (same(p, a) || same(p, b) || same(p, c)) return false;
        return pointInTriangle(p, a, b, c);
      });
      if (inside) continue;
      triangles.push(ia, ib, ic);
      remaining.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) throw new Error('La triangulación se ha atascado');
  }
  if (remaining.length === 3) triangles.push(...remaining);
  return { verts, triangles };
}

const ringEdges = (ring) => ring.map((v, i) => [v, ring[(i + 1) % ring.length]]);
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9;

function pointInTriangle(p, a, b, c) {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  return d1 >= -1e-12 && d2 >= -1e-12 && d3 >= -1e-12;
}

function segmentsCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// ---------- Composición de la palabra ----------

// Tres decimales de altura de mayúscula: menos de un cuarto de píxel a tamaño de portada.
const round = (value) => Math.round(value * 1000) / 1000;
const letters = [];
let penX = 0;
let firstMinX = null;

for (const [index, id] of ids.entries()) {
  const glyph = glyphAt(id);
  const contours = flatten(glyph.path.commands);
  if (firstMinX === null) firstMinX = glyph.path.bbox.minX;
  const offset = penX - firstMinX;
  const outerIndex = contours.findIndex((c) => signedArea(c) < 0);
  const insets = contours.map((c) => inset(c, BEVEL));
  const { verts, triangles } = triangulate(
    insets[outerIndex],
    insets.filter((_, i) => i !== outerIndex),
  );
  const toWorld = ([x, y]) => [round((x + offset) / capHeight), round(y / capHeight)];
  letters.push({
    char: WORD[index],
    contours: contours.map((c) => c.map(toWorld).flat()),
    insets: insets.map((c) => c.map(toWorld).flat()),
    face: verts.map(toWorld).flat(),
    triangles,
    minX: round((glyph.path.bbox.minX + offset) / capHeight),
    maxX: round((glyph.path.bbox.maxX + offset) / capHeight),
  });
  penX += glyph.advanceWidth + TRACKING;
}

const output = {
  source: 'Archivo variable (SIL OFL 1.1), wght 640, wdth 125',
  note: 'Exploración del wordmark dimensional de KYRO. No es un logotipo oficial.',
  bevel: round(BEVEL / capHeight),
  width: letters.at(-1).maxX,
  letters,
};
const target = resolve(root, 'src/scripts/wordmark-geometry.json');
writeFileSync(target, `${JSON.stringify(output)}\n`);
const vertexCount = letters.reduce((n, l) => n + l.contours.reduce((m, c) => m + c.length / 2, 0), 0);
console.log(`wordmark-geometry.json: ${letters.length} letras, ${vertexCount} vértices de contorno, ancho ${output.width}`);
