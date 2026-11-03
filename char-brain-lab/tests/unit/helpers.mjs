import { BrainMemory } from '../../src/brain.js';

export const KYRO = Object.freeze({ kind: 'humano', id: 'kyro' });
export const REVISORA = Object.freeze({ kind: 'humano', id: 'revisora' });
export const CLAUDE = Object.freeze({ kind: 'brain', id: 'claude' });
export const CHAR = Object.freeze({ kind: 'brain', id: 'char' });

export const as = (actor) => ({ actor, session: 'sesion-de-prueba' });

/** Reloj determinista: avanza un minuto en cada lectura. */
export function makeClock(start = '2026-11-03T10:00:00.000Z') {
  let time = Date.parse(start);
  return () => {
    const iso = new Date(time).toISOString();
    time += 60_000;
    return iso;
  };
}

/** Memoria en memoria (sin almacenamiento), con reloj determinista. */
export function newMemory(brain = 'claude', creator = KYRO) {
  return BrainMemory.create(brain, as(creator), { clock: makeClock() });
}

/** Almacenamiento compatible con localStorage, en memoria. */
export class MemoryStorage {
  #data = new Map();
  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null;
  }
  setItem(key, value) {
    this.#data.set(key, String(value));
  }
  removeItem(key) {
    this.#data.delete(key);
  }
  keys() {
    return [...this.#data.keys()];
  }
}

/** Experiencia + hipótesis listas para experimentar. */
export function seedHypothesis(memory, actor = KYRO, claim = { subject: 'motor de memoria', property: 'escrituras entre Brains rechazadas', value: true }) {
  const experienceId = memory.recordExperience(
    {
      summary: `Observación sobre ${claim.subject} (${claim.property})`,
      source: { kind: 'ejecución', ref: 'npm test' },
      evidence: [{ kind: 'comando', ref: 'npm test' }],
    },
    as(actor),
  );
  const hypothesisId = memory.formulateHypothesis(
    { statement: `${claim.subject}: ${claim.property} = ${claim.value}`, claim, basedOn: [experienceId] },
    as(actor),
  );
  return { experienceId, hypothesisId };
}

export const CRITERIA = Object.freeze([
  { metric: 'escrituras_cruzadas_aceptadas', operator: '==', target: '0' },
  { metric: 'casos_probados', operator: '>=', target: '3' },
]);

/**
 * Lleva un experimento hasta resultado verificado.
 * `observer` registra el resultado; `verifier` lo verifica.
 */
export function runExperiment(memory, hypothesisId, {
  measurements = { escrituras_cruzadas_aceptadas: '0', casos_probados: '5' },
  observer = KYRO,
  verifier = REVISORA,
  outcome = 'confirmado',
  infrastructure = 'correcta',
  criteria = CRITERIA,
} = {}) {
  const experimentId = memory.proposeExperiment(
    { hypothesisId, description: 'Intentar escrituras cruzadas', mode: 'simulación', criteria },
    as(observer),
  );
  memory.recordExecution(experimentId, { infrastructure }, as(observer));
  if (infrastructure !== 'correcta') return experimentId;
  memory.recordObservation(experimentId, { measurements, evidence: [{ kind: 'registro', ref: 'salida de la prueba' }] }, as(observer));
  memory.verifyResult(
    experimentId,
    { outcome, method: 'Repetición independiente de la prueba', evidence: outcome === 'no-verificable' ? [] : [{ kind: 'registro', ref: 'segunda ejecución' }] },
    as(verifier),
  );
  return experimentId;
}

/** Comprueba que una función lanza una RuleViolation con el código indicado. */
export function code(fn) {
  try {
    fn();
  } catch (error) {
    return error.code ?? `sin-código: ${error.message}`;
  }
  return 'no-lanzó';
}
