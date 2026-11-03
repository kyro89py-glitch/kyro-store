#!/usr/bin/env node
// Servidor estático local del laboratorio (sin dependencias). Solo escucha en 127.0.0.1.
// Uso: node scripts/serve.mjs [puerto]   →   http://127.0.0.1:4410/ui/

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

/** Solo se sirven la interfaz, el motor y los datos; nunca pruebas ni scripts. */
const PUBLIC_DIRS = ['ui', 'src', 'data'];

function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = normalize(join(ROOT, decoded));
  if (!target.startsWith(ROOT + sep)) return null;
  const top = target.slice(ROOT.length + 1).split(sep)[0];
  return PUBLIC_DIRS.includes(top) ? target : null;
}

export function startServer({ port = 4410, host = '127.0.0.1' } = {}) {
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const url = request.url ?? '/';
    if (url === '/' || url === '/ui') {
      response.writeHead(302, { Location: '/ui/' }).end();
      return;
    }
    let target;
    try {
      target = resolvePath(url.endsWith('/') ? `${url}index.html` : url);
    } catch {
      target = null;
    }
    if (!target) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
      return;
    }
    try {
      const info = await stat(target);
      if (!info.isFile()) throw new Error('no es un archivo');
      response.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream',
        'Content-Length': info.size,
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
    }
  });
  return new Promise((resolveStart, rejectStart) => {
    server.once('error', rejectStart);
    server.listen(port, host, () => {
      const address = server.address();
      resolveStart({ server, url: `http://${host}:${address.port}` });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 4410);
  const { url } = await startServer({ port });
  console.log(`Char · Dual Brain Lab en ${url}/ui/  (Ctrl+C para detener)`);
}
