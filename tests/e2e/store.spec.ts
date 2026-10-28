import { expect, test } from '@playwright/test';
import { cartToggle, expectNoA11yViolations, expectNoHorizontalOverflow, trackErrors } from './helpers';

// Catálogo de prueba: tests/fixtures/catalog (moneda XTS, productos no reales).

const PAGES = ['/', '/tienda/', '/tienda/categoria-de-prueba-a/', '/producto/prenda-de-prueba-uno/', '/carrito/', '/marca/'];

test.describe('páginas', () => {
  for (const path of PAGES) {
    test(`${path} carga sin errores, con CSP y sin desbordamiento`, async ({ page }) => {
      const errors = trackErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });

    test(`${path} cumple WCAG 2.2 AA (axe)`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      await expectNoA11yViolations(page);
    });
  }

  test('la página 404 orienta de vuelta a la tienda', async ({ page }) => {
    const response = await page.goto('/no-existe/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta página no existe.');
    await expect(page.getByRole('main').getByRole('link', { name: 'Ver la tienda' })).toBeVisible();
  });

  test('robots: el sitio no se indexa todavía', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });
});

test.describe('portada', () => {
  test('la cartela muestra la marca y lleva a la tienda', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'KYRO' })).toBeVisible();
    await page.getByRole('link', { name: 'Ver la tienda' }).first().click();
    await expect(page).toHaveURL(/\/tienda\/$/);
  });

  test('con movimiento reducido todo es visible al instante', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const opacity = await page.locator('.hero__caption').evaluate((element) => getComputedStyle(element).opacity);
    expect(opacity).toBe('1');
  });
});

test.describe('catálogo', () => {
  test('muestra solo productos activos, nunca borradores', async ({ page }) => {
    await page.goto('/tienda/');
    const cards = page.getByRole('list', { name: 'Tienda' }).getByRole('listitem');
    await expect(cards).toHaveCount(3);
    await expect(page.getByText('Borrador de prueba')).toHaveCount(0);
    const draft = await page.request.get('/producto/borrador-de-prueba/');
    expect(draft.status()).toBe(404);
  });

  test('filtra por categoría', async ({ page }) => {
    await page.goto('/tienda/');
    await page.getByRole('navigation', { name: 'Categorías' }).getByRole('link', { name: 'Categoría de prueba A' }).click();
    await expect(page).toHaveURL(/\/tienda\/categoria-de-prueba-a\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Categoría de prueba A');
    await expect(page.getByRole('list', { name: 'Categoría de prueba A' }).getByRole('listitem')).toHaveCount(2);
  });

  test('marca los productos sin opciones disponibles', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-tres/');
    await expect(page.getByRole('button', { name: 'No disponible' })).toBeDisabled();
  });

  test('la ficha incluye datos estructurados coherentes con el catálogo', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-uno/');
    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(jsonLd).toMatchObject({
      '@type': 'Product',
      name: 'Prenda de prueba 1',
      offers: { price: '125.00', priceCurrency: 'XTS' },
    });
  });
});

test.describe('carrito', () => {
  test('pide elegir talla y no permite opciones no disponibles', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-uno/');
    await expect(page.getByRole('radio', { name: /M/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Añadir al carrito' }).click();
    await expect(page.getByText('Selecciona una opción de talla para continuar.')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('añadir, cambiar cantidad, persistir y quitar', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/producto/prenda-de-prueba-uno/');
    await page.getByRole('radio', { name: 'S', exact: true }).check();
    await page.getByRole('button', { name: 'Añadir al carrito' }).click();

    const drawer = page.getByRole('dialog', { name: 'Carrito' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Prenda de prueba 1' })).toBeVisible();
    await expect(drawer.getByText('Talla: S')).toBeVisible();
    await expect(drawer.getByText('Tu carrito está vacío.')).toBeHidden();
    await expect(drawer.locator('[data-cart-subtotal]')).toHaveText(/125,00\sXTS/);

    await drawer.getByRole('button', { name: /Sumar una unidad/ }).click();
    await expect(drawer.locator('[data-line-quantity]')).toHaveText('2');
    await expect(drawer.locator('[data-cart-subtotal]')).toHaveText(/250,00\sXTS/);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(cartToggle(page)).toHaveAccessibleName('Carrito, 2 artículos');

    // Persiste tras recargar y en la página completa del carrito.
    await page.goto('/carrito/');
    const line = page.locator('.cart-line');
    await expect(line).toHaveCount(1);
    await expect(page.locator('[data-line-quantity]')).toHaveText('2');
    await expect(page.getByText('Tu carrito está vacío.')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Pagar' })).toBeDisabled();
    await expect(page.getByText('El pago en línea todavía no está activo.', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: /Quitar Prenda de prueba 1/ }).click();
    await expect(page.getByText('Tu carrito está vacío.')).toBeVisible();
    await expect(page.locator('.cart-line')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pagar' })).toBeHidden();
    await expect(cartToggle(page)).toHaveAccessibleName('Carrito, vacío');
    expect(errors).toEqual([]);
  });

  test('el panel lateral queda dentro de la pantalla', async ({ page }) => {
    // Sin transición, para medir la posición final del panel.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/producto/prenda-de-prueba-dos/');
    await page.getByRole('button', { name: 'Añadir al carrito' }).click();
    const box = await page.getByRole('dialog', { name: 'Carrito' }).boundingBox();
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  });

  test('una opción única queda preseleccionada', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-dos/');
    await page.getByRole('button', { name: 'Añadir al carrito' }).click();
    const drawer = page.getByRole('dialog', { name: 'Carrito' });
    await expect(drawer.getByText('Talla: Única')).toBeVisible();
  });

  test('ignora datos manipulados en el almacenamiento local', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'kyro.cart.v1',
        JSON.stringify({
          lines: [
            { sku: '<img src=x onerror="window.__xss=1">', quantity: 1 },
            { sku: 'TEST-002-U', quantity: 9999 },
            { sku: 'NO-EXISTE-1', quantity: 1 },
          ],
        }),
      );
    });
    await page.goto('/carrito/');
    await expect(page.locator('.cart-line')).toHaveCount(1);
    await expect(page.locator('[data-line-quantity]')).toHaveText('10');
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    // La variante inexistente se elimina del almacenamiento.
    const stored = await page.evaluate(() => window.localStorage.getItem('kyro.cart.v1'));
    expect(stored).not.toContain('NO-EXISTE-1');
  });

  test('el panel del carrito pasa la auditoría de accesibilidad', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/producto/prenda-de-prueba-dos/');
    await page.getByRole('button', { name: 'Añadir al carrito' }).click();
    await expect(page.getByRole('dialog', { name: 'Carrito' })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

test.describe('menú móvil', () => {
  test('se abre, navega y se cierra con Escape', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo en móvil');
    await page.goto('/');
    await page.getByRole('button', { name: 'Menú' }).click();
    const menu = page.getByRole('dialog', { name: 'Menú' });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await page.getByRole('button', { name: 'Menú' }).click();
    await menu.getByRole('link', { name: 'Tienda' }).click();
    await expect(page).toHaveURL(/\/tienda\/$/);
  });
});
