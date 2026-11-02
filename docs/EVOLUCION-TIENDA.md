# Evolución de la tienda: avance por fases

Registro de lo hecho tras la [auditoría](AUDITORIA.md), en la rama `evolucion-tienda`. Cada
resultado se clasifica igual que en la auditoría:

- **Confirmado:** comprobado leyendo el código o la configuración.
- **Probado:** cubierto por pruebas automáticas que pasan.
- **Pendiente:** falta trabajo o una decisión de KYRO.
- **No verificado:** no se ha podido comprobar en este entorno.

Nada de esta rama está publicado ni fusionado; `main` no se ha tocado.

## Fase 3: navegación, contacto y ayuda

| Cambio | Estado |
| --- | --- |
| Desbordamiento de la portada a 320 px (47 px) y 375 px (4 px): el título «Colecciones» y su contador pasan a dos líneas cuando no caben | Probado (barrido de 8 anchos, de 320 a 1920 px, en 13 páginas: sin desbordamiento ni objetivos táctiles menores de 24 px) |
| Correo oficial `kyro89py@gmail.com` en `src/config/store.ts` | Confirmado |
| Página `/ayuda/` «Ayuda y contacto»: botón «Escribir un correo» (enlace `mailto:`) y aviso de que abre la aplicación de correo de quien escribe | Probado |
| No hay formulario: el sitio no puede decir «mensaje enviado» porque no envía nada | Probado |
| «Copiar la dirección»: solo aparece si el navegador permite copiar; dice «Dirección copiada.» únicamente si la copia funcionó y, si falla, lo dice | Probado (éxito y fallo simulados) |
| Preguntas frecuentes (`src/config/help.ts`): solo describen el funcionamiento real del sitio (pago inactivo, carrito en el dispositivo, sin cuentas, tallas agotadas, límite de unidades, qué se guarda en el navegador) | Probado: las afirmaciones «sin cookies ni terceros» y «solo se guarda el carrito» tienen su propia prueba |
| Envíos, cambios y devoluciones: la ayuda dice que todavía no están publicados; enlaza a las páginas informativas en cuanto existan | Probado (con y sin páginas) |
| Si se borra el correo de la configuración, la página pasa a llamarse «Ayuda» y desaparecen el bloque de contacto y los «escríbenos» | Confirmado (código); no hay prueba con ese build |
| Pie: Tienda (toda la tienda, categorías reales, carrito) · Atención al cliente (ayuda, preguntas frecuentes, correo) · KYRO (la marca y redes cuando existan) · Información (solo si hay páginas) | Probado: ningún enlace interno del pie da error |
| Menú móvil: enlace a «Ayuda y contacto» con objetivo táctil de 44 px | Probado |
| `/ayuda/` y las páginas informativas en el sitemap (que solo se genera al lanzar la tienda) | Confirmado |
| Redes sociales, teléfono, dirección, horario | Pendiente: no se publican hasta que KYRO los facilite |
| Formulario de contacto | Pendiente (decisión D5 de la auditoría): necesita un servicio que entregue el mensaje |

## Fase 4: búsqueda, cantidad, cambio de talla y campos opcionales

| Cambio | Estado |
| --- | --- |
| `/buscar/`: busca en nombre, categoría, resumen, detalles y composición, sin distinguir tildes ni mayúsculas; las palabras de 1–2 letras solo cuentan al principio de una palabra | Probado (18 pruebas unitarias en `tests/unit/search.test.ts` y e2e) |
| Filtros que salen de los datos: categoría (si hay ≥ 2), talla disponible (si hay ≥ 2), «solo disponibles» (si alguna pieza está agotada), orden por precio (si hay precios distintos) | Probado |
| Estado en la URL (`?q=…&categoria=…&talla=…&disponible=1&orden=…`); los valores que no existen en el catálogo se ignoran | Probado |
| Sin resultados: mensaje, «Quitar filtros» y «Ver toda la tienda». Catálogo vacío: estado «La primera colección está en preparación», sin filtros | Probado (demostración y producción) |
| Sin JavaScript: se ve el catálogo completo y un aviso; no se muestran controles que no funcionarían (búsqueda, cantidad, «Añadir al carrito») | Probado |
| «Buscar» en la cabecera (escritorio), el menú móvil y el pie (solo si hay productos); «Buscar y filtrar» en la tienda y en cada categoría | Probado |
| Selector de cantidad en la ficha: respeta el límite por talla descontando lo que ya está en el carrito y lo explica | Probado |
| Cambiar de talla dentro del carrito (las agotadas aparecen, pero no se pueden elegir); si la talla ya estaba, se juntan con el límite | Probado (pruebas unitarias de `changeVariant` y e2e) |
| `catalog.json` incluye `productId` para agrupar las tallas de cada producto | Confirmado |
| Campos opcionales del catálogo: `price.compareAt` (precio anterior real, debe ser mayor; se muestra tachado), `sizeGuide` (página de guía de tallas; el build falla si no existe) y `productLink` en páginas informativas (se enlazan en todas las fichas) | Probado con datos de prueba; ningún producto real los usa |
| Variantes de dos ejes (talla + color) | Pendiente: depende de la decisión D1 y de productos reales |

Verificación completa de esta fase: `astro check` 0 errores; 70 pruebas unitarias; build de
producción y de pruebas; 232 pruebas e2e superadas y 10 omitidas a propósito (pruebas del
menú móvil en los perfiles de escritorio y tableta, donde ese menú no existe).

## Ficha de producto y foto editorial

Punto de reversión: etiqueta local `respaldo/antes-ficha-editorial` (`628b9dd`).

| Cambio | Estado |
| --- | --- |
| Fichas de la remera «'92» y del pantalón cargo | **Pendiente**: no existen. El catálogo real está vacío y faltan nombre, precio, moneda, tallas y existencias; no se inventan |
| Foto editorial del modelo (remera «'92» + cargo) como imagen de campaña de la portada, entera (4:5), con «Imagen generada con IA» y un acercamiento lento al desplazar (solo con movimiento permitido) | Probado (producción) |
| Fidelidad de la foto frente a las originales: «'92», «Manchester United» y estampado del cargo, correctos; escudo y trébol de las mangas estaban intercambiados y el trébol, deformado | Corregido con retoque manual a partir de fotografías de detalle reales (`portada-corregida.png`; la original se conserva). Verificado con medidas de luz, color y textura |
| Esquema: `generated` en imágenes de producto y de campaña; el build falla si una ficha solo tiene imágenes generadas | Probado (unitarias) |
| Galería: puntos para elegir foto en móvil, enlace de cada foto a su versión grande (funciona sin JavaScript), visor a pantalla completa con deslizamiento, flechas del teclado y botones; las editoriales no se recortan | Probado |
| Elegir y añadir: talla elegida junto a la etiqueta, explicación de las tallas tachadas, «Añadido ✓» en el botón | Probado |
| Barra de compra fija en móvil (mismo formulario y mismo carrito); se aparta cuando el botón principal está en pantalla | Probado |
| Fotos con reserva JPG en lugar de PNG para navegadores sin AVIF/WebP | Confirmado |
| Casilla «Solo disponibles» de la búsqueda a 24 px | Confirmado (barrido de anchos) |

Medición (`scripts/medir-rendimiento.mjs`, sin GPU; CPU 4× y red 4G en móvil): portada de
producción LCP 1428 ms escritorio / 2012 ms móvil, CLS 0, la foto de campaña no se descarga
en la carga inicial; ficha de demostración LCP 140 / 680 ms, TBT 0, CLS 0.
