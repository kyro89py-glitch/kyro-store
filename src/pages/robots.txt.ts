import type { APIRoute } from 'astro';
import { store } from '../config/store';

// Mientras store.indexable sea false, se pide a los buscadores que no rastreen nada.
export const GET: APIRoute = ({ site }) => {
  const indexable = store.indexable && !__KYRO_FIXTURES__;
  const lines = indexable
    ? ['User-agent: *', 'Allow: /', ...(site ? [`Sitemap: ${new URL('sitemap.xml', site).href}`] : [])]
    : ['User-agent: *', 'Disallow: /'];
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
