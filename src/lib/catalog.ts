import { getCollection, type CollectionEntry } from 'astro:content';
import { store } from '../config/store';
import { findCatalogErrors } from './catalog-rules';
import { slugify } from './text';

export type Product = CollectionEntry<'products'>;

export interface Category {
  name: string;
  slug: string;
  count: number;
}

function compareProducts(a: Product, b: Product): number {
  return (
    a.data.position - b.data.position || a.data.name.localeCompare(b.data.name, store.locale)
  );
}

/** Productos con status "active", validados y ordenados. Los borradores no salen nunca. */
export async function getActiveProducts(): Promise<Product[]> {
  const products = await getCollection('products', ({ data }) => data.status === 'active');

  const errors = findCatalogErrors(
    products.map((product) => ({
      id: product.id,
      name: product.data.name,
      category: product.data.category,
      currency: product.data.price.currency,
      skus: product.data.variants.map((variant) => variant.sku),
    })),
  );
  if (errors.length > 0) {
    throw new Error(`Catálogo con errores:\n- ${errors.join('\n- ')}`);
  }

  return products.sort(compareProducts);
}

export function categorySlug(product: Product): string {
  return slugify(product.data.category);
}

export function getCategories(products: Product[]): Category[] {
  const categories = new Map<string, Category>();
  for (const product of products) {
    const slug = categorySlug(product);
    const category = categories.get(slug);
    if (category) category.count += 1;
    else categories.set(slug, { name: product.data.category, slug, count: 1 });
  }
  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, store.locale));
}

/** Destacados primero; si no hay ninguno marcado, el orden normal del catálogo. */
export function getFeatured(products: Product[], limit: number): Product[] {
  const featured = products.filter((product) => product.data.featured);
  return (featured.length > 0 ? featured : products).slice(0, limit);
}

export function isPurchasable(product: Product): boolean {
  return product.data.variants.some((variant) => variant.available);
}
