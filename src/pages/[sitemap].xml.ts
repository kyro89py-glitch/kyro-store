import type { APIRoute, GetStaticPaths } from 'astro';
import { store } from '../config/store';
import { getActiveProducts, getCategories } from '../lib/catalog';
import { routes } from '../lib/urls';

// /sitemap.xml solo se genera cuando la tienda se lanza: `store.indexable` en true y
// un dominio definido (KYRO_SITE_URL). Antes de eso no existe.
export const getStaticPaths = (() =>
  store.indexable && import.meta.env.SITE && !__KYRO_FIXTURES__
    ? [{ params: { sitemap: 'sitemap' } }]
    : []) satisfies GetStaticPaths;

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site }) => {
  if (!site) return new Response(null, { status: 404 });
  const products = await getActiveProducts();
  const paths = [
    routes.home(),
    routes.shop(),
    routes.brand(),
    ...getCategories(products).map((category) => routes.category(category.slug)),
    ...products.map((product) => routes.product(product.id)),
  ];
  const urls = paths.map((path) => `  <url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
