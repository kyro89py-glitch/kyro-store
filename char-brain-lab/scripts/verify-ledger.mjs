#!/usr/bin/env node
// Verifica un registro exportado fuera del navegador: cadena de hashes y todas las reglas.
// Uso: node scripts/verify-ledger.mjs <registro.json>
// Sale con código 0 si el registro es íntegro y cumple las reglas; 1 si no.

import { readFile } from 'node:fs/promises';

import { BrainMemory } from '../src/brain.js';
import { parseLedger } from '../src/ledger.js';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/verify-ledger.mjs <registro.json>');
  process.exit(2);
}

try {
  const { brain, events } = parseLedger(await readFile(file, 'utf8'));
  const memory = BrainMemory.fromEvents(events, { expectedBrain: brain });
  const state = memory.state;
  const count = (collection) => Object.keys(collection).length;
  const byStatus = (collection) =>
    Object.values(collection).reduce((totals, record) => ({ ...totals, [record.status]: (totals[record.status] ?? 0) + 1 }), {});

  console.log(`Registro de ${brain}: ÍNTEGRO y conforme a las reglas.`);
  console.log(`  Eventos: ${events.length} · cabecera ${memory.head}`);
  console.log(`  Creado: ${state.createdAt} por ${state.createdBy.kind} ${state.createdBy.id}`);
  console.log(`  Experiencias: ${count(state.experiences)} · Hipótesis: ${count(state.hypotheses)}`);
  console.log(`  Experimentos: ${count(state.experiments)} ${JSON.stringify(byStatus(state.experiments))}`);
  console.log(`  Aprendizajes: ${count(state.learnings)} ${JSON.stringify(byStatus(state.learnings))}`);
  console.log(`  Contradicciones abiertas: ${memory.openContradictions().length}`);
} catch (error) {
  console.error(`Registro NO válido: ${error.message}`);
  for (const problem of error?.details?.problems ?? []) console.error(`  - ${problem}`);
  process.exit(1);
}
