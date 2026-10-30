import { categorySlug, isPurchasable, type Product } from './catalog';
import { normalize, type SearchItem } from './search';

/** Datos de búsqueda de un producto: solo lo que ya se publica en su ficha. */
export function toSearchItem(product: Product, position: number): SearchItem {
  const { data } = product;
  return {
    id: product.id,
    position,
    name: normalize(data.name),
    category: normalize(data.category),
    categorySlug: categorySlug(product),
    text: normalize([data.summary, ...data.details, data.composition ?? ''].join(' ')),
    price: data.price.amount,
    available: isPurchasable(product),
    sizes: data.variants.filter((variant) => variant.available).map((variant) => variant.label),
  };
}
