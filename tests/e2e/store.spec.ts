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
  '/ayuda/',
  '/buscar/',
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
    // Con varias tallas, la línea ofrece cambiarla; la elegida es la S.
    await expect(drawer.getByRole('combobox', { name: 'Talla de Prenda de prueba 1' })).toHaveValue('TEST-001-S');
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

test.describe('carrito: cantidad y cambio de talla', () => {
  test('la ficha añade varias unidades de una vez y respeta el límite por talla', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('kyro.cart.v1', JSON.stringify({ lines: [{ sku: 'TEST-001-L', quantity: 8 }] }));
    });
    await page.goto('/producto/prenda-de-prueba-uno/');
    const quantity = page.getByRole('group', { name: 'Cantidad' });
    await expect(quantity.getByRole('button', { name: 'Restar una unidad' })).toBeDisabled();
    await quantity.getByRole('button', { name: 'Sumar una unidad' }).click();
    await quantity.getByRole('button', { name: 'Sumar una unidad' }).click();
    await expect(quantity.locator('output')).toHaveText('3');

    // Con 8 de la L ya en el carrito, solo caben 2 más: la cantidad se ajusta sola.
    await page.getByRole('radio', { name: 'L', exact: true }).check();
    await expect(quantity.locator('output')).toHaveText('2');
    await expect(quantity.getByRole('button', { name: 'Sumar una unidad' })).toBeDisabled();
    await expect(page.getByText('Ya tienes 8 en el carrito. Puedes añadir 2 más.')).toBeVisible();

    await page.getByRole('button', { name: 'Añadir al carrito' }).click();
    await expect(page.getByText('Añadidas 2 unidades al carrito.')).toBeAttached();
    await expect(cartToggle(page)).toHaveAccessibleName('Carrito, 10 artículos');
    await page.keyboard.press('Escape');
    await expect(page.getByText('Ya tienes el máximo de 10 unidades de esta talla en el carrito.').first()).toBeVisible();
  });

  test('cambia de talla en el carrito sin perder la línea, y junta tallas repetidas', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('sembrado')) return;
      sessionStorage.setItem('sembrado', '1');
      window.localStorage.setItem(
        'kyro.cart.v1',
        JSON.stringify({
          lines: [
            { sku: 'TEST-001-S', quantity: 2 },
            { sku: 'TEST-002-U', quantity: 1 },
          ],
        }),
      );
    });
    await page.goto('/carrito/');
    const select = page.getByRole('combobox', { name: 'Talla de Prenda de prueba 1' });
    // Las tallas agotadas aparecen, pero no se pueden elegir.
    await expect(select.locator('option[value="TEST-001-M"]')).toHaveJSProperty('disabled', true);
    // Una pieza con una sola talla no ofrece desplegable.
    await expect(page.getByRole('combobox', { name: /Prenda de prueba 2/ })).toHaveCount(0);

    await select.selectOption('TEST-001-L');
    await expect(page.getByRole('combobox', { name: 'Talla de Prenda de prueba 1' })).toHaveValue('TEST-001-L');
    await expect(page.getByRole('combobox', { name: 'Talla de Prenda de prueba 1' })).toBeFocused();
    await expect(page.locator('[data-cart-announcer]')).toHaveText('Cambiado a talla L.');
    // La línea sigue primera y con la misma cantidad.
    await expect(page.locator('.cart-line').first()).toHaveAttribute('data-sku', 'TEST-001-L');
    await expect(page.locator('.cart-line').first().locator('[data-line-quantity]')).toHaveText('2');
    const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('kyro.cart.v1') ?? '{}'));
    expect(stored.lines).toEqual([
      { sku: 'TEST-001-L', quantity: 2 },
      { sku: 'TEST-002-U', quantity: 1 },
    ]);
  });
});

