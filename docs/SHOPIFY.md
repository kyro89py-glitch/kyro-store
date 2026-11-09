# KYRO en Shopify

Tema propio para la tienda Shopify de KYRO (`shopify-theme/`) y plan para cargar los productos.
Nada de esto está publicado: el tema se instala como **no publicado** y los productos se crean
como **borradores**.

## Estado

| Parte | Estado |
| --- | --- |
| Tema personalizado (Liquid, plantillas JSON, secciones y bloques editables) | Terminado y validado en local |
| Acceso a la tienda KYRO desde el conector | Confirmado el 09-11-2026: `50upy1-b4.myshopify.com` («Mi tienda», plan Basic) |
| Copia de seguridad del tema actual | Hecha: «Horizon – copia de seguridad 2026-11-09», sin publicar. Horizon sigue publicado y sin cambios |
| Tema instalado en Shopify | «kyro-tema-shopify» (`gid://shopify/OnlineStoreTheme/189999710422`), sin publicar: subido a mano por KYRO y actualizado el 09-11-2026 desde el conector con `themeFilesUpsert`, archivo por archivo desde GitHub. Sus 61 archivos son idénticos a los del repositorio (MD5 comprobado). **Pendiente**: revisarlo con «Vista previa» dentro de Shopify |
| Tema «kyro-tema-shopify-1» | Subido a mano con un zip anterior: Shopify rechazó la sección del look y la plantilla de inicio, así que está incompleto. **Se puede eliminar** desde el panel; el conector no puede borrar temas |
| Productos borrador | Fichas preparadas (abajo); se crean cuando haya acceso |
| Precios, tallas a la venta, inventario | **Pendiente de KYRO**: no se inventan |
| Pagos, envíos, impuestos, políticas, dominio | **Pendiente**: se configuran en el panel de Shopify con los datos legales de KYRO |
| Fotografías con modelo fieles a las prendas | Portada del tema: look «'92», generado con IA y retocado, más tres fotos reales de detalle (ver «Portada de campaña»). Look «THE 212»: solo fotos reales por ahora. Imágenes nuevas con modelo: **pendiente** (ver «Generación con IA») |
| Fotos de producto | Reales y mejoradas sin IA en `fotos-producto/` (remera «THE 212», remera «'92» y cargo), listas para las fichas |
| Nombre de la tienda en Shopify | **Pendiente de KYRO**: sigue siendo «Mi tienda» (títulos de página, correos, checkout). El tema muestra «KYRO» con el ajuste «Nombre de la marca», sin tocar la tienda |

## El tema

Online Store 2.0: todo se edita desde **Tienda online > Temas > Personalizar**, sin tocar código.

| Página | Plantilla | Secciones |
| --- | --- | --- |
| Inicio | `templates/index.json` | Imagen principal (pantalla completa, dividida o «Campaña»), Look de campaña, Productos destacados y Colecciones (solo aparecen con datos reales), Imagen con texto y Texto destacado (desactivadas) |
| Catálogo y colecciones | `collection.json` | Cabecera de colección, filtros de Shopify (Search & Discovery), orden, rejilla y paginación |
| Lista de colecciones | `list-collections.json` | Mosaico de colecciones |
| Producto | `product.json` | Galería (deslizable en móvil, miniaturas en escritorio, zoom a pantalla completa), título, precio, variantes, cantidad, añadir al carrito (AJAX, funciona sin JavaScript), pago exprés, descripción, desplegables, envíos y devoluciones, barra de compra fija en móvil, recomendaciones |
| Carrito | `cart.json` | Líneas con cantidad, quitar, descuentos, subtotal, nota opcional y **checkout nativo de Shopify** |
| Búsqueda | `search.json` | Buscador y resultados (productos, páginas y artículos) |
| Contacto | `page.contact.json` | Formulario de contacto de Shopify (los mensajes llegan al correo de la tienda) |
| Envíos y políticas | `page.envios.json` | Texto de la página + lista de las políticas creadas en Shopify |
| Otras | `page.json`, `404.json`, `blog.json`, `article.json`, `password.json`, `gift_card.liquid` | |

Cabecera y pie son grupos de secciones (`header-group.json`, `footer-group.json`): barra de
anuncios opcional, menú principal, buscador, carrito con contador; pie con boletín (alta real
de clientes de Shopify), menús, políticas reales de la tienda, selector de país, medios de pago
activos y redes (solo las que tengan enlace).

Identidad: obsidiana `#0e1012`, obsidiana profundo `#08090a`, marfil `#f1ece3`, champán
`#c8b38a` (editables en Configuración del tema > Colores); Bodoni Moda y Archivo alojadas en el
propio tema (SIL Open Font License 1.1). Sin logotipo oficial, la marca se muestra como palabra
tipográfica con el ajuste «Nombre de la marca» (por defecto «KYRO»; si se vacía, el nombre de la
tienda); el logotipo se carga en Configuración del tema > Marca.

Las imágenes generadas con IA se pueden identificar con el campo «Pie de la imagen» de las
secciones de imagen (por ejemplo, «Imagen generada con IA»).

### Verificación

- Theme Check de Shopify (`@shopify/theme-check-node` 3.24.0): 0 errores y 0 avisos en los 51
  archivos Liquid y JSON (09-11-2026, con la portada de campaña). Theme Check **no** comprueba
  que las etiquetas de las opciones de un `select` tengan como máximo 50 caracteres, y Shopify
  rechaza la sección si no es así: se revisan aparte.
- Vista previa local con el Liquid real del tema y datos de prueba (no es Shopify): 10 páginas
  sin desbordamiento horizontal a 390 y 1440 px.
- Accesibilidad (axe-core, WCAG 2.1 AA y buenas prácticas): 0 infracciones en 9 páginas, móvil
  y escritorio.
- JavaScript: selector de variantes (precio, precio anterior, disponibilidad, URL), talla
  agotada deshabilitada, añadir al carrito por AJAX (cantidad e id correctos, aviso y contador),
  menú móvil, zoom y barra de compra fija.
- Peso: CSS 9,5 KB y JavaScript 4,4 KB comprimidos, sin librerías.
- **No verificado**: el funcionamiento dentro de Shopify (checkout, pagos exprés,
  recomendaciones, filtros, formularios). Se comprobará en la vista previa del tema cuando esté
  instalado.

### Portada de campaña (look «'92»)

La portada se construye sobre la foto de campaña del look «'92» que entregó KYRO, sin mostrar
productos, precios, tallas ni existencias.

| Bloque | Qué muestra |
| --- | --- |
| Imagen principal, composición «Campaña» | `kyro-92-espalda.jpg` entera, de la cabeza a los pies, sobre un fondo de estudio del mismo tono que el de la foto (`#181718` → obsidiana profundo), con los bordes fundidos y un grano común a foto y página. En escritorio, texto a la izquierda y figura a la derecha; en móvil y tableta, figura arriba (limitada a la altura de la pantalla) y el texto sobre el final fundido. Crédito «Look «'92»» e «Imagen generada con IA» arriba a la derecha (en vertical en móvil, para no tapar la cabeza) |
| Look de campaña (`sections/look.liquid`, nueva) | Recorte de frente `kyro-92-frente-remera.jpg` (de la cabeza a la cintura) con «Imagen generada con IA»; título «'92»; el texto aprobado del look; los detalles comprobados de las prendas (frente, espalda, manga izquierda, manga derecha, pantalón) y tres fotos **reales** de detalle con «Fotografía real» |
| Productos destacados, Colecciones | Sin cambios: solo aparecen cuando haya productos y colecciones reales |
| Look «THE 212» (segunda sección «Look de campaña», foto a la derecha) | Espalda de la remera como foto principal, frente de la remera y frente del cargo en pequeño: las tres son **fotos reales** sobre fondo de estudio oscuro (`kyro-212-*.jpg`, `kyro-cargo-frente.jpg`); texto aprobado del look y detalles comprobados |
| Texto destacado | Desactivado: repetía el título y el texto de la imagen principal. Se reactiva en el personalizador |

**Indicación de IA (decisión de KYRO, 09-11-2026):** la portada ya no muestra pies visibles
«Imagen generada con IA» ni «Fotografía real». Se mantiene la información en lo que no se ve:
el texto alternativo de las dos imágenes generadas lo dice y los archivos conservan sus
metadatos de origen (XMP de Canva y EXIF «AI generated»). Según el país donde venda KYRO puede
haber obligación de indicarlo de forma visible (por ejemplo, en la UE para imágenes sintéticas
realistas de personas); conviene confirmarlo con su asesoría.

Todas las fotos van incluidas en el tema (`assets/`) y se usan solo si no se elige otra imagen en
el personalizador (fragmento `snippets/campaign-media.liquid`): así la portada se ve completa
nada más instalar el zip, sin subir archivos aparte.

| Archivo | Tamaño | Procedencia |
| --- | --- | --- |
| `kyro-92-espalda.jpg` | 1024 × 1536 | Generada con IA (Canva), retocada sin IA (abajo) |
| `kyro-92-frente-remera.jpg` | 668 × 668 | Generada con IA (Canva), retocada sin IA; recorte por encima de la cintura |
| `kyro-92-detalle-escudo.jpg` | 640 × 800 | Foto real: recorte de `src/content/looks/92/detalle-escudo.jpg` |
| `kyro-92-detalle-trebol.jpg` | 640 × 800 | Foto real: recorte de `src/content/looks/92/detalle-trebol.jpg` |
| `kyro-92-detalle-diablo.jpg` | 640 × 800 | Foto real: recorte de `src/content/looks/92/remera-espalda.jpg` |

**Las dos imágenes generadas:**

- **Origen:** imágenes generadas con IA en Canva y entregadas por KYRO el 09-11-2026. Los
  metadatos de origen (XMP de Canva y EXIF «AI generated») se conservan en los archivos, y la
  página lo indica en el pie y en el texto alternativo.
- **Referencias reales:** `src/content/looks/92/` (remera de frente, de espaldas, escudo y
  trébol; cargo de frente y de espaldas).
- **Comparación con las prendas reales:** en la de espaldas el pantalón coincide (ripstop gris
  claro con ramas oscuras y salpicaduras blancas). El diablo de la espalda está dibujado con un
  trazo más simple que el semitono real (**no idéntico**). En las dos, los emblemas de las
  mangas estaban intercambiados y el trébol salía relleno.
- **Retoque de las mangas (sin IA):** se borraron los emblemas generados y se colocaron los
  reales, tomados de `detalle-escudo.jpg` y `detalle-trebol.jpg`: escudo en la manga izquierda
  de quien la viste y trébol en contorno, en la tinta roja del pecho, en la derecha. La tinta se
  aplica como reflectancia sobre la tela, así que conserva pliegues y luz. Donde el emblema
  viejo formaba el borde de la manga, el borde se reconstruyó a partir de la silueta de arriba
  y de abajo.
- **Acabado fotográfico** (para que no parezca tanto una imagen de IA): balance de blancos
  neutro (las imágenes tenían dominante magenta; la remera real es blanca), menos
  microcontraste artificial, negros y altas luces de película, viñeteado suave y grano fino.
  Los colores de las prendas se mantienen: diferencia media de unos 2 niveles sobre 255.
- **Pantalón incorrecto:** la versión de frente muestra un pantalón con otro estampado
  (camuflaje de manchas negras). No se usa a cuerpo entero: solo el recorte de la cabeza a la
  cintura, con el borde inferior fundido, en el que el pantalón no aparece.

**Correcciones de errores previos del tema**, encontradas al revisar la portada con la
animación activada (`kyro.js` y `kyro.css`):

- El título de la imagen principal («KYRO») no llegaba a aparecer nunca: empieza recortado del
  todo y el observador de desplazamiento no lo daba por visible. Ahora se observa su contenedor.
- Al aparecer, el título se quedaba 2,5 rem más abajo y montaba sobre el botón. Ahora vuelve a
  su sitio.

**Comprobado en la vista previa local** (no es Shopify; ver abajo): sin desbordamiento horizontal
a 390, 768, 1024, 1440 y 1920 px; título y botones sin solaparse; axe-core sin infracciones
(WCAG 2.1 AA y buenas prácticas), en móvil y escritorio; contraste de los textos sobre la foto
medido píxel a píxel con el texto oculto, de 6,1:1 como mínimo.

### Generación con IA

- **Figma Weave** (Nano Banana Pro, 11 créditos por imagen a 2K): la cuenta ya usó sus
  ejecuciones gratuitas; hace falta un plan de pago. No se generó nada.
- **Canva** (`generate-image` con referencias): acepta las fotos reales como referencia
  (importadas desde sus direcciones públicas de GitHub). Su conector exige usar como
  instrucción el texto literal de KYRO; con él salió una hoja de vistas sobre fondo urbano, no
  una foto de campaña. Además, la red de este entorno bloquea `www.canva.com`, así que solo
  llega una miniatura de 200 px: la imagen completa hay que descargarla desde Canva.
- Cualquier imagen nueva pasa por el protocolo de fidelidad de docs/MODA-IA.md antes de
  publicarse: estampados, logotipos y bolsillos idénticos a las fotos reales.

### Vista previa local

Como el tema aún no está instalado, la portada se revisó con una vista previa local: el Liquid
real del tema interpretado con `liquidjs`, con filtros y objetos de Shopify simplificados y con
los datos que tiene hoy la tienda (sin productos ni colecciones, sin políticas, menús
`main-menu` y `footer` reales). Sirve para revisar composición, encuadre y textos; **no**
sustituye a la vista previa del tema dentro de Shopify.

## Instalar el tema sin publicarlo

1. **Con el conector** (cuando esté autorizado en la tienda KYRO): se crea un tema no
   publicado y se suben los archivos. Publicar está bloqueado para el conector.
2. **A mano**: Tienda online > Temas > Agregar tema > Subir archivo zip, con
   `kyro-tema-shopify.zip`. El tema queda en la biblioteca, sin publicar; «Vista previa» lo
   muestra con los datos reales de la tienda.

El zip se genera comprimiendo el contenido de `shopify-theme/` (las carpetas `assets`,
`config`, `layout`, `locales`, `sections`, `snippets` y `templates` en la raíz del zip).

## Productos (borradores)

Solo datos confirmados por las fotos y etiquetas reales. Precio, moneda, tallas a la venta,
inventario, SKU y peso quedan **pendientes**.

### Remera «'92» Manchester United

- Marca/proveedor: adidas Originals (etiqueta: MUFC TEE 90, ref. JM5499, color WHITE).
- Descripción: remera blanca. Frente: «'92» en semitono azul y «Manchester United» en rojo.
  Espalda: diablo con tridente en semitono azul. Mangas: escudo del Manchester United en la
  izquierda y trébol de adidas en contorno rojo en la derecha.
- Fotos (reales, con exposición corregida): frente, espalda, escudo, trébol, etiquetas.
- Unidad fotografiada: talla L. **Pendiente**: qué tallas se venden.

### Pantalón cargo Baggy

- Marca/proveedor: **pendiente** (no se lee en las fotos).
- Descripción: pantalón cargo de corte holgado (etiqueta «BAGGY», talla 32×32). Tejido ripstop
  gris claro con estampado de ramas oscuras y salpicaduras blancas. Bolsillos con solapa y
  broches metálicos.
- Fotos (reales): frente, espalda, bolsillos delanteros, tejido, etiqueta.
- Unidad fotografiada: 32×32. **Pendiente**: qué tallas se venden.

## Configuración pendiente en el panel de Shopify

- País y moneda de la tienda; datos legales del negocio.
- Pagos: Shopify Payments u otros proveedores disponibles en el país de KYRO.
- Envíos (zonas y tarifas) e impuestos.
- Políticas (Configuración > Políticas): reembolsos, envíos, privacidad, términos. Requieren
  revisión legal; el tema solo enlaza las que existan.
- Páginas: «Contacto» con la plantilla `page.contact` y «Envíos» con `page.envios`.
- Menús: `main-menu` y `footer`.
- Filtros: aplicación Search & Discovery.
- Dominio y contraseña de la tienda hasta el lanzamiento.
