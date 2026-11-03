// Interfaz del laboratorio. Todo lo que se muestra sale del estado del motor: si un dato
// no existe, se muestra como ausente. Las animaciones solo marcan eventos que acaban de
// registrarse. Las acciones se registran siempre como persona (nunca como un Brain).

import { Lab, SLOT_STATUS } from '../src/lab.js';
import { RuleViolation } from '../src/rules.js';
import {
  ACTIVE_LEARNING,
  BRAINS,
  EPISTEMIC,
  EVIDENCE_KINDS,
  EXPERIENCE_AMEND_EPISTEMIC,
  EXPERIENCE_EPISTEMIC,
  EXPERIMENT_MODES,
  EXPERIMENT_STATUS,
  LEARNING_STATUS,
  OPERATORS,
  RETRYABLE_STATUS,
  SOURCE_KINDS,
  STANCE_VERDICT,
  VERDICT,
} from '../src/vocabulary.js';

// ---------------------------------------------------------------------------------------
// Estado de la interfaz (preferencias locales, nunca datos de memoria)

const prefs = {
  read(key, fallback) {
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* sin almacenamiento: la preferencia dura lo que la página */
    }
  },
};

function browserStorage() {
  try {
    const storage = window.localStorage;
    storage.getItem('charlab.v1.probe');
    return storage;
  } catch {
    return null;
  }
}

const lab = new Lab({ storage: browserStorage() }).load();
const SESSION = `ui-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)).slice(0, 8)}`;

const ui = {
  brain: BRAINS[prefs.read('charlab.v1.view', 'claude')] ? prefs.read('charlab.v1.view', 'claude') : 'claude',
  selected: { char: null, claude: null },
  operator: prefs.read('charlab.v1.operator', 'operador'),
  pulse: null,
};

const actor = () => ({ kind: 'humano', id: ui.operator });
const ctx = () => ({ actor: actor(), session: SESSION });

// ---------------------------------------------------------------------------------------
// Utilidades de DOM (sin innerHTML: todo texto entra como texto)

const SVG_NS = 'http://www.w3.org/2000/svg';

