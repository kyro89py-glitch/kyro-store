# Recursos provisionales y de terceros

Inventario de todo lo que no es definitivo o no es propio de KYRO. Revisar antes de
cualquier lanzamiento.

## Provisionales (hay que sustituirlos)

| Recurso | Dónde | Estado | Qué falta |
| --- | --- | --- | --- |
| Logotipo | `src/components/brand/Wordmark.astro`, `.wordmark` en `src/styles/base.css` | Tipográfico, compuesto con Archivo extendida. El sitio ya usa `src/assets/brand/logo.svg` si existe | Logotipo oficial en SVG (requisitos en `MARCA.md`) |
| Favicon | `public/favicon.svg` | Monograma "K" geométrico | Versión derivada del logotipo oficial |
| Textos de marca | `src/config/copy.ts` | Borrador basado solo en la descripción de la marca | Revisión y aprobación de KYRO |
| Imagen de portada | `src/content/campaign/` | No hay; composición CSS de luz y grano | Fotografía de campaña con licencia (ver `IMAGENES.md`) |
| Fotografía de producto | `src/content/products/` | No hay productos | Sesión de producto real (brief en `MARCA.md`) |
| Páginas informativas (términos, privacidad, envíos, devoluciones) | `src/content/pages/` | No hay ninguna; el pie no muestra la sección | Textos redactados y aprobados por KYRO |

## Solo para pruebas (nunca llegan a producción)

| Recurso | Dónde | Origen |
| --- | --- | --- |
| Productos ficticios (moneda `XTS`) | `tests/fixtures/catalog/` | Escritos para las pruebas |
| Imágenes abstractas de producto y de portada | `tests/fixtures/**/*.jpg` | Generadas con `tests/fixtures/generate-images.mjs` (degradados SVG) |
| Logotipo de prueba (rectángulos) | `tests/fixtures/brand/logo.svg` | Dibujado para verificar el uso del SVG oficial |
| Página informativa de prueba | `tests/fixtures/pages/` | Texto marcado como no real |

Se compilan solo con `KYRO_CATALOG=fixtures`, en `.fixtures-dist/`, con un aviso visible
de "Catálogo de prueba" en todas las páginas.

## Definitivos de terceros

| Recurso | Dónde | Licencia |
| --- | --- | --- |
| Bodoni Moda (tipografía editorial) | `src/assets/fonts/` | SIL Open Font License 1.1 (`LICENSE-BodoniModa-OFL.txt`) |
| Archivo (tipografía de interfaz y logotipo) | `src/assets/fonts/` | SIL Open Font License 1.1 (`LICENSE-Archivo-OFL.txt`) |

No hay imágenes, iconos, scripts ni servicios de terceros cargados por el sitio.
