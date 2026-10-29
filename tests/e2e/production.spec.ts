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
  await expect(titles).toHaveText(['Colecciones']);
  await expect(page.locator('.panel')).toHaveCount(0);
  await expect(page.locator('.manifesto img')).toHaveCount(0);
  await expect(page.locator('.manifesto figcaption')).toHaveCount(0);
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

test.describe('mundo 3D de la portada (exploración)', () => {
  test('dibuja KYRO en 3D sin perder el texto accesible', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    const hasWebGL = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl')));
    test.skip(!hasWebGL, 'este navegador no tiene WebGL');
    const scene = page.locator('[data-escena]');
    await expect(scene).toHaveAttribute('data-escena3d', 'ready');
    await expect(scene.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('heading', { level: 1, name: 'KYRO' })).toBeVisible();
    // El pie también usa el KYRO en volumen.
    await expect(page.locator('footer [data-wordmark-3d]')).toHaveAttribute('data-3d', 'ready');
    expect(errors).toEqual([]);
  });

  test('sin WebGL se ve el KYRO plano y la portada funciona', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      // Simula un navegador o una tarjeta gráfica sin WebGL.
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: unknown) {
        return type === 'webgl' ? null : original.call(this, type as '2d', options as CanvasRenderingContext2DSettings);
      } as typeof original;
    });
    await page.goto('/');
    const scene = page.locator('[data-escena]');
    await expect(scene).toHaveAttribute('data-escena3d', 'failed');
    await expect(scene.locator('canvas')).toHaveCount(0);
    await expect(scene.locator('.masthead__letter').first()).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Explorar las colecciones' })).toBeVisible();
  });

  test('con colores forzados se usan las letras planas del sistema', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/\bdim\b/);
    const scene = page.locator('[data-escena]');
    await expect(scene.locator('.masthead__letter').first()).toBeVisible();
    await expect(scene.locator('canvas')).toHaveCount(0);
  });

  test('con movimiento reducido la portada mide una pantalla', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const heights = await page.evaluate(() => [document.querySelector('[data-escena]')!.getBoundingClientRect().height, innerHeight]);
    expect(Math.abs((heights[0] ?? 0) - (heights[1] ?? 0))).toBeLessThan(2);
  });

  test.describe('sin JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('se ven las letras planas', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('[data-escena] .masthead__letter').first()).toBeVisible();
    });
  });
});
