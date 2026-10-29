import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, trackErrors } from './helpers';

// Build de producción (dist/): el catálogo real está vacío hasta que KYRO cargue productos.

test('sin productos, la portada y la tienda muestran el estado vacío', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByText('La primera colección está en preparación.')).toBeVisible();
  await expect(page.getByText('Catálogo de prueba')).toHaveCount(0);

  await page.goto('/tienda/');
  await expect(page.getByText('La primera colección está en preparación.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Categorías' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('sin datos, la portada no muestra secciones vacías ni imagen de campaña', async ({ page }) => {
  await page.goto('/');
  const titles = page.getByRole('main').getByRole('heading', { level: 2 });
  await expect(titles).toHaveText(['Colección']);
  await expect(page.locator('.hero img')).toHaveCount(0);
  await expect(page.locator('.hero figcaption')).toHaveCount(0);
});

test('el pie de página no inventa categorías ni contacto', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Toda la tienda' })).toBeVisible();
  await expect(footer.getByRole('link', { name: /Categoría/ })).toHaveCount(0);
  await expect(footer.getByRole('heading', { name: 'Contacto' })).toHaveCount(0);
});

test('sin logotipo oficial se usa el tipográfico provisional', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg.logo')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'KYRO' })).toBeVisible();
  await expect(page.locator('.site-header .wordmark')).toHaveText('KYRO');
});

test('sin textos de KYRO no hay páginas informativas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('contentinfo').getByRole('heading', { name: 'Información' })).toHaveCount(0);
  const testPage = await page.request.get('/info/pagina-de-prueba/');
  expect(testPage.status()).toBe(404);
});

test('no hay sitemap mientras la tienda no se lance', async ({ page }) => {
  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(404);
  const robots = await (await page.request.get('/robots.txt')).text();
  expect(robots).not.toContain('Sitemap:');
});

test('ningún producto de prueba se cuela en producción', async ({ page }) => {
  const catalog = await (await page.request.get('/catalog.json')).json();
  expect(catalog).toEqual({ version: 1, currency: null, variants: {} });
  const fixture = await page.request.get('/producto/prenda-de-prueba-uno/');
  expect(fixture.status()).toBe(404);
});

test('robots.txt bloquea el rastreo mientras la tienda no se lance', async ({ page }) => {
  const robots = await (await page.request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /');
});

test('un carrito guardado con piezas que ya no existen queda vacío', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('kyro.cart.v1', JSON.stringify({ lines: [{ sku: 'TEST-001-S', quantity: 1 }] }));
  });
  await page.goto('/carrito/');
  await expect(page.getByText('Tu carrito está vacío.')).toBeVisible();
});

test('estado vacío accesible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expectNoA11yViolations(page);
});
