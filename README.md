# KYRO Store

Tienda online independiente de KYRO: moda urbana con identidad premium, minimalista y
cinematográfica.

> **Estado:** base funcional en desarrollo local. No está publicada ni desplegada. El
> catálogo está vacío a propósito: solo se cargarán productos, precios y existencias
> reales. El pago en línea llegará en la fase 2 ([docs/FASE-2-PAGOS.md](docs/FASE-2-PAGOS.md)).

## Qué incluye

| Página | Ruta | Estado |
| --- | --- | --- |
| Portada: apertura cinematográfica, novedades, categorías y destacados | `/` | Lista; cada sección aparece solo con datos reales |
| Tienda y categorías | `/tienda/`, `/tienda/<categoria>/` | Lista (vacía hasta cargar productos) |
| Ficha de producto | `/producto/<slug>/` | Lista |
| Carrito (panel lateral y página) | `/carrito/` | Funciona en el navegador; el pago está desactivado |
| Marca | `/marca/` | Lista; textos en borrador |
| Página 404 | — | Lista |

## Requisitos

- Node.js **24 LTS** (mínimo 22.23.4, lo exige Astro 7). Con `nvm`: `nvm use`.
- npm 10 o superior.

## Comandos

```bash
npm ci                 # instala dependencias exactas del lockfile
npm run dev            # servidor local con el catálogo real (vacío)
npm run dev:fixtures   # servidor local con los datos de PRUEBA (productos e imagen de portada)
npm run build          # build de producción en dist/
npm run check          # comprobación de tipos y plantillas
npm test               # pruebas unitarias (Vitest)
npm run test:e2e       # pruebas en navegador (Playwright), requiere los dos builds
npm run verify         # todo lo anterior, en orden
```

Para las pruebas en navegador, instala Chromium una vez (y de nuevo cada vez que se
actualice Playwright): `npx playwright install chromium`. Se prueban cuatro perfiles:
escritorio, tableta, móvil y el build de producción.

## Estructura

```
src/
  config/store.ts      Ajustes de la tienda (contacto, redes, indexación, pago)
  config/copy.ts       Textos de marca (borrador para revisión)
  content.config.ts    Esquemas estrictos del catálogo y de las imágenes de campaña
  content/products/    Catálogo real: una carpeta por producto
  content/campaign/    Imagen editorial de la portada, con procedencia y licencia
  components/          layout · brand · catalog · product · cart
  layouts/             Plantilla base (cabecera, pie, carrito, CSP)
  lib/                 Lógica sin interfaz: catálogo, precios, rutas, carrito
  pages/               Rutas del sitio
  styles/              Tokens de diseño y estilos base
tests/
  unit/                Vitest
  e2e/                 Playwright + auditoría de accesibilidad (axe)
  fixtures/            Productos e imagen de portada de PRUEBA (moneda XTS); nunca llegan a producción
docs/                  Arquitectura, catálogo, imágenes, recursos provisionales y plan de pagos
```

## Documentación

- [Arquitectura y decisiones técnicas](docs/ARQUITECTURA.md)
- [Cómo cargar productos reales](docs/CATALOGO.md)
- [Imágenes: procedencia, licencia y portada](docs/IMAGENES.md)
- [Recursos provisionales y de terceros](docs/RECURSOS-PROVISIONALES.md)
- [Fase 2: pagos y pedidos](docs/FASE-2-PAGOS.md)
- [Seguridad](SECURITY.md)

## Pendiente de KYRO

- Logotipo oficial en SVG (hoy hay un logotipo tipográfico provisional).
- Fotografía de producto y de campaña, con licencia (ver `docs/IMAGENES.md`).
- Productos reales: nombres, precios, moneda, tallas y disponibilidad.
- Revisión de los textos de `src/config/copy.ts`.
- Datos de contacto y redes (`src/config/store.ts`).
- País de facturación, para elegir la pasarela de pago.

## Licencias de terceros

Las fuentes Bodoni Moda y Archivo se distribuyen con la SIL Open Font License 1.1
(ver `src/assets/fonts/`).
