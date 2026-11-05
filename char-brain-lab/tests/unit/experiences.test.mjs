import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BrainMemory } from '../../src/brain.js';
import { as, code, KYRO, newMemory, REVISORA, runExperiment, seedHypothesis } from './helpers.mjs';

const source = { kind: 'observación-directa', ref: 'panel de control' };

test('una experiencia declara su relación con experiencias anteriores, sin modificarlas', () => {
  const memory = newMemory();
  const first = memory.recordExperience({ summary: 'La caché expira a los 60 s', source }, as(KYRO));
  const before = structuredClone(memory.state.experiences[first]);
  const second = memory.recordExperience(
    { summary: 'La caché volvió a expirar a los 60 s', source, relations: [{ to: first, kind: 'confirma' }] },
    as(KYRO),
  );
  assert.deepEqual(memory.state.experiences[second].relations, [{ to: first, kind: 'confirma' }]);
  const after = memory.state.experiences[first];
  assert.equal(after.summary, before.summary);
  assert.equal(after.epistemic, before.epistemic);
  assert.deepEqual(memory.state.history[first].map((entry) => entry.type), ['experience.recorded', 'experience.recorded']);
  assert.equal(memory.openContradictions().length, 0, 'confirmar no abre contradicciones');
});

test('relaciones no válidas se rechazan: otro Brain, inexistente, repetida o tipo desconocido', () => {
  const memory = newMemory();
  const first = memory.recordExperience({ summary: 'A', source }, as(KYRO));
  const record = (relations) => code(() => memory.recordExperience({ summary: `B ${Math.random()}`, source, relations }, as(KYRO)));
  assert.equal(record([{ to: 'char:EXP-001', kind: 'confirma' }]), 'REFERENCIA_ENTRE_BRAINS');
  assert.equal(record([{ to: 'claude:EXP-099', kind: 'confirma' }]), 'NO_EXISTE');
  assert.equal(record([{ to: first, kind: 'confirma' }, { to: first, kind: 'amplía' }]), 'VALOR_NO_VALIDO');
  assert.equal(record([{ to: first, kind: 'sustituye' }]), 'VALOR_NO_ADMITIDO');
});

function disputedSetup() {
  const memory = newMemory();
  const { experienceId, hypothesisId } = seedHypothesis(memory);
  memory.amendExperience(experienceId, { epistemic: 'hecho-respaldado' }, 'Su evidencia (npm test) se revisó', as(KYRO));
  const learningId = memory.proposeLearning(
    { hypothesisId, stance: 'respalda', statement: 'Se sostiene', support: [runExperiment(memory, hypothesisId)] },
    as(KYRO),
  );
  const contradicting = memory.recordExperience(
    { summary: 'Una escritura cruzada fue aceptada', source, relations: [{ to: experienceId, kind: 'contradice' }] },
    as(REVISORA),
  );
  return { memory, experienceId, hypothesisId, learningId, contradicting };
}

test('"contradice" abre una contradicción entre experiencias; ninguna sobrescribe a la otra', () => {
  const { memory, experienceId, contradicting } = disputedSetup();
  const [contradiction] = memory.openContradictions();
  assert.equal(contradiction.kind, 'experiencias');
  assert.equal(contradiction.relation, 'declarada');
  assert.equal(contradiction.declaredBy, contradicting);
  assert.deepEqual([contradiction.a, contradiction.b], [experienceId, contradicting]);
  for (const id of [experienceId, contradicting]) {
    assert.equal(memory.epistemicOf(memory.state.experiences[id]), 'contradicción');
  }
  assert.equal(memory.state.experiences[experienceId].epistemic, 'hecho-respaldado', 'el estado registrado no cambia');
});

test('una contradicción en la base de la hipótesis bloquea aprobar y consolidar', () => {
  const { memory, experienceId, learningId } = disputedSetup();
  const checks = memory.learningChecks(learningId, KYRO);
  assert.deepEqual(checks.approve, [`La hipótesis se basa en experiencias con contradicción abierta: ${experienceId}.`]);
  assert.equal(code(() => memory.reviewLearning(learningId, { decision: 'aprobar' }, as(KYRO))), 'REVISION_BLOQUEADA');
});

