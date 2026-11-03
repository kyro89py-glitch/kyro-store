import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';

import { buildEvent, parseLedger, serializeLedger, verifyChain } from '../../src/ledger.js';
import { canonicalize, sha256Hex } from '../../src/integrity.js';
import { applyEvent } from '../../src/rules.js';
import { as, KYRO, newMemory, seedHypothesis } from './helpers.mjs';

test('SHA-256 coincide con node:crypto (vectores conocidos y 2000 entradas aleatorias)', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const reference = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
  for (let i = 0; i < 2000; i++) {
    const text = randomBytes(i % 260).toString('base64') + (i % 5 === 0 ? 'ñ·漢🧠' : '');
    assert.equal(sha256Hex(text), reference(text));
  }
});

test('JSON canónico: el orden de las claves no cambia el resultado; rechaza números no finitos', () => {
  assert.equal(canonicalize({ b: 1, a: { d: [1, 2], c: null } }), canonicalize({ a: { c: null, d: [1, 2] }, b: 1 }));
  assert.throws(() => canonicalize({ x: Number.NaN }));
  assert.throws(() => canonicalize({ x: () => 1 }));
});

function sampleEvents() {
  const memory = newMemory();
  seedHypothesis(memory);
  return memory.events.map((event) => structuredClone(event));
}

test('una cadena intacta se verifica', () => {
  const events = sampleEvents();
  assert.equal(events.length, 3);
  assert.deepEqual(verifyChain(events, 'claude'), { ok: true, problems: [] });
});

test('alterar el contenido de un evento pasado se detecta', () => {
  const events = sampleEvents();
  events[1].payload.summary = 'Resumen reescrito en silencio';
  const result = verifyChain(events, 'claude');
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /Evento 2: el contenido no coincide con su hash/);
});

test('recalcular el hash del evento alterado rompe el enlace con el siguiente', () => {
  const events = sampleEvents();
  events[1].payload.summary = 'Resumen reescrito en silencio';
  const rebuilt = buildEvent({ previous: events[0], ...events[1] });
  events[1] = rebuilt;
  const result = verifyChain(events, 'claude');
  assert.equal(result.ok, false);
  assert.match(result.problems.join(' '), /Evento 3: no enlaza con el evento anterior/);
});

test('borrar, reordenar o atribuir un evento a otro registro se detecta', () => {
  const removed = sampleEvents();
  removed.splice(1, 1);
  assert.equal(verifyChain(removed, 'claude').ok, false);

  const reordered = sampleEvents();
  [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
  assert.equal(verifyChain(reordered, 'claude').ok, false);

  assert.equal(verifyChain(sampleEvents(), 'char').ok, false);
});

test('aplicar directamente un evento cuyo contenido no coincide con su hash se rechaza', () => {
  const memory = newMemory();
  const event = buildEvent({
    previous: memory.events.at(-1),
    ledger: 'claude',
    type: 'experience.recorded',
    at: '2026-11-03T12:00:00.000Z',
    actor: KYRO,
    session: null,
    payload: { id: 'claude:EXP-001', summary: 'original', source: { kind: 'otro', ref: 'x' }, evidence: [], observedAt: '2026-11-03T12:00:00.000Z', epistemic: 'observación' },
  });
  event.payload.summary = 'cambiado después de firmar';
  assert.throws(() => applyEvent(structuredClone(memory.state), event), { code: 'HASH' });
});

test('un registro exportado con una cabecera falsa se rechaza', () => {
  const memory = newMemory();
  seedHypothesis(memory);
  const exported = serializeLedger('claude', memory.events);
  assert.equal(parseLedger(JSON.stringify(exported)).events.length, 3);
  assert.throws(() => parseLedger({ ...exported, head: 'f'.repeat(64) }), /cabecera/);
  assert.throws(() => parseLedger({ ...exported, format: 'otro' }), /No es un registro/);
});

test('los eventos y el estado están congelados: no admiten cambios silenciosos', () => {
  const memory = newMemory();
  const { experienceId } = seedHypothesis(memory, KYRO);
  assert.throws(() => {
    memory.state.experiences[experienceId].summary = 'cambio silencioso';
  }, TypeError);
  assert.throws(() => {
    memory.events[0].payload.brain = 'char';
  }, TypeError);
  memory.recordExperience({ summary: 'Otra', source: { kind: 'otro', ref: 'x' } }, as(KYRO));
  assert.equal(memory.verify().ok, true);
});
