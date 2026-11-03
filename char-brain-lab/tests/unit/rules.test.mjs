import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildEvent } from '../../src/ledger.js';
import { applyEvent, criteriaHash } from '../../src/rules.js';
import { as, CLAUDE, code, CRITERIA, KYRO, newMemory, REVISORA, runExperiment, seedHypothesis } from './helpers.mjs';

test('un experimento sin criterios de éxito se rechaza', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  assert.equal(code(() => memory.proposeExperiment({ hypothesisId, description: 'x', mode: 'simulación', criteria: [] }, as(KYRO))), 'CRITERIOS_REQUERIDOS');
  assert.equal(
    code(() => memory.proposeExperiment({ hypothesisId, description: 'x', mode: 'simulación', criteria: [{ metric: 'm', operator: '>=', target: 'alto' }] }, as(KYRO))),
    'VALOR_NO_VALIDO',
  );
});

test('la ejecución queda ligada al hash de los criterios fijados', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const experimentId = memory.proposeExperiment({ hypothesisId, description: 'x', mode: 'simulación', criteria: CRITERIA }, as(KYRO));
  const state = structuredClone(memory.state);
  const event = buildEvent({
    previous: memory.events.at(-1),
    ledger: 'claude',
    type: 'experiment.executed',
    at: '2026-11-03T12:00:00.000Z',
    actor: KYRO,
    session: null,
    payload: { experimentId, criteriaHash: criteriaHash([{ id: 'C1', metric: 'otra', operator: '==', target: 1 }]), infrastructure: 'correcta' },
  });
  assert.equal(code(() => applyEvent(state, event)), 'CRITERIOS_HASH');
});

test('no se añaden métricas que no figuraban en los criterios', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const experimentId = memory.proposeExperiment({ hypothesisId, description: 'x', mode: 'simulación', criteria: CRITERIA }, as(KYRO));
  memory.recordExecution(experimentId, {}, as(KYRO));
  assert.equal(code(() => memory.recordObservation(experimentId, { measurements: { metrica_nueva: 1 } }, as(KYRO))), 'METRICA_NO_DECLARADA');
});

test('la falta de medición da "no-resuelta", nunca "debilitada"', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const experimentId = runExperiment(memory, hypothesisId, { measurements: { escrituras_cruzadas_aceptadas: '0' } });
  const experiment = memory.state.experiments[experimentId];
  assert.deepEqual(experiment.evaluation.map((item) => item.outcome), ['cumple', 'desconocido']);
  assert.equal(experiment.verdict, 'no-resuelta');
  assert.match(experiment.verdictReason, /no se interpreta como fallo/);
});

test('un criterio incumplido debilita la hipótesis; el aprendizaje que lo recoge la niega', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const experimentId = runExperiment(memory, hypothesisId, { measurements: { escrituras_cruzadas_aceptadas: '2', casos_probados: '5' } });
  assert.equal(memory.state.experiments[experimentId].verdict, 'debilitada');
  assert.equal(
    code(() => memory.proposeLearning({ hypothesisId, stance: 'respalda', statement: 's', support: [experimentId] }, as(KYRO))),
    'RESPALDO_NO_VALIDO',
  );
  const learningId = memory.proposeLearning({ hypothesisId, stance: 'debilita', statement: 'No se sostiene', support: [experimentId] }, as(KYRO));
  assert.equal(memory.state.learnings[learningId].claim.holds, false);
});

test('un fallo de infraestructura no debilita la hipótesis y admite un reintento controlado', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const failed = runExperiment(memory, hypothesisId, { infrastructure: 'fallida' });
  const experiment = memory.state.experiments[failed];
  assert.equal(experiment.status, 'fallo-de-infraestructura');
  assert.equal(experiment.verdict, 'no-resuelta');
  assert.match(experiment.verdictReason, /infraestructura/);
  assert.equal(code(() => memory.recordObservation(failed, { measurements: {} }, as(KYRO))), 'INFRAESTRUCTURA');

  const retry = memory.proposeExperiment({ hypothesisId, description: 'Reintento', mode: 'simulación', retryOf: failed }, as(KYRO));
  assert.equal(memory.state.experiments[retry].criteriaHash, experiment.criteriaHash);
  assert.equal(memory.state.experiments[retry].retryRoot, failed);
  assert.equal(code(() => memory.proposeExperiment({ hypothesisId, description: 'Otro', mode: 'simulación', retryOf: failed }, as(KYRO))), 'REINTENTO_NO_VALIDO');
});

