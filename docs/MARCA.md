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
| Bodoni Moda (Didone editorial) | Titulares, nombres de producto en la ficha, manifiesto | Solo a partir de ~24 px; peso 420; cursiva para frases de la marca |
| Archivo (grotesca variable) | Interfaz, textos, precios, logotipo provisional | Navegación y botones con anchura 112 %; logotipo a 125 % |

- La tensión entre la Didone (alta costura) y la grotesca extendida (calle) es la
  identidad tipográfica.
- Escala de cuarta justa (1,333). Texto en minúscula inicial: sin etiquetas en
  mayúsculas, salvo el logotipo.
- Fuentes alojadas en el propio sitio, con licencia SIL OFL 1.1.

## Logotipo

**Hoy:** logotipo tipográfico provisional ("KYRO" en Archivo extendida, con espaciado amplio).

**Cuando exista el oficial**, se coloca como `src/assets/brand/logo.svg` y el sitio lo usa
automáticamente en la cabecera, el pie y la portada. Requisitos del archivo:

- **SVG vectorial**, con los textos convertidos a trazos: sin fuentes incrustadas ni
  imágenes rasterizadas dentro.
- Color con **`fill="currentColor"`**, sin colores fijos: el sitio lo pinta en marfil
  sobre obsidiana, o en negro en el modo de alto contraste.
- **Sin atributos `style` ni `<style>`**: la política de seguridad del sitio (CSP) los
  bloquea. Usar atributos de presentación (`fill`, `stroke`).
- `viewBox` ajustado al dibujo, sin márgenes vacíos.
- Versión horizontal legible a 16 px de alto (cabecera móvil).
- Aparte, un **símbolo cuadrado** para el favicon y los iconos de aplicación.

## Movimiento

- **Un solo momento automático:** la apertura de la portada. El encuadre se abre como
  una cartela de cine y el logotipo aparece con un barrido de luz; dura unos 3,3 s y
  la frase y los botones aparecen a los 1,5 s.
- Todo lo demás responde a una acción: subrayados que crecen al pasar el cursor,
  segunda foto en las tarjetas, apertura del carrito y del menú.
- Duraciones: 160 ms (interfaz), 320 ms (enlaces), 560 ms (paneles). Curva de salida
  suave (`--ease-out`).
- Con "reducir movimiento" activado, todo aparece al instante.

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
- La misma foto se recorta a 2.39:1 en escritorio, 1.85:1 en tableta horizontal y
  1.37:1 en vertical. **Zona segura:** el motivo debe quedar dentro del **57 % central del
  ancho** para sobrevivir al recorte vertical.
- El logotipo se superpone en el centro sobre un velo oscuro: dejar aire en el centro o
  aceptar que la figura quede por debajo del logotipo.
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
- Botones que dicen lo que hacen: "Añadir al carrito", "Ver la tienda".
- Los textos actuales están en borrador en `src/config/copy.ts`.

## Qué no hacer

- Imágenes de bancos presentadas como fotografía propia (las provisionales llevan crédito
  visible).
- Colores, sombras o degradados decorativos fuera de la paleta.
- Animaciones automáticas en cada sección.
- Tarjetas con bordes redondeados o sombras genéricas.