function build(element, props, children) {
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

const h = (tag, props, ...children) => build(document.createElement(tag), props, children);
const s = (tag, props, ...children) => build(document.createElementNS(SVG_NS, tag), props, children);

const slug = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDate = (iso) => (iso ? dateFormat.format(new Date(iso)) : 'sin fecha');
const fmtValue = (value) => (value === true ? 'sí' : value === false ? 'no' : String(value));
const shortHash = (hash) => (hash ? hash.slice(0, 12) : 'ninguna');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function actorLabel(who) {
  if (!who) return 'desconocido';
  return who.kind === 'brain' ? `Brain ${BRAINS[who.id]?.name ?? who.id}` : `Persona: ${who.id}`;
}

function toLocalInput(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ---------------------------------------------------------------------------------------
// Vocabulario visible

const KIND_LABEL = {
  experiencia: 'Experiencia',
  hipotesis: 'Hipótesis',
  experimento: 'Experimento',
  aprendizaje: 'Aprendizaje',
  contradiccion: 'Contradicción',
};

const EVENT_LABEL = {
  'ledger.created': 'Registro creado',
  'experience.recorded': 'Experiencia registrada',
  'experience.amended': 'Experiencia corregida',
  'hypothesis.formulated': 'Hipótesis formulada',
  'experiment.proposed': 'Experimento propuesto',
  'experiment.cancelled': 'Experimento cancelado',
  'experiment.executed': 'Ejecución registrada',
  'result.observed': 'Resultado observado',
  'result.verified': 'Resultado verificado',
  'learning.proposed': 'Aprendizaje propuesto',
  'learning.support-added': 'Respaldo añadido',
  'learning.reviewed': 'Aprendizaje revisado',
  'learning.consolidated': 'Aprendizaje consolidado',
  'learning.superseded': 'Aprendizaje superado',
  'learning.discarded': 'Aprendizaje descartado',
  'contradiction.resolved': 'Contradicción resuelta',
};

const RESOLUTION_LABEL = {
  'a-supera-b': 'A sustituye a B (B queda superado)',
  'b-supera-a': 'B sustituye a A (A queda superado)',
  'descartar-a': 'Descartar A',
  'descartar-b': 'Descartar B',
  compatibles: 'Son compatibles: ambos siguen activos',
};

const RELATION_LABEL = {
  'valores-incompatibles': 'Asignan valores distintos a la misma propiedad',
  'polaridad-opuesta': 'Uno afirma lo que el otro niega',
};

/** Etapas del ciclo y los eventos que las implementan de verdad. */
const STAGES = [
  { name: 'Observar', types: ['experience.recorded'], note: 'Registra lo observado con su fuente y su evidencia.' },
  {
    name: 'Comprender',
    types: ['experience.amended'],
    partial: true,
    note: 'Clasificación epistemológica manual al registrar o corregir. Sin análisis automático.',
  },
  { name: 'Hipotetizar', types: ['hypothesis.formulated'], note: 'Afirmación estructurada, nunca presentada como hecho.' },
  { name: 'Planificar', types: ['experiment.proposed'], note: 'Criterios de éxito fijados con hash antes de ejecutar.' },
  {
    name: 'Actuar',
    types: ['experiment.executed'],
    partial: true,
    note: 'El laboratorio no ejecuta: registra ejecuciones hechas fuera y el estado de la infraestructura.',
  },
  { name: 'Probar', types: ['result.observed'], note: 'Comparación automática del resultado con los criterios.' },
  { name: 'Verificar', types: ['result.verified'], note: 'Confirmación con evidencia; se marca si es independiente.' },
  { name: 'Aprender', types: ['learning.proposed', 'learning.support-added'], note: 'Aprendizaje candidato desde resultados verificados.' },
  {
    name: 'Actualizar',
    types: ['learning.reviewed', 'learning.consolidated', 'learning.superseded', 'learning.discarded', 'contradiction.resolved'],
    note: 'Revisión explícita. Consolidar exige una persona.',
  },
];

// ---------------------------------------------------------------------------------------
// Componentes pequeños

const epistemicChip = (value, prefix = '') => h('span', { class: `chip ep ep-${slug(value)}`, title: 'Estado epistemológico' }, `${prefix}${value}`);
const statusChip = (value) => h('span', { class: `chip st st-${slug(value)}` }, value);
const verdictChip = (value) =>
  value ? h('span', { class: `chip vd vd-${slug(value)}` }, `veredicto: ${value}`) : h('span', { class: 'chip vd vd-none' }, 'sin veredicto');

function facts(rows) {
  return h(
    'dl',
    { class: 'facts' },
    rows.filter(Boolean).map(([term, detail]) => [h('dt', {}, term), h('dd', {}, detail ?? 'no disponible')]),
  );
}

function button(label, onclick, { variant = 'ghost', disabled = false, title = null } = {}) {
  return h('button', { type: 'button', class: `btn ${variant}`, onclick, disabled, title }, label);
}

function refButton(memory, id) {
  const record = findRecord(memory, id);
  const text = record ? `${id}` : `${id} (no existe)`;
  return h('button', { type: 'button', class: 'ref', onclick: () => select(memory.brain, id) }, text);
}

function evidenceList(list) {
  if (!list?.length) return h('p', { class: 'muted' }, 'Sin evidencia adjunta.');
  return h(
    'ul',
    { class: 'evidence' },
    list.map((item) =>
      h(
        'li',
        {},
        h('span', { class: 'ev-kind' }, item.kind),
        h('span', { class: 'mono ev-ref' }, item.ref),
        item.description ? h('span', { class: 'ev-desc' }, item.description) : null,
        item.sha256 ? h('span', { class: 'mono ev-hash' }, `sha256 ${shortHash(item.sha256)}`) : null,
      ),
    ),
  );
}

function blockerList(title, blockers, okText) {
  return h(
    'div',
    { class: `gate ${blockers.length ? 'is-blocked' : 'is-open'}` },
    h('h4', {}, title),
    blockers.length ? h('ul', {}, blockers.map((item) => h('li', {}, item))) : h('p', {}, okText),
  );
}

// ---------------------------------------------------------------------------------------
// Consultas sobre la memoria

function findRecord(memory, id) {
  if (!memory || !id) return null;
  const state = memory.state;
  if (id.startsWith('CON:')) {
    const item = memory.contradictions().find((entry) => entry.id === id);
    return item ? { ...item, kind: 'contradiccion' } : null;
  }
  return state.experiences[id] ?? state.hypotheses[id] ?? state.experiments[id] ?? state.learnings[id] ?? null;
}

function touchedBy(memory, seq) {
  return Object.entries(memory.state.history)
    .filter(([, entries]) => entries.some((entry) => entry.seq === seq))
    .map(([id]) => id);
}

function eligibleSupport(memory, hypothesisId, stance, exclude = []) {
  return Object.values(memory.state.experiments).filter(
    (experiment) =>
      experiment.hypothesisId === hypothesisId &&
      experiment.status === EXPERIMENT_STATUS.verificado &&
      (!stance || experiment.verdict === STANCE_VERDICT[stance]) &&
      [VERDICT.respaldada, VERDICT.debilitada].includes(experiment.verdict) &&
      !exclude.includes(experiment.id),
  );
}

// ---------------------------------------------------------------------------------------
// Acciones de navegación

function selectBrain(brain) {
  ui.brain = brain;
  prefs.write('charlab.v1.view', brain);
  render();
}

function select(brain, id) {
  ui.brain = brain;
  ui.selected[brain] = id;
  render();
  document.getElementById('inspector')?.focus({ preventScroll: false });
}

function notify(text, kind = 'ok') {
  const notice = document.getElementById('notice');
  notice.textContent = text;
  notice.dataset.kind = kind;
}

/** Tras un comando: marca los registros tocados por el último evento y vuelve a pintar. */
function afterChange({ brain, text, selectId = undefined }) {
  const memory = lab.memory(brain);
  const last = memory?.events.at(-1);
  ui.pulse = last ? { brain, seq: last.seq, ids: touchedBy(memory, last.seq) } : null;
  if (selectId !== undefined) ui.selected[brain] = selectId;
  ui.brain = brain;
  notify(text);
  render();
}

function run(command) {
  return lab.run(ui.brain, command);
}

// ---------------------------------------------------------------------------------------
// Cabecera

function renderMasthead() {
  const storageOk = lab.storageAvailable;
  document.getElementById('masthead-meta').replaceChildren(
    h(
      'button',
      { type: 'button', class: 'operator', onclick: () => forms.operator(), title: 'Cambiar el nombre con el que se registran tus acciones' },
      h('span', { class: 'operator-label' }, 'Operador'),
      h('span', { class: 'operator-name' }, ui.operator),
    ),
    h(
      'p',
      { class: `storage ${storageOk ? 'is-ok' : 'is-off'}` },
      storageOk ? 'Guardado en este navegador' : 'Sin almacenamiento: los cambios se pierden al cerrar',
    ),
    h('p', { class: 'session' }, 'Sesión ', h('span', { class: 'mono' }, SESSION)),
  );
}

// ---------------------------------------------------------------------------------------
// Campo dual

function integrityLine(slot) {
  if (slot.status === SLOT_STATUS.vacio) {
    return h('p', { class: 'integrity is-empty' }, 'Sin registro en este laboratorio.');
  }
  if (slot.status === SLOT_STATUS.comprometido) {
    return h('p', { class: 'integrity is-broken' }, h('strong', {}, 'Integridad comprometida. '), slot.problems[0] ?? '');
  }
  const check = slot.memory.verify();
  const events = slot.memory.events.length;
  if (!check.ok) return h('p', { class: 'integrity is-broken' }, h('strong', {}, 'Cadena rota. '), check.problems[0]);
  return h(
    'p',
    { class: 'integrity is-ok' },
    h('strong', {}, 'Cadena íntegra'),
    `, ${plural(events, 'evento', 'eventos')}. Cabecera `,
    h('span', { class: 'mono' }, shortHash(slot.memory.head)),
  );
}

const COLUMNS = {
  char: [
    ['experiences', 'Experiencias', 52],
    ['hypotheses', 'Hipótesis', 160],
    ['experiments', 'Experimentos', 268],
    ['learnings', 'Aprendizajes', 372],
  ],
  claude: [
    ['learnings', 'Aprendizajes', 48],
    ['experiments', 'Experimentos', 152],
    ['hypotheses', 'Hipótesis', 260],
    ['experiences', 'Experiencias', 368],
  ],
};

function neuralField(brain, memory) {
  const width = 420;
  const height = 236;
  const top = 18;
  const usable = 172;
  const maxPerColumn = 12;
  const svg = s('svg', {
    class: 'neural',
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': memory
      ? `Mapa de registros de ${BRAINS[brain].name}: cada nodo es un registro real y cada línea una relación registrada.`
      : `${BRAINS[brain].name} no tiene registros.`,
  });

  const positions = new Map();
  const nodes = [];
  for (const [collection, caption, x] of COLUMNS[brain]) {
    const records = memory ? Object.values(memory.state[collection]) : [];
    const shown = records.slice(-maxPerColumn);
    shown.forEach((record, index) => {
      const y = top + (index + 0.5) * (usable / Math.max(shown.length, 1));
      positions.set(record.id, { x, y });
      nodes.push({ record, x, y });
    });
    svg.append(s('text', { class: 'col-caption', x, y: height - 26, 'text-anchor': 'middle' }, caption));
    svg.append(
      s('text', { class: 'col-count', x, y: height - 10, 'text-anchor': 'middle' }, records.length > shown.length ? `${records.length} (últimos ${shown.length})` : String(records.length)),
    );
  }

  const edges = s('g', { class: 'edges' });
  const link = (from, to, cls = '') => {
    const a = positions.get(from);
    const b = positions.get(to);
    if (!a || !b) return;
    const mid = (a.x + b.x) / 2;
    edges.append(s('path', { class: `edge ${cls}`, d: `M${a.x},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}` }));
  };
  if (memory) {
    const state = memory.state;
    for (const hypothesis of Object.values(state.hypotheses)) hypothesis.basedOn.forEach((id) => link(hypothesis.id, id));
    for (const experiment of Object.values(state.experiments)) link(experiment.id, experiment.hypothesisId);
    for (const learning of Object.values(state.learnings)) {
      link(learning.id, learning.hypothesisId, 'is-derived');
      learning.support.forEach((id) => link(learning.id, id, 'is-support'));
    }
  }
  svg.append(edges);

  const pulsing = ui.pulse?.brain === brain ? new Set(ui.pulse.ids) : new Set();
  for (const { record, x, y } of nodes) {
    const epistemic = memory.epistemicOf(record);
    const selected = ui.selected[brain] === record.id;
    const group = s(
      'g',
      {
        class: `node ep-${slug(epistemic)} kind-${record.kind}${selected ? ' is-selected' : ''}${pulsing.has(record.id) ? ' pulse' : ''}`,
        transform: `translate(${x},${y})`,
        'data-id': record.id,
      },
      s('title', {}, `${record.id}: ${epistemic}`),
      s('circle', { class: 'halo', r: 11 }),
      s('circle', { class: 'ring', r: 9.5 }),
      s('circle', { class: 'core', r: 6 }),
    );
    group.addEventListener('click', () => select(brain, record.id));
    svg.append(group);
  }

  if (!memory || nodes.length === 0) {
    svg.append(
      s('text', { class: 'empty-caption', x: width / 2, y: top + usable / 2, 'text-anchor': 'middle' }, memory ? 'Sin registros todavía' : 'Sin registro'),
    );
  }
  return svg;
}

function counts(memory) {
  const state = memory.state;
  const experiments = Object.values(state.experiments);
  const learnings = Object.values(state.learnings);
  const verified = experiments.filter((experiment) => experiment.status === EXPERIMENT_STATUS.verificado).length;
  const consolidated = learnings.filter((learning) => learning.status === LEARNING_STATUS.consolidado).length;
  const open = memory.openContradictions().length;
  const item = (term, value, detail = null) => h('div', {}, h('dt', {}, term), h('dd', {}, String(value), detail ? h('span', { class: 'dd-detail' }, detail) : null));
  return h(
    'dl',
    { class: 'counts' },
    item('Experiencias', Object.keys(state.experiences).length),
    item('Hipótesis', Object.keys(state.hypotheses).length),
    item('Experimentos', experiments.length, `${verified} verificados`),
    item('Aprendizajes', learnings.length, `${consolidated} consolidados`),
    h('div', { class: open ? 'is-alert' : '' }, h('dt', {}, 'Contradicciones abiertas'), h('dd', {}, String(open))),
  );
}

function hemisphere(brain) {
  const slot = lab.slots[brain];
  const info = BRAINS[brain];
  const active = ui.brain === brain;
  const created = slot.memory?.state.createdBy;
  return h(
    'article',
    { class: `hemisphere brain-${brain}${active ? ' is-active' : ''}`, 'aria-labelledby': `hemi-${brain}` },
    h(
      'div',
      { class: 'hemi-head' },
      h('h2', { class: 'hemi-name', id: `hemi-${brain}` }, info.name),
      h('p', { class: 'hemi-origin' }, info.origin),
    ),
    integrityLine(slot),
    created ? h('p', { class: 'hemi-created' }, `Registro creado por ${actorLabel(created)}, ${fmtDate(slot.memory.state.createdAt)}.`) : null,
    neuralField(brain, slot.memory),
    slot.memory ? counts(slot.memory) : null,
    h(
      'button',
      { type: 'button', class: 'btn hemi-open', 'aria-pressed': String(active), onclick: () => selectBrain(brain) },
      active ? `Trabajando en la memoria de ${info.name}` : `Trabajar en la memoria de ${info.name}`,
    ),
  );
}

function channel() {
  return h(
    'aside',
    { class: 'channel', 'aria-labelledby': 'channel-title' },
    h('h2', { class: 'channel-title', id: 'channel-title' }, 'Coordinación'),
    h('p', { class: 'channel-state' }, 'Protocolo no implementado'),
    h(
      'ul',
      { class: 'channel-facts' },
      h('li', {}, 'Dos registros independientes, con claves de almacenamiento distintas.'),
      h('li', {}, 'Nada se copia, se fusiona ni se sincroniza entre Brains.'),
      h('li', {}, 'El motor rechaza que un Brain escriba en la memoria del otro o cite sus registros.'),
    ),
  );
}

function renderField() {
  document.getElementById('field').replaceChildren(hemisphere('char'), channel(), hemisphere('claude'));
}

// ---------------------------------------------------------------------------------------
// Espacio de trabajo

function brainTabs() {
  return h(
    'div',
    { class: 'tabs', role: 'group', 'aria-label': 'Memoria en la que trabajas' },
    Object.values(BRAINS).map((info) =>
      h(
        'button',
        { type: 'button', class: `tab brain-${info.id}`, 'aria-pressed': String(ui.brain === info.id), onclick: () => selectBrain(info.id) },
        info.name,
      ),
    ),
  );
}

function cycleRail(memory) {
  const totals = {};
  for (const event of memory?.events ?? []) totals[event.type] = (totals[event.type] ?? 0) + 1;
  return h(
    'ol',
    { class: 'cycle', 'aria-label': 'Ciclo de aprendizaje: eventos registrados en cada etapa' },
    STAGES.map((stage) => {
      const n = stage.types.reduce((sum, type) => sum + (totals[type] ?? 0), 0);
      return h(
        'li',
        { class: `stage${n ? ' has-events' : ''}${stage.partial ? ' is-partial' : ''}` },
        h('span', { class: 'stage-name' }, stage.name),
        h('span', { class: 'stage-count' }, plural(n, 'evento', 'eventos')),
        h('span', { class: 'stage-note' }, stage.partial ? `Parcial. ${stage.note}` : stage.note),
      );
    }),
  );
}

function emptyLedger(brain) {
  const info = BRAINS[brain];
  return h(
    'div',
    { class: 'empty-state' },
    h('h3', {}, `${info.name} todavía no tiene memoria en este laboratorio`),
    h(
      'p',
      {},
      `Crear el registro graba la identidad de ${info.name} y su política de aprendizaje. Quedará constancia de que lo creaste tú (${actorLabel(actor())}).`,
    ),
    h(
      'div',
      { class: 'actions' },
      button(`Crear el registro de ${info.name}`, () => forms.createLedger(brain), { variant: 'primary' }),
      button('Importar un registro', () => openImport()),
      brain === 'claude' ? button('Importar la inspección inicial', () => importBundled()) : null,
    ),
    brain === 'claude'
      ? h(
          'p',
          { class: 'hint' },
          'La inspección inicial es el registro real de la sesión que construyó este laboratorio (data/claude-brain.ledger.json): lo que Claude observó, el experimento que hizo y el aprendizaje que propuso, pendiente de tu revisión.',
        )
      : h('p', { class: 'hint' }, 'Char no ha registrado nada aquí. Si transcribes algo que dijo Char, quedará registrado como tuyo, con la conversación como fuente.'),
  );
}

function compromised(slot) {
  const info = BRAINS[slot.brain];
  return h(
    'div',
    { class: 'empty-state is-broken' },
    h('h3', {}, `El registro guardado de ${info.name} no superó la verificación`),
    h('p', {}, 'No se ha reemplazado ni reparado. Mientras siga así, no admite escrituras.'),
    h('ul', { class: 'problems' }, slot.problems.slice(0, 8).map((problem) => h('li', {}, problem))),
    h(
      'div',
      { class: 'actions' },
      button('Descargar la copia dañada', () => downloadText(lab.rawStored(slot.brain) ?? '', `char-brain-lab-${slot.brain}-danado.json`)),
      button('Descartar la copia local', () => forms.discardLocal(slot.brain), { variant: 'danger' }),
    ),
  );
}

function recordRow(memory, record, text, chips) {
  const selected = ui.selected[memory.brain] === record.id;
  return h(
    'li',
    {},
    h(
      'button',
      {
        type: 'button',
        class: `record-row ep-${slug(record.kind === 'contradiccion' ? (record.status === 'abierta' ? EPISTEMIC.contradiccion : 'resuelta') : memory.epistemicOf(record))}${selected ? ' is-selected' : ''}`,
        'aria-current': selected ? 'true' : null,
        onclick: () => select(memory.brain, record.id),
      },
      h('span', { class: 'mono row-id' }, record.id),
      h('span', { class: 'row-text' }, text),
      h('span', { class: 'row-chips' }, chips),
    ),
  );
}

function group(title, items, empty, rowFor) {
  return h(
    'section',
    { class: 'group' },
    h('h4', {}, title, h('span', { class: 'group-count' }, String(items.length))),
    items.length ? h('ul', { class: 'rows' }, items.map(rowFor)) : h('p', { class: 'muted' }, empty),
  );
}

function recordsPanel(memory) {
  const state = memory.state;
  const experiences = Object.values(state.experiences);
  return h(
    'section',
    { class: 'records', 'aria-labelledby': 'records-title' },
    h(
      'div',
      { class: 'records-head' },
      h('h3', { id: 'records-title' }, 'Registros'),
      button('Registrar experiencia', () => forms.recordExperience(), { variant: 'primary' }),
    ),
    group('Experiencias', experiences, 'Ninguna todavía. Empieza registrando qué se observó y de dónde viene.', (record) =>
      recordRow(memory, record, record.summary, [epistemicChip(record.epistemic)]),
    ),
    group('Hipótesis', Object.values(state.hypotheses), 'Se formulan desde una experiencia.', (record) =>
      recordRow(memory, record, record.statement, [epistemicChip(EPISTEMIC.hipotesis)]),
    ),
    group('Experimentos', Object.values(state.experiments), 'Se proponen desde una hipótesis, con criterios fijados antes de ejecutar.', (record) =>
      recordRow(memory, record, record.description, [statusChip(record.status), record.verdict ? verdictChip(record.verdict) : null]),
    ),
    group('Aprendizajes', Object.values(state.learnings), 'Se proponen desde resultados verificados.', (record) =>
      recordRow(memory, record, record.statement, [statusChip(record.status), epistemicChip(memory.epistemicOf(record))]),
    ),
    group('Contradicciones', memory.contradictions(), 'Ninguna. Aparecen solas cuando dos aprendizajes activos chocan.', (record) =>
      recordRow(memory, { ...record, kind: 'contradiccion' }, `${record.a} frente a ${record.b}`, [statusChip(record.status)]),
    ),
  );
}

// ---------------------------------------------------------------------------------------
// Inspector

function inspectorHead(record, chips) {
  return h(
    'header',
    { class: 'insp-head' },
    h('p', { class: 'insp-kind' }, `${KIND_LABEL[record.kind]} en la capa ${record.layer ?? 'evolutiva'}`),
    h('h3', { class: 'insp-id mono' }, record.id),
    h('div', { class: 'row-chips' }, chips),
  );
}

function historyBlock(memory, id) {
  const entries = memory.state.history[id] ?? [];
  return h(
    'section',
    { class: 'history' },
    h('h4', {}, 'Historial'),
    entries.length
      ? h(
          'ol',
          {},
          entries.map((entry) =>
            h(
              'li',
              {},
              h('span', { class: 'mono hist-seq' }, `#${entry.seq}`),
              h('span', { class: 'hist-type' }, EVENT_LABEL[entry.type] ?? entry.type),
              h('span', { class: 'hist-meta' }, `${fmtDate(entry.at)}, ${actorLabel(entry.actor)}`),
            ),
          ),
        )
      : h('p', { class: 'muted' }, 'Sin eventos.'),
  );
}

function inspectExperience(memory, record) {
  return [
    inspectorHead(record, [epistemicChip(record.epistemic)]),
    h('p', { class: 'insp-text' }, record.summary),
    facts([
      ['Memoria de', BRAINS[memory.brain].name],
      ['Registrada por', actorLabel(record.recordedBy)],
      ['Registrada', fmtDate(record.recordedAt)],
      ['Observada', fmtDate(record.observedAt)],
      ['Fuente', `${record.source.kind}: ${record.source.ref}${record.source.description ? `. ${record.source.description}` : ''}`],
      ['Sesión', record.session ?? 'no indicada'],
    ]),
    h('h4', {}, 'Evidencia'),
    evidenceList(record.evidence),
    record.amendments.length
      ? h(
          'section',
          {},
          h('h4', {}, 'Correcciones'),
          h(
            'ol',
            { class: 'amendments' },
            record.amendments.map((amendment) =>
              h(
                'li',
                {},
                h('p', {}, `${fmtDate(amendment.at)}, ${actorLabel(amendment.actor)}: ${amendment.reason}`),
                h('p', { class: 'muted' }, `Antes: "${amendment.previous.summary}" (${amendment.previous.epistemic}).`),
              ),
            ),
          ),
        )
      : null,
    h(
      'div',
      { class: 'actions' },
      record.epistemic !== EPISTEMIC.descartado ? button('Formular hipótesis', () => forms.formulateHypothesis(record.id), { variant: 'primary' }) : null,
      button('Corregir', () => forms.amendExperience(record)),
    ),
  ];
}

function inspectHypothesis(memory, record) {
  const state = memory.state;
  const experiments = record.experimentIds.map((id) => state.experiments[id]);
  const canLearn = eligibleSupport(memory, record.id, null).length > 0;
  return [
    inspectorHead(record, [epistemicChip(EPISTEMIC.hipotesis)]),
    h('p', { class: 'insp-text' }, record.statement),
    h(
      'div',
      { class: 'claim' },
      facts([
        ['Sujeto', fmtValue(record.claim.subject)],
        ['Propiedad', fmtValue(record.claim.property)],
        ['Valor', fmtValue(record.claim.value)],
      ]),
      h('p', { class: 'muted' }, 'La afirmación estructurada se usa para detectar duplicados y contradicciones. Se compara literalmente, sin sinónimos.'),
    ),
    facts([
      ['Formulada por', actorLabel(record.formulatedBy)],
      ['Formulada', fmtDate(record.formulatedAt)],
      ['Basada en', h('span', {}, record.basedOn.map((id) => refButton(memory, id)))],
    ]),
    h('h4', {}, 'Experimentos'),
    experiments.length
      ? h(
          'ul',
          { class: 'linked' },
          experiments.map((experiment) => h('li', {}, refButton(memory, experiment.id), statusChip(experiment.status), verdictChip(experiment.verdict))),
        )
      : h('p', { class: 'muted' }, 'Ninguno. Una hipótesis sin experimentos sigue siendo solo una hipótesis.'),
    h(
      'div',
      { class: 'actions' },
      button('Proponer experimento', () => forms.proposeExperiment(record), { variant: 'primary' }),
      button('Proponer aprendizaje', () => forms.proposeLearning(record), {
        disabled: !canLearn,
        title: canLearn ? null : 'Necesita al menos un experimento verificado con veredicto respaldada o debilitada.',
      }),
    ),
    canLearn ? null : h('p', { class: 'hint' }, 'Para proponer un aprendizaje hace falta un resultado verificado que respalde o debilite la hipótesis.'),
  ];
}

function criteriaTable(record) {
  const evaluation = new Map((record.evaluation ?? []).map((item) => [item.criterionId, item]));
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      { class: 'criteria' },
      h('caption', {}, `Criterios fijados el ${fmtDate(record.criteriaFixedAt)}, hash `, h('span', { class: 'mono' }, shortHash(record.criteriaHash))),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Criterio'), h('th', { scope: 'col' }, 'Condición'), h('th', { scope: 'col' }, 'Observado'), h('th', { scope: 'col' }, 'Resultado'))),
      h(
        'tbody',
        {},
        record.criteria.map((criterion) => {
          const item = evaluation.get(criterion.id);
          const outcome = item?.outcome ?? null;
          return h(
            'tr',
            {},
            h('th', { scope: 'row' }, h('span', { class: 'mono' }, criterion.id), criterion.description ? h('span', { class: 'crit-desc' }, criterion.description) : null),
            h('td', { class: 'mono' }, `${criterion.metric} ${criterion.operator} ${fmtValue(criterion.target)}`),
            h('td', { class: 'mono' }, item ? (item.observed === null ? 'sin medición' : fmtValue(item.observed)) : 'pendiente'),
            h('td', {}, outcome ? h('span', { class: `chip oc oc-${outcome}` }, outcome) : h('span', { class: 'muted' }, 'pendiente')),
          );
        }),
      ),
    ),
  );
}

