import { defineCollection, type ImageFunction } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { generatedOutsideModelView, IMAGE_VIEWS, lacksRealPhoto } from './lib/catalog-rules';

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

// Con KYRO_CATALOG=fixtures se usan los datos de prueba (nunca en producción).
const useFixtures = process.env.KYRO_CATALOG === 'fixtures';
const catalogBase = useFixtures ? './tests/fixtures/catalog' : './src/content/products';
const campaignBase = useFixtures ? './tests/fixtures/campaign' : './src/content/campaign';
const pagesBase = useFixtures ? './tests/fixtures/pages' : './src/content/pages';
const looksBase = useFixtures ? './tests/fixtures/looks' : './src/content/looks';

/**
 * Imagen de una galería (fichas y looks). `view` y `label` ordenan la experiencia: la
 * galería muestra el nombre de cada vista ("Look completo", "Remera · espalda",
 * "Detalle · escudo") y permite saltar entre ellas.
 */
const galleryImage = (image: ImageFunction) =>
  z.object({
    src: image(),
    alt: z.string().trim().min(1, 'Cada imagen necesita texto alternativo').max(200),
    /**
     * true si es una imagen generada con IA (p. ej. un modelo vistiendo la prenda). Se
     * señala, solo puede ser una vista con modelo y siempre queda una foto real.
     */
    generated: z.boolean().default(false),
    /** Qué muestra: modelo (look completo), frente, espalda o detalle. */
    view: z.enum(IMAGE_VIEWS).optional(),
    /** Nombre corto visible en la galería, p. ej. "Detalle · escudo". */
    label: z.string().trim().min(1).max(40).optional(),
  });

/** Reglas de fidelidad comunes a toda galería con imágenes generadas. */
function checkGallery(images: { generated: boolean; view?: (typeof IMAGE_VIEWS)[number] | undefined }[], ctx: z.RefinementCtx) {
  if (lacksRealPhoto(images)) {
    ctx.addIssue({
      code: 'custom',
      path: ['images'],
      message: 'Con imágenes generadas con IA, la galería debe conservar al menos una fotografía real de la prenda.',
    });
  }
  for (const index of generatedOutsideModelView(images)) {
    ctx.addIssue({
      code: 'custom',
      path: ['images', index, 'view'],
      message: 'Una imagen generada con IA solo puede ser una vista con modelo (view: modelo); frente, espalda y detalles deben ser fotografías reales.',
    });
  }
}

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
          /**
           * Opcional: precio anterior real (misma unidad que `amount`), solo si la pieza
           * está rebajada. Se muestra tachado; debe ser mayor que el precio actual.
           */
          compareAt: z.number().int().positive().optional(),
        }),
        images: z.array(galleryImage(image)).min(1).max(16),
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
        /**
         * Opcional: slug de la página informativa con la guía de tallas
         * (src/content/pages/<slug>.md). La ficha la enlaza; si la página no existe, el build falla.
         */
        sizeGuide: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug de una página informativa')
          .optional(),
        featured: z.boolean().default(false),
        /** Fecha real de lanzamiento (AAAA-MM-DD). Solo los productos con fecha aparecen en "Novedades". */
        releasedAt: z.coerce.date().optional(),
        /** Orden en listados (menor primero). */
        position: z.number().int().default(0),
      })
      .superRefine((product, ctx) => {
        checkGallery(product.images, ctx);
        if (product.price.compareAt !== undefined && product.price.compareAt <= product.price.amount) {
          ctx.addIssue({
            code: 'custom',
            path: ['price', 'compareAt'],
            message: 'El precio anterior debe ser mayor que el precio actual.',
          });
        }
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

/**
 * Imágenes de campaña (por ahora, la imagen editorial de la portada).
 *
 *   src/content/campaign/portada.md + la fotografía en la misma carpeta
 *
 * Toda imagen debe declarar su procedencia y licencia. Una imagen que no sea de KYRO
 * se marca como provisional y el sitio muestra su crédito. Ver docs/IMAGENES.md.
 */
const campaign = defineCollection({
  // README.md documenta la carpeta y no es una imagen de campaña.
  loader: glob({ pattern: ['*.md', '!README.md'], base: campaignBase }),
  schema: ({ image }) =>
    z
      .object({
        placement: z.literal('hero'),
        image: image(),
        alt: z.string().trim().min(1, 'La imagen necesita texto alternativo').max(200),
        /** Zona de la foto que se conserva al recortar en móvil y escritorio. */
        focus: z.enum(['center', 'top', 'bottom', 'left', 'right']).default('center'),
        /** true si no es fotografía propia de KYRO (banco de imágenes, prueba…). */
        provisional: z.boolean(),
        /** true si la imagen está generada con IA: el sitio lo indica junto a ella. */
        generated: z.boolean().default(false),
        /** Opcional: slug del look al que lleva la imagen (src/content/looks/<slug>/). */
        look: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .optional(),
        credit: z
          .object({
            author: z.string().trim().min(1),
            source: z.string().trim().min(1),
            license: z.string().trim().min(1),
            url: z.url().optional(),
          })
          .optional(),
      })
      .superRefine((entry, ctx) => {
        if (entry.provisional && !entry.credit) {
          ctx.addIssue({
            code: 'custom',
            path: ['credit'],
            message: 'Una imagen provisional debe declarar autor, fuente y licencia.',
          });
        }
      }),
});

/**
 * Páginas informativas (términos, privacidad, envíos, cambios y devoluciones…).
 *
 *   src/content/pages/<slug>.md → /info/<slug>/
 *
 * Los textos los redacta y aprueba KYRO: el sitio no incluye ninguno de ejemplo.
 * Una página solo aparece en el pie cuando existe su archivo.
 */
const pages = defineCollection({
  // README.md documenta la carpeta y no es una página.
  loader: glob({ pattern: ['*.md', '!README.md'], base: pagesBase }),
  schema: z.object({
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(200),
    /** Obligatoria: los textos legales siempre muestran su fecha de vigencia. */
    updatedAt: z.coerce.date(),
    /** Orden en el pie de página (menor primero). */
    order: z.number().int().default(0),
    /**
     * true: la ficha de cada producto enlaza esta página (p. ej. envíos o devoluciones),
     * junto al botón de compra.
     */
    productLink: z.boolean().default(false),
  }),
});

/**
 * Looks: un conjunto completo presentado como campaña, con su galería (vista con modelo,
 * frente, espalda y detalles). No vende por sí mismo: enlaza a las fichas de las prendas
 * cuando existen.
 *
 *   src/content/looks/<slug>/index.md + sus imágenes → /looks/<slug>/
 */
const looks = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: looksBase,
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().trim().min(1).max(80),
        summary: z.string().trim().min(1).max(240),
        images: z.array(galleryImage(image)).min(1).max(20),
        /** Prendas del look. `product` (slug) enlaza a su ficha cuando existe. */
        garments: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(120),
              product: z
                .string()
                .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                .optional(),
            }),
          )
          .default([]),
        order: z.number().int().default(0),
      })
      .superRefine((look, ctx) => checkGallery(look.images, ctx)),
});

export const collections = { products, campaign, pages, looks };
