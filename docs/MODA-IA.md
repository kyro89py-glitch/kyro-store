# Experiencia de moda con modelos de IA: fase A (auditoría y dirección artística)

Fecha: 30-10-2026 · Rama: `evolucion-tienda` (`157390c`) · **Propuesta: nada de esto está
publicado, fusionado ni subido.** `main` sigue en `5ba8d17`; la etiqueta local
`respaldo/antes-evolucion-tienda` marca el punto anterior a esta rama y cada fase es un commit
propio, revertible por separado.

Clasificación: **confirmado** (comprobado en código o configuración), **probado** (cubierto
por pruebas que pasan), **pendiente** (falta trabajo o una decisión de KYRO), **no
verificado** (no se ha podido comprobar aquí).

## 1. Auditoría

### 1.1 Qué existe y qué conviene hacer con ello

| Pieza | Estado | Propuesta |
| --- | --- | --- |
| Portada «Cámara oscura»: KYRO en 3D (WebGL propio, ~15 kB), haz de luz, polvo, cámara que orbita al desplazar | Probado (respaldos sin WebGL, sin JS, movimiento reducido, colores forzados). Fluidez en Android: **no verificada** | **Conservar** como apertura. Acortarla (hoy ~3,4 s; ~2,6 s en móvil) para que el producto llegue antes |
| Colecciones en profundidad (paneles CSS 3D, categorías reales) y transición panel → categoría | Probado con datos de prueba | **Conservar** y ampliar con fotografía real de cada categoría |
| Revelados al desplazar (`reveal.ts`, 49 líneas) y transiciones tarjeta → ficha (View Transitions) | Probado | **Conservar**; reutilizar para la nueva vista editorial (sin librerías) |
| Ficha: galería deslizable, información fija en escritorio, talla, cantidad, «Añadir al carrito» con confirmación, relacionados reales, precio anterior, guía de tallas, enlaces de información | Probado | **Ampliar**: barra de compra fija en móvil, encuadres de detalle, ampliación de imagen |
| Cuadrícula de tarjetas (tienda, categorías, búsqueda) | Probado | **Conservar** en tienda y búsqueda (sirve para comparar); la portada y las categorías ganan una vista editorial |
| Carrito, búsqueda, ayuda y contacto | Probado | No se tocan |
| Cuenta de cliente y pago | No existen (decisión D1 de la [auditoría](AUDITORIA.md)) | Pendiente |

### 1.2 Cómo se cargan los productos

- Cada producto es un Markdown validado con Zod (`src/content.config.ts`): nombre, categoría,
  precio en unidad mínima y moneda única, imágenes locales con texto alternativo obligatorio,
  variantes (SKU, etiqueta, disponibilidad obligatoria), y campos opcionales reales.
- Las imágenes las optimiza Astro en el build (AVIF/WebP, tamaños adaptativos, carga diferida).
- El carrito guarda solo SKU y cantidad; precios y disponibilidad salen siempre de
  `catalog.json`, generado desde el catálogo. El pago está desactivado.
- **Catálogo real: vacío** (`src/content/products/` solo tiene su README). Todo lo que se ve
  con productos es la demostración, con datos de prueba (moneda XTS, imágenes abstractas).

### 1.3 Las 12 fotos recibidas: 6 prendas, frente y espalda

Solo se anota lo que se ve en las fotos. Nada de esto se publicará como dato de producto
sin que KYRO lo confirme.

