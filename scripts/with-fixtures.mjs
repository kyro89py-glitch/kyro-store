// Ejecuta un comando de Astro con el catálogo de prueba (tests/fixtures/catalog).
// Se usa un script en lugar de `KYRO_CATALOG=fixtures astro ...` para que funcione
// igual en macOS, Linux y Windows sin dependencias extra.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const astroPackage = require.resolve('astro/package.json');
const astroBin = join(dirname(astroPackage), require(astroPackage).bin.astro);
const args = process.argv.slice(2);

const child = spawn(process.execPath, [astroBin, ...args], {
  stdio: 'inherit',
  env: { ...process.env, KYRO_CATALOG: 'fixtures' },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