test('un reintento no puede cambiar los criterios y los reintentos son limitados', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const failed = runExperiment(memory, hypothesisId, { infrastructure: 'fallida' });
  const changed = [{ id: 'C1', metric: 'casos_probados', operator: '>=', target: 1 }];
  const event = buildEvent({
    previous: memory.events.at(-1),
    ledger: 'claude',
    type: 'experiment.proposed',
    at: '2026-11-03T12:00:00.000Z',
    actor: KYRO,
    session: null,
    payload: { id: 'claude:EXM-002', hypothesisId, description: 'Reintento con criterios más fáciles', mode: 'simulación', criteria: changed, criteriaHash: criteriaHash(changed), retryOf: failed },
  });
  assert.equal(code(() => applyEvent(structuredClone(memory.state), event)), 'CRITERIOS_CAMBIADOS');

  let previous = failed;
  for (let i = 0; i < 3; i++) {
    previous = memory.proposeExperiment({ hypothesisId, description: `Reintento ${i + 1}`, mode: 'simulación', retryOf: previous }, as(KYRO));
    memory.recordExecution(previous, { infrastructure: 'fallida' }, as(KYRO));
  }
  assert.equal(code(() => memory.proposeExperiment({ hypothesisId, description: 'Cuarto', mode: 'simulación', retryOf: previous }, as(KYRO))), 'REINTENTOS_AGOTADOS');
});

test('un resultado refutado o no verificable no sirve como respaldo', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const refuted = runExperiment(memory, hypothesisId, { outcome: 'refutado' });
  const unverifiable = runExperiment(memory, hypothesisId, { outcome: 'no-verificable' });
  assert.equal(memory.state.experiments[refuted].verdict, 'no-resuelta');
  assert.equal(memory.state.experiments[unverifiable].status, 'resultado-no-verificable');
  for (const id of [refuted, unverifiable]) {
    assert.equal(code(() => memory.proposeLearning({ hypothesisId, stance: 'respalda', statement: 's', support: [id] }, as(KYRO))), 'RESPALDO_NO_VALIDO');
  }
  assert.equal(
    code(() => memory.verifyResult(runExperiment(memory, hypothesisId, { outcome: 'confirmado' }), { outcome: 'confirmado', method: 'm', evidence: [{ kind: 'otro', ref: 'r' }] }, as(KYRO))),
    'ORDEN',
  );
});

test('confirmar un resultado exige evidencia', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const experimentId = memory.proposeExperiment({ hypothesisId, description: 'x', mode: 'simulación', criteria: CRITERIA }, as(KYRO));
  memory.recordExecution(experimentId, {}, as(KYRO));
  memory.recordObservation(experimentId, { measurements: { casos_probados: 4 } }, as(KYRO));
  assert.equal(code(() => memory.verifyResult(experimentId, { outcome: 'confirmado', method: 'Lo digo yo', evidence: [] }, as(REVISORA))), 'EVIDENCIA_REQUERIDA');
});

test('la autoverificación se marca como no independiente y no basta para consolidar', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const a = runExperiment(memory, hypothesisId, { observer: KYRO, verifier: KYRO });
  const b = runExperiment(memory, hypothesisId, { observer: KYRO, verifier: KYRO });
  assert.equal(memory.state.experiments[a].verification.independent, false);
  const learningId = memory.proposeLearning({ hypothesisId, stance: 'respalda', statement: 's', support: [a, b] }, as(KYRO));
  memory.reviewLearning(learningId, { decision: 'aprobar' }, as(KYRO));
  assert.deepEqual(memory.learningChecks(learningId, KYRO).consolidate, [
    'Ningún respaldo fue verificado por alguien distinto de quien observó el resultado.',
  ]);
  const c = runExperiment(memory, hypothesisId, { observer: KYRO, verifier: REVISORA });
  memory.addLearningSupport(learningId, [c], as(KYRO));
  memory.consolidateLearning(learningId, {}, as(KYRO));
  assert.equal(memory.state.learnings[learningId].status, 'CONSOLIDADO');
});

test('un Brain no puede consolidar ni descartar conocimiento consolidado', () => {
  const memory = newMemory('claude', CLAUDE);
  const { hypothesisId } = seedHypothesis(memory, CLAUDE);
  const a = runExperiment(memory, hypothesisId, { observer: CLAUDE, verifier: KYRO });
  const b = runExperiment(memory, hypothesisId, { observer: CLAUDE, verifier: KYRO });
  const learningId = memory.proposeLearning({ hypothesisId, stance: 'respalda', statement: 's', support: [a, b] }, as(CLAUDE));
  memory.reviewLearning(learningId, { decision: 'aprobar' }, as(CLAUDE));
  assert.match(memory.learningChecks(learningId, CLAUDE).consolidate.join(' '), /solo permite consolidar a: humano/);
  memory.consolidateLearning(learningId, {}, as(KYRO));
  assert.equal(code(() => memory.discardLearning(learningId, { reason: 'ya no me gusta' }, as(CLAUDE))), 'REQUIERE_HUMANO');
  memory.discardLearning(learningId, { reason: 'Revisión humana' }, as(KYRO));
  assert.equal(memory.state.learnings[learningId].status, 'DESCARTADO');
});

