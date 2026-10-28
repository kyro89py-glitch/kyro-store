import type { CartLine, CartState, CatalogIndex, CatalogVariant } from './types';

// Funciones puras: reciben un estado y devuelven uno nuevo. Así se prueban sin
// navegador (tests/unit/cart.test.ts) y la misma lógica servirá en el servidor.

export const EMPTY_CART: CartState = { lines: [] };

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,39}$/;
const MAX_LINES = 50;

function clampQuantity(quantity: number, max: number): number {
  if (!Number.isFinite(quantity)) return 0;
  return Math.min(Math.max(Math.trunc(quantity), 0), max);
}

/**
 * Valida lo leído de localStorage. Cualquier cosa inesperada (JSON manipulado,
 * versiones antiguas) se descarta en lugar de romper la página.
 */
export function parseCart(raw: unknown, max: number): CartState {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as CartState).lines)) {
    return EMPTY_CART;
  }
  let state = EMPTY_CART;
  for (const line of (raw as { lines: unknown[] }).lines.slice(0, MAX_LINES)) {
    if (typeof line !== 'object' || line === null) continue;
    const { sku, quantity } = line as Partial<CartLine>;
    if (typeof sku !== 'string' || !SKU_PATTERN.test(sku) || typeof quantity !== 'number') continue;
    state = addItem(state, sku, quantity, max);
  }
  return state;
}

export function addItem(state: CartState, sku: string, quantity: number, max: number): CartState {
  const existing = state.lines.find((line) => line.sku === sku);
  return setQuantity(state, sku, (existing?.quantity ?? 0) + quantity, max);
}

/** Cantidad 0 elimina la línea. Las líneas nuevas se añaden al final. */
export function setQuantity(state: CartState, sku: string, quantity: number, max: number): CartState {
  const next = clampQuantity(quantity, max);
  const exists = state.lines.some((line) => line.sku === sku);
  if (next === 0) return removeItem(state, sku);
  if (!exists) {
    if (state.lines.length >= MAX_LINES) return state;
    return { lines: [...state.lines, { sku, quantity: next }] };
  }
  return {
    lines: state.lines.map((line) => (line.sku === sku ? { sku, quantity: next } : line)),
  };
}

export function removeItem(state: CartState, sku: string): CartState {
  return { lines: state.lines.filter((line) => line.sku !== sku) };
}

export function quantityOf(state: CartState, sku: string): number {
  return state.lines.find((line) => line.sku === sku)?.quantity ?? 0;
}

export function itemCount(state: CartState): number {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}

export interface CartSummaryLine extends CatalogVariant {
  quantity: number;
  lineTotal: number;
}

export interface CartSummary {
  lines: CartSummaryLine[];
  /** Suma de las líneas disponibles, en unidades mínimas de la moneda. */
  subtotal: number;
  currency: string | null;
  hasUnavailable: boolean;
}

/** Une el carrito con el catálogo. Las variantes que ya no existen se ignoran. */
export function summarize(state: CartState, catalog: CatalogIndex): CartSummary {
  const lines: CartSummaryLine[] = [];
  for (const line of state.lines) {
    const variant = catalog.variants[line.sku];
    if (!variant) continue;
    lines.push({ ...variant, quantity: line.quantity, lineTotal: variant.price * line.quantity });
  }
  return {
    lines,
    subtotal: lines.filter((line) => line.available).reduce((sum, line) => sum + line.lineTotal, 0),
    currency: catalog.currency,
    hasUnavailable: lines.some((line) => !line.available),
  };
}

/** Quita del carrito las variantes que ya no están en el catálogo publicado. */
export function pruneMissing(state: CartState, catalog: CatalogIndex): CartState {
  const lines = state.lines.filter((line) => line.sku in catalog.variants);
  return lines.length === state.lines.length ? state : { lines };
}
