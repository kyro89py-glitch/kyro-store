# Looks

Un conjunto completo presentado como campaña: `<slug>/index.md` + sus imágenes →
`/looks/<slug>/`. La galería muestra la vista con modelo y, sobre todo, las fotografías
reales de cada prenda (frente, espalda y detalles) para examinarlas con zoom.

- Cada imagen declara `view` (`modelo`, `frente`, `espalda`, `detalle`) y un `label`
  corto visible en la galería.
- Una imagen generada con IA (`generated: true`) solo puede ser `view: modelo`; el
  build falla si un frente, una espalda o un detalle es generado.
- `garments[].product` enlaza a la ficha de la prenda cuando existe (slug de
  `src/content/products/`).

## Look «'92»: procedencia de las imágenes

| Archivo | Origen | Tratamiento |
| --- | --- | --- |
| `../../campaign/portada-corregida.png` | Generada con IA, emblemas corregidos a mano | Ver `src/content/campaign/README.md` |
| `remera-frente.jpg`, `remera-espalda.jpg`, `cargo-frente.jpg`, `cargo-espalda.jpg` | Fotografías de KYRO de las prendas extendidas | Recorte a la prenda y exposición (misma ganancia en los tres canales: ×1,33–1,36 remera, ×1,14–1,15 cargo); sin cambios de color |
| `detalle-escudo.jpg`, `detalle-trebol.jpg`, `detalle-etiquetas.jpg`, `detalle-cargo-etiqueta.jpg` | Fotografías de detalle de KYRO | Recorte 4:5; el escudo y la etiqueta del cargo, girados 90° para leerse derechos (nunca reflejados) |

## Look «THE 212»: procedencia de las imágenes

| Archivo | Origen | Tratamiento |
| --- | --- | --- |
| `remera-frente.jpg`, `remera-espalda.jpg` | Fotografías de KYRO de la remera extendida | Recorte a la prenda y exposición (misma ganancia en los tres canales: ×1,38 y ×1,30); sin cambios de color |
| `detalle-etiquetas.jpg` | Fotografía de detalle de KYRO | Recorte 4:5 |
| `../92/cargo-*.jpg`, `../92/detalle-cargo-etiqueta.jpg` | Las mismas fotografías del cargo del look «'92» | Ver arriba |

Sin vista con modelo: la imagen generada recibida conserva la remera (frente «THE 212» y
espalda «NEW YORK»), pero no el pantalón (otro estampado de camuflaje y otros bolsillos),
añade un logotipo en la manga derecha y deforma el de la izquierda. No se usa.
