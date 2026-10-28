/** Lo único que se guarda en el navegador: qué variante y cuántas unidades. */
export interface CartLine {
  sku: string;
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
}

/**
 * Índice público del catálogo (/catalog.json), generado en el build a partir de los
 * productos activos. Los precios del carrito salen siempre de aquí, nunca de lo
 * guardado en el navegador. En la fase 2 el servidor los volverá a calcular.
 */
export interface CatalogVariant {
  sku: string;
  productName: string;
  optionName: string;
  label: string;
  price: number;
  url: string;
  image: { src: string; width: number; height: number } | null;
  available: boolean;
}

export interface CatalogIndex {
  version: 1;
  currency: string | null;
  variants: Record<string, CatalogVariant>;
}
