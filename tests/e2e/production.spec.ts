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