test.describe('búsqueda', () => {
  const results = (page: import('@playwright/test').Page) =>
    page.getByRole('list', { name: 'Resultados' }).getByRole('listitem');

  test('busca sin distinguir tildes ni mayúsculas y guarda la búsqueda en la URL', async ({ page }) => {
    await page.goto('/buscar/');
    await expect(results(page)).toHaveCount(4);
    await page.getByRole('searchbox', { name: 'Buscar en la tienda' }).fill('PRENDA DE PRUEBA 3');
    await expect(results(page)).toHaveCount(1);
    await expect(results(page).first()).toContainText('Prenda de prueba 3');
    await expect(page).toHaveURL(/\/buscar\/\?q=PRENDA\+DE\+PRUEBA\+3$/);

    // La URL se puede compartir: al abrirla, la búsqueda se repite.
    await page.goto('/buscar/?q=categoria%20de%20prueba%20b');
    await expect(page.getByRole('searchbox', { name: 'Buscar en la tienda' })).toHaveValue('categoria de prueba b');
    await expect(results(page)).toHaveCount(2);
  });

  test('filtra por categoría, talla y disponibilidad y ordena por precio', async ({ page }) => {
    await page.goto('/buscar/');
    await page.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: 'Categoría de prueba A' });
    await expect(results(page)).toHaveCount(2);
    await page.getByRole('checkbox', { name: 'Solo disponibles' }).check();
    await expect(results(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await expect(results(page)).toHaveCount(4);

    await page.getByRole('combobox', { name: 'Talla' }).selectOption('L');
    await expect(results(page).getByRole('heading')).toHaveText(['Prenda de prueba 1', 'Prenda de prueba 4']);
    await page.getByRole('combobox', { name: 'Talla' }).selectOption('');

    await page.getByRole('combobox', { name: 'Ordenar' }).selectOption('precio-asc');
    await expect(results(page).getByRole('heading')).toHaveText([
      'Prenda de prueba 3',
      'Prenda de prueba 2',
      'Prenda de prueba 1',
      'Prenda de prueba 4',
    ]);
    await expect(page).toHaveURL(/orden=precio-asc/);
  });

  test('sin resultados lo dice y ofrece salidas reales', async ({ page }) => {
    await page.goto('/buscar/?q=zzzz');
    await expect(results(page)).toHaveCount(0);
    await expect(page.getByText('Ninguna pieza coincide.', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver toda la tienda' })).toHaveAttribute('href', '/tienda/');
    await page.getByRole('main').getByRole('button', { name: 'Quitar filtros' }).last().click();
    await expect(results(page)).toHaveCount(4);
  });

  test('ignora parámetros que no existen en el catálogo', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/buscar/?categoria=inventada&talla=XXL&orden=nada&q=%3Cimg%20src%3Dx%3E');
    await expect(page.getByRole('combobox', { name: 'Categoría' })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Ordenar' })).toHaveValue('relevancia');
    await expect(results(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('la tienda lleva a la búsqueda con su categoría', async ({ page }) => {
    await page.goto('/tienda/categoria-de-prueba-b/');
    await page.getByRole('link', { name: 'Buscar y filtrar' }).click();
    await expect(page.getByRole('combobox', { name: 'Categoría' })).toHaveValue('categoria-de-prueba-b');
    await expect(results(page)).toHaveCount(2);
  });
});

test.describe('ficha: galería', () => {
  const isMobile = (page: import('@playwright/test').Page) => (page.viewportSize()?.width ?? 0) < 960;

  test('los puntos del carrusel eligen la foto (móvil)', async ({ page }) => {
    test.skip(!isMobile(page), 'en escritorio las fotos se ven apiladas');
    await page.goto('/producto/prenda-de-prueba-uno/');
    const dots = page.getByRole('group', { name: 'Elegir foto' }).getByRole('button');
    await expect(dots).toHaveCount(3);
    await expect(dots.first()).toHaveAttribute('aria-current', 'true');
    await page.getByRole('button', { name: 'Foto 3 de 3' }).click();
    await expect(page.locator('[data-gallery-current]')).toHaveText('03');
    await expect(page.getByRole('button', { name: 'Foto 3 de 3' })).toHaveAttribute('aria-current', 'true');
    await expect(dots.first()).not.toHaveAttribute('aria-current');
  });

  test('el visor amplía la foto pulsada y se recorre con botones y teclado', async ({ page }) => {
    const errors = trackErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/producto/prenda-de-prueba-uno/');
    await page.getByRole('link', { name: 'Ampliar la foto 1 de 3' }).click();
    const viewer = page.getByRole('dialog', { name: 'Fotografías del producto a pantalla completa' });
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('[data-viewer-current]')).toHaveText('01');
    await expect(viewer.getByRole('button', { name: 'Foto anterior' })).toBeDisabled();
    await viewer.getByRole('button', { name: 'Foto siguiente' }).click();
    await expect(viewer.locator('[data-viewer-current]')).toHaveText('02');
    await page.keyboard.press('ArrowRight');
    await expect(viewer.locator('[data-viewer-current]')).toHaveText('03');
    await expect(viewer.getByRole('button', { name: 'Foto siguiente' })).toBeDisabled();
    // La foto generada con IA lo indica también a pantalla completa.
    await expect(viewer.getByText('Imagen generada con IA')).toBeVisible();
    // La foto se ve entera: no sobresale de su marco ni de la pantalla.
    const fits = await viewer.locator('.viewer__slide').nth(2).evaluate((slide) => {
      const frame = slide.querySelector('figure')?.getBoundingClientRect();
      const img = slide.querySelector('img')?.getBoundingClientRect();
      return Boolean(frame && img && img.height <= frame.height + 1 && img.bottom <= innerHeight + 1);
    });
    expect(fits).toBe(true);
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(page.getByRole('link', { name: 'Ampliar la foto 1 de 3' })).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('señala solo las imágenes generadas con IA y no recorta las editoriales', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-uno/');
    const slides = page.locator('.gallery__slide');
    await expect(slides.nth(2).locator('.gallery__tag')).toHaveText('Imagen generada con IA');
    await expect(slides.nth(0).locator('.gallery__tag')).toHaveCount(0);
    expect(await slides.nth(2).locator('img').evaluate((img) => getComputedStyle(img).objectFit)).toBe('contain');
    await page.goto('/producto/prenda-de-prueba-dos/');
    await expect(page.getByText('Imagen generada con IA')).toHaveCount(0);
  });
});

test.describe('ficha: elegir y añadir', () => {
  test('la talla elegida se lee junto a la etiqueta y se explican las tachadas', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-uno/');
    await expect(page.getByText('Las tallas tachadas están agotadas.')).toBeVisible();
    await expect(page.locator('.variants__chosen')).toHaveText('');
    await page.getByRole('radio', { name: 'L', exact: true }).check();
    await expect(page.locator('.variants__chosen')).toHaveText('L');
    // Una pieza sin tallas agotadas no muestra la explicación.
    await page.goto('/producto/prenda-de-prueba-dos/');
    await expect(page.getByText('Las tallas tachadas están agotadas.')).toHaveCount(0);
    await expect(page.locator('.variants__chosen')).toHaveText('Única');
  });

  test('el botón confirma «Añadido» y vuelve a su estado', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-dos/');
    const submit = page.locator('[data-submit]');
    await submit.click();
    await expect(submit).toHaveAttribute('data-done', '');
    await expect(page.getByRole('status').filter({ hasText: 'Añadido al carrito.' })).toBeAttached();
    await expect(submit).not.toHaveAttribute('data-done', { timeout: 4000 });
  });

  test('en móvil, la barra fija añade al carrito con el mismo formulario', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 960, 'la barra solo existe en pantallas estrechas');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/producto/prenda-de-prueba-uno/');
    const bar = page.getByRole('region', { name: 'Compra rápida: Prenda de prueba 1' });
    // Al entrar, el botón principal está por debajo de la galería: la barra está a mano.
    await expect(bar).toBeVisible();
    await expect(bar).not.toHaveAttribute('data-away');
    await expect(bar.getByText('Elige talla')).toBeVisible();

    // Sin talla, lleva hasta las tallas y pide elegir una.
    await bar.getByRole('button', { name: 'Añadir' }).click();
    await expect(page.getByText('Selecciona una opción de talla para continuar.')).toBeInViewport();

    await page.getByRole('radio', { name: 'S', exact: true }).check();
    await expect(bar.getByText('Talla S')).toBeAttached();
    // Con el botón principal en pantalla, la barra se aparta y no recibe el foco.
    await page.locator('[data-submit]').scrollIntoViewIfNeeded();
    await expect(bar).toHaveAttribute('data-away', '');
    await page.mouse.wheel(0, -2000);
    await expect(bar).not.toHaveAttribute('data-away');
    await bar.getByRole('button', { name: 'Añadir' }).click();
    await expect(cartToggle(page)).toHaveAccessibleName('Carrito, 1 artículo');
  });

  test('en escritorio no hay barra fija', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 960, 'solo en escritorio');
    await page.goto('/producto/prenda-de-prueba-uno/');
    await expect(page.locator('[data-buy-bar]')).toBeHidden();
  });
});

