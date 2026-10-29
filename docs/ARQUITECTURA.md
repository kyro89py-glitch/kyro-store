# Arquitectura

## Decisión: Astro 7 + TypeScript, salida estática

| Necesidad | Cómo la resuelve Astro |
| --- | --- |
| Velocidad en móvil | HTML pregenerado; sin JavaScript por defecto. Solo el carrito, el selector de talla, el menú y la galería cargan código, como *custom elements* nativos (sin React ni otro framework). |
| Catálogo fiable | *Content collections* con esquema Zod: un producto incompleto rompe el build en lugar de publicarse. |
| Fotografía de calidad | `astro:assets` genera AVIF/WebP en varios anchos con `srcset` y dimensiones fijas (sin saltos de diseño). |
| Tipografía | API de fuentes de Astro: archivos propios (sin Google Fonts), precarga y métricas de reserva para evitar saltos. |
| Seguridad en hosting estático | `security.csp`: Content-Security-Policy con hashes en `<meta>`, válida aunque el hosting no permita cabeceras. |
| Fase 2 | El mismo proyecto añade rutas de servidor (`/api/checkout`, webhooks) con un adaptador (Vercel, Netlify, Cloudflare o Node). El catálogo sigue siendo estático. |

Alternativas descartadas:

- **Next.js:** runtime de React innecesario para un catálogo mayormente estático, y la exportación estática pierde sus funciones de servidor.
- **HTML/JS sin framework:** sin validación del catálogo ni optimización de imágenes.
- **Shopify/Hydrogen:** excluidos por decisión de KYRO.

Dependencias de producción: solo `astro`. Desarrollo: TypeScript, `@astrojs/check`,
Vitest, Playwright y axe-core. Versiones exactas fijadas en `package.json` y `package-lock.json`.

## Flujo de datos

```
src/content/products/<slug>/index.md ──▶ esquema (content.config.ts)
                                          │  reglas entre productos (lib/catalog-rules.ts)
                                          ▼
                                 páginas estáticas + /catalog.json
                                          │
navegador: localStorage {sku, cantidad} ──┴──▶ carrito = precios de /catalog.json
```

- El navegador guarda **solo** SKU y cantidad (`kyro.cart.v1`). Lo leído se valida y lo
  manipulado se descarta.
- Nombres, imágenes y precios del carrito salen siempre de `/catalog.json`, generado en
  el build con los productos activos. En la fase 2 el servidor volverá a calcular todo.
- Las variantes que dejan de existir se eliminan solas del carrito.
- La portada se compone solo con datos reales (`lib/catalog-views.ts`): novedades por
  `releasedAt`, destacados por `featured`, categorías con la primera foto de su catálogo.
  Una sección sin datos no se muestra.
- La imagen editorial de la portada vive en su propia colección (`src/content/campaign/`)
  con procedencia y licencia obligatorias; si es provisional, el sitio muestra el crédito.
- Las páginas informativas (`src/content/pages/` → `/info/<slug>/`) y el logotipo oficial
  (`src/assets/brand/logo.svg`) se activan solos cuando existen sus archivos.

## SEO básico

- Título, descripción, `canonical` y Open Graph por página; datos estructurados de
  `Organization`/`WebSite` en la portada y de `Product` en cada ficha; migas de pan
  (`BreadcrumbList`) en la ficha cuando haya dominio definido.
- `robots.txt` y `noindex` bloquean la indexación mientras `store.indexable` sea `false`.
- `/sitemap.xml` se genera solo cuando la tienda sea indexable y tenga dominio
  (`KYRO_SITE_URL`); hasta entonces no existe.

## Seguridad

- **CSP** en todas las páginas: `default-src 'self'`, scripts y estilos solo propios o con
  hash, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. Sin scripts de terceros.
  El único script en línea (el que activa los revelados antes del primer pintado) registra
  su hash con `Astro.csp.insertScriptHash` en `BaseLayout.astro`; los valores dinámicos de
  estilo se escriben con CSSOM (`style.setProperty`), nunca con atributos `style`.
- **Sin HTML dinámico:** el carrito escribe con `textContent`/`setAttribute`; los datos
  estructurados (JSON-LD) escapan `<`.
- **Sin secretos** en el repositorio (`.env` ignorado; `.env.example` documenta variables).
- **Indexación bloqueada** (`noindex` + `robots.txt`) hasta que `store.indexable` sea `true`.
- **Catálogo de prueba aislado:** se activa con `KYRO_CATALOG=fixtures`, compila en
  `.fixtures-dist/` (demostración) o `.e2e-dist/` (pruebas, con logotipo de prueba),
  muestra un aviso visible y usa la moneda de pruebas `XTS`.
- **Un servidor de desarrollo por carpeta:** `scripts/run-astro.mjs` impide arrancar
  `dev` y `dev:fixtures` a la vez, porque comparten la caché de contenido de Astro.
- **Cadena de suministro:** lockfile, `npm ci`, Dependabot y acciones de GitHub fijadas por commit.

## Accesibilidad y movimiento

- Pruebas automáticas con axe (WCAG 2.2 AA) en todas las páginas y en el panel del
  carrito, en escritorio, tableta y móvil.
- Modo de alto contraste de Windows (`forced-colors`): la talla elegida y las no
  disponibles se distinguen con colores del sistema.
- Navegación completa por teclado, foco visible en champán, diálogos nativos (`<dialog>`),
  anuncios por `aria-live` al cambiar el carrito.
- Una sola animación automática (la apertura de la portada). Con `prefers-reduced-motion`
  todo aparece al instante y las transiciones entre páginas se desactivan.

## Límites de GitHub para alojar el sitio

GitHub Pages (consultado de memoria; la documentación oficial no fue accesible desde el
entorno de trabajo, conviene confirmarla en docs.github.com):

- Solo sirve archivos estáticos: sin código de servidor, base de datos, secretos ni webhooks.
- No permite cabeceras HTTP propias (por eso la CSP va en `<meta>`).
- Sitio publicado de hasta 1 GB, ~100 GB/mes de tráfico (límite blando), despliegues de
  hasta 10 minutos; Git rechaza archivos de más de 100 MB.
- **Sus condiciones prohíben usarlo como hosting de un negocio online o de una tienda
  orientada a transacciones comerciales.**

Conclusión: GitHub aloja el código, las revisiones y la CI. La tienda real se despliega en
un servicio que permita comercio y funciones de servidor (ver `FASE-2-PAGOS.md`). Si
alguna vez se quiere una vista previa en un subdirectorio, todos los enlaces respetan
`KYRO_BASE_PATH`.
