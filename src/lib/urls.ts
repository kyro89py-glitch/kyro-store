// Todas las rutas internas pasan por aquí para respetar `base` (astro.config.mjs)
// y la barra final que exige `trailingSlash: 'always'`.
const base = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function href(path = ''): string {
  const match = /^([^?#]*)(.*)$/.exec(path.replace(/^\/+/, ''));
  const pathname = match?.[1] ?? '';
  const suffix = match?.[2] ?? '';
  if (pathname === '') return `${base}/${suffix}`;
  const isFile = /\.[a-z0-9]+$/i.test(pathname);
  const normalized = isFile || pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${base}/${normalized}${suffix}`;
}

export const routes = {
  home: () => href(''),
  shop: () => href('tienda'),
  category: (slug: string) => href(`tienda/${slug}`),
  product: (slug: string) => href(`producto/${slug}`),
  cart: () => href('carrito'),
  brand: () => href('marca'),
  info: (slug: string) => href(`info/${slug}`),
  catalogIndex: () => href('catalog.json'),
};
