import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { getActiveProducts } from '../lib/catalog';
import type { CatalogIndex } from '../lib/cart/types';
import { routes } from '../lib/urls';

// Índice que usa el carrito para mostrar nombres, miniaturas y precios.
// Contiene solo datos públicos de productos activos.
export const GET: APIRoute = async () => {
  const products = await getActiveProducts();
  const index: CatalogIndex = {
    version: 1,
    currency: products[0]?.data.price.currency ?? null,
    variants: {},
  };

  for (const product of products) {
    const cover = product.data.images[0];
    const thumbnail = cover
      ? await getImage({ src: cover.src, width: 240, format: 'webp', quality: 72 })
      : null;
    for (const variant of product.data.variants) {
      index.variants[variant.sku] = {
        sku: variant.sku,
        productName: product.data.name,
        optionName: product.data.optionName,
        label: variant.label,
        price: product.data.price.amount,
        url: routes.product(product.id),
        image: thumbnail
          ? {
              src: thumbnail.src,
              width: Number(thumbnail.attributes.width ?? 240),
              height: Number(thumbnail.attributes.height ?? 300),
            }
          : null,
        available: variant.available,
      };
    }
  }

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
