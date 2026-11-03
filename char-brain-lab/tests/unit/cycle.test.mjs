import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EXPERIMENT_STATUS, LEARNING_STATUS } from '../../src/vocabulary.js';
import { as, CLAUDE, code, CRITERIA, KYRO, newMemory, REVISORA, runExperiment, seedHypothesis } from './helpers.mjs';

test('ciclo completo: cada etapa tiene su propio estado y queda en el historial', () => {
  const memory = newMemory('claude', CLAUDE);
  const { experienceId, hypothesisId } = seedHypothesis(memory, CLAUDE);

  // Experiencia registrada, con procedencia y Brain
  const experience = memory.state.experiences[experienceId];
  assert.equal(experienceId, 'claude:EXP-001');
  assert.equal(experience.recordedBy.id, 'claude');
  assert.equal(experience.source.ref, 'npm test');
  assert.equal(experience.epistemic, 'observación');

  // Hipótesis formulada, nunca presentada como hecho
  assert.equal(memory.epistemicOf(memory.state.hypotheses[hypothesisId]), 'hipótesis');

  // Experimento propuesto: criterios fijados con hash antes de ejecutar
  const experimentId = memory.proposeExperiment(
    { hypothesisId, description: 'Intentar escrituras cruzadas', mode: 'simulación', criteria: CRITERIA },
    as(CLAUDE),
  );
  const proposed = memory.state.experiments[experimentId];
  assert.equal(proposed.status, EXPERIMENT_STATUS.propuesto);
  assert.match(proposed.criteriaHash, /^[0-9a-f]{64}$/);
  assert.equal(proposed.verdict, null);

  // Experimento ejecutado
  memory.recordExecution(experimentId, { infrastructure: 'correcta' }, as(CLAUDE));
  assert.equal(memory.state.experiments[experimentId].status, EXPERIMENT_STATUS.ejecutado);

  // Resultado observado: comparación automática, pero aún sin veredicto
  memory.recordObservation(experimentId, { measurements: { escrituras_cruzadas_aceptadas: '0', casos_probados: '5' } }, as(CLAUDE));
  const observed = memory.state.experiments[experimentId];
  assert.equal(observed.status, EXPERIMENT_STATUS.observado);
  assert.deepEqual(observed.evaluation.map((item) => item.outcome), ['cumple', 'cumple']);
  assert.equal(observed.verdict, null, 'un resultado observado no es todavía evidencia verificada');

  // Resultado verificado por una persona distinta
  memory.verifyResult(experimentId, { outcome: 'confirmado', method: 'Repetición', evidence: [{ kind: 'registro', ref: 'log-2' }] }, as(REVISORA));
  const verified = memory.state.experiments[experimentId];
  assert.equal(verified.status, EXPERIMENT_STATUS.verificado);
  assert.equal(verified.verdict, 'respaldada');
  assert.equal(verified.verification.independent, true);
  assert.match(verified.verdictReason, /no la demuestra en general/);

  // Aprendizaje candidato
  const learningId = memory.proposeLearning(
    { hypothesisId, stance: 'respalda', statement: 'El motor rechaza escrituras entre Brains', support: [experimentId] },
    as(CLAUDE),
  );
  assert.equal(memory.state.learnings[learningId].status, LEARNING_STATUS.candidato);
  assert.equal(memory.epistemicOf(memory.state.learnings[learningId]), 'inferencia');

  // Revisión → APRENDIDO
  memory.reviewLearning(learningId, { decision: 'aprobar' }, as(KYRO));
  assert.equal(memory.state.learnings[learningId].status, LEARNING_STATUS.aprendido);

  // Consolidación bloqueada: un solo respaldo
  assert.deepEqual(memory.learningChecks(learningId, KYRO).consolidate, ['Respaldos verificados: 1 de 2.']);
  assert.equal(code(() => memory.consolidateLearning(learningId, {}, as(KYRO))), 'CONSOLIDACION_BLOQUEADA');

  // Segundo respaldo → consolidable, pero solo por una persona
  const second = runExperiment(memory, hypothesisId, { observer: CLAUDE, verifier: CLAUDE });
  memory.addLearningSupport(learningId, [second], as(CLAUDE));
  assert.equal(code(() => memory.consolidateLearning(learningId, {}, as(CLAUDE))), 'CONSOLIDACION_BLOQUEADA');
  memory.consolidateLearning(learningId, { notes: 'Dos respaldos, uno independiente' }, as(KYRO));
  assert.equal(memory.state.learnings[learningId].status, LEARNING_STATUS.consolidado);
  assert.equal(memory.state.learnings[learningId].layer, 'evolutiva');

  // Historial completo y trazable del aprendizaje
  const history = memory.state.history[learningId].map((entry) => entry.type);
  assert.deepEqual(history, ['learning.proposed', 'learning.reviewed', 'learning.support-added', 'learning.consolidated']);
  assert.equal(memory.verify().ok, true);
});

test('las siete etapas usan etiquetas distintas', () => {
  const memory = newMemory();
  const { experienceId, hypothesisId } = seedHypothesis(memory);
  const labels = new Set([memory.state.experiences[experienceId].kind]);
  const experimentId = memory.proposeExperiment({ hypothesisId, description: 'x', mode: 'análisis', criteria: CRITERIA }, as(KYRO));
  const statusAt = () => memory.state.experiments[experimentId].status;
  labels.add(statusAt());
  memory.recordExecution(experimentId, {}, as(KYRO));
  labels.add(statusAt());
  memory.recordObservation(experimentId, { measurements: { escrituras_cruzadas_aceptadas: 0, casos_probados: 3 } }, as(KYRO));
  labels.add(statusAt());
  memory.verifyResult(experimentId, { outcome: 'confirmado', method: 'm', evidence: [{ kind: 'otro', ref: 'r' }] }, as(REVISORA));
  labels.add(statusAt());
  const learningId = memory.proposeLearning({ hypothesisId, stance: 'respalda', statement: 's', support: [experimentId] }, as(KYRO));
  labels.add(memory.state.learnings[learningId].status);
  labels.add(LEARNING_STATUS.consolidado);
  assert.deepEqual([...labels], [
    'experiencia',
    'propuesto',
    'ejecutado',
    'resultado-observado',
    'resultado-verificado',
    'CANDIDATO',
    'CONSOLIDADO',
  ]);
});

test('el orden del ciclo es obligatorio', () => {
  const memory = newMemory();
  const { hypothesisId } = seedHypothesis(memory);
  const experimentId = memory.proposeExperiment({ hypothesisId, description: 'x', mode: 'simulación', criteria: CRITERIA }, as(KYRO));
  assert.equal(code(() => memory.recordObservation(experimentId, { measurements: {} }, as(KYRO))), 'ORDEN');
  assert.equal(code(() => memory.verifyResult(experimentId, { outcome: 'confirmado', method: 'm', evidence: [{ kind: 'otro', ref: 'r' }] }, as(KYRO))), 'ORDEN');
  memory.recordExecution(experimentId, {}, as(KYRO));
  assert.equal(code(() => memory.recordExecution(experimentId, {}, as(KYRO))), 'ORDEN');
  assert.equal(
    code(() => memory.proposeLearning({ hypothesisId, stance: 'respalda', statement: 's', support: [experimentId] }, as(KYRO))),
    'RESPALDO_NO_VALIDO',
  );
});
