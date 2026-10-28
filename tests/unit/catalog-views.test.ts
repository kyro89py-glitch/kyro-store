import { describe, expect, it } from 'vitest';
import { featuredOnly, newestFirst } from '../../src/lib/catalog-views';

const item = (id: string, data: { releasedAt?: Date; featured?: boolean }) => ({
  id,
  data: { featured: false, ...data },
});

describe('newestFirst (novedades)', () => {
  const products = [
    item('sin-fecha', {}),
    item('octubre', { releasedAt: new Date('2026-10-01') }),
    item('noviembre', { releasedAt: new Date('2026-11-01') }),
    item('septiembre', { releasedAt: new Date('2026-09-01') }),
  ];

  it('ordena por fecha descendente e ignora productos sin fecha', () => {
    expect(newestFirst(products, 10).map((product) => product.id)).toEqual(['noviembre', 'octubre', 'septiembre']);
  });

  it('respeta el límite', () => {
    expect(newestFirst(products, 2).map((product) => product.id)).toEqual(['noviembre', 'octubre']);
  });

  it('sin fechas no hay novedades', () => {
    expect(newestFirst([item('a', {}), item('b', {})], 4)).toEqual([]);
  });

  it('no modifica el orden del catálogo original', () => {
    const before = products.map((product) => product.id);
    newestFirst(products, 4);
    expect(products.map((product) => product.id)).toEqual(before);
  });
});

describe('featuredOnly (destacados)', () => {
  it('devuelve solo los marcados, en el orden del catálogo', () => {
    const products = [item('a', { featured: true }), item('b', {}), item('c', { featured: true })];
    expect(featuredOnly(products, 5).map((product) => product.id)).toEqual(['a', 'c']);
  });

  it('sin marcados no hay destacados (no se rellena con otros productos)', () => {
    expect(featuredOnly([item('a', {}), item('b', {})], 5)).toEqual([]);
  });
});
