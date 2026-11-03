import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Mensaje de Chromium cuando cancela la animación (opcional) de transición entre páginas.
 * En este entorno sin pantalla, con pruebas en paralelo, ocurre de forma intermitente en
 * cualquier navegación; la navegación termina igual. No es un error del sitio.
 */
const ABORTED_VIEW_TRANSITION = /^Transition was aborted because of invalid state\. ViewTransition opt-in disabled$/;

/** Registra errores de consola (incluidas violaciones de CSP) y excepciones. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !ABORTED_VIEW_TRANSITION.test(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'la página no debe desplazarse en horizontal').toBeLessThanOrEqual(0);
}

export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const summary = results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
  expect(summary, 'violaciones de accesibilidad').toEqual([]);
}

/** El botón "Carrito" de la cabecera. */
export function cartToggle(page: Page) {
  return page.locator('kyro-cart-toggle a');
}