| # | Prenda | Lo que se ve | Lo que no se puede saber por la foto |
| --- | --- | --- | --- |
| 1 | Camiseta blanca «'92» | Delante: «'92» en semitono azul y «Manchester United» en rojo; escudo en una manga, trébol en la otra. Detrás: diablo en semitono azul. Etiqueta colgante adidas Originals / Manchester United | Nombre comercial, precio, tallas y existencias, composición |
| 2 | Pantalón cargo de camuflaje | Estampado de ramas en grises con salpicaduras blancas; bolsillos de fuelle con solapa y botón de presión en las perneras; bolsillos traseros de parche; etiqueta de marca en la cintura (ilegible) | Marca, precio, tallas, composición. Las perneras salen cortadas por abajo en las dos fotos |
| 3 | Camiseta blanca «THE 212» | Delante: «THE 212» en naranja con contorno azul. Detrás: «NEW YORK» y «NYC», cinco estrellas, trébol y fondo texturizado. Logotipo en la manga. En la etiqueta se lee la talla **XL** | Precio (la etiqueta de precio no se lee con fiabilidad), otras tallas, composición |
| 4 | Camiseta deportiva jaspeada | Granate y negro jaspeado, logotipo adidas pequeño en blanco en el pecho; espalda lisa | Precio, tallas, composición |
| 5 | Pantalón de felpa blanco roto | Cintura elástica con cordón, bolsillos laterales, bolsillo trasero de parche, textos en relieve tono sobre tono en las perneras (ilegibles en la foto); etiqueta adidas | Precio, tallas, composición, texto exacto del relieve. Bajos cortados en la foto |
| 6 | Chaqueta negra de chándal | Cuello alto, cremallera completa, logotipo pequeño en el pecho, **tres franjas blancas diagonales a cada lado** del bajo delantero, puños y bajo elásticos; logotipo blanco en la espalda bajo el cuello | Tejido (parece un tejido técnico liso; **no verificado**), precio, tallas |

**Calidad de las fotos (confirmado):**

- 1620 × 1080 px y sin metadatos: probablemente reducidas. Para ver la prenda de cerca en una
  pantalla de alta densidad hacen falta unos 2000 px en el lado largo.
- Están hechas sobre una cama con sábana azul, con poca luz y dominante azul, arrugas, y otras
  prendas, portátiles y un lápiz en el encuadre.
- Muestran un espacio privado (habitación, portátil con pegatinas y un código QR): **las
  originales no se guardan en el repositorio**; solo entrarían recortes de la prenda.
- Sirven como **fuente de verdad** para comprobar la fidelidad. No sirven, tal cual, como
  fotografía de tienda premium.

### 1.4 Marcas de terceros

Las prendas llevan marcas de adidas, adidas Originals y Manchester United (y una marca
ilegible en el cargo). Esto tiene tres consecuencias que KYRO debe decidir o confirmar (no es
asesoramiento jurídico):

1. **Qué es KYRO.** El sitio presenta KYRO como marca de moda propia. Si KYRO revende prendas de
   otras marcas, los nombres de producto deben decir la marca real y el sitio no debe dar a
   entender que son diseños de KYRO.
