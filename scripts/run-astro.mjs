// Ejecuta el CLI de Astro con las opciones de KYRO. Lo usan los scripts de package.json.
//
//   node scripts/run-astro.mjs [--fixtures] [--test-logo] <comando de astro> [opciones]
//
//   --fixtures   usa los datos de prueba de tests/fixtures (KYRO_CATALOG=fixtures)
//   --test-logo  además usa el logotipo de prueba; solo para las pruebas e2e
//
// Se usa un script en lugar de variables en la línea de comandos para que funcione
// igual en macOS, Linux y Windows sin dependencias extra.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { findRunningDevServer, parallelDevMessage } from './dev-lock.mjs';

const require = createRequire(import.meta.url);
const astroPackage = require.resolve('astro/package.json');
const astroBin = join(dirname(astroPackage), require(astroPackage).bin.astro);

const args = process.argv.slice(2);
const env = { ...process.env };
while (['--fixtures', '--test-logo'].includes(args[0] ?? '')) {
  const flag = args.shift();
  if (flag === '--fixtures') env['KYRO_CATALOG'] = 'fixtures';
  if (flag === '--test-logo') env['KYRO_TEST_LOGO'] = '1';
}

// `astro dev` (no `astro dev stop|status|logs`): un solo servidor por carpeta.
const devSubcommands = new Set(['stop', 'status', 'logs']);
if (args[0] === 'dev' && !devSubcommands.has(args[1] ?? '')) {
  const running = findRunningDevServer(process.cwd());
  if (running) {
    console.error(parallelDevMessage(running));
    process.exit(1);
  }
}

const child = spawn(process.execPath, [astroBin, ...args], { stdio: 'inherit', env });

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
