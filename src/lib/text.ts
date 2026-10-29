import { store } from '../config/store';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Camisas & Sobrecamisas" → "camisas-sobrecamisas" (sin tildes ni eñes). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Serializa datos para un <script type="application/ld+json">. Escapa "<" para que
 * ningún texto del catálogo pueda cerrar la etiqueta e inyectar HTML.
 */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * "2026-10-01" → "1 de octubre de 2026". Las fechas del contenido son días sin hora
 * (medianoche UTC), así que se formatean en UTC para no mostrar el día anterior.
 */
export function formatDate(date: Date, locale: string = store.locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