function inspectExperiment(memory, record) {
  const verification = record.verification;
  const retryable = RETRYABLE_STATUS.includes(record.status) && !Object.values(memory.state.experiments).some((experiment) => experiment.retryOf === record.id);
  const cancellable = [EXPERIMENT_STATUS.propuesto, EXPERIMENT_STATUS.ejecutado, EXPERIMENT_STATUS.observado].includes(record.status);
  const next = {
    [EXPERIMENT_STATUS.propuesto]: button('Registrar ejecución', () => forms.recordExecution(record), { variant: 'primary' }),
    [EXPERIMENT_STATUS.ejecutado]: button('Registrar resultado', () => forms.recordObservation(record), { variant: 'primary' }),
    [EXPERIMENT_STATUS.observado]: button('Verificar resultado', () => forms.verifyResult(record), { variant: 'primary' }),
  }[record.status];
  return [
    inspectorHead(record, [statusChip(record.status), epistemicChip(memory.epistemicOf(record), 'resultado: ')]),
    h('p', { class: 'insp-text' }, record.description),
    facts([
      ['Hipótesis', refButton(memory, record.hypothesisId)],
      ['Modo', record.mode],
      ['Propuesto por', `${actorLabel(record.proposedBy)}, ${fmtDate(record.proposedAt)}`],
      record.retryOf ? ['Reintento de', refButton(memory, record.retryOf)] : null,
    ]),
    criteriaTable(record),
    h(
      'div',
      { class: `verdict vd-${slug(record.verdict ?? 'none')}` },
      h('p', { class: 'verdict-label' }, record.verdict ? `Veredicto: hipótesis ${record.verdict}` : 'Sin veredicto'),
      h('p', {}, record.verdictReason ?? 'Pendiente.'),
    ),
    record.execution
      ? facts([
          ['Ejecución', `${actorLabel(record.execution.actor)}, ${fmtDate(record.execution.at)}`],
          ['Infraestructura', record.execution.infrastructure],
          record.execution.notes ? ['Notas', record.execution.notes] : null,
        ])
      : null,
    record.observation
      ? h(
          'section',
          {},
          facts([
            ['Resultado observado por', `${actorLabel(record.observation.actor)}, ${fmtDate(record.observation.at)}`],
            record.observation.notes ? ['Notas', record.observation.notes] : null,
          ]),
          evidenceList(record.observation.evidence),
        )
      : null,
    verification
      ? h(
          'section',
          {},
          facts([
            ['Verificación', `${verification.outcome}, ${actorLabel(verification.actor)}, ${fmtDate(verification.at)}`],
            ['Método', verification.method],
            [
              'Independiente',
              verification.independent ? 'Sí: verificó alguien distinto de quien observó.' : 'No: verificó la misma persona o Brain que observó.',
            ],
          ]),
          evidenceList(verification.evidence),
        )
      : null,
    record.cancellation ? facts([['Cancelado', `${actorLabel(record.cancellation.actor)}: ${record.cancellation.reason}`]]) : null,
    h(
      'div',
      { class: 'actions' },
      next ?? null,
      retryable ? button('Reintentar con los mismos criterios', () => forms.retryExperiment(record)) : null,
      cancellable ? button('Cancelar experimento', () => forms.cancelExperiment(record), { variant: 'danger' }) : null,
    ),
  ];
}

