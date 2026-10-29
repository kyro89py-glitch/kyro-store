import { expect, test } from '@playwright/test';
import { cartToggle, expectNoA11yViolations, expectNoHorizontalOverflow, trackErrors } from './helpers';

// Catálogo de prueba: tests/fixtures/catalog (moneda XTS, productos no reales).

const PAGES = [
  '/',
  '/tienda/',
  '/tienda/categoria-de-prueba-a/',
  '/producto/prenda-de-prueba-uno/',
  '/carrito/',
  '/marca/',
  '/info/pagina-de-prueba/',
];

test.describe('páginas', () => {
  for (const path of PAGES) {
    test(`${path} carga sin errores, con CSP y sin desbordamiento`, async ({ page }) => {
      const errors = trackErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      await expectNoHorizontalOverflow(page);
      // Un nombre de transición repetido anularía la transición entre páginas.
      const names = await page.locator('[data-vt]').evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-vt')),
      );
      expect(new Set(names).size).toBe(names.length);
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
  test('la escena muestra la marca y lleva a las colecciones', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'KYRO' })).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: 'Explorar las colecciones' }).click();
    await expect(page).toHaveURL(/#colecciones$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Colecciones' })).toBeInViewport();
  });

  test('la imagen de campaña acompaña al manifiesto y declara su procedencia', async ({ page }) => {
    await page.goto('/');
    const manifesto = page.locator('.manifesto');
    await expect(manifesto.getByRole('img', { name: 'Imagen abstracta de prueba en tonos grafito y champán' })).toBeAttached();
    await expect(manifesto.locator('figcaption')).toContainText('Imagen provisional');
    await expect(manifesto.locator('figcaption')).toContainText('uso interno de pruebas');
  });

  test('secciones en orden: colecciones, novedades y destacados', async ({ page }) => {
    await page.goto('/');
    const titles = page.getByRole('main').getByRole('heading', { level: 2 });
    await expect(titles).toHaveText(['Colecciones', 'Novedades', 'Destacados']);
    await expect(page.getByText('La primera colección está en preparación.')).toHaveCount(0);
  });

  test('novedades: solo productos con fecha, el más reciente primero', async ({ page }) => {
    await page.goto('/');
    const names = page.getByRole('list', { name: 'Novedades' }).getByRole('heading', { level: 3 });
    await expect(names).toHaveText(['Prenda de prueba 2', 'Prenda de prueba 1']);
  });

  test('colecciones: un panel por categoría real, más toda la tienda', async ({ page }) => {
    await page.goto('/');
    const panels = page.getByRole('list', { name: 'Colecciones' }).getByRole('link');
    await expect(panels).toHaveCount(3);
    await expect(panels.first()).toContainText('Categoría de prueba A');
    await expect(panels.first()).toContainText('2 piezas');
    await expect(panels.nth(2)).toContainText('Toda la tienda');
    await expect(panels.nth(2)).toContainText('4 piezas');
    await expect(panels.nth(2)).toHaveAttribute('href', /\/tienda\/$/);
    // Con el teclado, el recorrido trae el panel enfocado al frente.
    await panels.nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tienda\/categoria-de-prueba-b\/$/);
  });

  test('colecciones: los paneles avanzan en profundidad con el desplazamiento', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('[data-colecciones]');
    await expect(section).toHaveAttribute('data-modo', '3d');
    await section.scrollIntoViewIfNeeded();
    const pos = () => section.evaluate((element) => Number(getComputedStyle(element).getPropertyValue('--pos') || 0));
    await page.evaluate(() => {
      const track = document.querySelector('.colecciones__pista') as HTMLElement;
      scrollTo(0, track.getBoundingClientRect().top + scrollY + (track.offsetHeight - innerHeight));
    });
    await expect.poll(pos).toBeGreaterThan(1.9);
  });

  test('la foto del panel y la portada de la categoría comparten nombre de transición', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.panel [data-vt]').first()).toHaveAttribute('data-vt', 'c-categoria-de-prueba-a');
    await page.goto('/tienda/categoria-de-prueba-a/');
    await expect(page.locator('.shop__cover')).toHaveAttribute('data-vt', 'c-categoria-de-prueba-a');
  });

  test('destacados: solo los marcados, el primero en grande', async ({ page }) => {
    await page.goto('/');
    const items = page.getByRole('list', { name: 'Destacados' }).getByRole('listitem');
    await expect(items.getByRole('heading', { level: 3 })).toHaveText(['Prenda de prueba 1', 'Prenda de prueba 4']);
    await expect(items.first()).toHaveClass(/featured__item--lead/);
  });

  test('con movimiento reducido todo es visible al instante', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const opacity = await page.locator('.escena__hud').evaluate((element) => getComputedStyle(element).opacity);
    expect(opacity).toBe('1');
    // Las colecciones forman una composición quieta.
    await expect(page.locator('[data-colecciones]')).not.toHaveAttribute('data-modo', '3d');
  });
});

