// Memoria de un Brain: registro de eventos + estado derivado.
//
// El estado nunca se modifica directamente. Cada comando construye un evento, lo valida
// aplicándolo sobre una copia del estado y solo lo añade si cumple todas las reglas.
// El estado resultante se congela: ningún código externo puede cambiarlo en silencio.

import { parseValue } from './analysis.js';
import { deepFreeze, jsonCopy } from './integrity.js';
import { buildEvent, serializeLedger, verifyChain } from './ledger.js';
import {
  RuleViolation,
  applyEvent,
  approvalBlockers,
  consolidationBlockers,
  contradictions,
  counterEvidence,
  criteriaHash,
  emptyState,
  epistemicOf,
  nextId,
  openContradictions,
  suggestReconciliation,
} from './rules.js';
import { BRAINS, DEFAULT_POLICY, EPISTEMIC } from './vocabulary.js';

const trim = (value) => (typeof value === 'string' ? value.trim() : value);
const optionalTrim = (value) => {
  const result = trim(value);
  return result === '' ? undefined : result;
};

function cleanEvidence(list) {
  return (list ?? [])
    .filter((item) => item && trim(item.ref))
    .map((item) => ({
      kind: item.kind,
      ref: trim(item.ref),
      description: optionalTrim(item.description),
      sha256: optionalTrim(item.sha256),
    }));
}

/** Reproduce un registro completo. Lanza un error con todos los problemas de la cadena. */
export function replay(events, expectedBrain = undefined) {
  const chain = verifyChain(events, expectedBrain);
  if (!chain.ok) {
    const error = new RuleViolation('INTEGRIDAD', `La cadena de eventos no es íntegra: ${chain.problems[0]}`, {
      problems: chain.problems,
    });
    throw error;
  }
  const state = emptyState();
  for (const event of events) {
    try {
      applyEvent(state, event);
    } catch (error) {
      if (error instanceof RuleViolation) {
        throw new RuleViolation(error.code, `Evento ${event.seq} (${event.type}): ${error.message}`, {
          ...(error.details ?? {}),
          seq: event.seq,
          problems: [`Evento ${event.seq} (${event.type}): ${error.message}`],
        });
      }
      throw error;
    }
  }
  return state;
}

export class BrainMemory {
  #events = [];
  #state = deepFreeze(emptyState());
  #clock;

  constructor({ clock } = {}) {
    this.#clock = clock ?? (() => new Date().toISOString());
  }

  /** Crea un registro nuevo. El primer evento graba identidad y política (capa base). */
  static create(brain, ctx, options = {}) {
    if (!BRAINS[brain]) throw new RuleViolation('BRAIN_DESCONOCIDO', `Brain desconocido: "${brain}".`);
    const memory = new BrainMemory(options);
    memory.#append('ledger.created', { brain, policy: ctx.policy ?? DEFAULT_POLICY }, ctx, brain);
    return memory;
  }

  /** Reconstruye una memoria desde sus eventos, validándolos todos. */
  static fromEvents(events, options = {}) {
    const memory = new BrainMemory(options);
    const frozen = deepFreeze(jsonCopy(events));
    memory.#state = deepFreeze(replay(frozen, options.expectedBrain));
    memory.#events = [...frozen];
    return memory;
  }

  get brain() {
    return this.#state.brain;
  }

  get state() {
    return this.#state;
  }

  get events() {
    return this.#events.slice();
  }

  get head() {
    return this.#state.head;
  }

