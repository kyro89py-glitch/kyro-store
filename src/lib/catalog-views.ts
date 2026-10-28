// Selecciones de productos para la portada. Funciones puras: solo reordenan datos
// reales del catálogo, nunca los completan ni los inventan.

interface Dated {
  data: { releasedAt?: Date | undefined };
}

interface Featurable {
  data: { featured: boolean };
}

/** "Novedades": solo productos con fecha de lanzamiento, de la más reciente a la más antigua. */
export function newestFirst<T extends Dated>(products: T[], limit: number): T[] {
  return products
    .flatMap((product) => (product.data.releasedAt ? [{ product, time: product.data.releasedAt.getTime() }] : []))
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(({ product }) => product);
}

/** "Destacados": solo los marcados con `featured: true`, en el orden del catálogo. */
export function featuredOnly<T extends Featurable>(products: T[], limit: number): T[] {
  return products.filter((product) => product.data.featured).slice(0, limit);
}
