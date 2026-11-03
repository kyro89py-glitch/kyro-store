// Registro de eventos de un Brain: solo se añade, nunca se reescribe.
//
// Cada evento lleva el hash del anterior. Alterar, borrar, reordenar o insertar un
// evento pasado rompe la cadena y `verifyChain` lo detecta.
//
// Límite conocido: no hay firmas. Quien tenga acceso de escritura puede recalcular la
// cadena completa; la cadena prueba coherencia interna, no autoría. Las firmas por Brain
// son un incremento posterior.

import { canonicalize, sha256Hex } from './integrity.js';
import { EVENT_VERSION, LEDGER_FORMAT, LEDGER_FORMAT_VERSION } from './vocabulary.js';

const HASHED_FIELDS = ['v', 'seq', 'ledger', 'type', 'at', 'actor', 'session', 'payload', 'prev'];

export function hashEvent(event) {
  const body = {};
  for (const field of HASHED_FIELDS) body[field] = event[field];
  return sha256Hex(canonicalize(body));
}

/** Construye el sobre del siguiente evento (sin validar las reglas de memoria). */
export function buildEvent({ previous, ledger, type, at, actor, session, payload }) {
  const event = {
    v: EVENT_VERSION,
    seq: previous ? previous.seq + 1 : 1,
    ledger,
    type,
    at,
    actor,
    session: session ?? null,
    payload,
    prev: previous ? previous.hash : null,
  };
  event.hash = hashEvent(event);
  return event;
}

/** Comprueba la cadena completa. Devuelve todos los problemas, no solo el primero. */
export function verifyChain(events, expectedLedger) {
  const problems = [];
  if (!Array.isArray(events)) return { ok: false, problems: ['El registro no contiene una lista de eventos.'] };
  events.forEach((event, index) => {
    const label = `Evento ${index + 1}`;
    if (!event || typeof event !== 'object') {
      problems.push(`${label}: no es un objeto.`);
      return;
    }
    if (event.seq !== index + 1) problems.push(`${label}: número de secuencia ${event.seq}, se esperaba ${index + 1}.`);
    const expectedPrev = index === 0 ? null : events[index - 1]?.hash;
    if (event.prev !== expectedPrev) problems.push(`${label}: no enlaza con el evento anterior.`);
    if (expectedLedger && event.ledger !== expectedLedger) {
      problems.push(`${label}: pertenece al registro "${event.ledger}", no a "${expectedLedger}".`);
    }
    let recomputed = null;
    try {
      recomputed = hashEvent(event);
    } catch (error) {
      problems.push(`${label}: no se puede calcular su hash (${error.message}).`);
    }
    if (recomputed && recomputed !== event.hash) problems.push(`${label}: el contenido no coincide con su hash.`);
  });
  return { ok: problems.length === 0, problems };
}

export function serializeLedger(brain, events) {
  return {
    format: LEDGER_FORMAT,
    formatVersion: LEDGER_FORMAT_VERSION,
    brain,
    head: events.length ? events[events.length - 1].hash : null,
    events,
  };
}

/** Lee un registro exportado. No aplica reglas: eso lo hace la reproducción. */
export function parseLedger(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!data || data.format !== LEDGER_FORMAT) throw new Error('No es un registro de Char · Dual Brain Lab.');
  if (data.formatVersion !== LEDGER_FORMAT_VERSION) {
    throw new Error(`Versión de formato no admitida: ${data.formatVersion}.`);
  }
  if (!Array.isArray(data.events)) throw new Error('El registro no contiene eventos.');
  const head = data.events.length ? data.events[data.events.length - 1].hash : null;
  if (data.head !== head) throw new Error('La cabecera declarada no coincide con el último evento.');
  return { brain: data.brain, events: data.events };
}
