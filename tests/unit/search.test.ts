import { describe, expect, it } from 'vitest';
import {
  criteriaToParams,
  DEFAULT_CRITERIA,
  isFiltered,
  normalize,
  parseCriteria,
  score,
  search,
  sortSizes,
  tokenize,
  type Criteria,
  type SearchItem,
} from '../../src/lib/search';

const item = (id: string, data: Partial<SearchItem>): SearchItem => ({
  id,
  position: 0,
  name: '',
  category: '',
  categorySlug: '',
  text: '',
  price: 1000,
  available: true,
  sizes: [],
  ...data,
});

const items: SearchItem[] = [
  item('camisa', {
    position: 0,
    name: normalize('Camisa Óxido'),
    category: normalize('Camisas'),
    categorySlug: 'camisas',
    text: normalize('Algodón lavado'),
    price: 30000,
    sizes: ['S', 'M'],
  }),
  item('pantalon', {
    position: 1,
    name: normalize('Pantalón recto'),
    category: normalize('Pantalones'),
    categorySlug: 'pantalones',
    text: normalize('Corte recto de algodón'),
    price: 45000,
    sizes: ['M', 'L'],
  }),
  item('sobrecamisa', {
    position: 2,
    name: normalize('Sobrecamisa negra'),
    category: normalize('Camisas'),
    categorySlug: 'camisas',
    text: normalize('Sarga'),
    price: 52000,
    available: false,
    sizes: [],
  }),
];

const criteria = (data: Partial<Criteria>): Criteria => ({ ...DEFAULT_CRITERIA, ...data });
const ids = (results: SearchItem[]) => results.map((result) => result.id);

describe('normalize y tokenize', () => {
  it('quita tildes, mayúsculas y espacios de más', () => {
    expect(normalize('  Pantalón   RECTO ')).toBe('pantalon recto');
    expect(normalize('Ñandutí')).toBe('nanduti');
  });

  it('separa palabras, quita repetidas y limita la consulta', () => {
    expect(tokenize('Camisa, camisa; ÓXIDO')).toEqual(['camisa', 'oxido']);
    expect(tokenize('a b c d e f g h i j')).toHaveLength(8);
    expect(tokenize('')).toEqual([]);
    expect(tokenize('<script>')).toEqual(['script']);
  });
});

describe('score', () => {
  it('exige todas las palabras', () => {
    expect(score(items[0]!, ['camisa', 'pantalon'])).toBe(0);
  });

  it('las palabras muy cortas solo coinciden al principio de una palabra', () => {
    expect(score(item('x', { name: 'prenda de prueba' }), ['b'])).toBe(0);
    expect(score(item('x', { category: 'categoria b' }), ['b'])).toBeGreaterThan(0);
    expect(score(item('x', { name: 'sobrecamisa' }), ['cam'])).toBeGreaterThan(0);
  });

  it('pesa más el nombre que la categoría y esta más que el texto', () => {
    const byName = score(items[0]!, ['camisa']);
    const byCategory = score(item('x', { category: 'camisas' }), ['camisa']);
    const byText = score(item('y', { text: 'una camisa' }), ['camisa']);
    expect(byName).toBeGreaterThan(byCategory);
    expect(byCategory).toBeGreaterThan(byText);
    expect(byText).toBeGreaterThan(0);
  });
});

describe('search', () => {
  it('sin criterios devuelve todo en el orden de la tienda', () => {
    expect(ids(search(items, DEFAULT_CRITERIA))).toEqual(['camisa', 'pantalon', 'sobrecamisa']);
  });

  it('busca sin distinguir tildes ni mayúsculas', () => {
    expect(ids(search(items, criteria({ query: 'PANTALON' })))).toEqual(['pantalon']);
    expect(ids(search(items, criteria({ query: 'óxido' })))).toEqual(['camisa']);
  });

  it('ordena por relevancia: primero lo que coincide en el nombre', () => {
    // "algodon" está en el texto de la camisa y del pantalón; "recto" solo en el nombre del pantalón.
    expect(ids(search(items, criteria({ query: 'camisa' })))).toEqual(['camisa', 'sobrecamisa']);
    expect(ids(search(items, criteria({ query: 'algodon recto' })))).toEqual(['pantalon']);
  });

  it('filtra por categoría, talla y disponibilidad', () => {
    expect(ids(search(items, criteria({ category: 'camisas' })))).toEqual(['camisa', 'sobrecamisa']);
    expect(ids(search(items, criteria({ size: 'L' })))).toEqual(['pantalon']);
    expect(ids(search(items, criteria({ available: true })))).toEqual(['camisa', 'pantalon']);
  });

  it('ordena por precio en los dos sentidos', () => {
    expect(ids(search(items, criteria({ sort: 'precio-desc' })))).toEqual(['sobrecamisa', 'pantalon', 'camisa']);
    expect(ids(search(items, criteria({ sort: 'precio-asc' })))).toEqual(['camisa', 'pantalon', 'sobrecamisa']);
  });

  it('sin coincidencias devuelve una lista vacía', () => {
    expect(search(items, criteria({ query: 'zapatos' }))).toEqual([]);
    expect(search([], DEFAULT_CRITERIA)).toEqual([]);
  });

  it('no modifica la lista original', () => {
    search(items, criteria({ sort: 'precio-desc' }));
    expect(ids(items)).toEqual(['camisa', 'pantalon', 'sobrecamisa']);
  });
});

describe('parámetros de la URL', () => {
  const allowed = { categories: ['camisas', 'pantalones'], sizes: ['S', 'M', 'L'] };

  it('lee criterios válidos', () => {
    const params = new URLSearchParams('q=camisa&categoria=camisas&talla=M&disponible=1&orden=precio-asc');
    expect(parseCriteria(params, allowed)).toEqual({
      query: 'camisa',
      category: 'camisas',
      size: 'M',
      available: true,
      sort: 'precio-asc',
    });
  });

  it('ignora categorías, tallas y órdenes que no existen', () => {
    const params = new URLSearchParams('categoria=zapatos&talla=XXL&orden=inventado&disponible=si');
    expect(parseCriteria(params, allowed)).toEqual(DEFAULT_CRITERIA);
  });

  it('recorta consultas larguísimas', () => {
    const params = new URLSearchParams({ q: 'x'.repeat(500) });
    expect(parseCriteria(params, allowed).query).toHaveLength(80);
  });

  it('omite los valores por defecto y vuelve a leer lo mismo', () => {
    expect(criteriaToParams(DEFAULT_CRITERIA).toString()).toBe('');
    const full = criteria({ query: 'camisa óxido', category: 'camisas', size: 'S', available: true, sort: 'precio-desc' });
    expect(parseCriteria(criteriaToParams(full), allowed)).toEqual(full);
  });

  it('el orden no cuenta como filtro', () => {
    expect(isFiltered(criteria({ sort: 'precio-asc' }))).toBe(false);
    expect(isFiltered(criteria({ size: 'S' }))).toBe(true);
  });
});

describe('sortSizes', () => {
  it('ordena tallas de letra, después números y al final el resto', () => {
    expect(sortSizes(['L', 'Única', 'S', '42', 'XL', 'M', '38', 'XS', 'M'])).toEqual([
      'XS',
      'S',
      'M',
      'L',
      'XL',
      '38',
      '42',
      'Única',
    ]);
  });
});
