import { store } from '../../config/store';
import { routes } from '../urls';
import { EMPTY_CART, parseCart, pruneMissing } from './state';
import type { CartState, CatalogIndex } from './types';

// Estado del carrito en el navegador: localStorage + eventos. Solo se importa desde
// scripts de cliente.

const STORAGE_KEY = 'kyro.cart.v1';
const CHANGE_EVENT = 'kyro:cart-change';
export const OPEN_CART_EVENT = 'kyro:open-cart';

const max = store.cart.maxQuantityPerLine;

function read(): CartState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseCart(JSON.parse(raw), max) : EMPTY_CART;
  } catch {
    // Almacenamiento bloqueado (modo privado, políticas) o JSON corrupto.
    return EMPTY_CART;
  }
}

function write(state: CartState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento el carrito sigue funcionando mientras la página esté abierta.
  }
}

let current: CartState = read();

export function getCart(): CartState {
  return current;
}

export function updateCart(update: (state: CartState) => CartState): CartState {
  const next = update(current);
  if (next !== current) {
    current = next;
    write(current);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
  return current;
}

export function onCartChange(listener: (state: CartState) => void): () => void {
  const handleChange = () => listener(current);
  // Otra pestaña modificó el carrito.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = read();
    listener(current);
  };
  window.addEventListener(CHANGE_EVENT, handleChange);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange);
    window.removeEventListener('storage', handleStorage);
  };
}

export function openCart(): void {
  window.dispatchEvent(new CustomEvent(OPEN_CART_EVENT));
}

let catalogRequest: Promise<CatalogIndex> | undefined;

export function loadCatalog(): Promise<CatalogIndex> {
  catalogRequest ??= fetch(routes.catalogIndex(), { credentials: 'same-origin' })
    .then((response) => {
      if (!response.ok) throw new Error(`catalog.json respondió ${response.status}`);
      return response.json() as Promise<CatalogIndex>;
    })
    .then((catalog) => {
      updateCart((state) => pruneMissing(state, catalog));
      return catalog;
    })
    .catch((error: unknown) => {
      catalogRequest = undefined;
      throw error;
    });
  return catalogRequest;
}
