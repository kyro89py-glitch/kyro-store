import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Catálogo de productos.
 *
 * Cada producto es una carpeta con un `index.md` y sus fotografías:
 *
 *   src/content/products/<slug>/index.md
 *   src/content/products/<slug>/frente.jpg
 *
 * El esquema es estricto a propósito: si falta un dato obligatorio (precio, texto
 * alternativo de una imagen, disponibilidad de una talla…) el build falla y el
 * producto no puede publicarse incompleto. Ver docs/CATALOGO.md.
 */

// Con KYRO_CATALOG=fixtures se usa el catálogo de prueba (nunca en producción).
const catalogBase =
  process.env.KYRO_CATALOG === 'fixtures' ? './tests/fixtures/catalog' : './src/content/products';

const products = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: catalogBase,
    // La carpeta define la URL: "<slug>/index.md" → /producto/<slug>/
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: ({ image }) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        /** draft: no se publica · active: a la venta · archived: retirado. */
        status: z.enum(['draft', 'active', 'archived']),
        category: z.string().trim().min(1).max(60),
        /** Frase breve para tarjetas y buscadores. */
        summary: z.string().trim().min(1).max(200),
        price: z.object({
          /** En la unidad mínima de la moneda (céntimos para USD/EUR, guaraníes para PYG). */
          amount: z.number().int().positive(),
          /** Código ISO 4217, p. ej. "PYG", "USD". */
          currency: z.string().regex(/^[A-Z]{3}$/, 'Usa un código ISO 4217 en mayúsculas'),
        }),
        images: z
          .array(
            z.object({
              src: image(),
              alt: z.string().trim().min(1, 'Cada imagen necesita texto alternativo').max(200),
            }),
          )
          .min(1)
          .max(12),
        /** Nombre de la opción que eligen los clientes. */
        optionName: z.string().trim().min(1).max(30).default('Talla'),
        variants: z
          .array(
            z.object({
              sku: z
                .string()
                .regex(/^[A-Z0-9][A-Z0-9-]{1,39}$/, 'SKU: mayúsculas, números y guiones'),
              label: z.string().trim().min(1).max(30),
              /** Obligatorio: la tienda nunca supone que hay existencias. */
              available: z.boolean(),
            }),
          )
          .min(1)
          .max(30),
        details: z.array(z.string().trim().min(1)).max(20).default([]),
        composition: z.string().trim().min(1).optional(),
        care: z.array(z.string().trim().min(1)).max(20).default([]),
        featured: z.boolean().default(false),
        /** Orden en listados (menor primero). */
        position: z.number().int().default(0),
      })
      .superRefine((product, ctx) => {
        const seen = new Set<string>();
        for (const [index, variant] of product.variants.entries()) {
          if (seen.has(variant.sku)) {
            ctx.addIssue({
              code: 'custom',
              path: ['variants', index, 'sku'],
              message: `SKU repetido en el producto: ${variant.sku}`,
            });
          }
          seen.add(variant.sku);
        }
      }),
});

export const collections = { products };
