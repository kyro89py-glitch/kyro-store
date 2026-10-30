# Auditoría técnica — evolución integral de la tienda

Fecha: 30-10-2026 · Rama auditada: `experiencia-inmersiva` (`2cf579f`) · Rama de trabajo:
`evolucion-tienda` (derivada de la anterior).

**Punto de restauración:** etiqueta local `respaldo/antes-evolucion-tienda` → `2cf579f`, que
es exactamente `origin/experiencia-inmersiva` en GitHub (verificable en remoto). `main`
sigue en `5ba8d17`, sin cambios.

## Clasificación usada

| Etiqueta | Significado |
| --- | --- |
| **Confirmado** | Hecho comprobado en el código o en el repositorio. |
| **Probado** | Implementado y cubierto por pruebas que pasan. |
| **No verificado** | Implementado, pero sin poder comprobarlo (p. ej., en un dispositivo real). |
| **Pendiente** | Necesita un servicio externo, una decisión o contenido de KYRO. |
| **Propuesta** | Mejora recomendada, no implementada. |
| **Problema** | Fallo confirmado. |

## 1. Proyecto y herramientas

| Tema | Estado |
| --- | --- |
| Repositorio `kyro89py-glitch/kyro-store` (público en GitHub) | Confirmado |
| Astro 7.4.3, salida **estática** (`output: 'static'`), TypeScript 6.0.3 | Confirmado |
| Node ≥ 22.23.4 (`.nvmrc`: 24) | Confirmado |
| Única dependencia de ejecución: `astro`. Desarrollo: `@astrojs/check`, Vitest 5, Playwright 1.64.1, axe, TypeScript, `@types/node` | Confirmado |
| `npm audit`: 0 vulnerabilidades | Confirmado (no prueba ausencia de fallos propios) |
| Actualizaciones disponibles: `astro` 7.4.4 (parche); TypeScript 7 y `@types/node` 26 bloqueadas a propósito en Dependabot | Confirmado |
| Scripts: `dev`, `dev:fixtures`, `build`, `build:fixtures`, `build:e2e`, `preview`, `preview:fixtures`, `check`, `test`, `test:e2e`, `verify` | Confirmado |
| Lint y formato: **no hay** ESLint ni Prettier configurados | Problema (menor) |
| CI en GitHub Actions: `npm run verify` en `main` y en PR; **sin despliegue** | Confirmado |
| Ramas ya fusionadas que siguen en GitHub (`dependabot-reglas`, `dependabot/…dbfed37405`, `fase-1-base-visual`, `fase-2-marca-y-contenidos`, `mejoras-vista-previa`) | Propuesta: borrarlas desde GitHub (aquí el proxy no lo permite) |

## 2. Rutas y páginas

| Ruta | Estado |
| --- | --- |
| `/` portada «Cámara oscura» (3D + colecciones) | Probado (e2e); fluidez en Android **no verificada** |
| `/tienda/`, `/tienda/<categoria>/` | Probado |
| `/producto/<slug>/` | Probado |
| `/carrito/` | Probado |
| `/marca/` | Probado |
| `/info/<slug>/` páginas informativas | Probado con datos de prueba; **sin textos reales** (Pendiente: KYRO) |
| `/404` | Probado |
| `/catalog.json` (índice de variantes para el carrito) | Probado |
| `/robots.txt` (bloquea todo mientras `indexable: false`) y `/sitemap.xml` (solo con dominio e indexación) | Probado |
| Búsqueda, favoritos, cuenta, registro, inicio de sesión, recuperación de contraseña, perfil, direcciones, checkout, confirmación de pedido, contacto, preguntas frecuentes | **No existen** |

## 3. Catálogo y modelo de datos

| Tema | Estado |
| --- | --- |
| Productos como archivos Markdown con esquema estricto (Zod): nombre, estado (`draft`/`active`/`archived`), categoría, resumen, precio entero en unidad mínima + moneda ISO, 1–12 imágenes con `alt` obligatorio, variantes con SKU único y `available` obligatorio, detalles, composición, cuidados, destacado, fecha de lanzamiento, orden | Probado |
| **Catálogo real vacío**: no hay productos, campaña ni páginas informativas reales | Confirmado |
| Datos de prueba aislados (`KYRO_CATALOG=fixtures`, moneda `XTS`, aviso visible, builds en carpetas separadas) | Probado |
| Una sola dimensión de variante por producto (p. ej. solo talla); **no** hay talla + color | Confirmado (limitación) |
| Sin precio anterior, guía de tallas, existencias numéricas ni información de envío por producto | Confirmado (no existen campos) |

