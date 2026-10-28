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