function inspectLearning(memory, record) {
  const checks = memory.learningChecks(record.id, actor());
  const active = ACTIVE_LEARNING.includes(record.status);
  const others = Object.values(memory.state.learnings).filter((learning) => learning.id !== record.id && ACTIVE_LEARNING.includes(learning.status));
  const moreSupport = eligibleSupport(memory, record.hypothesisId, record.stance, record.support);
  return [
    inspectorHead(record, [statusChip(record.status), epistemicChip(memory.epistemicOf(record))]),
    h('p', { class: 'insp-text' }, record.statement),
    facts([
      ['Postura', `${record.stance} la hipótesis`],
      [
        'Afirmación',
        `Sujeto «${record.claim.subject}», propiedad «${record.claim.property}», valor «${fmtValue(record.claim.value)}». ${record.claim.holds ? 'Se afirma.' : 'Se niega.'}`,
      ],
      ['Hipótesis', refButton(memory, record.hypothesisId)],
      ['Propuesto por', `${actorLabel(record.proposedBy)}, ${fmtDate(record.proposedAt)}`],
      ['Respaldos', h('span', {}, record.support.map((id) => refButton(memory, id)))],
      ['Verificaciones independientes', `${checks.independent} de ${checks.support}`],
      record.supersededBy ? ['Superado por', refButton(memory, record.supersededBy)] : null,
      record.priorIds.length ? ['Propuesto antes como', h('span', {}, record.priorIds.map((id) => refButton(memory, id)))] : null,
    ]),
    record.status === LEARNING_STATUS.candidato
      ? blockerList('Para aprobar (pasa a APRENDIDO)', checks.approve, 'Se cumplen los requisitos. Falta la revisión.')
      : null,
    record.status === LEARNING_STATUS.aprendido || record.status === LEARNING_STATUS.candidato
      ? blockerList(
          `Para consolidar (${checks.support} de ${checks.required} respaldos)`,
          checks.consolidate.filter((item) => !item.startsWith('Está en')),
          'Se cumplen los requisitos de consolidación.',
        )
      : null,
    record.reviews.length
      ? h(
          'section',
          {},
          h('h4', {}, 'Revisiones'),
          h('ol', { class: 'amendments' }, record.reviews.map((review) => h('li', {}, `${fmtDate(review.at)}, ${actorLabel(review.actor)}: ${review.decision}${review.notes ? `. ${review.notes}` : ''}`))),
        )
      : null,
    h(
      'div',
      { class: 'actions' },
      record.status === LEARNING_STATUS.candidato ? button('Revisar', () => forms.reviewLearning(record), { variant: 'primary' }) : null,
      record.status === LEARNING_STATUS.aprendido
        ? button('Consolidar', () => forms.consolidate(record), {
            variant: 'primary',
            disabled: checks.consolidate.length > 0,
            title: checks.consolidate.join(' ') || null,
          })
        : null,
      active && moreSupport.length ? button('Añadir respaldo', () => forms.addSupport(record)) : null,
      active && others.length ? button('Marcar como superado', () => forms.supersede(record, others)) : null,
      active ? button('Descartar', () => forms.discard(record), { variant: 'danger' }) : null,
    ),
  ];
}