  export() {
    return serializeLedger(this.brain, this.#events);
  }

  verify() {
    return verifyChain(this.#events, this.brain);
  }

  #append(type, payload, ctx, ledger = this.brain) {
    if (!ctx || !ctx.actor) throw new RuleViolation('AUTOR_REQUERIDO', 'Todo evento necesita un autor.');
    const previous = this.#events.at(-1) ?? null;
    const event = buildEvent({
      previous,
      ledger,
      type,
      at: ctx.at ?? this.#clock(),
      actor: jsonCopy(ctx.actor),
      session: ctx.session ?? null,
      payload: jsonCopy(payload),
    });
    const draft = structuredClone(this.#state);
    applyEvent(draft, event);
    this.#events.push(deepFreeze(event));
    this.#state = deepFreeze(draft);
    return event;
  }

  #at(ctx) {
    return { ...ctx, at: ctx.at ?? this.#clock() };
  }

  // ----------------------------------------------------------------------------------
  // Comandos: OBSERVAR → COMPRENDER

  recordExperience({ summary, source, evidence, observedAt, epistemic = EPISTEMIC.observacion }, ctx) {
    const context = this.#at(ctx);
    const id = nextId(this.#state, 'experience');
    this.#append(
      'experience.recorded',
      {
        id,
        summary: trim(summary),
        source: { kind: source?.kind, ref: trim(source?.ref), description: optionalTrim(source?.description) },
        evidence: cleanEvidence(evidence),
        observedAt: observedAt ?? context.at,
        epistemic,
      },
      context,
    );
    return id;
  }

  amendExperience(experienceId, changes, reason, ctx) {
    const clean = {};
    if (changes.summary !== undefined) clean.summary = trim(changes.summary);
    if (changes.epistemic !== undefined) clean.epistemic = changes.epistemic;
    if (changes.addEvidence !== undefined) clean.addEvidence = cleanEvidence(changes.addEvidence);
    this.#append('experience.amended', { experienceId, changes: clean, reason: trim(reason) }, ctx);
    return experienceId;
  }

  // HIPOTETIZAR

  formulateHypothesis({ statement, claim, basedOn }, ctx) {
    const id = nextId(this.#state, 'hypothesis');
    this.#append(
      'hypothesis.formulated',
      {
        id,
        statement: trim(statement),
        claim: { subject: trim(claim?.subject), property: trim(claim?.property), value: parseValue(claim?.value) },
        basedOn,
      },
      ctx,
    );
    return id;
  }

  // PLANIFICAR: los criterios quedan fijados (con su hash) antes de cualquier ejecución.

  proposeExperiment({ hypothesisId, description, mode, criteria, retryOf = null }, ctx) {
    const id = nextId(this.#state, 'experiment');
    let fixed;
    if (retryOf) {
      const original = this.#state.experiments[retryOf];
      fixed = original ? jsonCopy(original.criteria) : [];
    } else {
      fixed = jsonCopy(
        (criteria ?? []).map((criterion, index) => ({
          id: criterion.id ?? `C${index + 1}`,
          description: optionalTrim(criterion.description),
          metric: trim(criterion.metric),
          operator: criterion.operator,
          target: parseValue(criterion.target),
        })),
      );
    }
    this.#append(
      'experiment.proposed',
      {
        id,
        hypothesisId,
        description: trim(description),
        mode,
        criteria: fixed,
        criteriaHash: criteriaHash(fixed),
        retryOf: retryOf ?? null,
      },
      ctx,
    );
    return id;
  }

  cancelExperiment(experimentId, reason, ctx) {
    this.#append('experiment.cancelled', { experimentId, reason: trim(reason) }, ctx);
    return experimentId;
  }

  // ACTUAR: el laboratorio no ejecuta; registra una ejecución realizada fuera.

  recordExecution(experimentId, { infrastructure = 'correcta', notes } = {}, ctx) {
    const experiment = this.#state.experiments[experimentId];
    this.#append(
      'experiment.executed',
      { experimentId, criteriaHash: experiment?.criteriaHash ?? null, infrastructure, notes: optionalTrim(notes) },
      ctx,
    );
    return experimentId;
  }

  // PROBAR: la comparación con los criterios es automática y determinista.

  recordObservation(experimentId, { measurements, evidence, notes } = {}, ctx) {
    const clean = {};
    for (const [metric, value] of Object.entries(measurements ?? {})) {
      const parsed = parseValue(value);
      clean[metric] = parsed === undefined ? null : parsed;
    }
    this.#append(
      'result.observed',
      { experimentId, measurements: clean, evidence: cleanEvidence(evidence), notes: optionalTrim(notes) },
      ctx,
    );
    return experimentId;
  }

  // VERIFICAR

  verifyResult(experimentId, { outcome, method, evidence } = {}, ctx) {
    this.#append('result.verified', { experimentId, outcome, method: trim(method), evidence: cleanEvidence(evidence) }, ctx);
    return experimentId;
  }

  // APRENDER

  proposeLearning({ hypothesisId, stance, statement, support }, ctx) {
    const id = nextId(this.#state, 'learning');
    this.#append('learning.proposed', { id, hypothesisId, stance, statement: trim(statement), support }, ctx);
    return id;
  }

  addLearningSupport(learningId, experimentIds, ctx) {
    this.#append('learning.support-added', { learningId, experimentIds }, ctx);
    return learningId;
  }

  // ACTUALIZAR: siempre por revisión explícita, nunca automática.

  reviewLearning(learningId, { decision, notes } = {}, ctx) {
    this.#append('learning.reviewed', { learningId, decision, notes: optionalTrim(notes) }, ctx);
    return learningId;
  }

  consolidateLearning(learningId, { notes } = {}, ctx) {
    this.#append('learning.consolidated', { learningId, notes: optionalTrim(notes) }, ctx);
    return learningId;
  }

  supersedeLearning(learningId, { by, reason } = {}, ctx) {
    this.#append('learning.superseded', { learningId, by, reason: trim(reason) }, ctx);
    return learningId;
  }

  discardLearning(learningId, { reason } = {}, ctx) {
    this.#append('learning.discarded', { learningId, reason: trim(reason) }, ctx);
    return learningId;
  }

  resolveContradiction(contradictionId, { resolution, notes } = {}, ctx) {
    const open = openContradictions(this.#state).find((item) => item.id === contradictionId);
    this.#append(
      'contradiction.resolved',
      { contradictionId, a: open?.a ?? null, b: open?.b ?? null, resolution, notes: trim(notes) },
      ctx,
    );
    return contradictionId;
  }

  // ----------------------------------------------------------------------------------
  // Consultas

  contradictions() {
    return contradictions(this.#state);
  }

  openContradictions(learningId = null) {
    return openContradictions(this.#state, learningId);
  }

  suggestReconciliation(contradictionId) {
    const item = contradictions(this.#state).find((entry) => entry.id === contradictionId);
    return item ? suggestReconciliation(this.#state, item) : null;
  }

  epistemicOf(record) {
    return epistemicOf(this.#state, record);
  }

  /** Qué falta para cada transición de un aprendizaje, según quién la intente. */
  learningChecks(learningId, actor = null) {
    const learning = this.#state.learnings[learningId];
    if (!learning) return null;
    return {
      approve: approvalBlockers(this.#state, learning, actor),
      consolidate: consolidationBlockers(this.#state, learning, actor),
      counterEvidence: counterEvidence(this.#state, learning),
      openContradictions: openContradictions(this.#state, learningId),
      support: learning.support.length,
      required: this.#state.policy.minSupportForConsolidation,
      independent: learning.support.filter((id) => this.#state.experiments[id]?.verification?.independent).length,
    };
  }
}
