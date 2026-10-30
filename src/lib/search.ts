// Búsqueda, filtros y orden del catálogo. Funciones puras: las usan /buscar/ en el
// navegador y las pruebas unitarias. Solo filtran y reordenan datos reales; nunca los
// completan.

/** Una pieza del catálogo, preparada para buscar (textos ya normalizados). */
export interface SearchItem {
  id: string;
  /** Posición en el orden de la tienda (0 = primera). */
  position: number;
  name: string;
  category: string;
  /** Slug de la categoría, el mismo de /tienda/<categoria>/. */
  categorySlug: string;
  /** Resumen, detalles y composición. */
  text: string;
  price: number;
  available: boolean;
  /** Tallas disponibles (solo las que se pueden comprar). */
  sizes: string[];
}

export const SORTS = ['relevancia', 'precio-asc', 'precio-desc'] as const;
export type Sort = (typeof SORTS)[number];

export interface Criteria {
  query: string;
  /** Slug de la categoría, o null para todas. */
  category: string | null;
  size: string | null;
  /** true: solo piezas con alguna talla disponible. */
  available: boolean;
  sort: Sort;
}

export const DEFAULT_CRITERIA: Criteria = {
  query: '',
  category: null,
  size: null,
  available: false,
  sort: 'relevancia',
};

/** Nombres de los parámetros de la URL (/buscar/?q=…&categoria=…). */
export const PARAMS = {
  query: 'q',
  category: 'categoria',
  size: 'talla',
  available: 'disponible',
  sort: 'orden',
} as const;

const MAX_QUERY = 80;
const MAX_TOKENS = 8;

/** "Camiseta Básica" → "camiseta basica": sin tildes, en minúsculas y con espacios simples. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras de la búsqueda, sin repetir y con un límite (una consulta absurda no bloquea nada). */
export function tokenize(query: string): string[] {
  const words = normalize(query.slice(0, MAX_QUERY))
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return [...new Set(words)].slice(0, MAX_TOKENS);
}

/**
 * Puntuación de una pieza para una búsqueda. Todas las palabras deben aparecer en algún
 * sitio (0 = no coincide). Pesa más el nombre que la categoría, y esta más que el resto.
 */
export function score(item: SearchItem, tokens: string[]): number {
  let total = 0;
  for (const token of tokens) {
    if (startsWord(item.name, token)) total += 3;
    else if (contains(item.name, token)) total += 2;
    else if (contains(item.category, token)) total += 1.5;
    else if (contains(item.text, token)) total += 1;
    else return 0;
  }
  return total;
}

function startsWord(field: string, token: string): boolean {
  return field.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(token));
}

/**
 * Palabras de 3 letras o más se buscan también dentro de otras ("camisa" en
 * "sobrecamisa"); las más cortas, solo al principio de una palabra: si no, una "b"
 * coincidiría con casi todo.
 */
function contains(field: string, token: string): boolean {
  return token.length >= 3 ? field.includes(token) : startsWord(field, token);
}

/** Aplica búsqueda, filtros y orden. Devuelve las piezas que coinciden, ya ordenadas. */
export function search(items: SearchItem[], criteria: Criteria): SearchItem[] {
  const tokens = tokenize(criteria.query);
  const results = items.flatMap((item) => {
    if (criteria.category && item.categorySlug !== criteria.category) return [];
    if (criteria.available && !item.available) return [];
    if (criteria.size && !item.sizes.includes(criteria.size)) return [];
    const points = tokens.length > 0 ? score(item, tokens) : 0;
    if (tokens.length > 0 && points === 0) return [];
    return [{ item, points }];
  });

  results.sort((a, b) => {
    if (criteria.sort === 'precio-asc' && a.item.price !== b.item.price) return a.item.price - b.item.price;
    if (criteria.sort === 'precio-desc' && a.item.price !== b.item.price) return b.item.price - a.item.price;
    return b.points - a.points || a.item.position - b.item.position;
  });
  return results.map(({ item }) => item);
}

interface Allowed {
  categories: readonly string[];
  sizes: readonly string[];
}

/** Lee los criterios de la URL. Lo que no existe en el catálogo se ignora. */
export function parseCriteria(params: URLSearchParams, allowed: Allowed): Criteria {
  const category = params.get(PARAMS.category);
  const size = params.get(PARAMS.size);
  const sort = params.get(PARAMS.sort);
  return {
    query: (params.get(PARAMS.query) ?? '').trim().slice(0, MAX_QUERY),
    category: category && allowed.categories.includes(category) ? category : null,
    size: size && allowed.sizes.includes(size) ? size : null,
    available: params.get(PARAMS.available) === '1',
    sort: SORTS.find((value) => value === sort) ?? DEFAULT_CRITERIA.sort,
  };
}

/** Criterios → parámetros de la URL, sin los valores por defecto (URLs cortas y compartibles). */
export function criteriaToParams(criteria: Criteria): URLSearchParams {
  const params = new URLSearchParams();
  if (criteria.query) params.set(PARAMS.query, criteria.query);
  if (criteria.category) params.set(PARAMS.category, criteria.category);
  if (criteria.size) params.set(PARAMS.size, criteria.size);
  if (criteria.available) params.set(PARAMS.available, '1');
  if (criteria.sort !== DEFAULT_CRITERIA.sort) params.set(PARAMS.sort, criteria.sort);
  return params;
}

/** true si algún filtro (no el orden) restringe los resultados. */
export function isFiltered(criteria: Criteria): boolean {
  return Boolean(criteria.query || criteria.category || criteria.size || criteria.available);
}

const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'];

/**
 * Ordena tallas como se leen en una etiqueta: XS, S, M, L, XL…; después las numéricas de
 * menor a mayor, y al final cualquier otra (p. ej. "Única") en orden alfabético.
 */
export function sortSizes(labels: Iterable<string>): string[] {
  const rank = (label: string): [number, number, string] => {
    const key = normalize(label);
    const letter = SIZE_ORDER.indexOf(key);
    if (letter !== -1) return [0, letter, key];
    const number = Number(key.replace(',', '.'));
    if (key !== '' && Number.isFinite(number)) return [1, number, key];
    return [2, 0, key];
  };
  return [...new Set(labels)].sort((a, b) => {
    const [groupA, valueA, keyA] = rank(a);
    const [groupB, valueB, keyB] = rank(b);
    return groupA - groupB || valueA - valueB || keyA.localeCompare(keyB);
  });
}
