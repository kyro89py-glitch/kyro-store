# Cómo cargar productos reales

Cada producto es una carpeta dentro de `src/content/products/`. El nombre de la carpeta
es la URL del producto.

```
src/content/products/
  sobrecamisa-negra/
    index.md
    frente.jpg
    espalda.jpg
    detalle.jpg
```

→ `/producto/sobrecamisa-negra/`

## Ficha de ejemplo

Este ejemplo muestra el formato. **No es un producto de KYRO**: todos los valores son
marcadores que hay que reemplazar.

```markdown
---
name: NOMBRE DEL PRODUCTO
status: draft            # draft · active · archived
category: NOMBRE DE CATEGORÍA
summary: Una frase breve que describa la pieza.
price:
  amount: 000000         # en la unidad mínima de la moneda (ver abajo)
  currency: XXX          # código ISO 4217 de la moneda real (PYG, USD…)
  compareAt: 000000      # opcional; precio ANTERIOR real, solo si la pieza está rebajada
images:
  - src: ./frente.jpg
    alt: Descripción de lo que se ve en la foto
  - src: ./espalda.jpg
    alt: Descripción de lo que se ve en la foto
  - src: ./modelo.png
    alt: Descripción de lo que se ve en la foto
    generated: true      # opcional; imagen generada con IA (ver docs/IMAGENES.md)
    view: modelo         # opcional; modelo · frente · espalda · detalle
    label: Look completo # opcional; nombre visible en la galería
optionName: Talla        # opcional; por defecto "Talla"
variants:
  - sku: KY-0001-S
    label: S
    available: true
  - sku: KY-0001-M
    label: M
    available: false
details:                 # opcional
  - Detalle de la prenda
composition: Texto de composición   # opcional
care:                    # opcional
  - Instrucción de cuidado
sizeGuide: guia-de-tallas  # opcional; slug de una página de src/content/pages/
featured: false          # opcional; la muestra en "Destacados" de la portada
releasedAt: 2026-01-31   # opcional; fecha REAL de lanzamiento, la muestra en "Novedades"
position: 0              # opcional; orden en los listados (menor primero)
---

Descripción larga opcional, en Markdown.
```

## Reglas que comprueba el build

| Campo | Regla |
| --- | --- |
| Carpeta | Minúsculas, números y guiones (`abrigo-largo`). |
| `status` | Obligatorio. Solo `active` aparece en el sitio; `draft` sirve para preparar fichas. |
| `price.amount` | Entero positivo en la **unidad mínima**: céntimos para USD/EUR (`12550` = 125,50), guaraníes para PYG (`350000` = 350.000). |
| `price.currency` | Código ISO 4217 en mayúsculas. Todos los productos activos deben usar la misma moneda. |
| `images` | Entre 1 y 16, cada una con texto alternativo. La primera es la portada; la segunda aparece al pasar el cursor en la tienda. `view` (modelo, frente, espalda, detalle) y `label` ordenan la galería. Las generadas con IA llevan `generated: true`, **solo pueden ser `view: modelo`** (un frente, una espalda o un detalle siempre es una fotografía real) y debe quedar al menos una fotografía real. |
| `variants` | Entre 1 y 30. `available` es obligatorio: la tienda nunca supone que hay existencias. |
| `sku` | Mayúsculas, números y guiones; único en todo el catálogo. |
| `category` | Genera la URL de la categoría; dos categorías no pueden escribirse distinto y producir la misma URL. |
| `releasedAt` | Opcional, formato `AAAA-MM-DD`. Usa solo fechas reales de lanzamiento. |
| `price.compareAt` | Opcional. Precio anterior real, en la misma unidad que `amount` y **mayor** que él. La tienda lo muestra tachado junto al precio actual. No lo uses para simular descuentos. |
| `sizeGuide` | Opcional. Slug de una página informativa (`src/content/pages/<slug>.md`) con la guía de tallas; la ficha la enlaza. Si la página no existe, el build falla. |

Las páginas informativas con `productLink: true` (p. ej. envíos o devoluciones) se enlazan
en todas las fichas, bajo el botón de compra.

## Búsqueda

`/buscar/` busca en el nombre, la categoría, el resumen, los detalles y la composición,
sin distinguir tildes ni mayúsculas. Sus filtros salen solo de datos reales: categoría (si
hay al menos dos), talla (tallas con `available: true`, si hay al menos dos), "solo
disponibles" (si alguna pieza está agotada) y orden por precio (si hay precios distintos).
La página trae todas las piezas activas y filtra en el navegador; con un catálogo de
varios cientos de piezas convendrá pasar a un índice aparte.

## Cómo se llena la portada

Cada sección aparece solo cuando hay datos reales para ella; nunca se rellena con otros
productos:

| Sección | Qué muestra |
| --- | --- |
| Novedades | Hasta 4 productos con `releasedAt`, del más reciente al más antiguo. |
| Categorías | Una tarjeta por categoría, con la primera foto del primer producto (según `position`). |
| Destacados | Hasta 5 productos con `featured: true`; el primero ocupa el doble de espacio. |
| Colección | Solo si hay productos pero ninguno tiene fecha ni está destacado: los 8 primeros. |

Sin productos activos, la portada muestra "La primera colección está en preparación.".

Las tarjetas indican **Disponible** si al menos una variante tiene `available: true`, y
**No disponible** si ninguna lo tiene.

Si algo no cumple, `npm run build` falla con un mensaje que indica el campo.

## Fotografía

- Proporción **4:5** (vertical), en JPEG o PNG de buena calidad.
- Al menos **2000 px de ancho** para que se vea nítida en pantallas grandes; el sitio
  genera automáticamente las versiones AVIF/WebP más ligeras.
- Fondos y luz coherentes entre productos: la tienda está diseñada sobre negro obsidiana.
- El texto alternativo describe lo que se ve ("Sobrecamisa negra vista de frente, con
  cuello camisero"), no el nombre de marketing.

## Imagen editorial de la portada

Se configura aparte, en `src/content/campaign/`. Ver [IMAGENES.md](IMAGENES.md).

## Probar sin productos reales

`npm run dev:fixtures` arranca el sitio con los datos de `tests/fixtures/` (productos
ficticios, moneda `XTS`, una imagen de portada abstracta y un aviso visible en todas
las páginas). No puede correr a la vez que `npm run dev` en la misma carpeta.
