import { describe, expect, it } from 'vitest';
import { findCatalogErrors, type CatalogEntrySummary } from '../../src/lib/catalog-rules';
import { formatPrice, fractionDigits, toDecimalString } from '../../src/lib/money';
import { slugify, toJsonLd } from '../../src/lib/text';
import { href, routes } from '../../src/lib/urls';

describe('money', () => {
  it('usa los decimales de cada moneda', () => {
    expect(fractionDigits('USD')).toBe(2);
    expect(fractionDigits('PYG')).toBe(0);
  });

  it('formatea importes en unidades mínimas', () => {
    expect(formatPrice(125000, 'PYG')).toMatch(/125\.000/);
    expect(formatPrice(12550, 'USD')).toMatch(/125,50/);
  });

  it('rechaza importes no enteros', () => {
    expect(() => formatPrice(10.5, 'USD')).toThrow(TypeError);
  });

  it('toDecimalString para schema.org y pasarelas', () => {
    expect(toDecimalString(12550, 'USD')).toBe('125.50');
    expect(toDecimalString(125000, 'PYG')).toBe('125000');
  });
});

describe('text', () => {
  it('slugify quita tildes, eñes y símbolos', () => {
    expect(slugify('Camisas & Sobrecamisas')).toBe('camisas-sobrecamisas');
    expect(slugify('  Año Único ')).toBe('ano-unico');
  });

  it('toJsonLd no permite cerrar la etiqueta <script>', () => {
    const json = toJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});

describe('urls', () => {
  it('añade la barra final a las páginas y no a los archivos', () => {
    expect(href('')).toBe('/');
    expect(href('tienda')).toBe('/tienda/');
    expect(href('/tienda/')).toBe('/tienda/');
    expect(href('catalog.json')).toBe('/catalog.json');
    expect(href('tienda?orden=1#x')).toBe('/tienda/?orden=1#x');
  });

  it('rutas con nombre', () => {
    expect(routes.product('abrigo-largo')).toBe('/producto/abrigo-largo/');
    expect(routes.category('abrigos')).toBe('/tienda/abrigos/');
  });
});

describe('findCatalogErrors', () => {
  const entry = (overrides: Partial<CatalogEntrySummary>): CatalogEntrySummary => ({
    id: 'abrigo-largo',
    name: 'Abrigo',
    category: 'Abrigos',
    currency: 'PYG',
    skus: ['AB-01-M'],
    ...overrides,
  });

  it('acepta un catálogo coherente', () => {
    expect(findCatalogErrors([entry({}), entry({ id: 'otro', skus: ['OT-01-M'] })])).toEqual([]);
  });

  it('detecta SKU repetidos entre productos', () => {
    const errors = findCatalogErrors([entry({}), entry({ id: 'otro' })]);
    expect(errors.join()).toMatch(/AB-01-M/);
  });

  it('detecta monedas mezcladas', () => {
    const errors = findCatalogErrors([entry({}), entry({ id: 'otro', skus: ['X-1'], currency: 'USD' })]);
    expect(errors.join()).toMatch(/misma moneda/);
  });

  it('detecta carpetas que no son URL válidas', () => {
    expect(findCatalogErrors([entry({ id: 'Abrigo Largo' })]).join()).toMatch(/no es una URL válida/);
  });

  it('detecta categorías distintas con la misma URL', () => {
    const errors = findCatalogErrors([
      entry({}),
      entry({ id: 'otro', skus: ['X-1'], category: 'abrigos' }),
    ]);
    expect(errors.join()).toMatch(/comparten URL/);
  });
});