test.describe('catálogo', () => {
  test('muestra solo productos activos, nunca borradores', async ({ page }) => {
    await page.goto('/tienda/');
    const cards = page.getByRole('list', { name: 'Tienda' }).getByRole('listitem');
    await expect(cards).toHaveCount(4);
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

  test('las tarjetas muestran la disponibilidad del catálogo', async ({ page }) => {
    await page.goto('/tienda/');
    const card = (name: string) => page.getByRole('article').filter({ has: page.getByRole('heading', { name }) });
    await expect(card('Prenda de prueba 1')).toContainText('Disponible');
    await expect(card('Prenda de prueba 3')).toContainText('No disponible');
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
    await expect(page.locator('fieldset.variants')).toHaveAttribute('data-invalid', '');
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

test.describe('logotipo', () => {
  test('con un SVG en la carpeta de marca, la cabecera y la portada lo usan', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'KYRO, inicio' }).first().locator('svg.logo')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 }).getByRole('img', { name: 'KYRO' })).toBeVisible();
    await expect(page.locator('.wordmark')).toHaveCount(0);
  });
});

test.describe('páginas informativas', () => {
  test('el pie las enlaza y muestran título, vigencia y contenido', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('heading', { name: 'Información' })).toBeVisible();
    await footer.getByRole('link', { name: 'Página informativa de prueba' }).click();
    await expect(page).toHaveURL(/\/info\/pagina-de-prueba\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página informativa de prueba');
    await expect(page.locator('time')).toHaveText('1 de octubre de 2026');
    await expect(page.locator('time')).toHaveAttribute('datetime', '2026-10-01');
    await expect(page.getByRole('heading', { level: 2, name: 'Un apartado de prueba' })).toBeVisible();
  });
});

test.describe('ficha: más en la categoría', () => {
  test('muestra otras piezas reales de la misma categoría', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-uno/');
    const related = page.getByRole('list', { name: 'Más en Categoría de prueba A' });
    await expect(related.getByRole('heading', { level: 3 })).toHaveText(['Prenda de prueba 3']);
    await page.getByRole('link', { name: 'Ver la categoría' }).click();
    await expect(page).toHaveURL(/\/tienda\/categoria-de-prueba-a\/$/);
  });

  test('sin datos de dominio no se emiten migas de pan estructuradas', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-dos/');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });
});

test.describe('alto contraste (forced colors)', () => {
  test('la talla elegida y las no disponibles se distinguen', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.goto('/producto/prenda-de-prueba-uno/');
    await page.getByRole('radio', { name: 'S', exact: true }).check();
    const look = (sku: string) =>
      page.locator(`input[value="${sku}"] + .variant__label`).evaluate((element) => {
        const style = getComputedStyle(element);
        return `${style.backgroundColor}|${style.color}|${style.borderTopColor}`;
      });
    // expect.poll espera a que terminen las transiciones de color.
    await expect.poll(async () => (await look('TEST-001-S')) !== (await look('TEST-001-L'))).toBe(true);
    await expect.poll(async () => (await look('TEST-001-M')) !== (await look('TEST-001-L'))).toBe(true);
  });

  test('el logotipo de la portada sigue siendo visible', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.goto('/');
    const color = await page.locator('.escena__titulo').evaluate((element) => {
      const target = element.querySelector('.escena__marca, svg') ?? element;
      return getComputedStyle(target).color;
    });
    expect(color).not.toMatch(/rgba\(\d+, \d+, \d+, 0\)/);
  });
});

