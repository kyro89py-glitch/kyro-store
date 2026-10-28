import type { APIRoute } from 'astro';
import { store } from '../config/store';

// Mientras store.indexable sea false, se pide a los buscadores que no rastreen nada.
export const GET: APIRoute = () => {
  const lines = store.indexable ? ['User-agent: *', 'Allow: /'] : ['User-agent: *', 'Disallow: /'];
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
