import { SLUG_PATTERN, slugify } from './text';

/** Datos mínimos de cada producto para validar el catálogo completo. */
export interface CatalogEntrySummary {
  id: string;
  name: string;
  category: string;
  currency: string;
  skus: string[];
}

/**
 * Reglas que dependen de varios productos a la vez (el esquema de
 * content.config.ts solo ve uno). Devuelve la lista de errores; vacía si todo
 * está bien.
 */
export function findCatalogErrors(entries: CatalogEntrySummary[]): string[] {
  const errors: string[] = [];
  const skuOwners = new Map<string, string>();
  const categorySlugs = new Map<string, string>();
  const currencies = new Set<string>();

  for (const entry of entries) {
    if (!SLUG_PATTERN.test(entry.id)) {
      errors.push(
        `La carpeta "${entry.id}" no es una URL válida: usa minúsculas, números y guiones (p. ej. "abrigo-largo").`,
      );
    }

    for (const sku of entry.skus) {
      const owner = skuOwners.get(sku);
      if (owner && owner !== entry.id) {
        errors.push(`El SKU ${sku} está repetido en "${owner}" y "${entry.id}".`);
      }
      skuOwners.set(sku, entry.id);
    }

    const categorySlug = slugify(entry.category);
    if (categorySlug === '') {
      errors.push(`La categoría de "${entry.id}" no genera una URL válida.`);
    }
    const knownName = categorySlugs.get(categorySlug);
    if (knownName && knownName !== entry.category) {
      errors.push(
        `Las categorías "${knownName}" y "${entry.category}" comparten URL; escríbelas igual o usa nombres distintos.`,
      );
    }
    categorySlugs.set(categorySlug, entry.category);

    currencies.add(entry.currency);
  }

  if (currencies.size > 1) {
    errors.push(
      `Todos los productos activos deben usar la misma moneda; hay ${[...currencies].join(', ')}.`,
    );
  }

  return errors;
}

/**
 * Una ficha con imágenes generadas con IA debe conservar al menos una fotografía real
 * de la prenda: es la referencia que permite comprobar lo que se compra.
 */
export function lacksRealPhoto(images: { generated: boolean }[]): boolean {
  return images.some((image) => image.generated) && images.every((image) => image.generated);
}

/** Qué muestra cada imagen de una galería. */
export const IMAGE_VIEWS = ['modelo', 'frente', 'espalda', 'detalle'] as const;
export type ImageView = (typeof IMAGE_VIEWS)[number];

/**
 * Posiciones de las imágenes generadas con IA que se presentan como algo distinto de una
 * vista con modelo. Un frente, una espalda o un detalle de la prenda deben ser
 * fotografías reales: un detalle generado podría no coincidir con lo que se compra.
 */
export function generatedOutsideModelView(images: { generated: boolean; view?: ImageView | undefined }[]): number[] {
  return images.flatMap((image, index) => (image.generated && image.view !== 'modelo' ? [index] : []));
}
