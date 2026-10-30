import { describe, expect, it } from 'vitest';
import {
  addItem,
  changeVariant,
  EMPTY_CART,
  itemCount,
  parseCart,
  pruneMissing,
  quantityOf,
  removeItem,
  setQuantity,
  siblingVariants,
  summarize,
} from '../../src/lib/cart/state';
import type { CatalogIndex, CatalogVariant } from '../../src/lib/cart/types';

const MAX = 10;

function variant(sku: string, price: number, available = true, label = 'M'): CatalogVariant {
  return {
    sku,
    productId: sku.split('-')[0]!.toLowerCase(),
    productName: `Producto ${sku}`,
    optionName: 'Talla',
    label,
    price,
    url: `/producto/${sku.toLowerCase()}/`,
    image: null,
    available,
  };
}

const catalog: CatalogIndex = {
  version: 1,
  currency: 'XTS',
  variants: {
    'A-1': variant('A-1', 1250),
    'B-1': variant('B-1', 800),
    'C-1': variant('C-1', 500, false),
    'A-2': variant('A-2', 1250, true, 'L'),
    'A-3': variant('A-3', 1250, false, 'XL'),
  },
};

describe('addItem / setQuantity / removeItem', () => {
  it('añade una línea nueva y suma cantidades en la misma variante', () => {
    let cart = addItem(EMPTY_CART, 'A-1', 1, MAX);
    cart = addItem(cart, 'A-1', 2, MAX);
    expect(cart.lines).toEqual([{ sku: 'A-1', quantity: 3 }]);
  });

  it('no supera el máximo por línea', () => {
    const cart = addItem(EMPTY_CART, 'A-1', 25, MAX);
    expect(quantityOf(cart, 'A-1')).toBe(MAX);
  });

  it('cantidad 0 o negativa elimina la línea', () => {
    const cart = addItem(EMPTY_CART, 'A-1', 2, MAX);
    expect(setQuantity(cart, 'A-1', 0, MAX).lines).toEqual([]);
    expect(setQuantity(cart, 'A-1', -3, MAX).lines).toEqual([]);
  });

  it('trunca cantidades decimales', () => {
    expect(setQuantity(EMPTY_CART, 'A-1', 2.9, MAX).lines).toEqual([{ sku: 'A-1', quantity: 2 }]);
  });

  it('removeItem quita solo esa variante y no muta el estado anterior', () => {
    const before = addItem(addItem(EMPTY_CART, 'A-1', 1, MAX), 'B-1', 1, MAX);
    const after = removeItem(before, 'A-1');
    expect(after.lines).toEqual([{ sku: 'B-1', quantity: 1 }]);
    expect(before.lines).toHaveLength(2);
  });

  it('itemCount suma todas las unidades', () => {
    const cart = addItem(addItem(EMPTY_CART, 'A-1', 2, MAX), 'B-1', 3, MAX);
    expect(itemCount(cart)).toBe(5);
  });
});

describe('parseCart (datos de localStorage)', () => {
  it('acepta un carrito válido', () => {
    expect(parseCart({ lines: [{ sku: 'A-1', quantity: 2 }] }, MAX).lines).toEqual([
      { sku: 'A-1', quantity: 2 },
    ]);
  });

  it.each([null, undefined, 'texto', 42, [], {}, { lines: 'x' }])('descarta %j', (raw) => {
    expect(parseCart(raw, MAX)).toEqual(EMPTY_CART);
  });

  it('ignora líneas manipuladas y limita cantidades', () => {
    const cart = parseCart(
      {
        lines: [
          { sku: '<img src=x onerror=alert(1)>', quantity: 1 },
          { sku: 'A-1', quantity: '3' },
          { sku: 'B-1', quantity: 9999 },
          { sku: 'C-1', quantity: Number.NaN },
          null,
        ],
      },
      MAX,
    );
    expect(cart.lines).toEqual([{ sku: 'B-1', quantity: MAX }]);
  });

  it('une líneas duplicadas', () => {
    const cart = parseCart({ lines: [{ sku: 'A-1', quantity: 2 }, { sku: 'A-1', quantity: 3 }] }, MAX);
    expect(cart.lines).toEqual([{ sku: 'A-1', quantity: 5 }]);
  });
});

describe('summarize', () => {
  it('calcula totales con precios del catálogo, no del navegador', () => {
    const cart = addItem(addItem(EMPTY_CART, 'A-1', 2, MAX), 'B-1', 1, MAX);
    const summary = summarize(cart, catalog);
    expect(summary.lines.map((line) => line.lineTotal)).toEqual([2500, 800]);
    expect(summary.subtotal).toBe(3300);
    expect(summary.currency).toBe('XTS');
  });

  it('excluye del subtotal las variantes no disponibles', () => {
    const cart = addItem(addItem(EMPTY_CART, 'A-1', 1, MAX), 'C-1', 1, MAX);
    const summary = summarize(cart, catalog);
    expect(summary.subtotal).toBe(1250);
    expect(summary.hasUnavailable).toBe(true);
  });

  it('ignora variantes que ya no existen y pruneMissing las elimina', () => {
    const cart = addItem(addItem(EMPTY_CART, 'A-1', 1, MAX), 'GONE-1', 1, MAX);
    expect(summarize(cart, catalog).lines.map((line) => line.sku)).toEqual(['A-1']);
    expect(pruneMissing(cart, catalog).lines).toEqual([{ sku: 'A-1', quantity: 1 }]);
  });

  it('pruneMissing devuelve el mismo objeto si no hay nada que quitar', () => {
    const cart = addItem(EMPTY_CART, 'A-1', 1, MAX);
    expect(pruneMissing(cart, catalog)).toBe(cart);
  });
});

describe('changeVariant (cambiar de talla en el carrito)', () => {
  it('cambia la talla sin mover la línea de sitio', () => {
    const cart = { lines: [{ sku: 'B-1', quantity: 1 }, { sku: 'A-1', quantity: 2 }, { sku: 'C-1', quantity: 1 }] };
    expect(changeVariant(cart, 'A-1', 'A-2', MAX).lines).toEqual([
      { sku: 'B-1', quantity: 1 },
      { sku: 'A-2', quantity: 2 },
      { sku: 'C-1', quantity: 1 },
    ]);
  });

  it('si la nueva talla ya estaba, junta las dos líneas con el límite', () => {
    const cart = { lines: [{ sku: 'A-1', quantity: 7 }, { sku: 'B-1', quantity: 1 }, { sku: 'A-2', quantity: 6 }] };
    expect(changeVariant(cart, 'A-1', 'A-2', MAX).lines).toEqual([
      { sku: 'A-2', quantity: 10 },
      { sku: 'B-1', quantity: 1 },
    ]);
  });

  it('no hace nada con la misma talla, una línea inexistente o un SKU inválido', () => {
    const cart = { lines: [{ sku: 'A-1', quantity: 1 }] };
    expect(changeVariant(cart, 'A-1', 'A-1', MAX)).toBe(cart);
    expect(changeVariant(cart, 'Z-9', 'A-2', MAX)).toBe(cart);
    expect(changeVariant(cart, 'A-1', '<b>', MAX)).toBe(cart);
  });
});

describe('siblingVariants', () => {
  it('devuelve las tallas del mismo producto en el orden del catálogo', () => {
    expect(siblingVariants(catalog, 'A-2').map((item) => item.sku)).toEqual(['A-1', 'A-2', 'A-3']);
    expect(siblingVariants(catalog, 'B-1').map((item) => item.sku)).toEqual(['B-1']);
    expect(siblingVariants(catalog, 'NO-1')).toEqual([]);
  });
});