function inspectContradiction(memory, record) {
  const a = memory.state.learnings[record.a];
  const b = memory.state.learnings[record.b];
  const proposal = record.status === 'abierta' ? memory.suggestReconciliation(record.id) : null;
  return [
    inspectorHead({ ...record, layer: 'evolutiva' }, [statusChip(record.status)]),
    h('p', { class: 'insp-text' }, RELATION_LABEL[record.relation] ?? record.relation),
    facts([
      ['A', h('span', {}, refButton(memory, a.id), ` ${a.statement} (${a.status})`)],
      ['B', h('span', {}, refButton(memory, b.id), ` ${b.statement} (${b.status})`)],
    ]),
    proposal
      ? h(
          'div',
          { class: 'proposal' },
          h('h4', {}, 'Propuesta de reconciliación (no aplicada)'),
          h('p', {}, proposal.rationale),
          h('p', {}, proposal.nextStep),
          proposal.resolution ? h('p', {}, `Sugerencia: ${RESOLUTION_LABEL[proposal.resolution]}.`) : null,
        )
      : null,
    record.resolution
      ? facts([
          ['Resolución', RESOLUTION_LABEL[record.resolution.resolution]],
          ['Justificación', record.resolution.notes],
          ['Resuelta por', `${actorLabel(record.resolution.actor)}, ${fmtDate(record.resolution.at)}`],
        ])
      : null,
    record.status === 'abierta' ? h('div', { class: 'actions' }, button('Resolver', () => forms.resolve(record, proposal), { variant: 'primary' })) : null,
  ];
}

function inspector(memory) {
  const id = ui.selected[memory.brain];
  const record = findRecord(memory, id);
  let body;
  if (!record) {
    body = [
      h('h3', { class: 'insp-empty-title' }, 'Inspector'),
      h('p', { class: 'muted' }, 'Selecciona un registro para ver su procedencia, su evidencia, lo que falta para avanzar y su historial.'),
    ];
  } else {
    body = {
      experiencia: inspectExperience,
      hipotesis: inspectHypothesis,
      experimento: inspectExperiment,
      aprendizaje: inspectLearning,
      contradiccion: inspectContradiction,
    }[record.kind](memory, record);
    body.push(historyBlock(memory, record.id));
  }
  return h('section', { class: 'inspector', id: 'inspector', tabindex: '-1', 'aria-label': 'Inspector del registro seleccionado' }, body);
}

function renderWorkspace() {
  const root = document.getElementById('workspace');
  const slot = lab.slots[ui.brain];
  root.className = `workspace brain-${ui.brain}`;
  let content;
  if (slot.status === SLOT_STATUS.vacio) content = emptyLedger(ui.brain);
  else if (slot.status === SLOT_STATUS.comprometido) content = compromised(slot);
  else content = h('div', { class: 'ws-grid' }, recordsPanel(slot.memory), inspector(slot.memory));
  root.replaceChildren(
    h('div', { class: 'ws-head' }, h('h2', { id: 'ws-title' }, `Memoria de ${BRAINS[ui.brain].name}`), brainTabs()),
    cycleRail(slot.memory),
    content,
  );
}

// ---------------------------------------------------------------------------------------
// Registro de eventos

