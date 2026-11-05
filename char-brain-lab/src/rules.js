// Reglas de memoria: el reductor que valida y aplica cada evento.
//
// `applyEvent` es la única forma de cambiar el estado. Se usa igual para los comandos en
// vivo y para reproducir un registro importado, así que un registro que se reproduce sin
// errores cumple todas las reglas, venga de donde venga.

import {
  claimKey,
  claimRelation,
  computeVerdict,
  evaluateCriteria,
  normalizeText,
} from './analysis.js';
import { canonicalize, sha256Hex } from './integrity.js';
import { hashEvent } from './ledger.js';
import {
  ACTIVE_LEARNING,
  ACTOR_KINDS,
  BRAINS,
  EPISTEMIC,
  EVENT_TYPES,
  EVENT_VERSION,
  EVIDENCE_KINDS,
  EXPERIENCE_AMEND_EPISTEMIC,
  EXPERIENCE_EPISTEMIC,
  EXPERIENCE_RELATIONS,
  EXPERIENCE_RESOLUTIONS,
  EXPERIMENT_MODES,
  EXPERIMENT_STATUS,
  FORBIDDEN_MODES,
  ID_PREFIX,
  INFRASTRUCTURE,
  LEARNING_STATUS,
  NUMERIC_OPERATORS,
  OPERATORS,
  RESOLUTIONS,
  RETRYABLE_STATUS,
  REVIEW_DECISIONS,
  SOURCE_KINDS,
  STANCE,
  STANCE_VERDICT,
  VERDICT,
  VERIFICATION_OUTCOMES,
} from './vocabulary.js';

export class RuleViolation extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'RuleViolation';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new RuleViolation(code, message, details);
}

// ---------------------------------------------------------------------------------------
// Estado

export function emptyState() {
  return {
    brain: null,
    policy: null,
    createdAt: null,
    createdBy: null,
    seq: 0,
    head: null,
    lastAt: null,
    counters: { experience: 0, hypothesis: 0, experiment: 0, learning: 0 },
    experiences: {},
    hypotheses: {},
    experiments: {},
    learnings: {},
    resolutions: {},
    history: {},
  };
}

