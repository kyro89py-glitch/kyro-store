import { describe, expect, it } from 'vitest';
import { generatedOutsideModelView, lacksRealPhoto } from '../../src/lib/catalog-rules';

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

describe('generatedOutsideModelView (fidelidad de los detalles)', () => {
  it('acepta una imagen generada como vista con modelo', () => {
    expect(generatedOutsideModelView([{ generated: true, view: 'modelo' }, { generated: false, view: 'detalle' }])).toEqual([]);
  });

  it('señala imágenes generadas presentadas como frente, espalda, detalle o sin vista', () => {
    expect(
      generatedOutsideModelView([
        { generated: true, view: 'detalle' },
        { generated: false, view: 'frente' },
        { generated: true, view: 'espalda' },
        { generated: true },
      ]),
    ).toEqual([0, 2, 3]);
  });

  it('las fotografías reales pueden ser cualquier vista', () => {
    expect(generatedOutsideModelView([{ generated: false }, { generated: false, view: 'detalle' }])).toEqual([]);
  });
});