function renderLedger() {
  const root = document.getElementById('ledger');
  const slot = lab.slots[ui.brain];
  const memory = slot.memory;
  const name = BRAINS[ui.brain].name;
  root.className = `ledger brain-${ui.brain}`;
  const head = h(
    'div',
    { class: 'ledger-head' },
    h('h2', { id: 'ledger-title' }, `Registro de eventos de ${name}`),
    h(
      'div',
      { class: 'actions' },
      memory ? button('Exportar registro', () => exportLedger(ui.brain)) : null,
      button('Importar registro', () => openImport()),
      slot.status !== SLOT_STATUS.vacio ? button('Descartar la copia local', () => forms.discardLocal(ui.brain), { variant: 'danger' }) : null,
    ),
  );
  if (!memory) {
    root.replaceChildren(head, h('p', { class: 'muted' }, slot.status === SLOT_STATUS.vacio ? 'Sin eventos.' : 'Registro bloqueado por integridad.'));
    return;
  }
  const check = memory.verify();
  const events = memory.events.slice().reverse();
  root.replaceChildren(
    head,
    h(
      'p',
      { class: `chain ${check.ok ? 'is-ok' : 'is-broken'}` },
      check.ok
        ? `Verificado ahora: ${plural(events.length, 'evento encadenado', 'eventos encadenados')}, cada uno con el hash del anterior. Solo se añade; nada se reescribe.`
        : `Cadena rota: ${check.problems.join(' ')}`,
    ),
    h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'events' },
        h('thead', {}, h('tr', {}, ['N.º', 'Fecha', 'Evento', 'Autor', 'Hash', 'Anterior'].map((label) => h('th', { scope: 'col' }, label)))),
        h(
          'tbody',
          {},
          events.map((event) =>
            h(
              'tr',
              { class: ui.pulse?.brain === ui.brain && ui.pulse.seq === event.seq ? 'pulse' : null },
              h('td', { class: 'mono' }, String(event.seq)),
              h('td', {}, fmtDate(event.at)),
              h('td', {}, EVENT_LABEL[event.type] ?? event.type),
              h('td', {}, actorLabel(event.actor)),
              h('td', { class: 'mono' }, shortHash(event.hash)),
              h('td', { class: 'mono' }, event.prev ? shortHash(event.prev) : 'origen'),
            ),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------
// Importar y exportar

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportLedger(brain) {
  const data = lab.exportLedger(brain);
  downloadText(JSON.stringify(data, null, 2), `char-brain-lab-${brain}-${new Date().toISOString().slice(0, 10)}.json`);
  notify(`Registro de ${BRAINS[brain].name} exportado (${plural(data.events.length, 'evento', 'eventos')}).`);
}

function importResult(result) {
  const name = BRAINS[result.brain].name;
  const text = {
    nuevo: `Registro de ${name} importado: ${plural(result.added, 'evento verificado', 'eventos verificados')}.`,
    extensión: `Registro de ${name} actualizado: ${plural(result.added, 'evento nuevo', 'eventos nuevos')}, todos verificados.`,
    'sin-cambios': `El registro importado de ${name} ya coincidía con el actual.`,
  }[result.mode];
  afterChange({ brain: result.brain, text });
}

function importText(text) {
  try {
    importResult(lab.importLedger(text));
  } catch (error) {
    notify(`No se importó: ${error.message}`, 'error');
  }
}

function openImport() {
  document.getElementById('import-file').click();
}

document.getElementById('import-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) importText(await file.text());
});

async function importBundled() {
  try {
    const response = await fetch('../data/claude-brain.ledger.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`no se pudo leer el archivo (${response.status})`);
    importText(await response.text());
  } catch (error) {
    notify(`No se importó la inspección inicial: ${error.message}`, 'error');
  }
}

// ---------------------------------------------------------------------------------------
// Formularios

const dialog = document.getElementById('form-dialog');
let fieldSeq = 0;

function wrapField(field, id, control) {
  const helpId = field.help ? `${id}-help` : null;
  if (helpId) control.setAttribute('aria-describedby', helpId);
  return h(
    'div',
    { class: 'field' },
    h('label', { for: id }, field.label, field.optional ? h('span', { class: 'opt' }, ' (opcional)') : null),
    field.help ? h('p', { class: 'help', id: helpId }, field.help) : null,
    control,
  );
}

function selectControl(id, options, value) {
  return h(
    'select',
    { id },
    options.map((option) => {
      const [optionValue, label] = Array.isArray(option) ? option : [option, option];
      return h('option', { value: optionValue, selected: optionValue === value }, label);
    }),
  );
}

function repeatable({ legend, help, rows = 1, makeRow, addLabel }) {
  const list = h('div', { class: 'rows-edit' });
  const items = [];
  const add = () => {
    const row = makeRow(items.length + 1);
    items.push(row);
    list.append(row.el);
  };
  for (let i = 0; i < rows; i++) add();
  const el = h(
    'fieldset',
    { class: 'field repeat' },
    h('legend', {}, legend),
    help ? h('p', { class: 'help' }, help) : null,
    list,
    button(addLabel, add),
  );
  return { el, items };
}

function buildField(field) {
  const id = `f-${++fieldSeq}`;
  switch (field.type) {
    case 'info':
      return { name: null, el: h('div', { class: 'form-info' }, [field.text].flat().map((line) => h('p', {}, line))) };
    case 'text':
    case 'datetime-local': {
      const input = h('input', { id, type: field.type, value: field.value ?? '', autocomplete: 'off', maxlength: field.type === 'text' ? 2000 : null, placeholder: field.placeholder ?? null });
      return { name: field.name, el: wrapField(field, id, input), value: () => input.value };
    }
    case 'textarea': {
      const area = h('textarea', { id, rows: field.rows ?? 3, maxlength: 4000, placeholder: field.placeholder ?? null });
      area.value = field.value ?? '';
      return { name: field.name, el: wrapField(field, id, area), value: () => area.value };
    }
    case 'select': {
      const control = selectControl(id, field.options, field.value);
      return { name: field.name, el: wrapField(field, id, control), value: () => control.value };
    }
    case 'checks': {
      const boxes = field.options.map(([value, label]) => {
        const boxId = `${id}-${slug(value)}`;
        const box = h('input', { type: 'checkbox', id: boxId, value, checked: (field.value ?? []).includes(value) });
        return { box, el: h('div', { class: 'check' }, box, h('label', { for: boxId }, label)) };
      });
      const el = h(
        'fieldset',
        { class: 'field' },
        h('legend', {}, field.label),
        field.help ? h('p', { class: 'help' }, field.help) : null,
        boxes.length ? boxes.map((item) => item.el) : h('p', { class: 'muted' }, field.emptyText ?? 'No hay opciones disponibles.'),
      );
      return { name: field.name, el, value: () => boxes.filter((item) => item.box.checked).map((item) => item.box.value) };
    }
    case 'evidence': {
      const group = repeatable({
        legend: field.label,
        help: field.help,
        rows: 1,
        addLabel: 'Añadir otra evidencia',
        makeRow: (n) => {
          const kind = selectControl(`${id}-k${n}`, EVIDENCE_KINDS, 'archivo');
          kind.setAttribute('aria-label', `Tipo de la evidencia ${n}`);
          const ref = h('input', { type: 'text', 'aria-label': `Referencia de la evidencia ${n}`, placeholder: 'Ruta, comando, enlace o cita', autocomplete: 'off' });
          const description = h('input', { type: 'text', 'aria-label': `Descripción de la evidencia ${n} (opcional)`, placeholder: 'Qué demuestra (opcional)', autocomplete: 'off' });
          return { el: h('div', { class: 'row-edit ev-row' }, kind, ref, description), read: () => ({ kind: kind.value, ref: ref.value, description: description.value }) };
        },
      });
      return { name: field.name, el: group.el, value: () => group.items.map((item) => item.read()).filter((item) => item.ref.trim()) };
    }
    case 'criteria': {
      const group = repeatable({
        legend: field.label,
        help: field.help,
        rows: 1,
        addLabel: 'Añadir criterio',
        makeRow: (n) => {
          const metric = h('input', { type: 'text', 'aria-label': `Métrica del criterio C${n}`, placeholder: `Métrica C${n}, p. ej. errores`, autocomplete: 'off' });
          const operator = selectControl(`${id}-o${n}`, OPERATORS, '>=');
          operator.setAttribute('aria-label', `Condición del criterio C${n}`);
          const target = h('input', { type: 'text', 'aria-label': `Objetivo del criterio C${n}`, placeholder: 'Objetivo', autocomplete: 'off' });
          const description = h('input', { type: 'text', 'aria-label': `Descripción del criterio C${n} (opcional)`, placeholder: 'Qué significa (opcional)', autocomplete: 'off' });
          return {
            el: h('div', { class: 'row-edit crit-row' }, metric, operator, target, description),
            read: () => ({ metric: metric.value, operator: operator.value, target: target.value, description: description.value }),
          };
        },
      });
      return { name: field.name, el: group.el, value: () => group.items.map((item) => item.read()).filter((item) => item.metric.trim() || item.target.trim()) };
    }
    case 'measurements': {
      const inputs = field.metrics.map(({ metric, conditions }, index) => {
        const inputId = `${id}-m${index}`;
        const input = h('input', { id: inputId, type: 'text', autocomplete: 'off', placeholder: 'sin medición' });
        return { metric, input, el: h('div', { class: 'field inline' }, h('label', { for: inputId }, h('span', { class: 'mono' }, metric), h('span', { class: 'help' }, ` criterio: ${conditions}`)), input) };
      });
      const el = h('fieldset', { class: 'field' }, h('legend', {}, field.label), field.help ? h('p', { class: 'help' }, field.help) : null, inputs.map((item) => item.el));
      return {
        name: field.name,
        el,
        value: () => Object.fromEntries(inputs.map((item) => [item.metric, item.input.value.trim() === '' ? null : item.input.value])),
      };
    }
    default:
      throw new Error(`Campo desconocido: ${field.type}`);
  }
}

function errorText(error) {
  return error instanceof RuleViolation ? error.message : `Error inesperado: ${error.message}`;
}

function openForm({ title, fields = [], submit, danger = false, onSubmit }) {
  const controls = fields.map(buildField);
  const errorBox = h('p', { class: 'form-error', role: 'alert', tabindex: '-1', hidden: true });
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    h('h2', { id: 'dialog-title' }, title),
    controls.map((control) => control.el),
    errorBox,
    h(
      'div',
      { class: 'actions form-actions' },
      button('Cancelar', () => dialog.close()),
      h('button', { type: 'submit', class: `btn ${danger ? 'danger' : 'primary'}` }, submit),
    ),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = {};
    for (const control of controls) if (control.name) values[control.name] = control.value();
    try {
      const result = onSubmit(values);
      dialog.close();
      afterChange(result);
    } catch (error) {
      errorBox.hidden = false;
      errorBox.textContent = errorText(error);
      errorBox.focus();
    }
  });
  dialog.replaceChildren(form);
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.showModal();
  form.querySelector('input:not([type=checkbox]), textarea, select')?.focus();
}

const isoFromLocal = (value) => (value ? new Date(value).toISOString() : undefined);

const forms = {
  operator() {
    openForm({
      title: 'Operador',
      submit: 'Guardar nombre',
      fields: [
        { type: 'info', text: 'Tus acciones se registran como persona con este nombre. No hay autenticación: el nombre es declarado, no verificado.' },
        { type: 'text', name: 'name', label: 'Nombre', value: ui.operator },
      ],
      onSubmit: ({ name }) => {
        const clean = name.trim();
        if (!clean) throw new RuleViolation('CAMPO_REQUERIDO', 'Escribe un nombre.');
        ui.operator = clean.slice(0, 120);
        prefs.write('charlab.v1.operator', ui.operator);
        return { brain: ui.brain, text: `Tus acciones se registrarán como ${actorLabel(actor())}.` };
      },
    });
  },

  createLedger(brain) {
    const name = BRAINS[brain].name;
    openForm({
      title: `Crear el registro de ${name}`,
      submit: 'Crear registro',
      fields: [
        {
          type: 'info',
          text: [
            `El primer evento graba la identidad de ${name} y su política de aprendizaje. Esa capa base no se puede redefinir después.`,
            'Política: aprobar un candidato lo puede hacer una persona o el propio Brain; consolidar exige una persona, 2 respaldos verificados y al menos una verificación independiente. Hasta 3 reintentos por experimento.',
            `Quedará registrado que lo creó ${actorLabel(actor())}.`,
          ],
        },
      ],
      onSubmit: () => {
        lab.create(brain, ctx());
        return { brain, text: `Registro de ${name} creado.` };
      },
    });
  },

  recordExperience() {
    openForm({
      title: 'Registrar experiencia',
      submit: 'Registrar experiencia',
      fields: [
        { type: 'textarea', name: 'summary', label: 'Qué se observó', placeholder: 'Describe lo observado, sin interpretarlo' },
        { type: 'select', name: 'sourceKind', label: 'Tipo de fuente', options: SOURCE_KINDS, value: 'observación-directa' },
        { type: 'text', name: 'sourceRef', label: 'Fuente', help: 'Dónde está: archivo, conversación, comando o enlace.' },
        { type: 'text', name: 'sourceDescription', label: 'Contexto de la fuente', optional: true },
        { type: 'datetime-local', name: 'observedAt', label: 'Cuándo se observó', value: toLocalInput() },
        {
          type: 'select',
          name: 'epistemic',
          label: 'Estado epistemológico',
          options: EXPERIENCE_EPISTEMIC,
          value: EPISTEMIC.observacion,
          help: 'Un hecho respaldado necesita al menos una evidencia.',
        },
        { type: 'evidence', name: 'evidence', label: 'Evidencia', help: 'Opcional para una observación; obligatoria para un hecho respaldado.' },
      ],
      onSubmit: (values) => {
        const id = run((memory) =>
          memory.recordExperience(
            {
              summary: values.summary,
              source: { kind: values.sourceKind, ref: values.sourceRef, description: values.sourceDescription },
              observedAt: isoFromLocal(values.observedAt),
              epistemic: values.epistemic,
              evidence: values.evidence,
            },
            ctx(),
          ),
        );
        return { brain: ui.brain, text: `Experiencia ${id} registrada.`, selectId: id };
      },
    });
  },

  amendExperience(record) {
    openForm({
      title: `Corregir ${record.id}`,
      submit: 'Registrar corrección',
      fields: [
        { type: 'info', text: 'La corrección no borra nada: el valor anterior, tu nombre y el motivo quedan en el historial.' },
        { type: 'textarea', name: 'summary', label: 'Resumen', value: record.summary },
        { type: 'select', name: 'epistemic', label: 'Estado epistemológico', options: EXPERIENCE_AMEND_EPISTEMIC, value: record.epistemic },
        { type: 'evidence', name: 'addEvidence', label: 'Añadir evidencia' },
        { type: 'textarea', name: 'reason', label: 'Motivo de la corrección' },
      ],
      onSubmit: (values) => {
        const changes = {};
        if (values.summary.trim() !== record.summary) changes.summary = values.summary;
        if (values.epistemic !== record.epistemic) changes.epistemic = values.epistemic;
        if (values.addEvidence.length) changes.addEvidence = values.addEvidence;
        run((memory) => memory.amendExperience(record.id, changes, values.reason, ctx()));
        return { brain: ui.brain, text: `Corrección de ${record.id} registrada.`, selectId: record.id };
      },
    });
  },

  formulateHypothesis(fromId) {
    const memory = lab.memory(ui.brain);
    const options = Object.values(memory.state.experiences)
      .filter((experience) => experience.epistemic !== EPISTEMIC.descartado)
      .map((experience) => [experience.id, `${experience.id}: ${experience.summary.slice(0, 90)}`]);
    openForm({
      title: 'Formular hipótesis',
      submit: 'Formular hipótesis',
      fields: [
        { type: 'textarea', name: 'statement', label: 'Hipótesis', placeholder: 'Una explicación posible, no un hecho' },
        {
          type: 'info',
          text: 'Escribe la afirmación de forma estructurada. Así el laboratorio detecta duplicados y contradicciones (compara el texto normalizado; no reconoce sinónimos).',
        },
        { type: 'text', name: 'subject', label: 'Sujeto', placeholder: 'p. ej. motor de memoria' },
        { type: 'text', name: 'property', label: 'Propiedad', placeholder: 'p. ej. rechaza escrituras entre Brains' },
        { type: 'text', name: 'value', label: 'Valor', placeholder: 'p. ej. sí, 300 ms, alta' },
        { type: 'checks', name: 'basedOn', label: 'Experiencias en las que se basa', options, value: fromId ? [fromId] : [] },
      ],
      onSubmit: (values) => {
        const id = run((m) =>
          m.formulateHypothesis({ statement: values.statement, claim: { subject: values.subject, property: values.property, value: values.value }, basedOn: values.basedOn }, ctx()),
        );
        return { brain: ui.brain, text: `Hipótesis ${id} formulada.`, selectId: id };
      },
    });
  },

  proposeExperiment(hypothesis) {
    openForm({
      title: `Proponer experimento para ${hypothesis.id}`,
      submit: 'Proponer experimento',
      fields: [
        {
          type: 'info',
          text: 'Los criterios de éxito quedan fijados con un hash antes de ejecutar y no se pueden cambiar. Para cambiarlos hay que proponer otro experimento, y eso queda en el historial.',
        },
        { type: 'textarea', name: 'description', label: 'Procedimiento', placeholder: 'Qué se hará y en qué condiciones' },
        {
          type: 'select',
          name: 'mode',
          label: 'Modo',
          options: EXPERIMENT_MODES,
          value: 'simulación',
          help: 'El laboratorio no admite acciones reales: ni financieras ni de ningún otro tipo.',
        },
        {
          type: 'criteria',
          name: 'criteria',
          label: 'Criterios de éxito',
          help: 'Para >, >=, < y <= el objetivo debe ser un número. Para == y != puede ser texto, número o sí/no.',
        },
      ],
      onSubmit: (values) => {
        const id = run((memory) => memory.proposeExperiment({ hypothesisId: hypothesis.id, description: values.description, mode: values.mode, criteria: values.criteria }, ctx()));
        return { brain: ui.brain, text: `Experimento ${id} propuesto con sus criterios fijados.`, selectId: id };
      },
    });
  },

  retryExperiment(record) {
    openForm({
      title: `Reintentar ${record.id}`,
      submit: 'Proponer reintento',
      fields: [
        {
          type: 'info',
          text: [
            `El reintento usa exactamente los mismos criterios (hash ${shortHash(record.criteriaHash)}).`,
            `Criterios: ${record.criteria.map((criterion) => `${criterion.id} ${criterion.metric} ${criterion.operator} ${fmtValue(criterion.target)}`).join('; ')}.`,
          ],
        },
        { type: 'textarea', name: 'description', label: 'Procedimiento', value: `Reintento de ${record.id}: ${record.description}` },
        { type: 'select', name: 'mode', label: 'Modo', options: EXPERIMENT_MODES, value: record.mode },
      ],
      onSubmit: (values) => {
        const id = run((memory) => memory.proposeExperiment({ hypothesisId: record.hypothesisId, description: values.description, mode: values.mode, retryOf: record.id }, ctx()));
        return { brain: ui.brain, text: `Reintento ${id} propuesto.`, selectId: id };
      },
    });
  },

  recordExecution(record) {
    openForm({
      title: `Registrar la ejecución de ${record.id}`,
      submit: 'Registrar ejecución',
      fields: [
        { type: 'info', text: 'El laboratorio no ejecuta el experimento: registra que se ejecutó fuera y si la infraestructura funcionó.' },
        {
          type: 'select',
          name: 'infrastructure',
          label: 'Infraestructura',
          options: [
            ['correcta', 'Correcta: la ejecución se completó'],
            ['fallida', 'Fallida: problema de infraestructura (no cuenta como evidencia)'],
          ],
          value: 'correcta',
        },
        { type: 'textarea', name: 'notes', label: 'Notas', optional: true },
      ],
      onSubmit: (values) => {
        run((memory) => memory.recordExecution(record.id, values, ctx()));
        return { brain: ui.brain, text: `Ejecución de ${record.id} registrada.`, selectId: record.id };
      },
    });
  },

  recordObservation(record) {
    const metrics = [...new Set(record.criteria.map((criterion) => criterion.metric))].map((metric) => ({
      metric,
      conditions: record.criteria
        .filter((criterion) => criterion.metric === metric)
        .map((criterion) => `${criterion.operator} ${criterion.target}`)
        .join(' y '),
    }));
    openForm({
      title: `Registrar el resultado de ${record.id}`,
      submit: 'Registrar resultado',
      fields: [
        { type: 'measurements', name: 'measurements', label: 'Mediciones', metrics, help: 'Deja en blanco lo que no se midió: contará como desconocido, no como fallo.' },
        { type: 'evidence', name: 'evidence', label: 'Evidencia del resultado' },
        { type: 'textarea', name: 'notes', label: 'Notas', optional: true },
      ],
      onSubmit: (values) => {
        run((memory) => memory.recordObservation(record.id, values, ctx()));
        return { brain: ui.brain, text: `Resultado de ${record.id} observado y comparado con sus criterios. Falta verificarlo.`, selectId: record.id };
      },
    });
  },

  verifyResult(record) {
    const same = record.observation.actor.kind === 'humano' && record.observation.actor.id === ui.operator;
    openForm({
      title: `Verificar el resultado de ${record.id}`,
      submit: 'Registrar verificación',
      fields: [
        {
          type: 'info',
          text: `Lo observó ${actorLabel(record.observation.actor)}. Verificas como ${actorLabel(actor())}: ${same ? 'la verificación no contará como independiente.' : 'la verificación contará como independiente.'}`,
        },
        {
          type: 'select',
          name: 'outcome',
          label: 'Resultado de la verificación',
          options: [
            ['confirmado', 'Confirmado: la evidencia sostiene lo observado'],
            ['refutado', 'Refutado: lo observado no es correcto'],
            ['no-verificable', 'No verificable: no hay forma de comprobarlo'],
          ],
          value: 'confirmado',
        },
        { type: 'textarea', name: 'method', label: 'Método', placeholder: 'Cómo lo comprobaste' },
        { type: 'evidence', name: 'evidence', label: 'Evidencia de la verificación', help: 'Obligatoria para confirmar o refutar.' },
      ],
      onSubmit: (values) => {
        run((memory) => memory.verifyResult(record.id, values, ctx()));
        const verdict = lab.memory(ui.brain).state.experiments[record.id].verdict;
        return { brain: ui.brain, text: `Verificación de ${record.id} registrada. Veredicto: ${verdict ?? 'ninguno'}.`, selectId: record.id };
      },
    });
  },

  proposeLearning(hypothesis) {
    const memory = lab.memory(ui.brain);
    const eligible = eligibleSupport(memory, hypothesis.id, null);
    const stances = [];
    if (eligible.some((experiment) => experiment.verdict === VERDICT.respaldada)) stances.push(['respalda', 'Respalda la hipótesis']);
    if (eligible.some((experiment) => experiment.verdict === VERDICT.debilitada)) stances.push(['debilita', 'La hipótesis no se sostiene']);
    openForm({
      title: `Proponer aprendizaje desde ${hypothesis.id}`,
      submit: 'Proponer aprendizaje',
      fields: [
        { type: 'info', text: 'Quedará como CANDIDATO. Nada se consolida sin revisión.' },
        { type: 'select', name: 'stance', label: 'Postura', options: stances, value: stances[0]?.[0] },
        { type: 'textarea', name: 'statement', label: 'Aprendizaje', value: hypothesis.statement },
        {
          type: 'checks',
          name: 'support',
          label: 'Experimentos que lo respaldan',
          help: 'Solo cuentan los verificados cuyo veredicto coincide con la postura.',
          options: eligible.map((experiment) => [experiment.id, `${experiment.id}: veredicto ${experiment.verdict}`]),
          value: eligible.filter((experiment) => experiment.verdict === STANCE_VERDICT[stances[0]?.[0]]).map((experiment) => experiment.id),
        },
      ],
      onSubmit: (values) => {
        const id = run((m) => m.proposeLearning({ hypothesisId: hypothesis.id, stance: values.stance, statement: values.statement, support: values.support }, ctx()));
        return { brain: ui.brain, text: `Aprendizaje ${id} propuesto como CANDIDATO.`, selectId: id };
      },
    });
  },

  addSupport(learning) {
    const memory = lab.memory(ui.brain);
    const eligible = eligibleSupport(memory, learning.hypothesisId, learning.stance, learning.support);
    openForm({
      title: `Añadir respaldo a ${learning.id}`,
      submit: 'Añadir respaldo',
      fields: [{ type: 'checks', name: 'ids', label: 'Experimentos verificados', options: eligible.map((experiment) => [experiment.id, `${experiment.id}: ${experiment.description.slice(0, 80)}`]) }],
      onSubmit: ({ ids }) => {
        run((m) => m.addLearningSupport(learning.id, ids, ctx()));
        return { brain: ui.brain, text: `Respaldo añadido a ${learning.id}.`, selectId: learning.id };
      },
    });
  },

  reviewLearning(learning) {
    const checks = lab.memory(ui.brain).learningChecks(learning.id, actor());
    const options = [
      ['solicitar-evidencia', 'Pedir más evidencia (sigue como CANDIDATO)'],
      ['rechazar', 'Rechazar (pasa a DESCARTADO)'],
    ];
    if (!checks.approve.length) options.unshift(['aprobar', 'Aprobar (pasa a APRENDIDO)']);
    openForm({
      title: `Revisar ${learning.id}`,
      submit: 'Registrar revisión',
      fields: [
        {
          type: 'info',
          text: checks.approve.length ? [`No se puede aprobar todavía: ${checks.approve.join(' ')}`] : ['Se cumplen los requisitos para aprobar.'],
        },
        { type: 'select', name: 'decision', label: 'Decisión', options, value: options[0][0] },
        { type: 'textarea', name: 'notes', label: 'Notas', help: 'Obligatorias para rechazar o pedir evidencia.' },
      ],
      onSubmit: (values) => {
        run((m) => m.reviewLearning(learning.id, values, ctx()));
        return { brain: ui.brain, text: `Revisión de ${learning.id} registrada. Estado: ${lab.memory(ui.brain).state.learnings[learning.id].status}.`, selectId: learning.id };
      },
    });
  },

  consolidate(learning) {
    openForm({
      title: `Consolidar ${learning.id}`,
      submit: 'Consolidar',
      fields: [
        { type: 'info', text: 'Consolidar no cambia la capa base: el aprendizaje sigue en la capa evolutiva y puede superarse o descartarse más adelante (solo por una persona).' },
        { type: 'textarea', name: 'notes', label: 'Notas', optional: true },
      ],
      onSubmit: (values) => {
        run((m) => m.consolidateLearning(learning.id, values, ctx()));
        return { brain: ui.brain, text: `${learning.id} consolidado.`, selectId: learning.id };
      },
    });
  },

  supersede(learning, others) {
    openForm({
      title: `Marcar ${learning.id} como superado`,
      submit: 'Marcar como superado',
      fields: [
        { type: 'select', name: 'by', label: 'Lo sustituye', options: others.map((other) => [other.id, `${other.id}: ${other.statement.slice(0, 80)}`]), value: others[0].id },
        { type: 'textarea', name: 'reason', label: 'Motivo' },
      ],
      onSubmit: (values) => {
        run((m) => m.supersedeLearning(learning.id, values, ctx()));
        return { brain: ui.brain, text: `${learning.id} superado por ${values.by}.`, selectId: learning.id };
      },
    });
  },

  discard(learning) {
    openForm({
      title: `Descartar ${learning.id}`,
      submit: 'Descartar aprendizaje',
      danger: true,
      fields: [
        { type: 'info', text: 'El aprendizaje no se borra: queda como DESCARTADO, con tu nombre y el motivo.' },
        { type: 'textarea', name: 'reason', label: 'Motivo' },
      ],
      onSubmit: (values) => {
        run((m) => m.discardLearning(learning.id, values, ctx()));
        return { brain: ui.brain, text: `${learning.id} descartado.`, selectId: learning.id };
      },
    });
  },

  resolve(contradiction, proposal) {
    openForm({
      title: 'Resolver contradicción',
      submit: 'Registrar resolución',
      fields: [
        {
          type: 'info',
          text: [
            `A es ${contradiction.a}; B es ${contradiction.b}.`,
            proposal ? `Propuesta (no aplicada): ${proposal.nextStep}` : null,
          ].filter(Boolean),
        },
        {
          type: 'select',
          name: 'resolution',
          label: 'Resolución',
          options: Object.entries(RESOLUTION_LABEL),
          value: proposal?.resolution ?? 'compatibles',
        },
        { type: 'textarea', name: 'notes', label: 'Justificación' },
      ],
      onSubmit: (values) => {
        run((m) => m.resolveContradiction(contradiction.id, values, ctx()));
        return { brain: ui.brain, text: 'Contradicción resuelta.', selectId: contradiction.id };
      },
    });
  },

  cancelExperiment(record) {
    openForm({
      title: `Cancelar ${record.id}`,
      submit: 'Cancelar experimento',
      danger: true,
      fields: [{ type: 'textarea', name: 'reason', label: 'Motivo' }],
      onSubmit: ({ reason }) => {
        run((m) => m.cancelExperiment(record.id, reason, ctx()));
        return { brain: ui.brain, text: `${record.id} cancelado.`, selectId: record.id };
      },
    });
  },

  discardLocal(brain) {
    const name = BRAINS[brain].name;
    openForm({
      title: `Descartar la copia local de ${name}`,
      submit: 'Descartar copia local',
      danger: true,
      fields: [
        {
          type: 'info',
          text: 'Se borra el registro guardado en este navegador. No afecta a registros que hayas exportado. Si quieres conservarlo, expórtalo antes.',
        },
        { type: 'checks', name: 'confirm', label: 'Confirmación', options: [['si', 'Entiendo que esta acción no se puede deshacer']] },
      ],
      onSubmit: ({ confirm }) => {
        if (!confirm.includes('si')) throw new RuleViolation('CONFIRMACION', 'Marca la confirmación para descartar la copia local.');
        lab.discardLocal(brain);
        ui.selected[brain] = null;
        return { brain, text: `Copia local de ${name} descartada.` };
      },
    });
  },
};

// ---------------------------------------------------------------------------------------

function render() {
  renderMasthead();
  renderField();
  renderWorkspace();
  renderLedger();
  ui.pulse = null;
}

render();
document.documentElement.dataset.ready = 'true';
