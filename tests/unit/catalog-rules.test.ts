import { describe, expect, it } from 'vitest';
import { lacksRealPhoto } from '../../src/lib/catalog-rules';

describe('lacksRealPhoto (imágenes generadas con IA)', () => {
  it('acepta fichas solo con fotografías', () => {
    expect(lacksRealPhoto([{ generated: false }, { generated: false }])).toBe(false);
  });

  it('acepta imágenes generadas si queda al menos una fotografía real', () => {
    expect(lacksRealPhoto([{ generated: true }, { generated: false }])).toBe(false);
  });

  it('rechaza una ficha en la que todas las imágenes son generadas', () => {
    expect(lacksRealPhoto([{ generated: true }])).toBe(true);
    expect(lacksRealPhoto([{ generated: true }, { generated: true }])).toBe(true);
  });
});
