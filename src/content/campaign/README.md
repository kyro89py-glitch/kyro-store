# Imágenes de campaña

La fotografía editorial de la portada, con su procedencia declarada.

| Archivo | Qué es |
| --- | --- |
| `portada-corregida.png` | **La que usa el sitio** (`portada.md`). Versión retocada de `portada.png`. |
| `portada.png` | Original generada con IA a partir de las fotografías de la remera «'92» y del pantalón cargo. Se conserva intacta. |

La imagen está generada con IA y el sitio lo indica junto a ella (`generated: true`).

## Retoque de `portada-corregida.png`

En la original, los emblemas de las mangas estaban intercambiados y el trébol, deformado.
El retoque se hizo a mano (sin IA) y solo cambia las dos mangas: 2570 píxeles de
1 573 044 (0,16 %), dentro del recuadro x 335–747, y 301–392. Todo lo demás es idéntico
píxel a píxel.

- **Manga izquierda de quien la viste:** el escudo, tomado de una fotografía de detalle
  de la remera real; girado para seguir la manga y escorzado como se ve la manga casi
  de perfil, nunca reflejado.
- **Manga derecha:** el trébol completo, con la forma de la fotografía de detalle real,
  en el rojo con que la imagen representa la misma tinta (el texto «Manchester United»
  del pecho), porque sus líneas finas salieron subexpuestas en la foto del móvil.
- Los emblemas anteriores se borraron rellenando con la tela de la misma manga (luz y
  textura de la tela vecina) y se rehízo el borde de la silueta con antialiasing.
- Verificación: tela rellenada a +0,4 L* de su entorno en la manga del trébol (−2,7 L*
  en 26 píxeles junto al escudo), diferencia de color a*b* < 0,8 y textura equivalente.

Guía y ejemplo en [`docs/IMAGENES.md`](../../../docs/IMAGENES.md).
