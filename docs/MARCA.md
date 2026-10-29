# Sistema de marca KYRO en el sitio

Cómo se traduce la identidad de KYRO (moda urbana moderna, premium, minimalista y
cinematográfica: negro obsidiana, blanco marfil y champán discreto) en la tienda. Sirve
para mantener la coherencia y como guía para quien produzca el logotipo y la fotografía.

Este documento describe decisiones de diseño del sitio. No contiene datos comerciales
ni afirmaciones sobre la marca que KYRO no haya dado.

## Paleta

Definida en `src/styles/tokens.css`. No se añaden colores de acento fuera de esta lista.

| Token | Valor | Uso | Contraste sobre obsidiana |
| --- | --- | --- | --- |
| `--color-obsidian` | `#0e1012` | Fondo general | — |
| `--color-obsidian-deep` | `#08090a` | Portada, pie, menú | — |
| `--color-surface` | `#16191c` | Fondo de imágenes mientras cargan | — |
| `--color-ivory` | `#f1ece3` | Texto principal, botón principal | 16,2:1 |
| `--color-ivory-muted` | `#a7a198` | Texto secundario | 7,4:1 |
| `--color-champagne` | `#c8b38a` | Foco del teclado, subrayados, avisos discretos | 9,3:1 |

Todas las combinaciones de texto superan WCAG AA (4,5:1) sobre los tres fondos oscuros;
marfil y champán superan también AAA (7:1). El texto secundario sobre `surface` queda en
6,9:1. El champán se usa con moderación: nunca como fondo de grandes superficies ni en
más de un elemento por vista.

## Tipografía

| Familia | Rol | Reglas |
| --- | --- | --- |
| Bodoni Moda (Didone editorial) | Títulos de cartel (`.display`, hasta 9,5 rem), titulares, nombres de producto, manifiesto, menú móvil | Solo a partir de ~24 px; peso 400–420; cursiva para frases de la marca y para la página actual en el menú |
| Archivo (grotesca variable) | Interfaz, textos, precios, logotipo provisional y cabecera "KYRO" a todo el ancho | Navegación y botones con anchura 112 %; logotipo a 125 % |

- La tensión entre la Didone (alta costura) y la grotesca extendida (calle) es la
  identidad tipográfica.
- Escala de cuarta justa (1,333). Texto en minúscula inicial: sin etiquetas en
  mayúsculas, salvo el logotipo.
- Fuentes alojadas en el propio sitio, con licencia SIL OFL 1.1.

## Logotipo

**Hoy:** logotipo tipográfico **provisional**, compuesto con Archivo extendida. No es un
logotipo oficial ni está aprobado por KYRO. Se usa en dos tamaños
(`src/components/brand/Wordmark.astro`):

- **Marca** (`.wordmark`): "KYRO" con espaciado amplio, centrado en la cabecera de todas
  las páginas. Con cursor, el espaciado se abre y vira a champán.
- **Cabecera de revista** (`.masthead`): "KYRO" a todo el ancho, letra a letra. Abre la
  portada (montada sobre el borde inferior de la pantalla), cierra cada página en el pie
  y firma, en contorno, el menú móvil. Así el nombre se lee antes que cualquier otra cosa
  y la marca se reconoce aunque aún no haya fotografía.

**Cuando exista el oficial**, se coloca como `src/assets/brand/logo.svg` y el sitio lo usa
automáticamente en la cabecera, el pie, el menú y la portada (también a todo el ancho).
Requisitos del archivo:

- **SVG vectorial**, con los textos convertidos a trazos: sin fuentes incrustadas ni
  imágenes rasterizadas dentro.
- Color con **`fill="currentColor"`**, sin colores fijos: el sitio lo pinta en marfil
  sobre obsidiana, o en negro en el modo de alto contraste.
- **Sin atributos `style` ni `<style>`**: la política de seguridad del sitio (CSP) los
  bloquea. Usar atributos de presentación (`fill`, `stroke`).
- `viewBox` ajustado al dibujo, sin márgenes vacíos.
- Versión horizontal legible a 16 px de alto (cabecera móvil) y que aguante el tamaño
  de cartel a todo el ancho de la pantalla.
- Aparte, un **símbolo cuadrado** para el favicon y los iconos de aplicación.

## Movimiento

Un lenguaje de cámara: el movimiento revela, encuadra y confirma; nunca decora ni hace
esperar. **No hay pantalla de carga**: el contenido está en la página desde el primer
pintado y el movimiento solo lo descubre.

**Apertura de la portada** (solo CSS, ~2 s): la pantalla se abre como un obturador desde
el centro → las letras de KYRO suben una a una desde una máscara → aparece la frase →
aparecen las acciones. Después la luz deriva despacio; con ratón, un foco sigue al cursor;
al desplazarse, la pantalla y el nombre se separan (paralaje con `animation-timeline`).

**Vocabulario al desplazarse** (`data-reveal`, `src/scripts/reveal.ts` + `base.css`). Cada
pieza se revela una sola vez al entrar en pantalla; las que entran juntas se escalonan
90 ms en orden de lectura:

| Gesto | Uso | Efecto |
| --- | --- | --- |
| `aperture` | Fotos de tarjetas, categorías, pantallas de luz, galería | Se abre como un obturador desde el centro |
| `title` | Títulos de sección y de página, letras del KYRO del pie | El texto sube desde una máscara, como un rótulo |
| `rise` | Textos, enlaces, precios | Aparece y sube un poco |
| `line` | Líneas divisorias | Se dibuja de izquierda a derecha |

**Transiciones entre páginas** (View Transitions entre documentos, mejora progresiva): la
página saliente se funde (240 ms) y la entrante sube levemente (560 ms); la cabecera queda
quieta; la foto de una tarjeta viaja hasta la ficha del producto; la línea del filtro de
categorías se desliza de una categoría a otra.

**Respuesta a acciones:**

- Cursor (solo con ratón): subrayados champán que crecen, segunda foto y acercamiento
  lento en las tarjetas, barrido de luz en el botón principal, KYRO que "respira".
- Toque: no hay estados hover en pantallas táctiles; botones, tarjetas, tallas y
  cantidades ceden al presionarlos.
- Menú móvil: cortina de arriba abajo, enlaces numerados en escalera, KYRO en contorno.
- Talla: el marfil la llena de abajo arriba y la pieza late una vez. Sin talla elegida,
  las opciones hacen un leve gesto y aparece el aviso.
- Añadir al carrito: barrido de luz en el botón, el número del carrito late, el panel
  entra con las líneas en escalera y la línea añadida se ilumina un instante.
- Acordeones de la ficha: se despliegan con altura animada donde el navegador lo admite.

**Tokens:** `--ease-out` (salida suave), `--ease-shutter` (obturador: arranque firme y
frenado largo), 160 ms (interfaz), 320 ms (enlaces), 560 ms (paneles), 1100 ms (revelados),
90 ms de escalonado. Solo se animan `opacity`, `translate`, `scale` y `clip-path`, que no
recalculan el diseño de la página.

**Accesibilidad y seguridad:**

- Con "reducir movimiento", todo aparece al instante y no hay transiciones entre páginas.
- Sin JavaScript nada se oculta: los revelados solo se activan si el script arranca
  (`html.motion`), y un seguro los retira si no lo hace en 3 s.
- Nada de lo que se revela queda fuera del alcance del teclado ni de los lectores de
  pantalla, y al terminar no queda ningún recorte que corte el foco.

## Fotografía: brief para la sesión

### Producto

- Proporción **4:5 vertical**, al menos **2000 px de ancho**, en JPEG o PNG.
- Fondo y luz **iguales en toda la colección**. El sitio es oscuro: funcionan mejor
  fondos neutros oscuros o grises medios con luz lateral suave que fondos blancos puros.
- Por pieza, como mínimo: frente y espalda. La primera foto es la portada de la tarjeta
  y la segunda aparece al pasar el cursor. Recomendados: detalle de material o acabado
  y la prenda puesta.
- Mismo encuadre y altura de cámara entre productos, para que la cuadrícula se lea ordenada.

### Campaña (portada)

- **Horizontal**, al menos **2560 px de ancho**.
- La foto llena la pantalla de la portada: unos 2:1 en escritorio y unos 2:3 en vertical
  en móvil. **Zona segura:** el motivo debe quedar dentro del **tercio central del ancho**
  para sobrevivir al recorte vertical.
- KYRO se monta sobre el **borde inferior** de la foto y la frase va arriba a la izquierda
  en escritorio (abajo en móvil), sobre un velo oscuro: dejar el tercio inferior más
  limpio y oscuro.
- Tonos oscuros y contrastados, con luz motivada (farolas, ventanas, neón tenue).
  Grano fino bienvenido; nada de filtros de color que salgan de la paleta.

### Derechos

- Cesión de derechos de imagen de modelos y localizaciones para uso comercial online.
- Ninguna prenda o marca de terceros reconocible.
- Ver la lista de comprobación de licencia en [IMAGENES.md](IMAGENES.md).

## Voz y textos

- Frases cortas, verbos simples, sin superlativos ("el mejor", "único").
- Nada que no se pueda comprobar: materiales, origen, plazos, stock o premios solo si
  KYRO los confirma.
- Botones que dicen lo que hacen: "Añadir al carrito", "Explorar la colección", "Ver la tienda".
- Los textos actuales están en borrador en `src/config/copy.ts`.

## Qué no hacer

- Imágenes de bancos presentadas como fotografía propia (las provisionales llevan crédito
  visible).
- Colores, sombras o degradados decorativos fuera de la paleta.
- Movimiento que retrase la compra: pantallas de carga, animaciones que haya que esperar
  para poder pulsar, efectos en bucle llamativos.
- Animaciones que ignoren "reducir movimiento" o que oculten contenido si falla el script.
- Tarjetas con bordes redondeados o sombras genéricas.