test.describe('ficha: precio anterior e información de compra', () => {
  test('muestra el precio anterior tachado solo cuando existe', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-cuatro/');
    const price = page.locator('.product__price');
    await expect(price.locator('s')).toContainText('260,00');
    await expect(price).toContainText('Precio anterior:');
    await expect(price).toContainText('210,00');
    await page.goto('/producto/prenda-de-prueba-uno/');
    await expect(page.locator('.product__price s')).toHaveCount(0);
  });

  test('enlaza la guía de tallas y la información marcada por KYRO', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-uno/');
    const links = page.locator('.product__links');
    await expect(links.getByRole('link', { name: 'Guía de tallas' })).toHaveAttribute('href', '/info/pagina-de-prueba/');
    await expect(links.getByRole('link', { name: 'Página informativa de prueba' })).toBeVisible();
    // Sin guía de tallas en su ficha, el producto 2 solo enlaza la información general.
    await page.goto('/producto/prenda-de-prueba-dos/');
    await expect(page.locator('.product__links').getByRole('link', { name: 'Guía de tallas' })).toHaveCount(0);
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
  test('enlaza tienda, categorías, ayuda, marca y el correo oficial; sin redes inventadas', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    for (const name of [
      'Toda la tienda',
      'Categoría de prueba A',
      'Categoría de prueba B',
      'Buscar',
      'Carrito',
      'Ayuda y contacto',
      'Preguntas frecuentes',
      'La marca',
    ]) {
      await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
    }
    // El único contacto es el correo que facilitó KYRO (store.contact.email).
    await expect(footer.locator('a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:kyro89py@gmail.com');
    // store.social está vacío: ningún enlace sale del sitio salvo el correo.
    const external = await footer
      .locator('a[href]')
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute('href') ?? '').filter((href) => /^(https?:)?\/\//.test(href)),
      );
    expect(external).toEqual([]);
  });

  test('ningún enlace del pie apunta a una página que no existe', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page
      .getByRole('contentinfo')
      .locator('a[href^="/"]')
      .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href') ?? ''))]);
    for (const href of hrefs) {
      const response = await page.request.get(href.split('#')[0] ?? href);
      expect(response.status(), href).toBe(200);
    }
  });
});

