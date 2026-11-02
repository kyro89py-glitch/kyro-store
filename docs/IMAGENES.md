# Imágenes: procedencia, licencia y uso

Regla general: **ninguna imagen entra al sitio sin procedencia y licencia conocidas**, y
ninguna imagen ajena se presenta como fotografía propia de KYRO.

## Imagen editorial de la portada

Hoy es `src/content/campaign/portada-corregida.png`: un modelo con la remera «'92» y el
pantalón cargo gris, **generada con IA** a partir de las fotografías de esas prendas y
retocada a mano para corregir los emblemas de las mangas; la original sin retocar se
conserva en `portada.png` (detalle en el README de esa carpeta). Se muestra
entera (4:5, sin recortes) en el bloque marfil del manifiesto, con la indicación «Imagen
generada con IA». Para cambiarla o añadir otra:

```
src/content/campaign/
  portada.md
  portada.jpg
```

```markdown
---
placement: hero
image: ./portada.jpg
alt: Descripción de lo que se ve en la foto
focus: center            # center · top · bottom · left · right
provisional: false       # true si NO es fotografía propia de KYRO
generated: false         # true si la imagen está generada con IA (el sitio lo indica)
credit:                  # obligatorio si provisional es true
  author: Nombre del fotógrafo o del estudio
  source: Dónde se obtuvo (sesión propia, banco de imágenes…)
  license: Licencia o acuerdo de uso
  url: https://…         # opcional
---
```

- Con `provisional: true`, el sitio muestra bajo la imagen: *"Imagen provisional · autor
  / fuente (licencia)"*. Así nunca se confunde con fotografía de la marca.
- Con `provisional: false` y `credit`, muestra *"Fotografía: autor / fuente (licencia)"*.
- El build falla si una imagen provisional no declara su crédito.

### Encuadre

La misma foto se recorta a tres formatos de cine:

| Pantalla | Formato |
| --- | --- |
| Vertical (móvil, tableta) | 1.37:1 |
| Tableta horizontal | 1.85:1 |
| Escritorio | 2.39:1 |

- Horizontal, de al menos **2560 px de ancho**.
- El motivo principal centrado (o indicado con `focus`) y con aire alrededor: el logotipo
  KYRO se superpone en el centro, sobre un velo oscuro que garantiza su lectura.
- Tonos oscuros y contrastados; la marca está diseñada sobre negro obsidiana.

## Fotografía de producto

Ver [CATALOGO.md](CATALOGO.md#fotografía) y el brief de sesión en [MARCA.md](MARCA.md#fotografía-brief-para-la-sesión).

### Imágenes generadas con IA

Una imagen de producto generada con IA (por ejemplo, un modelo vistiendo la prenda) se
declara con `generated: true`:

- La ficha la señala con «Imagen generada con IA», también en el visor a pantalla completa.
- Se ve entera (sin recorte) en la galería.
- **El build falla si todas las imágenes de una ficha son generadas**: siempre queda al
  menos una fotografía real de la prenda para comprobar lo que se compra.
- Solo puede ser la vista con modelo (`view: modelo`): un frente, una espalda o un detalle
  generado podría no coincidir con la prenda, así que el build lo rechaza.
- Antes de usarla, se compara con las fotografías originales: colores, estampados,
  escudos, logotipos, textos, bolsillos y proporciones. Ver [MODA-IA.md](MODA-IA.md#4-protocolo-de-fidelidad-lo-que-hará-cumplir-el-código).

## Lista de comprobación de licencia

Antes de usar una imagen que no sea de una sesión propia:

1. ¿Permite uso comercial en una tienda online?
2. ¿Permite modificarla (recortes, velos, formatos)?
3. Si aparecen personas: ¿hay cesión de derechos de imagen para uso comercial?
4. Si aparecen marcas, logotipos o prendas de terceros: ¿puede sugerir que son de KYRO?
   Si es así, no se usa.
5. ¿Exige atribución? Se declara en `credit`.
6. Se guarda copia de la licencia o del acuerdo fuera del repositorio.

Durante la primera fase no se pudo descargar ni verificar ninguna imagen de bancos
libres: la red del entorno de desarrollo bloquea Unsplash, Pexels, Wikimedia Commons y
Openverse.
