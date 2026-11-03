import assert from 'node:assert/strict';
import { test } from 'node:test';

import { claimRelation } from '../../src/analysis.js';
import { as, CLAUDE, code, KYRO, newMemory, REVISORA, runExperiment, seedHypothesis } from './helpers.mjs';

test('relación estructural entre afirmaciones', () => {
  const base = { subject: 'Latencia', property: 'Unidad', value: 'ms', holds: true };
  assert.equal(claimRelation(base, { ...base, subject: ' latencia ' }), 'duplicado');
  assert.equal(claimRelation(base, { ...base, holds: false }), 'polaridad-opuesta');
  assert.equal(claimRelation(base, { ...base, value: 's' }), 'valores-incompatibles');
  assert.equal(claimRelation(base, { ...base, value: 's', holds: false }), null);
  assert.equal(claimRelation(base, { ...base, property: 'Otra' }), null);
});

function twoCompetingLearnings(memory) {
  const h1 = seedHypothesis(memory, KYRO, { subject: 'Caché', property: 'Tiempo de vida', value: '60 s' }).hypothesisId;
  const h2 = seedHypothesis(memory, KYRO, { subject: 'caché', property: 'tiempo de vida', value: '300 s' }).hypothesisId;
  const e1 = runExperiment(memory, h1);
  const e2 = runExperiment(memory, h2);
  const a = memory.proposeLearning({ hypothesisId: h1, stance: 'respalda', statement: 'TTL 60 s', support: [e1] }, as(KYRO));
  const b = memory.proposeLearning({ hypothesisId: h2, stance: 'respalda', statement: 'TTL 300 s', support: [e2] }, as(KYRO));
  return { h1, h2, a, b };
}

test('dos aprendizajes incompatibles abren una contradicción; ninguno sobrescribe al otro', () => {
  const memory = newMemory();
  const { a, b } = twoCompetingLearnings(memory);
  const [contradiction] = memory.openContradictions();
  assert.equal(contradiction.relation, 'valores-incompatibles');
  assert.deepEqual([contradiction.a, contradiction.b], [a, b]);
  assert.equal(memory.state.learnings[a].status, 'CANDIDATO');
  assert.equal(memory.state.learnings[b].status, 'CANDIDATO');
  assert.equal(memory.epistemicOf(memory.state.learnings[a]), 'contradicción');
  assert.equal(code(() => memory.reviewLearning(a, { decision: 'aprobar' }, as(KYRO))), 'REVISION_BLOQUEADA');
});

test('la propuesta de reconciliación no cambia nada; resolver exige un evento explícito', () => {
  const memory = newMemory();
  const { h1, a, b } = twoCompetingLearnings(memory);
  memory.addLearningSupport(a, [runExperiment(memory, h1)], as(KYRO));
  const [contradiction] = memory.openContradictions();
  const head = memory.head;
  const proposal = memory.suggestReconciliation(contradiction.id);
  assert.equal(proposal.estado, 'PROPUESTA');
  assert.equal(proposal.resolution, 'a-supera-b');
  assert.equal(memory.head, head, 'proponer no añade eventos');
  assert.equal(memory.openContradictions().length, 1);

  assert.equal(code(() => memory.resolveContradiction(contradiction.id, { resolution: 'a-supera-b', notes: '' }, as(KYRO))), 'CAMPO_REQUERIDO');
  memory.resolveContradiction(contradiction.id, { resolution: 'a-supera-b', notes: 'Más respaldo verificado' }, as(REVISORA));
  assert.equal(memory.state.learnings[b].status, 'SUPERADO');
  assert.equal(memory.state.learnings[b].supersededBy, a);
  assert.equal(memory.openContradictions().length, 0);
  assert.equal(memory.contradictions()[0].status, 'resuelta');
  memory.reviewLearning(a, { decision: 'aprobar' }, as(KYRO));
  assert.equal(memory.state.learnings[a].status, 'APRENDIDO');
  assert.equal(code(() => memory.resolveContradiction(contradiction.id, { resolution: 'compatibles', notes: 'x' }, as(KYRO))), 'CONTRADICCION_NO_ABIERTA');
});

test('resultados mixtos sobre la misma hipótesis: polaridad opuesta y evidencia en contra', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const supports = runExperiment(memory, hypothesisId);
  const weakens = runExperiment(memory, hypothesisId, { measurements: { escrituras_cruzadas_aceptadas: '1', casos_probados: '5' } });
  const pro = memory.proposeLearning({ hypothesisId, stance: 'respalda', statement: 'Se sostiene', support: [supports] }, as(KYRO));
  const contra = memory.proposeLearning({ hypothesisId, stance: 'debilita', statement: 'No se sostiene', support: [weakens] }, as(KYRO));
  assert.equal(memory.openContradictions()[0].relation, 'polaridad-opuesta');
  const checks = memory.learningChecks(pro, KYRO);
  assert.deepEqual(checks.counterEvidence, [weakens]);
  assert.equal(checks.approve.length, 2);
  memory.resolveContradiction(memory.openContradictions()[0].id, { resolution: 'descartar-b', notes: 'Fallo reproducido como error del caso de prueba' }, as(KYRO));
  assert.equal(memory.state.learnings[contra].status, 'DESCARTADO');
  assert.deepEqual(memory.learningChecks(pro, KYRO).approve, [`Hay evidencia verificada en contra: ${weakens}.`], 'la evidencia en contra sigue contando');
});

test('una contradicción con conocimiento consolidado solo la resuelve una persona', () => {
  const memory = newMemory('claude', CLAUDE);
  const h1 = seedHypothesis(memory, CLAUDE, { subject: 'Caché', property: 'TTL', value: 60 }).hypothesisId;
  const support = [runExperiment(memory, h1, { observer: CLAUDE, verifier: KYRO }), runExperiment(memory, h1, { observer: CLAUDE, verifier: KYRO })];
  const a = memory.proposeLearning({ hypothesisId: h1, stance: 'respalda', statement: 'TTL 60', support }, as(CLAUDE));
  memory.reviewLearning(a, { decision: 'aprobar' }, as(CLAUDE));
  memory.consolidateLearning(a, {}, as(KYRO));

  const h2 = seedHypothesis(memory, CLAUDE, { subject: 'Caché', property: 'TTL', value: 300 }).hypothesisId;
  memory.proposeLearning({ hypothesisId: h2, stance: 'respalda', statement: 'TTL 300', support: [runExperiment(memory, h2, { observer: CLAUDE, verifier: KYRO })] }, as(CLAUDE));
  const [contradiction] = memory.openContradictions();
  assert.equal(memory.epistemicOf(memory.state.learnings[a]), 'contradicción');
  assert.equal(code(() => memory.resolveContradiction(contradiction.id, { resolution: 'b-supera-a', notes: 'Lo nuevo manda' }, as(CLAUDE))), 'REQUIERE_HUMANO');
  assert.equal(memory.state.learnings[a].status, 'CONSOLIDADO');
});
