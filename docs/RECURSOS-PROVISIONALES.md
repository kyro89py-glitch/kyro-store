# Recursos provisionales y de terceros

Inventario de todo lo que no es definitivo o no es propio de KYRO. Revisar antes de
cualquier lanzamiento.

## Provisionales (hay que sustituirlos)

| Recurso | Dónde | Estado | Qué falta |
| --- | --- | --- | --- |
| Logotipo | `src/components/brand/Wordmark.astro`, `.wordmark` y `.masthead` en `src/styles/base.css` | Tipográfico y provisional, compuesto con Archivo extendida; también la cabecera "KYRO" a todo el ancho de la portada, el pie y el menú. El sitio ya usa `src/assets/brand/logo.svg` si existe | Logotipo oficial en SVG (requisitos en `MARCA.md`) |
| Favicon | `public/favicon.svg` | Monograma "K" geométrico | Versión derivada del logotipo oficial |
| Textos de marca | `src/config/copy.ts` | Borrador basado solo en la descripción de la marca | Revisión y aprobación de KYRO |
| Imagen de portada | `src/content/campaign/` | No hay; composición CSS de luz y grano | Fotografía de campaña con licencia (ver `IMAGENES.md`) |
| Pantallas de luz (estados vacíos, la marca, 404) | `src/components/brand/LightScreen.astro` | Composición CSS decorativa (degradados y grano), no es una imagen | Puede sustituirse por fotografía de campaña con licencia |
| Fotografía de producto | `src/content/products/` | No hay productos | Sesión de producto real (brief en `MARCA.md`) |
| Páginas informativas (términos, privacidad, envíos, devoluciones) | `src/content/pages/` | No hay ninguna; el pie no muestra la sección | Textos redactados y aprobados por KYRO |

## Solo para pruebas (nunca llegan a producción)

| Recurso | Dónde | Origen |
| --- | --- | --- |
| Productos ficticios (moneda `XTS`) | `tests/fixtures/catalog/` | Escritos para las pruebas |
| Imágenes abstractas de producto y de portada | `tests/fixtures/**/*.jpg` | Generadas con `tests/fixtures/generate-images.mjs` (degradados SVG) |
| Logotipo de prueba (rectángulos) | `tests/fixtures/brand/logo.svg` | Dibujado para verificar el uso del SVG oficial; solo en el build de las pruebas e2e |
| Página informativa de prueba | `tests/fixtures/pages/` | Texto marcado como no real |

Se compilan solo con `KYRO_CATALOG=fixtures`: la demostración en `.fixtures-dist/` y el
build de las pruebas e2e (con el logotipo de prueba) en `.e2e-dist/`. Ambos muestran un
aviso visible de "Catálogo de prueba" en todas las páginas.

## Definitivos de terceros

| Recurso | Dónde | Licencia |
| --- | --- | --- |
| Bodoni Moda (tipografía editorial) | `src/assets/fonts/` | SIL Open Font License 1.1 (`LICENSE-BodoniModa-OFL.txt`) |
| Archivo (tipografía de interfaz y logotipo) | `src/assets/fonts/` | SIL Open Font License 1.1 (`LICENSE-Archivo-OFL.txt`) |

No hay imágenes, iconos, scripts ni servicios de terceros cargados por el sitio.
