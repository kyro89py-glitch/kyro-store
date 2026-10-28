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
