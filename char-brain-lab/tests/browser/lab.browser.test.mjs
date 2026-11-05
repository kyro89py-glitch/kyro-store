// Pruebas en navegador (Chromium vía Playwright) de la interfaz del laboratorio.
// Si Playwright no está instalado, las pruebas se marcan como OMITIDAS, nunca como superadas.
// LAB_SCREENSHOTS=<carpeta> guarda capturas de los estados probados.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';

import { startServer } from '../../scripts/serve.mjs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return require(name);
    } catch {
      /* siguiente */
    }
  }
  return null;
}

const playwright = loadPlaywright();
const skip = playwright ? false : 'Playwright no está instalado: prueba OMITIDA (no superada).';
const SHOTS = process.env.LAB_SCREENSHOTS ?? null;

let server;
let baseURL;
let browser;

before(async () => {
  if (!playwright) return;
  ({ server, url: baseURL } = await startServer({ port: 0 }));
  // LAB_CHROMIUM_PATH permite usar un Chromium ya instalado cuando la versión de Playwright
  // encontrada no tiene su navegador descargado.
  const executablePath = process.env.LAB_CHROMIUM_PATH || undefined;
  browser = await playwright.chromium.launch({ executablePath });
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function openLab(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, locale: 'es-ES' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.goto(`${baseURL}/ui/`);
  await page.waitForSelector('html[data-ready]');
  return { context, page, errors };
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const dialog = (page) => page.locator('dialog[open]');

async function submit(page, name) {
  await dialog(page).getByRole('button', { name, exact: true }).click();
  try {
    await dialog(page).waitFor({ state: 'detached', timeout: 3000 });
  } catch {
    const message = await page.locator('dialog[open] .form-error').textContent().catch(() => '');
    throw new Error(`El formulario "${name}" no se cerró: ${message}`);
  }
}

async function noHorizontalScroll(page) {
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(scroll <= inner, `desplazamiento horizontal: ${scroll} > ${inner}`);
}

test('estado inicial honesto: sin registros, sin métricas inventadas, coordinación no implementada', { skip }, async () => {
  const { context, page, errors } = await openLab();
  for (const brain of ['char', 'claude']) {
    assert.equal(await page.locator(`.hemisphere.brain-${brain} .integrity`).textContent(), 'Sin registro en este laboratorio.');
  }
  assert.equal(await page.locator('.channel-state').textContent(), 'Protocolo no implementado');
  assert.equal(await page.locator('.counts').count(), 0, 'sin registro no hay contadores');
  await noHorizontalScroll(page);
  await shot(page, '01-inicial');
  assert.deepEqual(errors, []);
  await context.close();
});

test('ciclo completo desde la interfaz, con la memoria de Char intacta y persistencia al recargar', { skip }, async () => {
  const { context, page, errors } = await openLab();

  await page.getByRole('button', { name: 'Crear el registro de Claude' }).click();
  await submit(page, 'Crear registro');
  assert.match(await page.locator('.hemisphere.brain-claude .integrity').textContent(), /Cadena íntegra, 1 evento\./);

  // Observar
  await page.getByRole('button', { name: 'Registrar experiencia' }).click();
  const form = dialog(page);
  await form.getByLabel('Qué se observó').fill('Las pruebas unitarias del motor terminan sin fallos');
  await form.getByLabel('Tipo de fuente').selectOption('ejecución');
  await form.getByLabel('Fuente', { exact: true }).fill('node --test tests/unit');
  await form.getByLabel('Referencia de la evidencia 1').fill('salida de node --test');
  await submit(page, 'Registrar experiencia');
  assert.equal(await page.locator('#notice').textContent(), 'Experiencia claude:EXP-001 registrada.');

  // Hipotetizar
  await page.locator('#inspector').getByRole('button', { name: 'Formular hipótesis' }).click();
  await dialog(page).getByLabel('Hipótesis').fill('El motor rechaza escrituras entre Brains');
  await dialog(page).getByLabel('Sujeto').fill('motor de memoria');
  await dialog(page).getByLabel('Propiedad').fill('rechaza escrituras entre Brains');
  await dialog(page).getByLabel('Valor').fill('sí');
  assert.equal(await dialog(page).getByLabel(/claude:EXP-001/).isChecked(), true);
  await submit(page, 'Formular hipótesis');

  // Planificar: el motor rechaza un criterio mal formado y la interfaz muestra el motivo
  await page.locator('#inspector').getByRole('button', { name: 'Proponer experimento' }).click();
  await dialog(page).getByLabel('Procedimiento').fill('Intentar escribir en la memoria de Char con el actor Claude');
  await dialog(page).getByLabel('Métrica del criterio C1').fill('escrituras_aceptadas');
  await dialog(page).getByLabel('Condición del criterio C1').selectOption('<=');
  await dialog(page).getByLabel('Objetivo del criterio C1').fill('ninguna');
  await dialog(page).getByRole('button', { name: 'Proponer experimento', exact: true }).click();
  assert.match(await dialog(page).locator('.form-error').textContent(), /necesita un objetivo numérico/);
  await dialog(page).getByLabel('Objetivo del criterio C1').fill('0');
  await submit(page, 'Proponer experimento');
  const inspector = page.locator('#inspector');
  assert.match(await inspector.locator('caption').textContent(), /Criterios fijados el .*hash [0-9a-f]{12}/);

  // Actuar
  await inspector.getByRole('button', { name: 'Registrar ejecución' }).click();
  await submit(page, 'Registrar ejecución');

  // Probar
  await inspector.getByRole('button', { name: 'Registrar resultado' }).click();
  await dialog(page).getByLabel(/escrituras_aceptadas/).fill('0');
  await dialog(page).getByLabel('Referencia de la evidencia 1').fill('tests/unit/separation.test.mjs');
  await submit(page, 'Registrar resultado');
  assert.equal(await inspector.locator('.verdict-label').textContent(), 'Sin veredicto', 'observado no es verificado');
  assert.equal(await inspector.locator('.criteria .chip').textContent(), 'cumple');

  // Verificar como otra persona (independiente)
  await page.locator('.operator').click();
  await dialog(page).getByLabel('Nombre').fill('revisora');
  await submit(page, 'Guardar nombre');
  await inspector.getByRole('button', { name: 'Verificar resultado' }).click();
  assert.match(await dialog(page).locator('.form-info').textContent(), /contará como independiente/);
  await dialog(page).getByLabel('Método').fill('Repetí la prueba en otra terminal');
  await dialog(page).getByLabel('Referencia de la evidencia 1').fill('segunda ejecución de node --test');
  await submit(page, 'Registrar verificación');
  assert.equal(await inspector.locator('.verdict-label').textContent(), 'Veredicto: hipótesis respaldada');
  assert.match(await inspector.textContent(), /Sí: verificó alguien distinto de quien observó/);

  // Aprender
  await inspector.getByRole('button', { name: 'claude:HIP-001' }).click();
  await inspector.getByRole('button', { name: 'Proponer aprendizaje' }).click();
  await submit(page, 'Proponer aprendizaje');
  assert.match(await inspector.locator('.insp-head').textContent(), /CANDIDATO/);

  // Actualizar: revisión explícita; consolidar sigue bloqueado con motivo visible
  await inspector.getByRole('button', { name: 'Revisar' }).click();
  await dialog(page).getByLabel('Decisión').selectOption('aprobar');
  await submit(page, 'Registrar revisión');
  assert.match(await inspector.locator('.insp-head').textContent(), /APRENDIDO/);
  assert.equal(await inspector.getByRole('button', { name: 'Consolidar' }).isDisabled(), true);
  assert.match(await inspector.locator('.gate').textContent(), /Respaldos verificados: 1 de 2\./);

  // La memoria de Char no se tocó
  assert.equal(await page.locator('.hemisphere.brain-char .integrity').textContent(), 'Sin registro en este laboratorio.');
  assert.equal(await page.locator('.events tbody tr').count(), 9);
  assert.equal(await page.locator('.hemisphere.brain-claude .node').count(), 4);
  await shot(page, '02-ciclo-completo');

  // Persistencia
  await page.reload();
  await page.waitForSelector('html[data-ready]');
  assert.match(await page.locator('.hemisphere.brain-claude .integrity').textContent(), /Cadena íntegra, 9 eventos\./);
  assert.equal(await page.locator('.hemisphere.brain-char .integrity').textContent(), 'Sin registro en este laboratorio.');
  assert.deepEqual(errors, []);
  await context.close();
});

test('el registro real de la inspección se importa y una copia alterada queda bloqueada', { skip }, async () => {
  const { context, page, errors } = await openLab();
  await page.getByRole('button', { name: 'Importar la inspección inicial' }).click();
  await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('importado'));
  assert.equal(await page.locator('#notice').textContent(), 'Registro de Claude importado: 8 eventos verificados.');
  const rows = page.locator('.record-row');
  assert.equal(await rows.count(), 4);
  await page.getByRole('button', { name: /claude:APR-001/ }).click();
  const inspector = page.locator('#inspector');
  assert.match(await inspector.textContent(), /Propuesto porBrain Claude/);
  assert.match(await inspector.locator('.insp-head').textContent(), /CANDIDATO/);
  await page.getByRole('button', { name: /claude:EXM-001/ }).first().click();
  assert.equal(await inspector.locator('.verdict-label').textContent(), 'Veredicto: hipótesis debilitada');
  assert.match(await inspector.textContent(), /No: verificó la misma persona o Brain que observó/);
  await shot(page, '03-inspeccion-inicial');

  await page.evaluate(() => {
    const key = 'charlab.v1.ledger.claude';
    const data = JSON.parse(localStorage.getItem(key));
    data.events[6].payload.method = 'Verificado por una persona independiente';
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.waitForSelector('html[data-ready]');
  assert.match(await page.locator('.hemisphere.brain-claude .integrity').textContent(), /Integridad comprometida\. .*Evento 7/);
  assert.equal(await page.getByRole('button', { name: 'Registrar experiencia' }).count(), 0, 'un registro dañado no admite escrituras');
  assert.equal(await page.getByRole('button', { name: 'Descargar la copia dañada' }).count(), 1);
  await shot(page, '04-integridad-comprometida');
  assert.deepEqual(errors, []);
  await context.close();
});

test('una experiencia que contradice a otra abre una contradicción y se resuelve de forma explícita', { skip }, async () => {
  const { context, page, errors } = await openLab();
  await page.getByRole('button', { name: 'Importar la inspección inicial' }).click();
  await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('importado'));

  await page.getByRole('button', { name: 'Registrar experiencia' }).click();
  const form = dialog(page);
  await form.getByLabel('Qué se observó').fill('El usuario indica que el prototipo está en su ordenador, no en GitHub');
  await form.getByLabel('Tipo de fuente').selectOption('conversación');
  await form.getByLabel('Fuente', { exact: true }).fill('Mensaje del usuario');
  await form.getByLabel(/claude:EXP-001/).check();
  await form.getByRole('button', { name: 'Registrar experiencia', exact: true }).click();
  assert.match(await form.locator('.form-error').textContent(), /Elige el tipo de relación/);
  await form.getByLabel('Relación con experiencias anteriores').selectOption('contradice');
  await submit(page, 'Registrar experiencia');

  assert.equal(await page.locator('.counts .is-alert dd').textContent(), '1');
  assert.equal(await page.locator('.hemisphere.brain-claude .edge.rel-contradice').count(), 1);
  const inspector = page.locator('#inspector');
  assert.match(await inspector.textContent(), /Esta contradice claude:EXP-001/);
  assert.match(await inspector.locator('.insp-head').textContent(), /contradicción/);

  await page.getByRole('button', { name: /claude:EXP-001 frente a claude:EXP-002/ }).click();
  assert.match(await inspector.textContent(), /Entreexperiencias/);
  assert.match(await inspector.textContent(), /Propuesta de reconciliación \(no aplicada\)/);
  await inspector.getByRole('button', { name: 'Resolver' }).click();
  const options = await dialog(page).getByLabel('Resolución').locator('option').allTextContents();
  assert.equal(options.some((option) => option.includes('sustituye')), false, 'una experiencia no se supera');
  await dialog(page).getByLabel('Resolución').selectOption('compatibles');
  await dialog(page).getByLabel('Justificación').fill('La búsqueda cubría lo accesible desde la sesión; el usuario habla de su ordenador');
  await submit(page, 'Registrar resolución');
  assert.equal(await page.locator('.counts .is-alert').count(), 0);
  assert.match(await inspector.locator('.insp-head').textContent(), /resuelta/);
  await shot(page, '07-contradiccion-entre-experiencias');
  assert.deepEqual(errors, []);
  await context.close();
});

test('móvil: sin desplazamiento horizontal y formularios dentro de la pantalla', { skip }, async () => {
  const { context, page, errors } = await openLab({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Importar la inspección inicial' }).click();
  await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('importado'));
  await page.getByRole('button', { name: /claude:EXM-001/ }).first().click();
  await noHorizontalScroll(page);
  await shot(page, '05-movil');
  await page.getByRole('button', { name: 'Registrar experiencia' }).click();
  const box = await dialog(page).boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390, `el formulario se sale de la pantalla: ${JSON.stringify(box)}`);
  await noHorizontalScroll(page);
  await shot(page, '06-movil-formulario');
  assert.deepEqual(errors, []);
  await context.close();
});