test('el laboratorio no admite acciones reales', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  for (const mode of ['acción-real', 'real', 'financiero']) {
    assert.equal(code(() => memory.proposeExperiment({ hypothesisId, description: 'Transferir fondos', mode, criteria: CRITERIA }, as(KYRO))), 'ACCION_REAL_PROHIBIDA');
  }
  assert.equal(code(() => memory.proposeExperiment({ hypothesisId, description: 'x', mode: 'ejecución', criteria: CRITERIA }, as(KYRO))), 'VALOR_NO_ADMITIDO');
});

test('procedencia y estado epistemológico de las experiencias', () => {
  const memory = newMemory();
  assert.equal(code(() => memory.recordExperience({ summary: 'Sin fuente' }, as(KYRO))), 'VALOR_NO_ADMITIDO');
  assert.equal(
    code(() => memory.recordExperience({ summary: 'Hecho sin evidencia', source: { kind: 'documento', ref: 'doc' }, epistemic: 'hecho-respaldado' }, as(KYRO))),
    'EVIDENCIA_REQUERIDA',
  );
  assert.equal(
    code(() => memory.recordExperience({ summary: 'Del futuro', source: { kind: 'documento', ref: 'doc' }, observedAt: '2099-01-01T00:00:00.000Z' }, as(KYRO))),
    'FECHA_FUTURA',
  );
  assert.equal(
    code(() => memory.recordExperience({ summary: 'Consolidada por decreto', source: { kind: 'documento', ref: 'doc' }, epistemic: 'consolidado' }, as(KYRO))),
    'VALOR_NO_ADMITIDO',
  );
});

test('duplicados: experiencias, hipótesis (sin distinguir tildes ni mayúsculas) y aprendizajes', () => {
  const memory = newMemory();
  const first = memory.recordExperience({ summary: 'Prueba A', source: { kind: 'ejecución', ref: 'npm test' }, observedAt: '2026-11-03T09:00:00.000Z' }, as(KYRO));
  assert.equal(
    code(() => memory.recordExperience({ summary: '  prueba a. ', source: { kind: 'ejecución', ref: 'NPM TEST' }, observedAt: '2026-11-03T09:00:00.000Z' }, as(KYRO))),
    'DUPLICADO',
  );
  memory.formulateHypothesis({ statement: 'h', claim: { subject: 'Motor', property: 'Integridad', value: 'Alta' }, basedOn: [first] }, as(KYRO));
  assert.equal(
    code(() => memory.formulateHypothesis({ statement: 'h2', claim: { subject: 'motor', property: 'integridád', value: 'alta' }, basedOn: [first] }, as(KYRO))),
    'DUPLICADO',
  );

  const { hypothesisId } = seedHypothesis(memory);
  const a = runExperiment(memory, hypothesisId);
  const b = runExperiment(memory, hypothesisId);
  memory.proposeLearning({ hypothesisId, stance: 'respalda', statement: 's', support: [a] }, as(KYRO));
  assert.equal(code(() => memory.proposeLearning({ hypothesisId, stance: 'respalda', statement: 'otra redacción', support: [b] }, as(KYRO))), 'DUPLICADO');
});

test('una corrección conserva el valor anterior, el autor y el motivo', () => {
  const memory = newMemory();
  const id = memory.recordExperience({ summary: 'Resumen con erata', source: { kind: 'documento', ref: 'doc' } }, as(KYRO));
  assert.equal(code(() => memory.amendExperience(id, { summary: 'Sin motivo' }, '', as(KYRO))), 'CAMPO_REQUERIDO');
  memory.amendExperience(id, { summary: 'Resumen corregido', addEvidence: [{ kind: 'archivo', ref: 'doc.md' }], epistemic: 'hecho-respaldado' }, 'Erata y evidencia', as(REVISORA));
  const experience = memory.state.experiences[id];
  assert.equal(experience.summary, 'Resumen corregido');
  assert.equal(experience.epistemic, 'hecho-respaldado');
  assert.equal(experience.amendments[0].previous.summary, 'Resumen con erata');
  assert.equal(experience.amendments[0].actor.id, 'revisora');
  assert.deepEqual(memory.state.history[id].map((entry) => entry.type), ['experience.recorded', 'experience.amended']);
});
