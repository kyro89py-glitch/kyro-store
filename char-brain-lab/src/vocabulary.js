// Vocabulario controlado del laboratorio. Todo valor que entra en un evento se valida
// contra estas listas; un valor desconocido se rechaza en lugar de aceptarse en silencio.
//
// Origen: estructura descrita en el encargo (cuatro capas, estados del sistema de
// aprendizaje de Char y estados epistemológicos). PENDIENTE DE VERIFICAR contra los
// documentos originales de Char, que no estaban disponibles al construir esta versión.

export const LEDGER_FORMAT = 'char-brain-lab.ledger';
export const LEDGER_FORMAT_VERSION = 1;
export const EVENT_VERSION = 1;

/** Brains del laboratorio. Cada uno tiene su propio registro; nunca comparten uno. */
export const BRAINS = Object.freeze({
  char: Object.freeze({ id: 'char', name: 'Char', origin: 'Brain de ChatGPT' }),
  claude: Object.freeze({ id: 'claude', name: 'Claude', origin: 'Brain desarrollado con Claude' }),
});

export const ACTOR_KINDS = Object.freeze(['brain', 'humano']);

/** Capas de memoria. La capa base (núcleo) no admite cambios desde el ciclo de aprendizaje. */
export const LAYERS = Object.freeze({
  base: 'Base (núcleo: identidad y política)',
  operacional: 'Operacional (hipótesis y experimentos en curso)',
  experiencia: 'Experiencia (lo observado y su evidencia)',
  evolutiva: 'Evolutiva (aprendizajes y su ciclo de revisión)',
});

export const EPISTEMIC = Object.freeze({
  observacion: 'observación',
  hecho: 'hecho-respaldado',
  hipotesis: 'hipótesis',
  inferencia: 'inferencia',
  contradiccion: 'contradicción',
  desconocido: 'dato-desconocido',
  pendiente: 'pendiente-de-verificar',
  aprendido: 'aprendido',
  consolidado: 'consolidado',
  superado: 'superado',
  descartado: 'descartado',
});

/** Estados epistemológicos con los que puede registrarse una experiencia. */
export const EXPERIENCE_EPISTEMIC = Object.freeze([
  EPISTEMIC.observacion,
  EPISTEMIC.hecho,
  EPISTEMIC.pendiente,
  EPISTEMIC.desconocido,
]);

/** Estados a los que puede corregirse una experiencia ya registrada. */
export const EXPERIENCE_AMEND_EPISTEMIC = Object.freeze([...EXPERIENCE_EPISTEMIC, EPISTEMIC.descartado]);

export const SOURCE_KINDS = Object.freeze([
  'conversación',
  'documento',
  'código',
  'ejecución',
  'transcripción',
  'observación-directa',
  'otro',
]);

export const EVIDENCE_KINDS = Object.freeze(['archivo', 'comando', 'registro', 'enlace', 'cita', 'otro']);

/**
 * Modos de experimento. El laboratorio solo registra simulación, investigación o
 * análisis: no ejecuta acciones y no admite acciones reales (financieras ni de otro tipo).
 */
export const EXPERIMENT_MODES = Object.freeze(['simulación', 'investigación', 'análisis']);
export const FORBIDDEN_MODES = Object.freeze(['acción-real', 'accion-real', 'real', 'producción', 'financiero']);

/** Etapas del experimento: cada una es un estado distinto, nunca una sola etiqueta. */
export const EXPERIMENT_STATUS = Object.freeze({
  propuesto: 'propuesto',
  ejecutado: 'ejecutado',
  falloInfra: 'fallo-de-infraestructura',
  observado: 'resultado-observado',
  verificado: 'resultado-verificado',
  refutado: 'resultado-refutado',
  noVerificable: 'resultado-no-verificable',
  cancelado: 'cancelado',
});

/** Estados desde los que se admite un reintento controlado (mismos criterios). */
export const RETRYABLE_STATUS = Object.freeze([
  EXPERIMENT_STATUS.falloInfra,
  EXPERIMENT_STATUS.refutado,
  EXPERIMENT_STATUS.noVerificable,
  EXPERIMENT_STATUS.cancelado,
]);

export const INFRASTRUCTURE = Object.freeze(['correcta', 'fallida']);
export const VERIFICATION_OUTCOMES = Object.freeze(['confirmado', 'refutado', 'no-verificable']);

export const OPERATORS = Object.freeze(['>=', '<=', '>', '<', '==', '!=']);
export const NUMERIC_OPERATORS = Object.freeze(['>=', '<=', '>', '<']);

export const CRITERION_OUTCOME = Object.freeze({
  cumple: 'cumple',
  noCumple: 'no-cumple',
  desconocido: 'desconocido',
});

export const VERDICT = Object.freeze({
  respaldada: 'respaldada',
  debilitada: 'debilitada',
  noResuelta: 'no-resuelta',
});

/** Postura de un aprendizaje respecto de la hipótesis que lo origina. */
export const STANCE = Object.freeze({ respalda: 'respalda', debilita: 'debilita' });
export const STANCE_VERDICT = Object.freeze({ respalda: VERDICT.respaldada, debilita: VERDICT.debilitada });

/**
 * Estados del sistema de aprendizaje. El estado HIPÓTESIS del sistema de Char se
 * representa aquí como un registro propio (Hipótesis), porque el ciclo distingue
 * "formular una hipótesis" de "proponer un aprendizaje".
 */
export const LEARNING_STATUS = Object.freeze({
  candidato: 'CANDIDATO',
  aprendido: 'APRENDIDO',
  consolidado: 'CONSOLIDADO',
  superado: 'SUPERADO',
  descartado: 'DESCARTADO',
});

export const ACTIVE_LEARNING = Object.freeze([
  LEARNING_STATUS.candidato,
  LEARNING_STATUS.aprendido,
  LEARNING_STATUS.consolidado,
]);

export const REVIEW_DECISIONS = Object.freeze(['aprobar', 'rechazar', 'solicitar-evidencia']);

export const RESOLUTIONS = Object.freeze(['a-supera-b', 'b-supera-a', 'descartar-a', 'descartar-b', 'compatibles']);

/** Política por defecto, grabada en el evento de creación de cada registro. */
export const DEFAULT_POLICY = Object.freeze({
  /** Experimentos verificados que deben respaldar un aprendizaje para consolidarlo. */
  minSupportForConsolidation: 2,
  /** Al menos un respaldo verificado por alguien distinto de quien observó el resultado. */
  requireIndependentVerification: true,
  /** Quién puede consolidar: solo una persona. */
  consolidationBy: Object.freeze(['humano']),
  /** Quién puede aprobar un candidato (CANDIDATO → APRENDIDO). */
  approvalBy: Object.freeze(['brain', 'humano']),
  /** Reintentos controlados por experimento original. */
  maxRetries: 3,
});

export const EVENT_TYPES = Object.freeze([
  'ledger.created',
  'experience.recorded',
  'experience.amended',
  'hypothesis.formulated',
  'experiment.proposed',
  'experiment.cancelled',
  'experiment.executed',
  'result.observed',
  'result.verified',
  'learning.proposed',
  'learning.support-added',
  'learning.reviewed',
  'learning.consolidated',
  'learning.superseded',
  'learning.discarded',
  'contradiction.resolved',
]);

/** Prefijos de identificador por tipo de registro. */
export const ID_PREFIX = Object.freeze({
  experience: 'EXP',
  hypothesis: 'HIP',
  experiment: 'EXM',
  learning: 'APR',
});
