#!/usr/bin/env node
/*
 * Mide el rendimiento de páginas ya servidas (npm run preview) con Playwright y el
 * protocolo de DevTools, sin herramientas externas. Sirve para comparar antes y después
 * de un cambio; NO sustituye a una prueba en un dispositivo Android real.
 *
 * Perfiles:
 *   escritorio  1440 × 900, sin limitaciones.
 *   movil       Pixel 7, CPU ralentizada 4× y red ~4G (9 Mb/s, 170 ms de latencia).
 *
 * Uso:
 *   node scripts/medir-rendimiento.mjs [--base http://127.0.0.1:4321] [--sin-webgl] [ruta…]
 *   KYRO_CHROMIUM=/ruta/a/chromium  para usar un Chromium ya instalado.
 *
 * Métricas: FCP, LCP, CLS, TBT (suma de tareas largas por encima de 50 ms), bytes
 * transferidos por tipo y tiempos de fotograma durante los 4 s de la apertura.
 */
import { chromium, devices } from 'playwright-core';

const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://127.0.0.1:4321';
const withoutWebGL = args.includes('--sin-webgl');
const routes = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--base');
if (routes.length === 0) routes.push('/', '/tienda/', '/marca/');

const browser = await chromium.launch(
  process.env.KYRO_CHROMIUM ? { executablePath: process.env.KYRO_CHROMIUM } : {},
);
const rows = [];

for (const profile of ['escritorio', 'movil']) {
  for (const route of routes) {
    const mobile = profile === 'movil';
    const context = await browser.newContext(
      mobile ? { ...devices['Pixel 7'] } : { viewport: { width: 1440, height: 900 } },
    );
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (mobile) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 170,
        downloadThroughput: (9 * 1024 * 1024) / 8,
        uploadThroughput: (1.5 * 1024 * 1024) / 8,
      });
    }
    const sizes = new Map();
    const types = new Map();
    cdp.on('Network.responseReceived', (event) => types.set(event.requestId, event.type));
    cdp.on('Network.loadingFinished', (event) => sizes.set(event.requestId, event.encodedDataLength));

    if (withoutWebGL) {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, options) {
          return type === 'webgl' ? null : original.call(this, type, options);
        };
      });
    }
    await page.addInitScript(() => {
      const metrics = { lcp: 0, cls: 0, long: [] };
      window.__kyroMetrics = metrics;
      const observe = (type, fn) => new PerformanceObserver((list) => list.getEntries().forEach(fn)).observe({ type, buffered: true });
      observe('largest-contentful-paint', (entry) => (metrics.lcp = entry.startTime));
      observe('layout-shift', (entry) => !entry.hadRecentInput && (metrics.cls += entry.value));
      observe('longtask', (entry) => metrics.long.push(entry.duration));
    });

    await page.goto(base + route, { waitUntil: 'load' });
    const frames = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const times = [];
          const start = performance.now();
          const tick = (now) => {
            times.push(now);
            if (now - start < 4000) requestAnimationFrame(tick);
            else resolve(times);
          };
          requestAnimationFrame(tick);
        }),
    );
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => ({
      ...window.__kyroMetrics,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0,
    }));
    const deltas = frames.slice(1).map((time, i) => time - frames[i]).sort((a, b) => a - b);
    const byType = {};
    for (const [id, size] of sizes) byType[types.get(id) ?? 'Other'] = (byType[types.get(id) ?? 'Other'] ?? 0) + size;
    rows.push({
      perfil: profile,
      ruta: route,
      FCP: Math.round(m.fcp),
      LCP: Math.round(m.lcp),
      CLS: m.cls.toFixed(3),
      TBT: Math.round(m.long.reduce((sum, d) => sum + Math.max(0, d - 50), 0)),
      fotograma_mediana: deltas[Math.floor(deltas.length / 2)]?.toFixed(1),
      fotograma_p95: deltas[Math.floor(deltas.length * 0.95)]?.toFixed(1),
      kB: Object.entries(byType)
        .map(([type, size]) => `${type} ${(size / 1024).toFixed(1)}`)
        .join(', '),
    });
    await context.close();
  }
}
await browser.close();

console.log(`\nBase: ${base}${withoutWebGL ? ' (WebGL desactivado)' : ''}\n`);
console.log('| Perfil | Ruta | FCP ms | LCP ms | CLS | TBT ms | Fotograma mediana / p95 ms | Transferido (kB, sin comprimir) |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) {
  console.log(`| ${r.perfil} | ${r.ruta} | ${r.FCP} | ${r.LCP} | ${r.CLS} | ${r.TBT} | ${r.fotograma_mediana} / ${r.fotograma_p95} | ${r.kB} |`);
}