test('resolver descartando conserva el historial y deja la base descartada como bloqueo', () => {
  const { memory, experienceId, learningId } = disputedSetup();
  const [contradiction] = memory.openContradictions();
  const proposal = memory.suggestReconciliation(contradiction.id);
  assert.equal(proposal.estado, 'PROPUESTA');
  assert.equal(proposal.resolution, 'descartar-b', 'el hecho con evidencia frente a una observación sin evidencia');

  assert.equal(
    code(() => memory.resolveContradiction(contradiction.id, { resolution: 'a-supera-b', notes: 'x' }, as(KYRO))),
    'RESOLUCION_NO_VALIDA',
  );
  memory.resolveContradiction(contradiction.id, { resolution: 'descartar-a', notes: 'La prueba original tenía un error' }, as(KYRO));
  const discarded = memory.state.experiences[experienceId];
  assert.equal(discarded.epistemic, 'descartado');
  assert.equal(discarded.amendments.at(-1).previous.epistemic, 'hecho-respaldado');
  assert.match(discarded.amendments.at(-1).reason, /^Resolución de CON:/);
  assert.equal(memory.openContradictions().length, 0);
  assert.equal(memory.contradictions()[0].status, 'resuelta');
  assert.deepEqual(memory.learningChecks(learningId, KYRO).approve, [`La hipótesis se basa en experiencias descartadas: ${experienceId}.`]);
  assert.equal(
    code(() => memory.resolveContradiction(contradiction.id, { resolution: 'compatibles', notes: 'x' }, as(KYRO))),
    'CONTRADICCION_NO_ABIERTA',
  );
});

test('declararlas compatibles cierra la contradicción y desbloquea la aprobación', () => {
  const { memory, learningId } = disputedSetup();
  const [contradiction] = memory.openContradictions();
  memory.resolveContradiction(contradiction.id, { resolution: 'compatibles', notes: 'Condiciones de prueba distintas' }, as(KYRO));
  assert.equal(memory.openContradictions().length, 0);
  memory.reviewLearning(learningId, { decision: 'aprobar' }, as(KYRO));
  assert.equal(memory.state.learnings[learningId].status, 'APRENDIDO');
});

test('sin una diferencia clara de evidencia, la propuesta no elige ninguna experiencia', () => {
  const memory = newMemory();
  const first = memory.recordExperience({ summary: 'Respuesta en 80 ms', source, evidence: [{ kind: 'registro', ref: 'log-a' }] }, as(KYRO));
  memory.recordExperience(
    { summary: 'Respuesta en 900 ms', source, evidence: [{ kind: 'registro', ref: 'log-b' }], relations: [{ to: first, kind: 'contradice' }] },
    as(KYRO),
  );
  const proposal = memory.suggestReconciliation(memory.openContradictions()[0].id);
  assert.equal(proposal.resolution, null);
  assert.match(proposal.nextStep, /mismas condiciones/);
});

test('base de evidencia de una hipótesis: recuentos, no una puntuación', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  runExperiment(memory, hypothesisId);
  runExperiment(memory, hypothesisId, { observer: KYRO, verifier: KYRO });
  runExperiment(memory, hypothesisId, { measurements: { escrituras_cruzadas_aceptadas: '3', casos_probados: '5' } });
  runExperiment(memory, hypothesisId, { measurements: { escrituras_cruzadas_aceptadas: '0' } });
  runExperiment(memory, hypothesisId, { infrastructure: 'fallida' });
  memory.proposeExperiment({ hypothesisId, description: 'pendiente', mode: 'análisis', criteria: [{ metric: 'm', operator: '==', target: '1' }] }, as(KYRO));
  assert.deepEqual(memory.hypothesisEvidence(hypothesisId), {
    respaldada: 2,
    debilitada: 1,
    noResuelta: 2,
    pendiente: 1,
    cancelado: 0,
    independiente: 2,
  });
});

test('los registros creados antes de existir las relaciones siguen reproduciéndose igual', async () => {
  const { readFile } = await import('node:fs/promises');
  const ledger = JSON.parse(await readFile(new URL('../../data/claude-brain.ledger.json', import.meta.url), 'utf8'));
  const memory = BrainMemory.fromEvents(ledger.events);
  assert.equal(memory.head, ledger.head);
  assert.deepEqual(memory.state.experiences['claude:EXP-001'].relations, []);
});