export function nextId(state, kind) {
  return `${state.brain}:${ID_PREFIX[kind]}-${String(state.counters[kind] + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------------------
// Validadores

function text(value, field, { max = 4000, optional = false } = {}) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (optional) return null;
    fail('CAMPO_REQUERIDO', `Falta ${field}.`);
  }
  if (typeof value !== 'string') fail('TIPO_NO_VALIDO', `${field} debe ser texto.`);
  if (value.length > max) fail('LONGITUD', `${field} supera ${max} caracteres.`);
  return value;
}

function oneOf(value, list, field) {
  if (!list.includes(value)) {
    fail('VALOR_NO_ADMITIDO', `${field}: "${value}" no es un valor admitido (${list.join(', ')}).`);
  }
  return value;
}

function isoDate(value, field) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail('FECHA_NO_VALIDA', `${field} no es una fecha válida.`);
  return value;
}

function scalar(value, field) {
  const ok =
    (typeof value === 'string' && value.trim() !== '') ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'boolean';
  if (!ok) fail('VALOR_NO_VALIDO', `${field} debe ser un texto no vacío, un número o un booleano.`);
  return value;
}

function evidenceList(list, field, { min = 0 } = {}) {
  if (list === undefined || list === null) list = [];
  if (!Array.isArray(list)) fail('TIPO_NO_VALIDO', `${field} debe ser una lista.`);
  if (list.length < min) {
    fail('EVIDENCIA_REQUERIDA', `${field}: se necesita al menos ${min} evidencia${min === 1 ? '' : 's'}.`);
  }
  if (list.length > 50) fail('LONGITUD', `${field}: máximo 50 evidencias por evento.`);
  for (const item of list) {
    if (!item || typeof item !== 'object') fail('TIPO_NO_VALIDO', `${field}: cada evidencia debe ser un objeto.`);
    oneOf(item.kind, EVIDENCE_KINDS, 'Tipo de evidencia');
    text(item.ref, 'la referencia de la evidencia', { max: 2000 });
    text(item.description, 'la descripción de la evidencia', { optional: true });
    if (item.sha256 !== undefined && item.sha256 !== null && !/^[0-9a-f]{64}$/.test(item.sha256)) {
      fail('VALOR_NO_VALIDO', 'El hash de una evidencia debe ser SHA-256 en hexadecimal.');
    }
  }
  return list;
}

function idList(list, field, { min = 1 } = {}) {
  if (!Array.isArray(list) || list.length < min) fail('CAMPO_REQUERIDO', `${field}: se necesita al menos ${min}.`);
  if (new Set(list).size !== list.length) fail('VALOR_NO_VALIDO', `${field}: hay identificadores repetidos.`);
  return list;
}

/** Las referencias apuntan siempre al registro propio. Cruzar Brains requiere un protocolo. */
function ownRef(state, id, field) {
  if (typeof id !== 'string' || id === '') fail('CAMPO_REQUERIDO', `Falta ${field}.`);
  if (!id.startsWith(`${state.brain}:`)) {
    fail(
      'REFERENCIA_ENTRE_BRAINS',
      `${field} "${id}" no pertenece a la memoria de ${BRAINS[state.brain].name}. Las referencias entre Brains requieren el protocolo de coordinación, que aún no existe.`,
    );
  }
  return id;
}

function getRecord(state, collection, id, field) {
  ownRef(state, id, field);
  const record = state[collection][id];
  if (!record) fail('NO_EXISTE', `${field} "${id}" no existe.`);
  return record;
}

function checkActor(actor, ledgerBrain) {
  if (!actor || typeof actor !== 'object') fail('AUTOR_REQUERIDO', 'Todo evento necesita un autor.');
  oneOf(actor.kind, ACTOR_KINDS, 'Tipo de autor');
  text(actor.id, 'el identificador del autor', { max: 120 });
  if (actor.kind === 'brain') {
    if (!BRAINS[actor.id]) fail('AUTOR_DESCONOCIDO', `Brain desconocido: "${actor.id}".`);
    if (actor.id !== ledgerBrain) {
      fail(
        'ESCRITURA_ENTRE_BRAINS',
        `${BRAINS[actor.id].name} no puede escribir en la memoria de ${BRAINS[ledgerBrain]?.name ?? ledgerBrain}.`,
      );
    }
  }
}

function sameActor(a, b) {
  return Boolean(a && b && a.kind === b.kind && a.id === b.id);
}

function checkPolicy(policy) {
  if (!policy || typeof policy !== 'object') fail('POLITICA', 'Falta la política del registro.');
  const positiveInt = (value, field) => {
    if (!Number.isInteger(value) || value < 1 || value > 100) fail('POLITICA', `${field} debe ser un entero entre 1 y 100.`);
  };
  positiveInt(policy.minSupportForConsolidation, 'minSupportForConsolidation');
  positiveInt(policy.maxRetries, 'maxRetries');
  if (typeof policy.requireIndependentVerification !== 'boolean') fail('POLITICA', 'requireIndependentVerification debe ser booleano.');
  for (const field of ['consolidationBy', 'approvalBy']) {
    const list = policy[field];
    if (!Array.isArray(list) || list.length === 0 || !list.every((kind) => ACTOR_KINDS.includes(kind))) {
      fail('POLITICA', `${field} debe ser una lista de tipos de autor (${ACTOR_KINDS.join(', ')}).`);
    }
  }
}

function checkCriteria(criteria) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    fail('CRITERIOS_REQUERIDOS', 'Un experimento necesita criterios de éxito definidos antes de ejecutarse.');
  }
  if (criteria.length > 20) fail('LONGITUD', 'Máximo 20 criterios por experimento.');
  const ids = new Set();
  for (const criterion of criteria) {
    if (!criterion || typeof criterion !== 'object') fail('TIPO_NO_VALIDO', 'Cada criterio debe ser un objeto.');
    if (typeof criterion.id !== 'string' || !/^C\d{1,2}$/.test(criterion.id)) fail('VALOR_NO_VALIDO', 'El identificador de un criterio debe tener la forma C1, C2…');
    if (ids.has(criterion.id)) fail('VALOR_NO_VALIDO', `Criterio repetido: ${criterion.id}.`);
    ids.add(criterion.id);
    text(criterion.metric, `la métrica de ${criterion.id}`, { max: 120 });
    text(criterion.description, `la descripción de ${criterion.id}`, { optional: true, max: 500 });
    oneOf(criterion.operator, OPERATORS, `Operador de ${criterion.id}`);
    if (NUMERIC_OPERATORS.includes(criterion.operator)) {
      if (typeof criterion.target !== 'number' || !Number.isFinite(criterion.target)) {
        fail('VALOR_NO_VALIDO', `${criterion.id}: el operador ${criterion.operator} necesita un objetivo numérico.`);
      }
    } else {
      scalar(criterion.target, `El objetivo de ${criterion.id}`);
    }
  }
}

export function criteriaHash(criteria) {
  return sha256Hex(canonicalize(criteria));
}

// ---------------------------------------------------------------------------------------
// Consultas derivadas (también las usa la interfaz)

function contradictionId(a, b) {
  return `CON:${[a, b].sort().join('|')}`;
}

/**
 * Contradicciones abiertas y resueltas:
 * - entre aprendizajes activos, detectadas por su afirmación estructurada;
 * - entre experiencias, declaradas al registrar la más reciente ("contradice").
 */
export function contradictions(state) {
  const list = [];
  const active = Object.values(state.learnings).filter((learning) => ACTIVE_LEARNING.includes(learning.status));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const relation = claimRelation(active[i].claim, active[j].claim);
      if (!relation || relation === 'duplicado') continue;
      const [a, b] = [active[i].id, active[j].id].sort();
      const id = contradictionId(a, b);
      const resolution = state.resolutions[id] ?? null;
      list.push({ id, a, b, kind: 'aprendizajes', relation, status: resolution ? 'resuelta' : 'abierta', resolution });
    }
  }
  for (const experience of Object.values(state.experiences)) {
    for (const link of experience.relations ?? []) {
      if (link.kind !== 'contradice') continue;
      const other = state.experiences[link.to];
      const [a, b] = [experience.id, link.to].sort();
      const id = contradictionId(a, b);
      if (list.some((item) => item.id === id)) continue;
      const resolution = state.resolutions[id] ?? null;
      const bothStand = experience.epistemic !== EPISTEMIC.descartado && other.epistemic !== EPISTEMIC.descartado;
      if (!resolution && !bothStand) continue;
      list.push({ id, a, b, kind: 'experiencias', relation: 'declarada', declaredBy: experience.id, status: resolution ? 'resuelta' : 'abierta', resolution });
    }
  }
  for (const resolution of Object.values(state.resolutions)) {
    if (!list.some((item) => item.id === resolution.id)) {
      list.push({ id: resolution.id, a: resolution.a, b: resolution.b, kind: resolution.kind, relation: resolution.relation, status: 'resuelta', resolution });
    }
  }
  return list;
}

export function openContradictions(state, learningId = null) {
  return contradictions(state).filter(
    (item) => item.status === 'abierta' && (!learningId || item.a === learningId || item.b === learningId),
  );
}

/** Experimentos verificados de la misma hipótesis con el veredicto contrario a la postura. */
export function counterEvidence(state, learning) {
  const opposite = learning.stance === STANCE.respalda ? VERDICT.debilitada : VERDICT.respaldada;
  return Object.values(state.experiments)
    .filter((experiment) => experiment.hypothesisId === learning.hypothesisId && experiment.verdict === opposite)
    .map((experiment) => experiment.id);
}

/** Experiencias de base que ya no sostienen la hipótesis: descartadas o en contradicción abierta. */
function baseProblems(state, learning) {
  const problems = [];
  const basedOn = state.hypotheses[learning.hypothesisId]?.basedOn ?? [];
  const discarded = basedOn.filter((id) => state.experiences[id]?.epistemic === EPISTEMIC.descartado);
  const disputed = basedOn.filter((id) => state.experiences[id]?.epistemic !== EPISTEMIC.descartado && openContradictions(state, id).length);
  if (discarded.length) problems.push(`La hipótesis se basa en experiencias descartadas: ${discarded.join(', ')}.`);
  if (disputed.length) problems.push(`La hipótesis se basa en experiencias con contradicción abierta: ${disputed.join(', ')}.`);
  return problems;
}

/** Base de evidencia de una hipótesis. No es una puntuación: son los recuentos de los que se derivaría. */
export function hypothesisEvidence(state, hypothesisId) {
  const experiments = Object.values(state.experiments).filter((experiment) => experiment.hypothesisId === hypothesisId);
  const decided = experiments.filter((experiment) => [VERDICT.respaldada, VERDICT.debilitada].includes(experiment.verdict));
  return {
    respaldada: experiments.filter((experiment) => experiment.verdict === VERDICT.respaldada).length,
    debilitada: experiments.filter((experiment) => experiment.verdict === VERDICT.debilitada).length,
    noResuelta: experiments.filter((experiment) => experiment.verdict === VERDICT.noResuelta).length,
    pendiente: experiments.filter((experiment) => experiment.verdict === null && experiment.status !== EXPERIMENT_STATUS.cancelado).length,
    cancelado: experiments.filter((experiment) => experiment.status === EXPERIMENT_STATUS.cancelado).length,
    independiente: decided.filter((experiment) => experiment.verification?.independent).length,
  };
}

export function approvalBlockers(state, learning, actor = null) {
  const blockers = [];
  if (learning.status !== LEARNING_STATUS.candidato) {
    blockers.push(`Está en ${learning.status}: solo se aprueba un aprendizaje CANDIDATO.`);
  }
  if (actor && !state.policy.approvalBy.includes(actor.kind)) {
    blockers.push(`La política solo permite aprobar a: ${state.policy.approvalBy.join(', ')}.`);
  }
  const open = openContradictions(state, learning.id);
  if (open.length) {
    blockers.push(`Contradicción abierta con ${open.map((item) => (item.a === learning.id ? item.b : item.a)).join(', ')}.`);
  }
  const counter = counterEvidence(state, learning);
  if (counter.length) blockers.push(`Hay evidencia verificada en contra: ${counter.join(', ')}.`);
  blockers.push(...baseProblems(state, learning));
  return blockers;
}

export function consolidationBlockers(state, learning, actor = null) {
  const blockers = [];
  const policy = state.policy;
  if (learning.status !== LEARNING_STATUS.aprendido) {
    blockers.push(`Está en ${learning.status}: solo se consolida un aprendizaje APRENDIDO.`);
  }
  if (actor && !policy.consolidationBy.includes(actor.kind)) {
    blockers.push(`La política solo permite consolidar a: ${policy.consolidationBy.join(', ')}.`);
  }
  if (learning.support.length < policy.minSupportForConsolidation) {
    blockers.push(`Respaldos verificados: ${learning.support.length} de ${policy.minSupportForConsolidation}.`);
  }
  if (policy.requireIndependentVerification && !learning.support.some((id) => state.experiments[id]?.verification?.independent)) {
    blockers.push('Ningún respaldo fue verificado por alguien distinto de quien observó el resultado.');
  }
  const open = openContradictions(state, learning.id);
  if (open.length) {
    blockers.push(`Contradicción abierta con ${open.map((item) => (item.a === learning.id ? item.b : item.a)).join(', ')}.`);
  }
  const counter = counterEvidence(state, learning);
  if (counter.length) blockers.push(`Hay evidencia verificada en contra: ${counter.join(', ')}.`);
  blockers.push(...baseProblems(state, learning));
  return blockers;
}

/** Estado epistemológico que se muestra para un registro. */
export function epistemicOf(state, record) {
  switch (record.kind) {
    case 'experiencia':
      if (record.epistemic !== EPISTEMIC.descartado && openContradictions(state, record.id).length) {
        return EPISTEMIC.contradiccion;
      }
      return record.epistemic;
    case 'hipotesis':
      return EPISTEMIC.hipotesis;
    case 'experimento':
      switch (record.status) {
        case EXPERIMENT_STATUS.observado:
          return EPISTEMIC.observacion;
        case EXPERIMENT_STATUS.verificado:
          return EPISTEMIC.hecho;
        case EXPERIMENT_STATUS.refutado:
        case EXPERIMENT_STATUS.cancelado:
          return EPISTEMIC.descartado;
        case EXPERIMENT_STATUS.falloInfra:
          return EPISTEMIC.desconocido;
        default:
          return EPISTEMIC.pendiente;
      }
    case 'aprendizaje':
      if (ACTIVE_LEARNING.includes(record.status) && openContradictions(state, record.id).length) {
        return EPISTEMIC.contradiccion;
      }
      return {
        [LEARNING_STATUS.candidato]: EPISTEMIC.inferencia,
        [LEARNING_STATUS.aprendido]: EPISTEMIC.aprendido,
        [LEARNING_STATUS.consolidado]: EPISTEMIC.consolidado,
        [LEARNING_STATUS.superado]: EPISTEMIC.superado,
        [LEARNING_STATUS.descartado]: EPISTEMIC.descartado,
      }[record.status];
    default:
      return EPISTEMIC.desconocido;
  }
}

/**
 * Propuesta de reconciliación para una contradicción. Es solo una PROPUESTA: no cambia
 * nada. Aplicarla exige un evento `contradiction.resolved` con autor y motivo.
 */
export function suggestReconciliation(state, contradiction) {
  if (contradiction.kind === 'experiencias') {
    const a = state.experiences[contradiction.a];
    const b = state.experiences[contradiction.b];
    const describe = (experience) => `${experience.id}: ${experience.epistemic}, ${experience.evidence.length} evidencia(s)`;
    const strong = (experience) => experience.epistemic === EPISTEMIC.hecho && experience.evidence.length > 0;
    const bare = (experience) => experience.evidence.length === 0;
    let resolution = null;
    if (strong(a) && bare(b)) resolution = 'descartar-b';
    if (strong(b) && bare(a)) resolution = 'descartar-a';
    return {
      estado: 'PROPUESTA',
      resolution,
      rationale: `${describe(a)} · ${describe(b)}.`,
      nextStep: resolution
        ? 'Una está respaldada por evidencia y la otra no tiene ninguna. Revisar la que no la tiene antes de descartarla.'
        : 'Comprobar si se observaron en las mismas condiciones: si no, pueden ser compatibles; si sí, buscar evidencia que las distinga.',
    };
  }
  const a = state.learnings[contradiction.a];
  const b = state.learnings[contradiction.b];
  const score = (learning) => ({
    support: learning.support.length,
    independent: learning.support.filter((id) => state.experiments[id]?.verification?.independent).length,
    counter: counterEvidence(state, learning).length,
  });
  const sa = score(a);
  const sb = score(b);
  const describe = (id, s) => `${id}: ${s.support} respaldo(s), ${s.independent} independiente(s), ${s.counter} en contra`;
  const rationale = `${describe(a.id, sa)} · ${describe(b.id, sb)}.`;
  const net = (s) => s.support + s.independent - s.counter;
  let resolution = null;
  let nextStep;
  if (net(sa) > net(sb)) {
    resolution = 'a-supera-b';
    nextStep = `${a.id} tiene más respaldo verificado. Revisar si ${b.id} debe quedar superado.`;
  } else if (net(sb) > net(sa)) {
    resolution = 'b-supera-a';
    nextStep = `${b.id} tiene más respaldo verificado. Revisar si ${a.id} debe quedar superado.`;
  } else {
    nextStep = 'Respaldo equivalente: diseñar un experimento que distinga ambas afirmaciones.';
  }
  if (contradiction.relation === 'valores-incompatibles') {
    nextStep += ' Si la propiedad admite varios valores, pueden ser compatibles.';
  }
  return { estado: 'PROPUESTA', resolution, rationale, nextStep };
}

// ---------------------------------------------------------------------------------------
// Aplicación de eventos

function touch(state, ids, event) {
  const entry = { seq: event.seq, type: event.type, at: event.at, actor: event.actor };
  for (const id of new Set(ids.filter(Boolean))) {
    (state.history[id] ??= []).push(entry);
  }
}

function supportCheck(state, hypothesisId, stance, experimentId) {
  const experiment = getRecord(state, 'experiments', experimentId, 'Experimento de respaldo');
  if (experiment.hypothesisId !== hypothesisId) {
    fail('RESPALDO_NO_VALIDO', `${experimentId} pone a prueba otra hipótesis (${experiment.hypothesisId}).`);
  }
  if (experiment.status !== EXPERIMENT_STATUS.verificado) {
    fail('RESPALDO_NO_VALIDO', `${experimentId} está en "${experiment.status}": solo cuenta un resultado verificado.`);
  }
  const expected = STANCE_VERDICT[stance];
  if (experiment.verdict !== expected) {
    fail(
      'RESPALDO_NO_VALIDO',
      `${experimentId} tiene veredicto "${experiment.verdict}"; un aprendizaje que "${stance}" la hipótesis necesita veredicto "${expected}".`,
    );
  }
}

function setLearningStatus(learning, status, event, extra = {}) {
  learning.status = status;
  learning.statusChanges.push({ status, seq: event.seq, at: event.at, actor: event.actor, ...extra });
}

function requireHumanForConsolidated(learnings, actor, action) {
  if (learnings.some((learning) => learning.status === LEARNING_STATUS.consolidado) && actor.kind !== 'humano') {
    fail('REQUIERE_HUMANO', `${action} un aprendizaje CONSOLIDADO requiere una persona.`);
  }
}

const HANDLERS = {
  'ledger.created'(state, event) {
    const { brain, policy } = event.payload;
    if (!BRAINS[brain]) fail('BRAIN_DESCONOCIDO', `Brain desconocido: "${brain}".`);
    if (event.ledger !== brain) fail('IDENTIDAD', 'El registro declarado no coincide con el Brain que se crea.');
    checkPolicy(policy);
    state.brain = brain;
    state.policy = policy;
    state.createdAt = event.at;
    state.createdBy = event.actor;
  },

  'experience.recorded'(state, event) {
    const p = event.payload;
    if (p.id !== nextId(state, 'experience')) fail('IDENTIFICADOR', `Se esperaba el identificador ${nextId(state, 'experience')}.`);
    text(p.summary, 'el resumen de la experiencia');
    if (!p.source || typeof p.source !== 'object') fail('PROCEDENCIA_REQUERIDA', 'Toda experiencia necesita su procedencia.');
    oneOf(p.source.kind, SOURCE_KINDS, 'Tipo de fuente');
    text(p.source.ref, 'la referencia de la fuente', { max: 2000 });
    text(p.source.description, 'la descripción de la fuente', { optional: true });
    evidenceList(p.evidence, 'Evidencia');
    isoDate(p.observedAt, 'La fecha de observación');
    if (Date.parse(p.observedAt) > Date.parse(event.at)) fail('FECHA_FUTURA', 'La fecha de observación es posterior al registro.');
    oneOf(p.epistemic, EXPERIENCE_EPISTEMIC, 'Estado epistemológico');
    if (p.epistemic === EPISTEMIC.hecho && (p.evidence ?? []).length === 0) {
      fail('EVIDENCIA_REQUERIDA', 'Un hecho respaldado necesita al menos una evidencia.');
    }
    const relations = p.relations ?? [];
    if (!Array.isArray(relations) || relations.length > 20) fail('TIPO_NO_VALIDO', 'Las relaciones deben ser una lista (máximo 20).');
    const related = new Set();
    for (const link of relations) {
      if (!link || typeof link !== 'object') fail('TIPO_NO_VALIDO', 'Cada relación debe ser un objeto.');
      oneOf(link.kind, EXPERIENCE_RELATIONS, 'Tipo de relación');
      getRecord(state, 'experiences', link.to, 'Experiencia relacionada');
      if (related.has(link.to)) fail('VALOR_NO_VALIDO', `${link.to} aparece dos veces en las relaciones.`);
      related.add(link.to);
    }
    const duplicate = Object.values(state.experiences).find(
      (experience) =>
        normalizeText(experience.summary) === normalizeText(p.summary) &&
        normalizeText(experience.source.ref) === normalizeText(p.source.ref) &&
        experience.observedAt === p.observedAt,
    );
    if (duplicate) fail('DUPLICADO', `Esta experiencia ya está registrada como ${duplicate.id}.`, { existing: duplicate.id });

    state.counters.experience += 1;
    state.experiences[p.id] = {
      id: p.id,
      kind: 'experiencia',
      layer: 'experiencia',
      summary: p.summary,
      source: p.source,
      evidence: p.evidence ?? [],
      observedAt: p.observedAt,
      epistemic: p.epistemic,
      recordedAt: event.at,
      recordedBy: event.actor,
      session: event.session,
      relations,
      amendments: [],
    };
    touch(state, [p.id, ...relations.map((link) => link.to)], event);
  },

  'experience.amended'(state, event) {
    const p = event.payload;
    const experience = getRecord(state, 'experiences', p.experienceId, 'Experiencia');
    text(p.reason, 'el motivo de la corrección');
    const changes = p.changes ?? {};
    const keys = Object.keys(changes);
    if (keys.length === 0) fail('SIN_CAMBIOS', 'La corrección no cambia nada.');
    for (const key of keys) {
      if (!['summary', 'epistemic', 'addEvidence'].includes(key)) fail('CAMPO_NO_CORREGIBLE', `"${key}" no se puede corregir.`);
    }
    if ('summary' in changes) text(changes.summary, 'el nuevo resumen');
    if ('epistemic' in changes) oneOf(changes.epistemic, EXPERIENCE_AMEND_EPISTEMIC, 'Estado epistemológico');
    if ('addEvidence' in changes) evidenceList(changes.addEvidence, 'Evidencia añadida', { min: 1 });
    const evidence = [...experience.evidence, ...(changes.addEvidence ?? [])];
    const epistemic = changes.epistemic ?? experience.epistemic;
    if (epistemic === EPISTEMIC.hecho && evidence.length === 0) {
      fail('EVIDENCIA_REQUERIDA', 'Un hecho respaldado necesita al menos una evidencia.');
    }
    experience.amendments.push({
      seq: event.seq,
      at: event.at,
      actor: event.actor,
      reason: p.reason,
      changes,
      previous: { summary: experience.summary, epistemic: experience.epistemic, evidenceCount: experience.evidence.length },
    });
    if ('summary' in changes) experience.summary = changes.summary;
    experience.epistemic = epistemic;
    experience.evidence = evidence;
    touch(state, [experience.id], event);
  },

  'hypothesis.formulated'(state, event) {
    const p = event.payload;
    if (p.id !== nextId(state, 'hypothesis')) fail('IDENTIFICADOR', `Se esperaba el identificador ${nextId(state, 'hypothesis')}.`);
    text(p.statement, 'el enunciado de la hipótesis');
    if (!p.claim || typeof p.claim !== 'object') fail('AFIRMACION_REQUERIDA', 'La hipótesis necesita una afirmación estructurada (sujeto, propiedad, valor).');
    text(p.claim.subject, 'el sujeto de la afirmación', { max: 300 });
    text(p.claim.property, 'la propiedad de la afirmación', { max: 300 });
    scalar(p.claim.value, 'El valor de la afirmación');
    if (p.claim.holds !== undefined && p.claim.holds !== true) fail('VALOR_NO_VALIDO', 'Una hipótesis afirma; para negar, formula la afirmación contraria.');
    idList(p.basedOn, 'Experiencias de base');
    for (const id of p.basedOn) {
      const experience = getRecord(state, 'experiences', id, 'Experiencia de base');
      if (experience.epistemic === EPISTEMIC.descartado) fail('BASE_DESCARTADA', `${id} está descartada y no puede sostener una hipótesis.`);
    }
    const claim = { subject: p.claim.subject, property: p.claim.property, value: p.claim.value, holds: true };
    const duplicate = Object.values(state.hypotheses).find((hypothesis) => claimKey(hypothesis.claim) === claimKey(claim));
    if (duplicate) {
      fail('DUPLICADO', `Ya existe la hipótesis ${duplicate.id} con la misma afirmación. Añade experimentos a esa hipótesis.`, { existing: duplicate.id });
    }

    state.counters.hypothesis += 1;
    state.hypotheses[p.id] = {
      id: p.id,
      kind: 'hipotesis',
      layer: 'operacional',
      statement: p.statement,
      claim,
      basedOn: p.basedOn,
      formulatedAt: event.at,
      formulatedBy: event.actor,
      session: event.session,
      experimentIds: [],
    };
    touch(state, [p.id, ...p.basedOn], event);
  },

  'experiment.proposed'(state, event) {
    const p = event.payload;
    if (p.id !== nextId(state, 'experiment')) fail('IDENTIFICADOR', `Se esperaba el identificador ${nextId(state, 'experiment')}.`);
    const hypothesis = getRecord(state, 'hypotheses', p.hypothesisId, 'Hipótesis');
    text(p.description, 'la descripción del experimento');
    if (typeof p.mode === 'string' && FORBIDDEN_MODES.includes(normalizeText(p.mode))) {
      fail(
        'ACCION_REAL_PROHIBIDA',
        'El laboratorio no ejecuta acciones reales. Cualquier acción real, incluidas las financieras, requiere autorización humana explícita y un diseño de seguridad que no existe en esta versión.',
      );
    }
    oneOf(p.mode, EXPERIMENT_MODES, 'Modo del experimento');
    checkCriteria(p.criteria);
    if (p.criteriaHash !== criteriaHash(p.criteria)) fail('CRITERIOS_HASH', 'El hash declarado no corresponde a los criterios.');

    let retryRoot = null;
    if (p.retryOf !== null && p.retryOf !== undefined) {
      const original = getRecord(state, 'experiments', p.retryOf, 'Experimento reintentado');
      if (original.hypothesisId !== p.hypothesisId) fail('REINTENTO_NO_VALIDO', 'Un reintento debe poner a prueba la misma hipótesis.');
      if (!RETRYABLE_STATUS.includes(original.status)) {
        fail('REINTENTO_NO_VALIDO', `${original.id} está en "${original.status}": solo se reintenta tras fallo de infraestructura, cancelación o resultado no válido.`);
      }
      if (original.criteriaHash !== p.criteriaHash) {
        fail('CRITERIOS_CAMBIADOS', 'Un reintento usa exactamente los mismos criterios. Para cambiarlos, propón un experimento nuevo.');
      }
      if (Object.values(state.experiments).some((experiment) => experiment.retryOf === original.id)) {
        fail('REINTENTO_NO_VALIDO', `${original.id} ya tiene un reintento.`);
      }
      retryRoot = original.retryRoot ?? original.id;
      const used = Object.values(state.experiments).filter((experiment) => experiment.retryRoot === retryRoot).length;
      if (used >= state.policy.maxRetries) fail('REINTENTOS_AGOTADOS', `Se agotaron los ${state.policy.maxRetries} reintentos de ${retryRoot}.`);
    }

    state.counters.experiment += 1;
    state.experiments[p.id] = {
      id: p.id,
      kind: 'experimento',
      layer: 'operacional',
      hypothesisId: p.hypothesisId,
      description: p.description,
      mode: p.mode,
      criteria: p.criteria,
      criteriaHash: p.criteriaHash,
      criteriaFixedAt: event.at,
      retryOf: p.retryOf ?? null,
      retryRoot,
      status: EXPERIMENT_STATUS.propuesto,
      proposedAt: event.at,
      proposedBy: event.actor,
      session: event.session,
      execution: null,
      observation: null,
      evaluation: null,
      verification: null,
      cancellation: null,
      verdict: null,
      verdictReason: null,
    };
    hypothesis.experimentIds.push(p.id);
    touch(state, [p.id, p.hypothesisId, p.retryOf], event);
  },

  'experiment.cancelled'(state, event) {
    const p = event.payload;
    const experiment = getRecord(state, 'experiments', p.experimentId, 'Experimento');
    const cancellable = [EXPERIMENT_STATUS.propuesto, EXPERIMENT_STATUS.ejecutado, EXPERIMENT_STATUS.observado];
    if (!cancellable.includes(experiment.status)) fail('ORDEN', `No se puede cancelar un experimento en "${experiment.status}".`);
    text(p.reason, 'el motivo de la cancelación');
    experiment.status = EXPERIMENT_STATUS.cancelado;
    experiment.cancellation = { at: event.at, actor: event.actor, reason: p.reason };
    Object.assign(experiment, verdictFields(experiment));
    touch(state, [experiment.id], event);
  },

  'experiment.executed'(state, event) {
    const p = event.payload;
    const experiment = getRecord(state, 'experiments', p.experimentId, 'Experimento');
    if (experiment.status !== EXPERIMENT_STATUS.propuesto) {
      fail('ORDEN', `Solo se registra la ejecución de un experimento propuesto (estado actual: "${experiment.status}").`);
    }
    if (p.criteriaHash !== experiment.criteriaHash) fail('CRITERIOS_HASH', 'La ejecución no corresponde a los criterios fijados para este experimento.');
    oneOf(p.infrastructure, INFRASTRUCTURE, 'Estado de la infraestructura');
    text(p.notes, 'las notas de la ejecución', { optional: true });
    experiment.execution = { at: event.at, actor: event.actor, infrastructure: p.infrastructure, notes: p.notes ?? null };
    experiment.status = p.infrastructure === 'correcta' ? EXPERIMENT_STATUS.ejecutado : EXPERIMENT_STATUS.falloInfra;
    Object.assign(experiment, verdictFields(experiment));
    touch(state, [experiment.id], event);
  },

  'result.observed'(state, event) {
    const p = event.payload;
    const experiment = getRecord(state, 'experiments', p.experimentId, 'Experimento');
    if (experiment.status === EXPERIMENT_STATUS.falloInfra) {
      fail('INFRAESTRUCTURA', 'La ejecución falló por infraestructura: no hay resultado que observar. Usa un reintento controlado.');
    }
    if (experiment.status !== EXPERIMENT_STATUS.ejecutado) {
      fail('ORDEN', `Solo se registra el resultado de un experimento ejecutado (estado actual: "${experiment.status}").`);
    }
    const measurements = p.measurements;
    if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) fail('TIPO_NO_VALIDO', 'Las mediciones deben ser un objeto métrica → valor.');
    const metrics = new Set(experiment.criteria.map((criterion) => criterion.metric));
    for (const [metric, value] of Object.entries(measurements)) {
      if (!metrics.has(metric)) {
        fail('METRICA_NO_DECLARADA', `"${metric}" no figura en los criterios fijados antes de ejecutar. No se añaden métricas a posteriori.`);
      }
      if (value !== null) scalar(value, `La medición de ${metric}`);
    }
    evidenceList(p.evidence, 'Evidencia del resultado');
    text(p.notes, 'las notas del resultado', { optional: true });
    experiment.observation = { at: event.at, actor: event.actor, measurements, evidence: p.evidence ?? [], notes: p.notes ?? null };
    experiment.evaluation = evaluateCriteria(experiment.criteria, measurements);
    experiment.status = EXPERIMENT_STATUS.observado;
    Object.assign(experiment, verdictFields(experiment));
    touch(state, [experiment.id], event);
  },

  'result.verified'(state, event) {
    const p = event.payload;
    const experiment = getRecord(state, 'experiments', p.experimentId, 'Experimento');
    if (experiment.status !== EXPERIMENT_STATUS.observado) {
      fail('ORDEN', `Solo se verifica un resultado observado (estado actual: "${experiment.status}").`);
    }
    oneOf(p.outcome, VERIFICATION_OUTCOMES, 'Resultado de la verificación');
    text(p.method, 'el método de verificación');
    evidenceList(p.evidence, 'Evidencia de la verificación', { min: p.outcome === 'no-verificable' ? 0 : 1 });
    experiment.verification = {
      at: event.at,
      actor: event.actor,
      outcome: p.outcome,
      method: p.method,
      evidence: p.evidence ?? [],
      independent: !sameActor(event.actor, experiment.observation.actor),
    };
    experiment.status = {
      confirmado: EXPERIMENT_STATUS.verificado,
      refutado: EXPERIMENT_STATUS.refutado,
      'no-verificable': EXPERIMENT_STATUS.noVerificable,
    }[p.outcome];
    Object.assign(experiment, verdictFields(experiment));
    touch(state, [experiment.id, experiment.hypothesisId], event);
  },

  'learning.proposed'(state, event) {
    const p = event.payload;
    if (p.id !== nextId(state, 'learning')) fail('IDENTIFICADOR', `Se esperaba el identificador ${nextId(state, 'learning')}.`);
    const hypothesis = getRecord(state, 'hypotheses', p.hypothesisId, 'Hipótesis');
    oneOf(p.stance, Object.values(STANCE), 'Postura');
    text(p.statement, 'el enunciado del aprendizaje');
    idList(p.support, 'Experimentos de respaldo');
    for (const id of p.support) supportCheck(state, hypothesis.id, p.stance, id);
    const claim = { ...hypothesis.claim, holds: p.stance === STANCE.respalda };
    const sameClaim = Object.values(state.learnings).filter((learning) => claimKey(learning.claim) === claimKey(claim));
    const activeDuplicate = sameClaim.find((learning) => ACTIVE_LEARNING.includes(learning.status));
    if (activeDuplicate) {
      fail('DUPLICADO', `Ya existe el aprendizaje ${activeDuplicate.id} con la misma afirmación. Añade el respaldo a ese aprendizaje.`, { existing: activeDuplicate.id });
    }

    state.counters.learning += 1;
    state.learnings[p.id] = {
      id: p.id,
      kind: 'aprendizaje',
      layer: 'evolutiva',
      hypothesisId: hypothesis.id,
      stance: p.stance,
      statement: p.statement,
      claim,
      support: [...p.support],
      status: LEARNING_STATUS.candidato,
      proposedAt: event.at,
      proposedBy: event.actor,
      session: event.session,
      reviews: [],
      statusChanges: [{ status: LEARNING_STATUS.candidato, seq: event.seq, at: event.at, actor: event.actor }],
      supersededBy: null,
      priorIds: sameClaim.map((learning) => learning.id),
    };
    touch(state, [p.id, hypothesis.id, ...p.support], event);
  },

  'learning.support-added'(state, event) {
    const p = event.payload;
    const learning = getRecord(state, 'learnings', p.learningId, 'Aprendizaje');
    if (!ACTIVE_LEARNING.includes(learning.status)) fail('ORDEN', `No se añade respaldo a un aprendizaje ${learning.status}.`);
    idList(p.experimentIds, 'Experimentos de respaldo');
    for (const id of p.experimentIds) {
      if (learning.support.includes(id)) fail('DUPLICADO', `${id} ya respalda este aprendizaje.`);
      supportCheck(state, learning.hypothesisId, learning.stance, id);
    }
    learning.support.push(...p.experimentIds);
    touch(state, [learning.id, ...p.experimentIds], event);
  },

  'learning.reviewed'(state, event) {
    const p = event.payload;
    const learning = getRecord(state, 'learnings', p.learningId, 'Aprendizaje');
    if (learning.status !== LEARNING_STATUS.candidato) fail('ORDEN', `Solo se revisa un CANDIDATO (estado actual: ${learning.status}).`);
    oneOf(p.decision, REVIEW_DECISIONS, 'Decisión');
    text(p.notes, 'las notas de la revisión', { optional: p.decision === 'aprobar' });
    if (p.decision === 'aprobar') {
      const blockers = approvalBlockers(state, learning, event.actor);
      if (blockers.length) fail('REVISION_BLOQUEADA', `No se puede aprobar: ${blockers.join(' ')}`, { blockers });
    }
    learning.reviews.push({ seq: event.seq, at: event.at, actor: event.actor, decision: p.decision, notes: p.notes ?? null });
    if (p.decision === 'aprobar') setLearningStatus(learning, LEARNING_STATUS.aprendido, event);
    if (p.decision === 'rechazar') setLearningStatus(learning, LEARNING_STATUS.descartado, event, { reason: p.notes });
    touch(state, [learning.id], event);
  },

  'learning.consolidated'(state, event) {
    const p = event.payload;
    const learning = getRecord(state, 'learnings', p.learningId, 'Aprendizaje');
    text(p.notes, 'las notas de la consolidación', { optional: true });
    const blockers = consolidationBlockers(state, learning, event.actor);
    if (blockers.length) fail('CONSOLIDACION_BLOQUEADA', `No se puede consolidar: ${blockers.join(' ')}`, { blockers });
    setLearningStatus(learning, LEARNING_STATUS.consolidado, event, { notes: p.notes ?? null });
    touch(state, [learning.id], event);
  },

  'learning.superseded'(state, event) {
    const p = event.payload;
    const learning = getRecord(state, 'learnings', p.learningId, 'Aprendizaje');
    const replacement = getRecord(state, 'learnings', p.by, 'Aprendizaje que lo sustituye');
    if (learning.id === replacement.id) fail('VALOR_NO_VALIDO', 'Un aprendizaje no puede superarse a sí mismo.');
    if (!ACTIVE_LEARNING.includes(learning.status)) fail('ORDEN', `${learning.id} ya está ${learning.status}.`);
    if (!ACTIVE_LEARNING.includes(replacement.status)) fail('ORDEN', `${replacement.id} está ${replacement.status} y no puede sustituir a otro.`);
    text(p.reason, 'el motivo');
    requireHumanForConsolidated([learning], event.actor, 'Superar');
    learning.supersededBy = replacement.id;
    setLearningStatus(learning, LEARNING_STATUS.superado, event, { reason: p.reason, by: replacement.id });
    touch(state, [learning.id, replacement.id], event);
  },

  'learning.discarded'(state, event) {
    const p = event.payload;
    const learning = getRecord(state, 'learnings', p.learningId, 'Aprendizaje');
    if (!ACTIVE_LEARNING.includes(learning.status)) fail('ORDEN', `${learning.id} ya está ${learning.status}.`);
    text(p.reason, 'el motivo');
    requireHumanForConsolidated([learning], event.actor, 'Descartar');
    setLearningStatus(learning, LEARNING_STATUS.descartado, event, { reason: p.reason });
    touch(state, [learning.id], event);
  },

  'contradiction.resolved'(state, event) {
    const p = event.payload;
    const open = openContradictions(state).find((item) => item.id === p.contradictionId);
    if (!open) fail('CONTRADICCION_NO_ABIERTA', `No hay una contradicción abierta con el identificador ${p.contradictionId}.`);
    if (p.a !== open.a || p.b !== open.b) fail('VALOR_NO_VALIDO', 'Los aprendizajes indicados no corresponden a la contradicción.');
    oneOf(p.resolution, RESOLUTIONS, 'Resolución');
    text(p.notes, 'la justificación de la resolución');
    const record = () => {
      state.resolutions[open.id] = {
        id: open.id,
        a: open.a,
        b: open.b,
        kind: open.kind,
        relation: open.relation,
        resolution: p.resolution,
        notes: p.notes,
        seq: event.seq,
        at: event.at,
        actor: event.actor,
      };
    };
    if (open.kind === 'experiencias') {
      if (!EXPERIENCE_RESOLUTIONS.includes(p.resolution)) {
        fail('RESOLUCION_NO_VALIDA', 'Una experiencia no se supera: se descarta, con su historial, o se declara compatible.');
      }
      const discard = (experience) => {
        experience.amendments.push({
          seq: event.seq,
          at: event.at,
          actor: event.actor,
          reason: `Resolución de ${open.id}: ${p.notes}`,
          changes: { epistemic: EPISTEMIC.descartado },
          previous: { summary: experience.summary, epistemic: experience.epistemic, evidenceCount: experience.evidence.length },
        });
        experience.epistemic = EPISTEMIC.descartado;
      };
      if (p.resolution === 'descartar-a') discard(state.experiences[open.a]);
      if (p.resolution === 'descartar-b') discard(state.experiences[open.b]);
      record();
      touch(state, [open.id, open.a, open.b], event);
      return;
    }
    const a = state.learnings[open.a];
    const b = state.learnings[open.b];
    requireHumanForConsolidated([a, b], event.actor, 'Resolver una contradicción que afecta a');
    const reason = `Resolución de ${open.id}: ${p.notes}`;
    if (p.resolution === 'a-supera-b') {
      b.supersededBy = a.id;
      setLearningStatus(b, LEARNING_STATUS.superado, event, { reason, by: a.id });
    } else if (p.resolution === 'b-supera-a') {
      a.supersededBy = b.id;
      setLearningStatus(a, LEARNING_STATUS.superado, event, { reason, by: b.id });
    } else if (p.resolution === 'descartar-a') {
      setLearningStatus(a, LEARNING_STATUS.descartado, event, { reason });
    } else if (p.resolution === 'descartar-b') {
      setLearningStatus(b, LEARNING_STATUS.descartado, event, { reason });
    }
    record();
    touch(state, [open.id, a.id, b.id], event);
  },
};

function verdictFields(experiment) {
  const { verdict, reason } = computeVerdict(experiment);
  return { verdict, verdictReason: reason };
}

/**
 * Valida y aplica un evento sobre `state` (lo modifica). Lanza RuleViolation si el evento
 * incumple cualquier regla; quien llama debe trabajar sobre una copia.
 */
export function applyEvent(state, event) {
  if (!event || typeof event !== 'object') fail('EVENTO_NO_VALIDO', 'El evento no es un objeto.');
  if (event.v !== EVENT_VERSION) fail('VERSION', `Versión de evento no admitida: ${event.v}.`);
  if (!EVENT_TYPES.includes(event.type)) {
    fail('TIPO_DE_EVENTO', `Tipo de evento no admitido: "${event.type}". La capa base y los tipos no declarados no se pueden modificar desde el ciclo de aprendizaje.`);
  }
  if (event.seq !== state.seq + 1) fail('SECUENCIA', `Secuencia ${event.seq}; se esperaba ${state.seq + 1}.`);
  if ((event.prev ?? null) !== state.head) fail('CADENA', 'El evento no enlaza con el último evento del registro.');
  if (hashEvent(event) !== event.hash) fail('HASH', 'El contenido del evento no coincide con su hash.');
  isoDate(event.at, 'La fecha del evento');
  if (state.lastAt && Date.parse(event.at) < Date.parse(state.lastAt)) {
    fail('RELOJ', 'La fecha del evento es anterior a la del último evento registrado.');
  }
  if (state.seq === 0) {
    if (event.type !== 'ledger.created') fail('GENESIS', 'El primer evento debe crear el registro.');
  } else {
    if (event.type === 'ledger.created') {
      fail('NUCLEO_INMUTABLE', 'El registro ya existe: su identidad y su política (capa base) no se pueden redefinir.');
    }
    if (event.ledger !== state.brain) {
      fail('ESCRITURA_ENTRE_BRAINS', `El evento pertenece al registro "${event.ledger}", no al de ${BRAINS[state.brain].name}.`);
    }
  }
  if (!event.payload || typeof event.payload !== 'object') fail('EVENTO_NO_VALIDO', 'El evento no tiene contenido.');
  if (event.session !== null && typeof event.session !== 'string') fail('EVENTO_NO_VALIDO', 'La sesión debe ser texto o null.');
  checkActor(event.actor, state.seq === 0 ? event.payload.brain : state.brain);

  HANDLERS[event.type](state, event);
  state.seq = event.seq;
  state.head = event.hash;
  state.lastAt = event.at;
  return state;
}
