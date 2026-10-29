# Experiencia inmersiva «Cámara oscura» (exploración)

Primera versión de la portada inmersiva de KYRO: análisis de la referencia, dirección
artística, arquitectura y límites. **Es una exploración pendiente de aprobación; el KYRO
tipográfico sigue siendo un logotipo provisional, no oficial.**

## 1. Referencia analizada

**Qué se analizó:** un PDF con **19 fotogramas** (2 por segundo, de 0,0 a 9,0 s) de un vídeo
de 9,8 s grabado con un móvil apuntando a la pantalla de un portátil, mientras se recorre
el sitio del estudio Active Theory. **El vídeo original no llegó** (el PDF menciona un ZIP que
no se adjuntó): no se extrajeron fotogramas propios ni se pudo observar el movimiento
continuo entre ellos, solo inferirlo de la secuencia.

**Uso permitido:** referencia de técnica y sensación. No se reutilizan textos, logotipos,
modelos 3D, vídeos ni la identidad de Active Theory.

### Lo que muestran los fotogramas

| Tiempo | Escena |
| --- | --- |
| 0,0–0,5 s | Nubes de partículas de colores con forma orgánica; la cámara avanza hacia un núcleo de luz (resplandor, desenfoque). |
| 1,0–2,0 s | Sin corte, la cámara entra en un espacio: un plano de agua/cáusticas arriba, un panel con textura hexagonal, columnas, un anillo de partículas y suelo reflectante; desciende y orbita. |
| 2,5–8,5 s | Galería (`/work`): tarjetas de vidrio con grosor y borde iluminado, flotando a distintas profundidades y giradas; entran desde el fondo y pasan junto a la cámara al desplazarse. Entre ellas, remolinos de partículas y una columna de fragmentos iridiscentes. Títulos en tipografía pixelada con efecto de interferencia. |
| 9,0 s | Vuelta a la portada: titular monoespaciado gigante sobre un anillo 3D de vidrio con reflejos. |
| Siempre | Interfaz 2D fija sobre el mundo 3D: menú en cápsula arriba a la derecha y una lista abajo a la izquierda. |

### Técnicas identificadas

1. **Cámara y profundidad:** un único mundo continuo; el desplazamiento mueve la cámara
   (avance, descenso, órbita) y la URL cambia sin recargar. Profundidad por paralaje,
   desenfoque de lo cercano y escala por distancia.
2. **Capas y paneles flotantes:** tarjetas de vidrio con grosor real, rotadas en Y, a
   varias profundidades; la que está en foco al frente y nítida, las demás atrás.
3. **Luz, partículas y volumen:** resplandor (bloom), materiales iridiscentes, nubes de
   puntos que forman volúmenes, suelo que refleja.
4. **Transiciones con el desplazamiento:** vuelo de cámara entre escenas; las tarjetas
   llegan desde el fondo y salen por los lados; texto que se "sintoniza".
5. **Interfaz separada del mundo:** la navegación es 2D y siempre está accesible.

### Qué se adapta a una tienda de moda y qué no

| Se adapta | No se adapta (y por qué) |
| --- | --- |
| Un mundo continuo para portada → colecciones | Toda la web como una sola escena WebGL: en Android cuesta batería y retrasa la compra |
| Paneles con grosor que llegan desde el fondo | Vídeo dentro de las tarjetas: datos y batería |
| Suelo reflectante y luz que revela | Colores saturados e iridiscencias: chocan con la paleta de KYRO |
| Partículas, pero solo donde hay luz | Partículas por toda la pantalla: compiten con las prendas |
| Navegación 2D fija sobre el 3D | Texto con interferencia o pixelado: perjudica la lectura de nombres y precios |
| Desplazamiento con inercia | Secuestro del desplazamiento: se mantiene el desplazamiento nativo |

## 2. Dirección artística de KYRO

Un plató a oscuras donde la luz revela. **KYRO es un objeto físico**, de obsidiana, sobre un
suelo pulido que lo refleja; un **haz de luz** entra en diagonal y lo descubre; el polvo solo
se ve dentro del haz. Las colecciones son **fotogramas** suspendidos en profundidad.

- **Paleta:** obsidiana, marfil y champán (sin colores saturados).
- **Tipografía:** KYRO en volumen (Archivo extendida, provisional); titulares en Bodoni Moda.
- **Movimiento:** cámara lenta y con inercia; nada se mueve sin motivo; la ficha, el
  carrito y los precios quedan quietos y legibles.