test.describe('ayuda y contacto', () => {
  test('ofrece el correo oficial sin prometer que el mensaje se envía desde el sitio', async ({ page }) => {
    await page.goto('/ayuda/');
    const contact = page.getByRole('region', { name: 'Escríbenos' });
    await expect(contact.getByText('kyro89py@gmail.com', { exact: true })).toBeVisible();
    const write = contact.getByRole('link', { name: 'Escribir un correo' });
    await expect(write).toHaveAttribute('href', /^mailto:kyro89py@gmail\.com\?subject=/);
    await expect(contact.getByText('abre tu aplicación de correo')).toBeVisible();
    // No hay formulario: nada puede decir "mensaje enviado".
    await expect(page.getByRole('main').locator('form')).toHaveCount(0);
    await expect(page.getByText(/mensaje enviado/i)).toHaveCount(0);
  });

  test('copiar la dirección avisa solo cuando de verdad se copió', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'los permisos del portapapeles solo se conceden en Chromium');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/ayuda/');
    await page.getByRole('button', { name: 'Copiar la dirección' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Dirección copiada.' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('kyro89py@gmail.com');
  });

  test('si el navegador no deja copiar, lo dice y no finge éxito', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('denegado')) },
      });
    });
    await page.goto('/ayuda/');
    await page.getByRole('button', { name: 'Copiar la dirección' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'No se pudo copiar.' })).toBeVisible();
    await expect(page.getByText('Dirección copiada.')).toHaveCount(0);
  });

  test('las preguntas se abren con el teclado y desde su enlace', async ({ page }) => {
    await page.goto('/ayuda/#carrito');
    await expect(page.locator('details#carrito')).toHaveAttribute('open', '');
    await page.locator('details#cuenta summary').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('details#cuenta')).toHaveAttribute('open', '');
    await expect(page.getByText('el sitio no tiene cuentas de cliente')).toBeVisible();
  });

  test('las respuestas describen el sitio real: pago inactivo y límite del carrito', async ({ page }) => {
    await page.goto('/ayuda/');
    await expect(page.getByText('El pago en línea no está activo')).toBeAttached();
    await expect(page.getByText('Hasta 10 unidades de cada talla.')).toBeAttached();
    // Con páginas informativas publicadas, la respuesta enlaza a ellas.
    await page.getByText('¿Dónde consulto envíos, cambios y devoluciones?').click();
    await expect(
      page.locator('details#condiciones').getByRole('link', { name: 'Página informativa de prueba' }),
    ).toBeVisible();
  });

  test('el sitio no usa cookies ni contacta con terceros', async ({ page, context, baseURL }) => {
    const origins = new Set<string>();
    page.on('request', (request) => {
      if (!request.url().startsWith('data:')) origins.add(new URL(request.url()).origin);
    });
    for (const path of ['/', '/tienda/', '/ayuda/', '/producto/prenda-de-prueba-dos/']) {
      await page.goto(path);
    }
    await page.getByRole('button', { name: 'Añadir al carrito' }).click();
    await expect(cartToggle(page)).toContainText('1');
    expect([...origins]).toEqual([new URL(baseURL ?? '').origin]);
    expect(await context.cookies()).toEqual([]);
    // Lo único guardado en el navegador es el carrito.
    const keys = await page.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)));
    expect(keys).toEqual(['kyro.cart.v1']);
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

  test('lleva a la búsqueda', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'solo en pantallas estrechas');
    await page.goto('/');
    await page.getByRole('button', { name: 'Menú' }).click();
    await page.getByRole('dialog', { name: 'Menú' }).getByRole('link', { name: 'Buscar' }).click();
    await expect(page).toHaveURL(/\/buscar\/$/);
  });

  test('lleva a ayuda y contacto', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'solo en pantallas estrechas');
    await page.goto('/');
    await page.getByRole('button', { name: 'Menú' }).click();
    await page.getByRole('dialog', { name: 'Menú' }).getByRole('link', { name: 'Ayuda y contacto' }).click();
    await expect(page).toHaveURL(/\/ayuda\/$/);
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

  test('cada foto de la ficha enlaza a su versión grande', async ({ page }) => {
    await page.goto('/producto/prenda-de-prueba-uno/');
    const link = page.getByRole('link', { name: 'Ampliar la foto 1 de 3' });
    await expect(link).toHaveAttribute('href', /\.webp$/);
    const response = await page.request.get((await link.getAttribute('href')) ?? '');
    expect(response.status()).toBe(200);
    await expect(page.getByRole('group', { name: 'Elegir foto' })).toBeHidden();
    await expect(page.locator('[data-buy-bar]')).toBeHidden();
  });

  test('no muestra controles que no funcionarían', async ({ page }) => {
    await page.goto('/buscar/');
    await expect(page.getByRole('search')).toBeHidden();
    // getByText no mira dentro de <noscript>: se busca el párrafo por su clase.
    await expect(page.locator('.search__noscript')).toBeVisible();
    await expect(page.locator('.search__noscript')).toContainText('La búsqueda necesita JavaScript.');
    await expect(page.getByRole('list', { name: 'Resultados' }).getByRole('listitem')).toHaveCount(4);
    await page.goto('/producto/prenda-de-prueba-uno/');
    await expect(page.getByRole('group', { name: 'Cantidad' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Añadir al carrito' })).toBeHidden();
    await expect(page.locator('.product-form noscript p')).toContainText('Para añadir piezas al carrito, activa JavaScript');
  });

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
