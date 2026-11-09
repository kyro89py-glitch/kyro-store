# Fotos de producto (reales, mejoradas sin IA)

Fotografías reales de cada prenda, preparadas para las fichas de Shopify. Salen de las fotos
originales hechas sobre la cama (que no se guardan aquí porque muestran un espacio privado) con
`scripts/limpiar-foto-producto.py`:

- la prenda se recorta del fondo (umbral y GrabCut; para prendas grises, por color);
- la iluminación desigual del móvil se empareja y la dominante de color se neutraliza con
  ganancias globales tomadas de la propia prenda; el estampado recibe las mismas ganancias;
- se coloca sobre un fondo de estudio neutro con sombra suave.

No se usa IA: el estampado, las arrugas y las etiquetas son los de la foto real. Si la prenda
salía cortada en la foto original, queda anclada al borde inferior del lienzo, para que se lea
como encuadre y no como el bajo de la prenda.

| Archivo | Prenda | Origen |
| --- | --- | --- |
| `remera-212-frente.jpg`, `remera-212-espalda.jpg` | Remera «NY City Tee» («THE 212») | Fotos de KYRO del 09-11-2026 |
| `remera-92-frente.jpg`, `remera-92-espalda.jpg` | Remera «'92» Manchester United | `src/content/looks/92/` |
| `cargo-frente.jpg`, `cargo-espalda.jpg` | Pantalón cargo «Baggy» | `src/content/looks/92/` |