## 3. Recorrido de la portada

1. **Apertura** (~3,4 s; ~2,6 s en móvil): oscuridad → se enciende el haz → aparece el polvo
   → KYRO llega desde el fondo, primero como silueta, y la luz lo recorre.
2. **Órbita** (desplazamiento): la cámara rodea KYRO y deja ver la extrusión y el reflejo.
3. **Colecciones:** la sección se fija; KYRO queda atrás y se apaga; el polvo pasa junto a
   la cámara; los paneles (categorías reales + "Toda la tienda") avanzan de uno en uno.
   Al abrir uno, su foto viaja hasta la portada de la categoría (View Transitions).
4. Novedades, manifiesto (con la imagen de campaña cuando exista) y destacados.

**Producción (catálogo vacío):** la apertura y la órbita son las mismas; en colecciones se
ve el estado "La primera colección está en preparación", sin paneles inventados.

## 4. Interacción

| Escritorio (ratón) | Android (táctil) |
| --- | --- |
| La luz y la cámara siguen al cursor | Un gesto horizontal gira la escena; el vertical es desplazamiento normal |
| El panel en foco se inclina hacia el cursor y su reflejo lo sigue | El panel cede al tocarlo; el reflejo se mueve con el desplazamiento |
| Teclado: al enfocar un panel, el recorrido lo trae al frente | Objetivos táctiles amplios (paneles de ~80 % del ancho) |

## 5. Arquitectura

- **Mundo 3D** (`src/scripts/3d/escena.ts`): un único lienzo WebGL fijo detrás de la portada
  y las colecciones. Cinco pasadas: suelo, reflejo, KYRO, haz y polvo. Sin librerías.
- **Núcleo** (`src/scripts/3d/nucleo.ts`): malla de KYRO, sombreado, matrices y la
  revelación; lo comparten el mundo y el KYRO del pie y del menú (`wordmark-3d.ts`).
- **Paneles** (`src/components/catalog/Colecciones.astro`): HTML con CSS 3D. Son enlaces
  reales, accesibles e indexables, y funcionan sin WebGL. El script solo actualiza `--pos`.
- **Escena** (`src/components/brand/Escena.astro`): pista con escenario fijo, frase,
  llamada a las colecciones y respaldo plano.
- **Transiciones:** View Transitions entre documentos (sin enrutador de una sola página):
  panel → portada de categoría (`c-<categoría>`) y tarjeta → ficha (`p-<producto>`).
- **Peso:** el 3D completo son ~15 kB comprimidos y se carga aparte.

## 6. Respaldos

| Situación | Qué se ve |
| --- | --- |
| Sin WebGL o si falla | KYRO plano sobre una luz hecha con CSS; la portada mide una pantalla |
| Sin JavaScript | Igual, y las colecciones como composición quieta |
| "Reducir movimiento" | Pose final quieta, sin recorrido ni polvo en movimiento; colecciones quietas |
| Colores forzados | Letras planas con colores del sistema |
| Ahorro de datos o poca memoria | Mundo 3D sin polvo |
| Con logotipo oficial (SVG) | Ese logotipo, plano (el 3D actual sale del KYRO tipográfico) |

Navegación, ficha y carrito no dependen de nada de lo anterior.

## 7. Rendimiento y límites

Medido con `scripts/medir-rendimiento.mjs` (ver [RENDIMIENTO.md](RENDIMIENTO.md)). En este
entorno **no hay GPU** (WebGL por software) **ni dispositivo Android real**: la fluidez en
Android **no está validada**. El vídeo de demostración se grabó con el reloj de la página
controlado (1/30 s por fotograma) para mostrar el ritmo real del 3D; las animaciones CSS
de la frase corren en tiempo real y en el vídeo aparecen algo antes.

## 8. Pendiente de decidir o de probar

- Prueba en un Android de gama media y en un escritorio con GPU (lista en RENDIMIENTO.md).
- Fotografía real: los paneles y la portada de categoría están pensados para fotos de
  moda; con las imágenes de prueba se ven apagados.
- Si KYRO adopta un logotipo oficial, generar su geometría 3D a partir del SVG.
- Fuentes (~186 kB): la mayor oportunidad de mejora de carga, independiente del 3D.
