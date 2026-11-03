// Laboratorio: dos memorias independientes (Char y Claude) y su almacenamiento.
//
// Cada Brain tiene su propio registro y su propia clave de almacenamiento. El laboratorio
// no fusiona, no copia y no sincroniza registros entre Brains. Si un registro guardado no
// supera la verificación, queda bloqueado: nunca se sustituye en silencio por uno nuevo.

import { BrainMemory } from './brain.js';
import { parseLedger, serializeLedger } from './ledger.js';
import { RuleViolation } from './rules.js';
import { BRAINS } from './vocabulary.js';

export const STORAGE_PREFIX = 'charlab.v1.ledger.';

export const SLOT_STATUS = Object.freeze({
  vacio: 'vacío',
  integro: 'íntegro',
  comprometido: 'comprometido',
});

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export class Lab {
  #storage;
  #clock;
  slots;

  constructor({ storage = null, clock } = {}) {
    this.#storage = storage;
    this.#clock = clock;
    this.slots = {};
    for (const brain of Object.keys(BRAINS)) this.slots[brain] = this.#emptySlot(brain);
  }

  #emptySlot(brain) {
    return { brain, status: SLOT_STATUS.vacio, memory: null, problems: [], persisted: null };
  }

  get storageAvailable() {
    if (!this.#storage) return false;
    return safe(() => {
      const key = `${STORAGE_PREFIX}__prueba`;
      this.#storage.setItem(key, '1');
      this.#storage.removeItem(key);
      return true;
    }, false);
  }

  /** Carga los registros guardados. Un registro dañado se marca, no se reemplaza. */
  load() {
    for (const brain of Object.keys(BRAINS)) {
      const raw = this.#storage ? safe(() => this.#storage.getItem(STORAGE_PREFIX + brain), null) : null;
      if (!raw) {
        this.slots[brain] = this.#emptySlot(brain);
        continue;
      }
      try {
        const parsed = parseLedger(raw);
        if (parsed.brain !== brain) {
          throw new RuleViolation('IDENTIDAD', `El registro guardado para ${BRAINS[brain].name} declara pertenecer a "${parsed.brain}".`);
        }
        const memory = BrainMemory.fromEvents(parsed.events, { clock: this.#clock, expectedBrain: brain });
        if (memory.brain !== brain) throw new RuleViolation('IDENTIDAD', 'El registro guardado no corresponde a este Brain.');
        this.slots[brain] = { brain, status: SLOT_STATUS.integro, memory, problems: [], persisted: true };
      } catch (error) {
        this.slots[brain] = {
          brain,
          status: SLOT_STATUS.comprometido,
          memory: null,
          problems: error?.details?.problems ?? [error?.message ?? String(error)],
          persisted: true,
        };
      }
    }
    return this;
  }

  memory(brain) {
    return this.slots[brain]?.memory ?? null;
  }

  #persist(brain) {
    const slot = this.slots[brain];
    if (!this.#storage || !slot.memory) {
      slot.persisted = false;
      return false;
    }
    slot.persisted = safe(() => {
      this.#storage.setItem(STORAGE_PREFIX + brain, JSON.stringify(slot.memory.export()));
      return true;
    }, false);
    return slot.persisted;
  }

  /** Crea el registro de un Brain. Solo si no existe ninguno (ni íntegro ni dañado). */
  create(brain, ctx) {
    const slot = this.slots[brain];
    if (!slot) throw new RuleViolation('BRAIN_DESCONOCIDO', `Brain desconocido: "${brain}".`);
    if (slot.status !== SLOT_STATUS.vacio) {
      throw new RuleViolation('REGISTRO_EXISTENTE', `${BRAINS[brain].name} ya tiene un registro; no se crea otro encima.`);
    }
    const memory = BrainMemory.create(brain, ctx, { clock: this.#clock });
    this.slots[brain] = { brain, status: SLOT_STATUS.integro, memory, problems: [], persisted: null };
    this.#persist(brain);
    return memory;
  }

  /** Ejecuta un comando sobre la memoria de un Brain y guarda el resultado. */
  run(brain, command) {
    const slot = this.slots[brain];
    if (!slot) throw new RuleViolation('BRAIN_DESCONOCIDO', `Brain desconocido: "${brain}".`);
    if (slot.status === SLOT_STATUS.comprometido) {
      throw new RuleViolation('REGISTRO_BLOQUEADO', `El registro de ${BRAINS[brain].name} no superó la verificación de integridad; no admite escrituras.`);
    }
    if (!slot.memory) throw new RuleViolation('REGISTRO_INEXISTENTE', `${BRAINS[brain].name} aún no tiene registro.`);
    const result = command(slot.memory);
    this.#persist(brain);
    return result;
  }

  exportLedger(brain) {
    const memory = this.memory(brain);
    if (!memory) throw new RuleViolation('REGISTRO_INEXISTENTE', `${BRAINS[brain].name} aún no tiene registro.`);
    return memory.export();
  }

  /**
   * Importa un registro exportado. Se admite si el Brain no tiene registro o si el
   * importado EXTIENDE el actual (mismos eventos iniciales). Nunca se fusionan historiales.
   */
  importLedger(input) {
    const parsed = parseLedger(input);
    if (!BRAINS[parsed.brain]) throw new RuleViolation('BRAIN_DESCONOCIDO', `Brain desconocido: "${parsed.brain}".`);
    const candidate = BrainMemory.fromEvents(parsed.events, { clock: this.#clock, expectedBrain: parsed.brain });
    if (candidate.brain !== parsed.brain) {
      throw new RuleViolation('IDENTIDAD', 'El registro declara un Brain distinto del que contienen sus eventos.');
    }
    const brain = parsed.brain;
    const slot = this.slots[brain];
    if (slot.status === SLOT_STATUS.comprometido) {
      throw new RuleViolation('REGISTRO_BLOQUEADO', `La copia local de ${BRAINS[brain].name} está dañada. Descártala de forma explícita antes de importar.`);
    }
    let mode = 'nuevo';
    let added = candidate.events.length;
    if (slot.memory) {
      const current = slot.memory.events;
      const extends_ =
        candidate.events.length >= current.length && current.every((event, index) => candidate.events[index].hash === event.hash);
      if (!extends_) {
        throw new RuleViolation(
          'CONFLICTO_DE_HISTORIAL',
          `El registro importado no extiende el de ${BRAINS[brain].name}: los historiales divergen y no se fusionan.`,
        );
      }
      added = candidate.events.length - current.length;
      mode = added === 0 ? 'sin-cambios' : 'extensión';
    }
    this.slots[brain] = { brain, status: SLOT_STATUS.integro, memory: candidate, problems: [], persisted: null };
    this.#persist(brain);
    return { brain, mode, added };
  }

  /** Borra la copia local de un Brain. Acción explícita y destructiva. */
  discardLocal(brain) {
    if (this.#storage) safe(() => this.#storage.removeItem(STORAGE_PREFIX + brain), null);
    this.slots[brain] = this.#emptySlot(brain);
  }

  /** Texto guardado tal cual (para exportar una copia dañada antes de descartarla). */
  rawStored(brain) {
    return this.#storage ? safe(() => this.#storage.getItem(STORAGE_PREFIX + brain), null) : null;
  }
}

export { serializeLedger };