2. **Derecho a revender y a usar las imágenes** con esas marcas en publicidad.
3. **Imágenes generadas con logotipos ajenos.** Los generadores suelen deformar logotipos y
   textos («'92», «THE 212», el escudo, el diablo, el trébol, las franjas). Una imagen así
   presentaría la prenda de forma distinta a como es, y además alteraría marcas registradas.

### 1.5 Herramientas de imagen disponibles (comprobado hoy)

| Herramienta | Resultado |
| --- | --- |
| Canva (conectado): generar imágenes con referencias y quitar fondos | **Bloqueada en dos puntos.** La red del entorno rechaza subir archivos a `www.canva.com` (proxy, 403), así que Canva no puede recibir las fotos de las prendas como referencia. Y la generación solo con texto responde «You have exceeded your credit quota»: la cuenta de Canva no tiene créditos. **No se generó ninguna imagen.** |
| Figma (incluye modelos de generación) | No conecta (proxy, 403) |
| Local: Python con Pillow y numpy, ImageMagick; `sharp` (ya viene con Astro) | Disponible: recortar, enderezar, ajustar exposición, redimensionar. **Sin GPU ni modelos de IA locales** |
| 3D propio (WebGL) | Disponible, pero mostrar prendas en 3D exigiría escanear o modelar cada una |

**Conclusión: hoy no es posible producir, desde este entorno, ninguna imagen con modelos de IA.**
No se ha simulado ninguna.

## 2. Dirección artística: «Plató»

Continúa la «Cámara oscura»: si la portada es un plató a oscuras donde la luz revela KYRO, el
resto de la tienda es ese mismo plató, y **cada prenda es un plano** de la campaña.

- **Paleta:** negro profundo `#08090a`, obsidiana `#0e1012`, carbón `#16191c`/`#1d2124`, marfil
  `#f1ece3`. El champán `#c8b38a` solo marca estado (precio rebajado, selección, foco).
- **Luz común a todas las imágenes:** una luz principal dura, lateral, a unos 45°; contraluz
  suave en hombros; sin relleno frontal; el fondo uno o dos pasos por debajo de la prenda.
  **El color de la prenda no se etalona**: solo el fondo.
- **Escenarios:** (1) estudio negro con fondo carbón y suelo pulido que refleja (fichas y
  planos generales); (2) calle nocturna desaturada, con hormigón y asfalto mojado (looks); (3)
  detalle sobre fondo neutro (tejido, estampado, cremallera).
- **Encuadres por prenda:** cuerpo entero 2:3 · plano medio 4:5 · detalle 1:1 · espalda
  cuando la espalda tiene diseño (prendas 1, 3 y 6).
- **Tipografía y movimiento:** el sistema actual (Bodoni Moda para titulares, Archivo para
  interfaz). Una cosa a la vez: la imagen se abre como un obturador, después el nombre,
  después el precio y la acción (90 ms entre cada una).

## 3. Casting de modelos de IA

- **Un elenco fijo** de 4 a 6 personas recurrentes, para que parezca una sola campaña:
  mujeres y hombres de distintos tonos de piel, de 20 a 35 años, con complexiones distintas
  (no un único tipo de cuerpo), con peinado y maquillaje naturales.
- **Estilismo de acompañamiento** sin logotipos, en negro y carbón, para que la prenda en venta
  sea lo único con marca en la imagen.
- **Poses** naturales: peso en una pierna, manos relajadas o en los bolsillos, nunca tapando
  un estampado o un logotipo; frente y espalda para las prendas con diseño detrás.
- **Talla coherente:** el modelo debe llevar una talla que exista en el catálogo (la camiseta
  «THE 212» XL no se puede mostrar ceñida como una S).
- **Control de calidad:** manos con cinco dedos y articulaciones creíbles, rostro sin
  deformaciones, piel con textura natural, sombras coherentes con la dirección de la luz,
  caída de la tela creíble y ningún texto inventado.
- **Transparencia:** cada imagen generada lleva la indicación «Imagen generada con IA» en la
  ficha y en su texto alternativo. En algunas jurisdicciones (por ejemplo, la UE) hay
  obligaciones de transparencia para contenido sintético; KYRO debe confirmarlo con su
  asesoría.

## 4. Protocolo de fidelidad (lo que hará cumplir el código)

1. **La foto original es la verdad.** Cada imagen generada se compara lado a lado con ella:
   color, forma, tamaño y posición de cada estampado; logotipos y textos idénticos; número y
   posición de bolsillos, botones, franjas (la chaqueta: tres por lado, en diagonal), cuello,
   puños, bajo, cremallera; largo y caída. **Nada añadido.**
2. **Si falla un solo punto, la imagen se descarta** y se usa la foto real (recortada y con
   el fondo limpio, sin tocar la prenda).
3. **Procedencia en el catálogo (fase B):** cada imagen declara su origen: `original`,
   `retocada` (recorte, fondo, exposición; prenda intacta) o `generada`. Una imagen
   `generada` debe citar las originales que usó y estar aprobada por KYRO. El build fallará si:
   - la primera imagen de un producto (tarjeta, buscadores, carrito) es generada;
   - una ficha no tiene al menos una imagen original o retocada;
   - una imagen generada no cita sus referencias o no está aprobada.
4. **Orden de archivos:** `src/content/products/<producto>/` con las fotos de producto y
   `editorial/` para las generadas. Las fotos originales completas (con la habitación) no
   entran en el repositorio.

## 5. Propuesta de experiencia (fases C y D)

- **Portada:** apertura actual, más corta → colecciones → **«Plano a plano»**: cada prenda
  destacada de verdad (`featured`) ocupa una pantalla. La imagen llega con el obturador; el
  panel de compra real (nombre, precio, tallas disponibles, «Ver la pieza») aparece
  coordinado y siempre legible. Al desplazar, el plano general pasa al detalle (fundido y
  escala de 1 a 1,08 con animaciones ligadas al desplazamiento en CSS donde existan; si no,
  el cambio es directo). Sin WebGL nuevo.
- **Categorías:** cabecera con la imagen de campaña de la categoría y un ritmo editorial
  (una pieza grande y dos pequeñas) en lugar de una cuadrícula uniforme.
- **Ficha, en móvil:** imagen primero; barra fija con talla y «Añadir al carrito» cuando el
  botón original sale de la pantalla. La galería tiene encuadres de frente, espalda y detalle,
  y se puede abrir a pantalla completa con zoom nativo.
- **Ficha, en escritorio:** paralaje moderado (unos 8 px) que sigue al cursor, y lupa sobre
  la foto.
- **Transición editorial → ficha:** la imagen viaja hasta la ficha (View Transitions, como hoy
  tarjeta → ficha).
- **Siempre:** con movimiento reducido todo queda quieto; nada depende de WebGL; solo la
  primera imagen se carga de inmediato; ninguna librería nueva.
- **Cuenta:** la navegación no la mostrará mientras no exista (decisión D1).

## 6. Plan por fases

| Fase | Trabajo | Archivos | Riesgos | Pruebas | Depende de |
| --- | --- | --- | --- | --- | --- |
| **B** Sistema de imágenes | Procedencia de imágenes en el esquema con las reglas del punto 4; indicación «Imagen generada con IA»; script con `sharp` para recortar y normalizar fotos de producto sin tocar la prenda | `src/content.config.ts`, `ProductGallery.astro`, `ProductCard.astro`, `src/pages/producto/[slug].astro`, `scripts/`, `docs/IMAGENES.md` | Endurecer el esquema rompe fichas mal declaradas (es la intención) | Unitarias del esquema, e2e de la indicación, fallo de build con imagen generada sin aprobar | Nada para el código; las imágenes, de los puntos 2 y 3 del apartado 7 |
| **C** Prototipo «Plano a plano» | Una sección de portada con las primeras prendas reales | `src/components/editorial/` (nuevo), `src/pages/index.astro` | Que el efecto retrase la compra; peso de imágenes | e2e (compra desde la sección), axe, teclado, movimiento reducido, medición LCP/CLS/TBT | Datos reales de al menos 2 prendas |
| **D** Integración | Categorías editoriales, barra de compra móvil, galería con encuadres y zoom | `ShopView.astro`, `src/pages/tienda/`, `ProductGallery.astro`, `ProductForm.astro`, ficha | Regresiones en carrito y navegación | Las 232 e2e actuales más las nuevas; barrido a 390, 768, 1440 y 2560 px | C aprobada |
| **E** Optimización | Medición antes y después (`scripts/medir-rendimiento.mjs`), correcciones, documentación | `docs/RENDIMIENTO.md` y los afectados | Cifras de este entorno sin GPU: límite pesimista | Medición, auditoría de accesibilidad, revisión de seguridad | Prueba en Android real (KYRO) |

## 7. Qué necesito de KYRO para seguir

1. **Datos de cada prenda:** nombre, marca, precio y moneda, tallas con existencias reales,
   categoría, composición y cuidados (de la etiqueta interior), y cuáles son destacadas.
2. **Fotos originales a resolución completa**, o una sesión nueva siguiendo el brief de
   [MARCA.md](MARCA.md): prenda entera, fondo liso, luz difusa, frente, espalda y detalles.
3. **Cómo producir las imágenes con modelos**, una de estas:
   - permitir `www.canva.com` en el acceso a red del entorno y recargar los créditos de Canva
     (la generación consume créditos de tu cuenta);
   - otra herramienta de prueba virtual de prendas (suelen ser de pago: requiere tu
     autorización);
   - generarlas fuera y entregármelas: las valido con el protocolo del punto 4 antes de usarlas.
4. **Marcas:** confirmar el derecho a revender y a usar imágenes con marcas de adidas y
   Manchester United, y si KYRO se presenta como tienda multimarca o como marca propia.

## 8. Estado de esta fase

| Resultado | Estado |
| --- | --- |
| Auditoría del proyecto y de la experiencia inmersiva | Confirmado |
| Análisis de las 12 fotos (6 prendas, frente y espalda) | Confirmado (solo lo visible) |
| Recortes de trabajo de cada foto, para revisión; fuera del repositorio | Confirmado |
| Generación de imágenes con modelos de IA | **No realizada**: red bloqueada hacia Canva y cuota de Canva agotada |
| Dirección artística, casting, protocolo de fidelidad y plan | Propuesta pendiente de aprobación |
| Fases B a E | Pendientes |
