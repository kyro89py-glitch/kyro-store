// Análisis puro: comparación con criterios, veredicto, duplicados y contradicciones.
//
// Todo es determinista y basado en reglas explícitas. La detección de duplicados y
// contradicciones es ESTRUCTURAL (sujeto, propiedad, valor normalizados): no entiende
// sinónimos ni paráfrasis. Una contradicción detectada se señala para revisión; nunca se
// resuelve sola.

import {
  CRITERION_OUTCOME,
  EXPERIMENT_STATUS,
  NUMERIC_OPERATORS,
  VERDICT,
} from './vocabulary.js';

/** Minúsculas, sin tildes, espacios colapsados y sin puntuación final. */
export function normalizeText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:,!?¡¿]+$/u, '')
    .trim();
}

/** Clave de una afirmación sin su polaridad: sujeto | propiedad. */
export function slotKey(claim) {
  return `${normalizeText(claim.subject)}|${normalizeText(claim.property)}`;
}

/** Clave completa: sujeto | propiedad | valor | se cumple o no. */
export function claimKey(claim) {
  return `${slotKey(claim)}|${normalizeText(claim.value)}|${claim.holds === false ? 'no' : 'si'}`;
}

/**
 * Relación entre dos afirmaciones.
 * - "duplicado": dicen lo mismo.
 * - "polaridad-opuesta": una afirma lo que la otra niega.
 * - "valores-incompatibles": asignan valores distintos a la misma propiedad. Supone que
 *   la propiedad tiene un solo valor; si no es así, la revisión puede marcarlas como
 *   compatibles.
 * - null: no hay relación detectable.
 */
export function claimRelation(a, b) {
  if (slotKey(a) !== slotKey(b)) return null;
  const sameValue = normalizeText(a.value) === normalizeText(b.value);
  const holdsA = a.holds !== false;
  const holdsB = b.holds !== false;
  if (sameValue) return holdsA === holdsB ? 'duplicado' : 'polaridad-opuesta';
  if (holdsA && holdsB) return 'valores-incompatibles';
  return null;
}

/** Interpreta texto de un formulario: número, booleano o texto. */
export function parseValue(raw) {
  if (typeof raw !== 'string') return raw;
  const text = raw.trim();
  if (text === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (/^(true|verdadero|sí|si)$/i.test(text)) return true;
  if (/^(false|falso|no)$/i.test(text)) return false;
  return text;
}

function sameValue(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b;
  return normalizeText(a) === normalizeText(b);
}

/**
 * Compara una medición con un criterio. La ausencia de medición da "desconocido", nunca
 * "no-cumple": la falta de información no es una conclusión negativa.
 */
export function evaluateCriterion(criterion, measurements) {
  const observed = Object.prototype.hasOwnProperty.call(measurements ?? {}, criterion.metric)
    ? measurements[criterion.metric]
    : undefined;
  const base = {
    criterionId: criterion.id,
    metric: criterion.metric,
    operator: criterion.operator,
    target: criterion.target,
    observed: observed === undefined ? null : observed,
  };
  if (observed === undefined || observed === null || observed === '') {
    return { ...base, outcome: CRITERION_OUTCOME.desconocido, reason: 'sin medición' };
  }
  if (NUMERIC_OPERATORS.includes(criterion.operator)) {
    if (typeof observed !== 'number' || !Number.isFinite(observed)) {
      return { ...base, outcome: CRITERION_OUTCOME.desconocido, reason: 'la medición no es numérica' };
    }
    const target = criterion.target;
    const ok =
      criterion.operator === '>='
        ? observed >= target
        : criterion.operator === '<='
          ? observed <= target
          : criterion.operator === '>'
            ? observed > target
            : observed < target;
    return { ...base, outcome: ok ? CRITERION_OUTCOME.cumple : CRITERION_OUTCOME.noCumple, reason: null };
  }
  const equal = sameValue(observed, criterion.target);
  const ok = criterion.operator === '==' ? equal : !equal;
  return { ...base, outcome: ok ? CRITERION_OUTCOME.cumple : CRITERION_OUTCOME.noCumple, reason: null };
}

export function evaluateCriteria(criteria, measurements) {
  return criteria.map((criterion) => evaluateCriterion(criterion, measurements));
}

/**
 * Veredicto sobre la hipótesis. Solo existe cuando el resultado está verificado; antes es
 * null (pendiente). Un fallo de infraestructura o un resultado no verificable deja la
 * hipótesis "no-resuelta": no la debilita.
 */
export function computeVerdict(experiment) {
  switch (experiment.status) {
    case EXPERIMENT_STATUS.falloInfra:
      return {
        verdict: VERDICT.noResuelta,
        reason: 'Fallo de infraestructura: la ejecución no aporta evidencia sobre la hipótesis.',
      };
    case EXPERIMENT_STATUS.refutado:
      return {
        verdict: VERDICT.noResuelta,
        reason: 'La verificación refutó el resultado observado: no puede usarse como evidencia.',
      };
    case EXPERIMENT_STATUS.noVerificable:
      return { verdict: VERDICT.noResuelta, reason: 'El resultado no pudo verificarse.' };
    case EXPERIMENT_STATUS.verificado: {
      const evaluation = experiment.evaluation ?? [];
      const failed = evaluation.filter((item) => item.outcome === CRITERION_OUTCOME.noCumple);
      const unknown = evaluation.filter((item) => item.outcome === CRITERION_OUTCOME.desconocido);
      if (failed.length > 0) {
        return {
          verdict: VERDICT.debilitada,
          reason: `No cumple ${failed.map((item) => item.criterionId).join(', ')}.`,
        };
      }
      if (unknown.length > 0) {
        return {
          verdict: VERDICT.noResuelta,
          reason: `Faltan datos para ${unknown.map((item) => item.criterionId).join(', ')}; la ausencia de medición no se interpreta como fallo.`,
        };
      }
      return {
        verdict: VERDICT.respaldada,
        reason: 'Cumple todos los criterios fijados antes de ejecutar. Respalda la hipótesis en las condiciones probadas; no la demuestra en general.',
      };
    }
    case EXPERIMENT_STATUS.cancelado:
      return { verdict: null, reason: 'Experimento cancelado.' };
    default:
      return { verdict: null, reason: 'Pendiente: el resultado aún no está verificado.' };
  }
}
