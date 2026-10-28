import { defineConfig, devices } from '@playwright/test';

// Las pruebas e2e usan dos builds ya generados (npm run build && npm run build:fixtures):
// - Catálogo de prueba (.fixtures-dist) para probar tienda, producto y carrito.
// - Producción (dist), con el catálogo real vacío.
// `--ignore-lock` mantiene `astro preview` en primer plano para que Playwright lo controle.
const fixturesURL = 'http://127.0.0.1:4322';
const productionURL = 'http://127.0.0.1:4321';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    locale: 'es-ES',
  },
  projects: [
    {
      name: 'escritorio',
      testIgnore: /production\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: fixturesURL },
    },
    {
      name: 'movil',
      testIgnore: /production\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: fixturesURL },
    },
    {
      name: 'produccion',
      testMatch: /production\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: productionURL },
    },
  ],
  webServer: [
    {
      command: 'node scripts/with-fixtures.mjs preview --port 4322 --host 127.0.0.1 --ignore-lock',
      url: fixturesURL,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'npx astro preview --port 4321 --host 127.0.0.1 --ignore-lock',
      url: productionURL,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
