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

test('sin productos, la portada no muestra secciones vacías', async ({ page }) => {
  await page.goto('/');
  const titles = page.getByRole('main').getByRole('heading', { level: 2 });
  await expect(titles).toHaveText(['Colecciones']);
  await expect(page.locator('.panel')).toHaveCount(0);
});

test('la imagen de campaña se ve entera e indica que está generada con IA', async ({ page }) => {
  await page.goto('/');
  const figure = page.locator('.manifesto__foto');
  const image = figure.locator('img');
  await expect(image).toHaveAttribute('alt', /remera blanca «'92» de Manchester United/);
  // Se usa la versión con las mangas corregidas, no la original.
  await expect(image).toHaveAttribute('src', /portada-corregida/);
  await expect(figure.locator('figcaption')).toHaveText('Imagen generada con IA');
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  // Misma proporción que la foto (4:5): no se recorta.
  const box = await figure.boundingBox();
  expect(Math.abs((box?.width ?? 0) / (box?.height ?? 1) - 1122 / 1402)).toBeLessThan(0.01);
});

test('el pie de página no inventa categorías ni redes; solo el correo oficial', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Toda la tienda' })).toBeVisible();
  await expect(footer.getByRole('link', { name: /Categoría/ })).toHaveCount(0);
  await expect(footer.locator('a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:kyro89py@gmail.com');
  await expect(footer.locator('a[href^="http"]')).toHaveCount(0);
});

test('sin productos, la búsqueda muestra el estado vacío y ningún filtro', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/buscar/');
  await expect(page.getByText('La primera colección está en preparación.')).toBeVisible();
  await expect(page.getByRole('search')).toHaveCount(0);
  await expect(page.getByRole('combobox')).toHaveCount(0);
  // Sin catálogo, el pie no enlaza a una búsqueda vacía.
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Buscar' })).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test.describe('look «92»', () => {
  test('la portada lleva al look y el look reúne la vista con modelo y las fotos reales', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.getByRole('link', { name: "Ver el look «'92»" }).click();
    await expect(page).toHaveURL(/\/looks\/92\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Look «'92»");
    const labels = page.locator('.gallery__label');
    await expect(labels).toHaveText([
      'Look completo',
      'Remera · frente',
      'Remera · espalda',
      'Detalle · escudo',
      'Detalle · trébol',
      'Detalle · etiquetas',
      'Cargo · frente',
      'Cargo · espalda',
      'Detalle · tejido y talla',
    ]);
    // Solo la vista con modelo está generada con IA, y se indica.
    await expect(page.locator('.gallery__slide').first().locator('.gallery__tag')).toHaveText('Imagen generada con IA');
    await expect(page.locator('.gallery__tag')).toHaveCount(1);
    await expect(page.getByRole('group', { name: 'Elegir foto' }).getByRole('button')).toHaveCount(9);
    // Las prendas se nombran; no hay enlaces a fichas que no existen ni precios.
    const garments = page.getByRole('region', { name: 'Prendas del look' });
    await expect(garments.getByRole('listitem')).toHaveCount(2);
    await expect(garments.getByRole('link')).toHaveCount(0);
    await expect(page.getByText(/\d+[.,]\d{2}\s?[A-Z]{3}/)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('las fotos de detalle se abren a pantalla completa y se amplían', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/looks/92/');
    await page.getByRole('link', { name: /Ampliar la foto 4 de 9/ }).click();
    const viewer = page.getByRole('dialog', { name: "Fotografías del look «'92» a pantalla completa" });
    await expect(viewer.locator('[data-viewer-label]')).toHaveText('Detalle · escudo');
    await viewer.getByRole('button', { name: 'Acercar' }).click();
    await expect(viewer.locator('[data-zoom-stage]').nth(3)).toHaveAttribute('data-zoomed', '');
    await expect.poll(() => viewer.locator('[data-zoom-stage]').nth(3).locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  });

  test('el look «THE 212» solo muestra fotografías reales y se llega desde el otro look', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/looks/92/', { waitUntil: 'load' });
    await page.getByRole('navigation', { name: 'Otros looks' }).getByRole('link', { name: 'Look «THE 212»' }).click();
    await expect(page).toHaveURL(/\/looks\/212\/$/);
    await expect(page.locator('.gallery__label')).toHaveText([
      'Remera · frente',
      'Remera · espalda',
      'Detalle · etiquetas',
      'Cargo · frente',
      'Cargo · espalda',
      'Detalle · tejido y talla',
    ]);
    // La imagen con modelo recibida no conserva el pantalón: no hay vista generada.
    await expect(page.locator('.gallery__tag')).toHaveCount(0);
    await expect(page.getByText('Todas son fotografías reales de las prendas')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Otros looks' }).getByRole('link', { name: "Look «'92»" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('el look no se desborda en ningún ancho', async ({ page }) => {
    for (const path of ['/looks/92/', '/looks/212/']) {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `desbordamiento en ${path} a ${width} px`).toBeLessThanOrEqual(0);
      }
    }
  });

  test('los looks son accesibles', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const path of ['/looks/92/', '/looks/212/']) {
      await page.goto(path);
      await expectNoA11yViolations(page);
    }
  });
});

test('sin páginas informativas, la ayuda dice que las condiciones no están publicadas', async ({ page }) => {
  // Sin animaciones: axe mediría el contraste de textos a medio aparecer.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ayuda/');
  await expect(
    page.getByText('Las condiciones de envío, cambios y devoluciones todavía no están publicadas en este sitio.'),
  ).toBeAttached();
  await expect(page.locator('details#condiciones a')).toHaveCount(0);
  await expectNoA11yViolations(page);
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
