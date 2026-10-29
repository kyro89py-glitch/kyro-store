// Detecta un servidor de desarrollo de Astro ya en marcha en esta carpeta.
//
// El catálogo real (`npm run dev`) y el de prueba (`npm run dev:fixtures`) comparten la
// caché de contenido de Astro en `.astro/`: si corren a la vez, uno sobrescribe los
// datos del otro. Astro registra el servidor activo en `.astro/dev.json`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {{ pid: number, url: string }} RunningDevServer
 */

/**
 * @param {number} pid
 * @returns {boolean}
 */
function isAlive(pid) {
  try {
    // La señal 0 no detiene el proceso: solo comprueba que existe.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: existe, pero pertenece a otro usuario.
    return /** @type {NodeJS.ErrnoException} */ (error).code === 'EPERM';
  }
}

/**
 * Devuelve el servidor activo o null. Ante cualquier dato inesperado devuelve null:
 * esta comprobación nunca debe impedir arrancar por un error propio.
 *
 * @param {string} rootDir carpeta del proyecto
 * @returns {RunningDevServer | null}
 */
export function findRunningDevServer(rootDir) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(rootDir, '.astro', 'dev.json'), 'utf8'));
  } catch {
    return null;
  }
  if (typeof data?.pid !== 'number' || typeof data?.url !== 'string') return null;
  return isAlive(data.pid) ? { pid: data.pid, url: data.url } : null;
}

/**
 * @param {RunningDevServer} server
 * @returns {string}
 */
export function parallelDevMessage(server) {
  return [
    `Ya hay un servidor de desarrollo de KYRO en marcha en ${server.url} (pid ${server.pid}).`,
    '',
    'El catálogo real (npm run dev) y el de prueba (npm run dev:fixtures) no pueden',
    'ejecutarse a la vez en la misma carpeta: comparten la caché de contenido de Astro',
    'y uno sobrescribiría los datos del otro.',
    '',
    'Detén el servidor actual con `npx astro dev stop` (o Ctrl+C en su terminal) y vuelve a intentarlo.',
  ].join('\n');
}
