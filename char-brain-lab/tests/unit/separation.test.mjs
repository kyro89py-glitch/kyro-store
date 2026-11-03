import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BrainMemory } from '../../src/brain.js';
import { Lab, STORAGE_PREFIX } from '../../src/lab.js';
import { buildEvent } from '../../src/ledger.js';
import { applyEvent } from '../../src/rules.js';
import { as, CHAR, CLAUDE, code, KYRO, makeClock, MemoryStorage, newMemory, seedHypothesis } from './helpers.mjs';

test('un Brain no puede escribir en la memoria del otro', () => {
  const claude = newMemory('claude', KYRO);
  assert.equal(code(() => claude.recordExperience({ summary: 'Intrusión', source: { kind: 'otro', ref: 'x' } }, as(CHAR))), 'ESCRITURA_ENTRE_BRAINS');
  const char = newMemory('char', KYRO);
  assert.equal(code(() => char.recordExperience({ summary: 'Intrusión', source: { kind: 'otro', ref: 'x' } }, as(CLAUDE))), 'ESCRITURA_ENTRE_BRAINS');
  assert.equal(code(() => BrainMemory.create('claude', as(CHAR))), 'ESCRITURA_ENTRE_BRAINS');
});

test('un evento etiquetado con otro registro se rechaza', () => {
  const claude = newMemory('claude', KYRO);
  const event = buildEvent({
    previous: claude.events.at(-1),
    ledger: 'char',
    type: 'experience.recorded',
    at: '2026-11-03T12:00:00.000Z',
    actor: KYRO,
    session: null,
    payload: { id: 'claude:EXP-001', summary: 's', source: { kind: 'otro', ref: 'x' }, evidence: [], observedAt: '2026-11-03T12:00:00.000Z', epistemic: 'observación' },
  });
  assert.equal(code(() => applyEvent(structuredClone(claude.state), event)), 'ESCRITURA_ENTRE_BRAINS');
});

test('las referencias a registros del otro Brain se rechazan (no hay protocolo todavía)', () => {
  const claude = newMemory('claude', KYRO);
  assert.equal(
    code(() => claude.formulateHypothesis({ statement: 'h', claim: { subject: 's', property: 'p', value: 'v' }, basedOn: ['char:EXP-001'] }, as(KYRO))),
    'REFERENCIA_ENTRE_BRAINS',
  );
});

test('la identidad y la política del registro (capa base) no se redefinen', () => {
  const claude = newMemory('claude', KYRO);
  const redefine = buildEvent({
    previous: claude.events.at(-1),
    ledger: 'claude',
    type: 'ledger.created',
    at: '2026-11-03T12:00:00.000Z',
    actor: KYRO,
    session: null,
    payload: { brain: 'claude', policy: { ...claude.state.policy, consolidationBy: ['brain'] } },
  });
  assert.equal(code(() => applyEvent(structuredClone(claude.state), redefine)), 'NUCLEO_INMUTABLE');
  const core = buildEvent({ ...redefine, previous: claude.events.at(-1), type: 'core.updated' });
  assert.equal(code(() => applyEvent(structuredClone(claude.state), core)), 'TIPO_DE_EVENTO');
});

test('los identificadores llevan el Brain de origen', () => {
  const char = newMemory('char', KYRO);
  const { experienceId, hypothesisId } = seedHypothesis(char);
  assert.equal(experienceId, 'char:EXP-001');
  assert.equal(hypothesisId, 'char:HIP-001');
});

test('laboratorio: cada Brain tiene su propia clave y escribir en uno no toca el otro', () => {
  const storage = new MemoryStorage();
  const lab = new Lab({ storage, clock: makeClock() });
  lab.create('char', as(KYRO));
  lab.create('claude', as(KYRO));
  const charBefore = storage.getItem(`${STORAGE_PREFIX}char`);
  lab.run('claude', (memory) => seedHypothesis(memory));
  assert.equal(storage.getItem(`${STORAGE_PREFIX}char`), charBefore, 'el registro de Char no cambia');
  assert.deepEqual(storage.keys().sort(), [`${STORAGE_PREFIX}char`, `${STORAGE_PREFIX}claude`]);
  assert.equal(code(() => lab.create('claude', as(KYRO))), 'REGISTRO_EXISTENTE');

  const reloaded = new Lab({ storage, clock: makeClock('2026-11-04T00:00:00.000Z') }).load();
  assert.equal(reloaded.slots.claude.status, 'íntegro');
  assert.equal(reloaded.memory('claude').events.length, 3);
  assert.equal(reloaded.memory('char').events.length, 1);
});

test('laboratorio: un registro guardado y alterado queda bloqueado, no se reemplaza', () => {
  const storage = new MemoryStorage();
  const lab = new Lab({ storage, clock: makeClock() });
  lab.create('claude', as(KYRO));
  lab.run('claude', (memory) => seedHypothesis(memory));
  const key = `${STORAGE_PREFIX}claude`;
  const tampered = JSON.parse(storage.getItem(key));
  tampered.events[1].payload.summary = 'Reescrito fuera del laboratorio';
  storage.setItem(key, JSON.stringify(tampered));

  const reloaded = new Lab({ storage, clock: makeClock('2026-11-04T00:00:00.000Z') }).load();
  assert.equal(reloaded.slots.claude.status, 'comprometido');
  assert.match(reloaded.slots.claude.problems.join(' '), /Evento 2/);
  assert.equal(code(() => reloaded.run('claude', (memory) => memory)), 'REGISTRO_BLOQUEADO');
  assert.equal(code(() => reloaded.create('claude', as(KYRO))), 'REGISTRO_EXISTENTE');
  assert.equal(storage.getItem(key), JSON.stringify(tampered), 'la copia dañada se conserva para revisarla');
});

test('laboratorio: importar solo admite registros nuevos o extensiones del actual', () => {
  const source = new Lab({ storage: new MemoryStorage(), clock: makeClock() });
  source.create('char', as(KYRO));
  const early = structuredClone(source.exportLedger('char'));
  source.run('char', (memory) => seedHypothesis(memory));
  const later = structuredClone(source.exportLedger('char'));

  const target = new Lab({ storage: new MemoryStorage(), clock: makeClock('2026-11-05T00:00:00.000Z') });
  assert.deepEqual(target.importLedger(early), { brain: 'char', mode: 'nuevo', added: 1 });
  assert.equal(target.memory('claude'), null, 'importar a Char no crea ni toca a Claude');
  assert.deepEqual(target.importLedger(later), { brain: 'char', mode: 'extensión', added: 2 });
  assert.deepEqual(target.importLedger(later), { brain: 'char', mode: 'sin-cambios', added: 0 });

  const divergent = new Lab({ storage: new MemoryStorage(), clock: makeClock('2026-12-01T00:00:00.000Z') });
  divergent.create('char', as(KYRO));
  assert.equal(code(() => target.importLedger(divergent.exportLedger('char'))), 'CONFLICTO_DE_HISTORIAL');
  assert.equal(target.memory('char').events.length, 3, 'el conflicto no modifica el registro actual');

  const forged = structuredClone(later);
  forged.events[2].actor = CLAUDE;
  assert.equal(code(() => new Lab({}).importLedger(forged)), 'INTEGRIDAD');
});

test('reproducir un registro exportado da exactamente el mismo estado', () => {
  const memory = newMemory('claude', CLAUDE);
  seedHypothesis(memory, CLAUDE);
  const exported = JSON.parse(JSON.stringify(memory.export()));
  const copy = BrainMemory.fromEvents(exported.events);
  assert.deepEqual(copy.state, memory.state);
  assert.equal(copy.head, memory.head);
});