## 4. Carrito y variantes

| Tema | Estado |
| --- | --- |
| Selección de talla con radios reales; las no disponibles, deshabilitadas y marcadas; se exige elegir antes de añadir; una opción única queda preseleccionada | Probado |
| Añadir (desde la ficha), cambiar cantidad, quitar, persistencia en `localStorage`, subtotal, panel lateral y página completa | Probado |
| Validación contra `/catalog.json`: SKU inexistentes eliminados, cantidades limitadas (máx. 10 por línea), datos manipulados ignorados, sin HTML dinámico | Probado |
| Selector de **cantidad** en la ficha (hoy siempre añade 1) | No existe |
| Cambiar la talla de una línea desde el carrito | No existe |
| Añadir desde tarjetas o colecciones (hoy solo desde la ficha) | No existe (decisión de diseño: la talla se elige en la ficha) |
| Envío, impuestos y descuentos | No existen (y no se inventan) |
| Botón **Pagar** deshabilitado con aviso | Probado (`store.checkout.enabled = false`) |

## 5. Cuentas, sesiones, datos personales, checkout y pedidos

| Tema | Estado |
| --- | --- |
| Backend, API, base de datos | **No existen** (sitio 100 % estático) |
| Autenticación, sesiones, registro, recuperación de contraseña | **No existen** |
| Perfil, direcciones, historial de pedidos | **No existen** |
| Pasarela de pago, pedidos, confirmación | **No existen**; plan previo en `docs/FASE-2-PAGOS.md` |
| Tienda Shopify publicada de KYRO | Existe según el propietario; **no se ha inspeccionado** (fuera del alcance autorizado) |
| Datos personales tratados hoy por el sitio | Ninguno (solo el carrito, en el navegador, sin datos personales) |

Conclusión: **ninguna** de las funciones de cuenta, dirección o compra puede construirse de
forma real sin un servicio de servidor. Ver la decisión D1 más abajo.

## 6. Contacto, pie y políticas

| Tema | Estado |
| --- | --- |
| `store.contact.email` vacío → no se muestra contacto | Confirmado |
| Correo facilitado por el propietario para publicar: `kyro89py@gmail.com` | Pendiente de integrar (autorizado) |
| Pie: Tienda (toda la tienda + categorías reales), KYRO (marca, carrito), Información (solo si hay páginas), Contacto (solo si hay correo o redes) | Probado |
| Políticas (privacidad, términos, envíos, devoluciones) | Pendiente: textos de KYRO |
| Formulario de contacto | No existe; necesita un servicio que entregue el mensaje |

## 7. Seguridad

| Tema | Estado |
| --- | --- |
| CSP estricta por `<meta>` (scripts y estilos propios o con hash, `object-src 'none'`, `form-action 'self'`) | Probado |
| Sin secretos en el repositorio; `.env` ignorado; `.env.example` sin valores | Confirmado |
| Escritura del carrito con `textContent`/`setAttribute` (sin HTML dinámico); JSON-LD escapado | Probado |
| `frame-ancestors`, HSTS y demás cabeceras **no** pueden ponerse por `<meta>`: dependen del hosting | Pendiente (al elegir hosting) |
| Validación en servidor, CSRF, límites de peticiones, almacenamiento de credenciales | No aplica todavía (no hay servidor) |

## 8. SEO y accesibilidad

| Tema | Estado |
| --- | --- |
| Título y descripción por página; `noindex` mientras no se lance; canonical y `og:url` solo con dominio definido | Probado |
| Open Graph básico (tipo, sitio, título, descripción); **sin `og:image`** | Propuesta |
| JSON-LD: Organization, WebSite, Product (solo datos del catálogo), BreadcrumbList (con dominio) | Probado |
| axe WCAG 2.2 AA sin violaciones en 7 páginas × 3 tamaños; colores forzados; teclado en colecciones y menú; movimiento reducido | Probado |

## 9. Rendimiento

