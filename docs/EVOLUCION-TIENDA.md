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
