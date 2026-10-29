import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd } from '../../src/lib/seo';
import { formatDate } from '../../src/lib/text';

describe('breadcrumbJsonLd', () => {
  const crumbs = [
    { name: 'Tienda', path: '/tienda/' },
    { name: 'Abrigos', path: '/tienda/abrigos/' },
    { name: 'Abrigo largo', path: '/producto/abrigo-largo/' },
  ];

  it('sin dominio no genera nada (schema.org exige URLs absolutas)', () => {
    expect(breadcrumbJsonLd(crumbs, undefined)).toBeNull();
  });

  it('con dominio, numera los pasos y usa URLs absolutas', () => {
    const result = breadcrumbJsonLd(crumbs, new URL('https://kyro.example'));
    expect(result).toMatchObject({ '@type': 'BreadcrumbList' });
    expect(result?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Tienda', item: 'https://kyro.example/tienda/' },
      { '@type': 'ListItem', position: 2, name: 'Abrigos', item: 'https://kyro.example/tienda/abrigos/' },
      { '@type': 'ListItem', position: 3, name: 'Abrigo largo', item: 'https://kyro.example/producto/abrigo-largo/' },
    ]);
  });

  it('sin pasos no genera nada', () => {
    expect(breadcrumbJsonLd([], new URL('https://kyro.example'))).toBeNull();
  });
});

describe('formatDate', () => {
  it('formatea fechas de contenido sin desplazarlas un día', () => {
    expect(formatDate(new Date('2026-10-01'))).toBe('1 de octubre de 2026');
    expect(formatDate(new Date('2026-01-31'))).toBe('31 de enero de 2026');
  });
});