| Tema | Estado |
| --- | --- |
| LCP de portada 1,6 s (escritorio) / 2,2 s (móvil simulado); CLS 0 en todo el sitio | Probado (en este entorno) |
| Coste del 3D en dispositivos reales | **No verificado** (sin GPU ni Android aquí; ver `RENDIMIENTO.md`) |
| Fuentes ~186 kB: el mayor peso del sitio | Propuesta: recortarlas |
| Imágenes AVIF/WebP con tamaños adaptativos y carga diferida | Probado |

## 10. Responsive (anchos 320, 375, 390, 430, 768, 1024, 1440, 1920)

Revisadas 11 páginas (producción y demostración) con movimiento reducido: sin
desbordamientos ni objetivos táctiles menores de 24 px, **excepto**:

| Problema | Detalle |
| --- | --- |
| Problema | Portada de la demostración a **320 px: 47 px** de desbordamiento horizontal; a **375 px: 4 px**. Causa: la cabecera de «Colecciones» (título de cartel + contador «01 — 03») no puede partirse en dos líneas. |

## 11. Pruebas

| Tipo | Estado |
| --- | --- |
| Tipos (`astro check`): 0 errores | Probado |
| Unitarias (Vitest): 48 | Probado |
| E2E (Playwright): 165 superadas, 6 omitidas **a propósito** (3 pruebas del menú móvil × los proyectos de escritorio y tableta, donde ese menú no existe) | Probado |
| Pruebas de 3D: se omiten solas si el navegador no tiene WebGL | Confirmado |
| Integración con servicios, autenticación, autorización, checkout en sandbox | No aplica todavía |
| Lint y formato | No existen |

## 12. Decisiones necesarias antes de las fases 5 y 6

**D1 — Motor de comercio (cuentas, direcciones, checkout, pedidos).** Opciones:

| | A. Shopify como motor (recomendada) | B. Backend propio | C. Solo enlaces a Shopify |
| --- | --- | --- | --- |
| Qué es | La web de KYRO (Astro) muestra el catálogo y el carrito; Shopify gestiona productos, cuentas, direcciones, pago y pedidos | Servidor propio + base de datos + proveedor de identidad + pasarela | Catálogo en el repositorio; "Pagar" lleva a un enlace de carrito de Shopify |
| Cuentas y direcciones | Cuentas de cliente de Shopify (seguras, sin contraseñas propias) | Hay que construirlas y protegerlas | Las de Shopify, por enlace |
| Pago | Checkout alojado de Shopify con los medios que tenga configurados | Integrar pasarela (p. ej. Bancard o Pagopar en Paraguay) | Checkout de Shopify |
| Coste | Sin coste extra conocido sobre el plan actual (a confirmar) | Hosting, base de datos, servicios; mantenimiento | Ninguno extra |
| Riesgo | Medio-bajo | Alto (seguridad, PCI, tiempo) | Bajo, pero catálogo duplicado a mano |
| Cambia la tienda Shopify | No toca el tema publicado; **sí** requiere añadir el canal "Headless" (credenciales de la API de escaparate) y gestionar los productos en Shopify | No | Requiere productos en Shopify |

**D2** — País de venta, moneda y medios de pago (dependen de D1).
**D3** — Hosting y dominio (no se despliega nada sin aprobación).
**D4** — Textos de políticas y preguntas frecuentes (o usar las políticas ya definidas en
Shopify, si existen).
**D5** — Formulario de contacto: necesita un servicio que entregue el mensaje (el de Shopify
en la opción A, o uno externo). Mientras tanto, enlace de correo.

## 13. Lo que se puede hacer ya, sin servicios externos

1. **Fase 3:** corregir el desbordamiento a 320–375 px; navegación y pie completos (sin
   enlaces vacíos); sección de contacto con `kyro89py@gmail.com`; `og:image`.
2. **Fase 4:** selector de cantidad; cambiar de talla en el carrito; búsqueda y orden en el
   catálogo (con estado "sin resultados" y catálogo vacío); esquema preparado para precio
   anterior, guía de tallas y talla + color, sin inventar datos.
3. **Fase 7:** estructura de ayuda y políticas que se activa cuando KYRO aporte los textos.
4. **Fase 8:** recortar fuentes; añadir lint y formato.

Todo ello sirve igual con la opción A (el catálogo pasaría a leerse de Shopify detrás de la
misma interfaz `src/lib/catalog.ts`).
