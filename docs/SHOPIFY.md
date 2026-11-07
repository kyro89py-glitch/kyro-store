# KYRO en Shopify

Tema propio para la tienda Shopify de KYRO (`shopify-theme/`) y plan para cargar los productos.
Nada de esto está publicado: el tema se instala como **no publicado** y los productos se crean
como **borradores**.

## Estado

| Parte | Estado |
| --- | --- |
| Tema personalizado (Liquid, plantillas JSON, secciones y bloques editables) | Terminado y validado en local |
| Acceso a la tienda KYRO desde el conector | **Pendiente**: el conector estaba vinculado a otra tienda (HuellaEnManta), que no se tocó. Se revocó ese acceso; falta volver a autorizar el conector eligiendo la tienda KYRO |
| Tema instalado en Shopify | Pendiente del acceso (o de subir el zip a mano, ver abajo) |
| Productos borrador | Fichas preparadas (abajo); se crean cuando haya acceso |
| Precios, tallas a la venta, inventario | **Pendiente de KYRO**: no se inventan |
| Pagos, envíos, impuestos, políticas, dominio | **Pendiente**: se configuran en el panel de Shopify con los datos legales de KYRO |
| Fotografías con modelo fieles a las prendas | **Pendiente**: ver docs/MODA-IA.md |

## El tema

Online Store 2.0: todo se edita desde **Tienda online > Temas > Personalizar**, sin tocar código.

| Página | Plantilla | Secciones |
| --- | --- | --- |
| Inicio | `templates/index.json` | Imagen principal (pantalla completa o dividida), Productos destacados, Imagen con texto (desactivada hasta tener foto y texto reales), Colecciones, Texto destacado |
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
tipográfica con el nombre de la tienda; el logotipo se carga en Configuración del tema > Marca.

Las imágenes generadas con IA se pueden identificar con el campo «Pie de la imagen» de las
secciones de imagen (por ejemplo, «Imagen generada con IA»).

### Verificación

- Theme Check de Shopify (`@shopify/theme-check-node` 3.24.0): 0 errores y 0 avisos en los 49
  archivos Liquid y JSON.
- Vista previa local con el Liquid real del tema y datos de prueba (no es Shopify): 10 páginas
  sin desbordamiento horizontal a 390 y 1440 px.
- Accesibilidad (axe-core, WCAG 2.1 AA y buenas prácticas): 0 infracciones en 9 páginas, móvil
  y escritorio.
- JavaScript: selector de variantes (precio, precio anterior, disponibilidad, URL), talla
  agotada deshabilitada, añadir al carrito por AJAX (cantidad e id correctos, aviso y contador),
  menú móvil, zoom y barra de compra fija.
- Peso: CSS 7,9 KB y JavaScript 4,1 KB comprimidos, sin librerías.
- **No verificado**: el funcionamiento dentro de Shopify (checkout, pagos exprés,
  recomendaciones, filtros, formularios). Se comprobará en la vista previa del tema cuando esté
  instalado.

## Instalar el tema sin publicarlo

1. **Con el conector** (cuando esté autorizado en la tienda KYRO): se crea un tema no
   publicado y se suben los archivos. Publicar está bloqueado para el conector.
2. **A mano**: Tienda online > Temas > Agregar tema > Subir archivo zip, con
   `kyro-tema-shopify.zip`. El tema queda en la biblioteca, sin publicar; «Vista previa» lo
   muestra con los datos reales de la tienda.

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