test.describe('pie de página', () => {
  test('enlaza tienda, categorías, marca y carrito; sin contacto inventado', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    for (const name of ['Toda la tienda', 'Categoría de prueba A', 'Categoría de prueba B', 'La marca', 'Carrito']) {
      await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
    }
    // store.contact y store.social están vacíos: no debe aparecer ningún bloque de contacto.
    await expect(footer.getByRole('heading', { name: 'Contacto' })).toHaveCount(0);
    await expect(footer.locator('a[href^="mailto:"]')).toHaveCount(0);
  });
});

test.describe('menú móvil', () => {
  test('se abre, navega y se cierra con Escape', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'solo en pantallas estrechas');
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

  test('incluye las categorías del catálogo', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'solo en pantallas estrechas');
    await page.goto('/');
    await page.getByRole('button', { name: 'Menú' }).click();
    const menu = page.getByRole('dialog', { name: 'Menú' });
    await menu.getByRole('link', { name: 'Categoría de prueba A' }).click();
    await expect(page).toHaveURL(/\/tienda\/categoria-de-prueba-a\/$/);
  });
});

test.describe('movimiento', () => {
  test('los bloques se revelan al entrar en pantalla y no quedan recortados', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/\bmotion\b/);
    const title = page.getByRole('heading', { level: 2, name: 'Destacados' });
    await expect(title).not.toHaveClass(/is-revealed/);
    await title.scrollIntoViewIfNeeded();
    await expect(title).toHaveClass(/is-revealed/);
    // Al terminar la animación no queda ningún recorte (cortaría el foco o el hover).
    await expect.poll(() => title.evaluate((element) => getComputedStyle(element).clipPath)).toBe('none');
  });

  test('la cabecera de la portada se vuelve sólida cuando el nombre llega a ella', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('kyro-header');
    await expect(header).not.toHaveAttribute('data-scrolled');
    await page.getByRole('heading', { level: 2, name: 'Destacados' }).scrollIntoViewIfNeeded();
    await expect(header).toHaveAttribute('data-scrolled', '');
  });

  test('al añadir, el contador late y la línea nueva se ilumina', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-dos/');
    await page.getByRole('button', { name: 'Añadir al carrito' }).click();
    await expect(page.locator('[data-cart-count]')).toHaveAttribute('data-bump', '');
    await expect(page.getByRole('dialog', { name: 'Carrito' }).locator('.cart-line')).toHaveAttribute(
      'data-changed',
      '',
    );
  });

  test('la foto de la tarjeta y la primera de la ficha comparten nombre de transición', async ({ page }) => {
    await page.goto('/tienda/');
    await expect(page.locator('a[href$="/producto/prenda-de-prueba-uno/"] [data-vt]')).toHaveAttribute(
      'data-vt',
      'p-prenda-de-prueba-uno',
    );
    await page.goto('/producto/prenda-de-prueba-uno/');
    await expect(page.locator('.gallery__slide').first()).toHaveAttribute('data-vt', 'p-prenda-de-prueba-uno');
  });

  test('el filtro marca la categoría actual con su indicador', async ({ page }) => {
    await page.goto('/tienda/categoria-de-prueba-a/');
    const nav = page.getByRole('navigation', { name: 'Categorías' });
    await expect(nav.getByRole('link', { name: 'Categoría de prueba A' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('.category-nav__indicator')).toHaveCount(1);
  });

  test('el menú móvil marca la página actual', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'solo en pantallas estrechas');
    await page.goto('/tienda/');
    await page.getByRole('button', { name: 'Menú' }).click();
    const menu = page.getByRole('dialog', { name: 'Menú' });
    await expect(menu.getByRole('link', { name: 'Tienda' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('no se oculta nada a la espera de animaciones', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/\bmotion\b/);
    const title = page.getByRole('heading', { level: 2, name: 'Destacados' });
    await title.scrollIntoViewIfNeeded();
    expect(await title.evaluate((element) => getComputedStyle(element).clipPath)).toBe('none');
    const card = page.locator('.product-card__media').first();
    expect(await card.evaluate((element) => getComputedStyle(element).clipPath)).toBe('none');
  });
});
