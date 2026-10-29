# Rendimiento

Cómo se mide el rendimiento del sitio, la línea base antes de la experiencia inmersiva
y, sobre todo, **qué no se puede medir en el entorno de desarrollo**.

## Cómo medir

Con el sitio servido (`npm run build && npm run preview`):

```bash
node scripts/medir-rendimiento.mjs                 # portada, tienda y marca
node scripts/medir-rendimiento.mjs --sin-webgl /   # la portada sin WebGL, para aislar su coste
```

El script usa Playwright y el protocolo de DevTools (no hace falta Lighthouse) en dos
perfiles:

- **escritorio:** 1440 × 900, sin limitaciones.
- **movil:** Pixel 7, CPU ralentizada 4× y red ~4G (9 Mb/s, 170 ms de latencia). Es una
  aproximación a un Android de gama media, no una medida de un teléfono real.

Mide FCP, LCP, CLS, TBT (suma de lo que pasa de 50 ms en cada tarea larga), bytes
transferidos y tiempos de fotograma durante los 4 s de la apertura.

## Línea base (29-10-2026, rama `exploracion-wordmark-3d`, catálogo real vacío)

| Perfil | Ruta | FCP ms | LCP ms | CLS | TBT ms | Fotograma mediana / p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| escritorio | / | 1140 | 1140 | 0 | 1387 | 66,7 / 500 |
| escritorio | / sin WebGL | 404 | 500 | 0 | 0 | 33,3 / 50 |
| escritorio | /tienda/ | 148 | 308 | 0 | 100 | 16,7 / 16,8 |
| escritorio | /marca/ | 132 | 384 | 0 | 244 | 16,7 / 33,4 |
| movil | / | 912 | 912 | 0 | 481 | 16,7 / 50 |
| movil | /tienda/ | 756 | 896 | 0 | 176 | 16,7 / 16,7 |
| movil | /marca/ | 748 | 884 | 0 | 147 | 16,7 / 16,8 |

Peso de los recursos (comprimidos con gzip, como los serviría un alojamiento normal):

| Recurso | Tamaño |
| --- | --- |
| JavaScript común (carrito, menú, revelados) | ~6 kB |
| Wordmark 3D (se carga aparte, solo donde se usa) | ~10 kB |
| CSS por página | ~8–8,5 kB |
| Fuentes (Archivo variable, Bodoni Moda redonda y cursiva) | ~186 kB (woff2) |

Lectura:

- **Las fuentes son el mayor peso** del sitio (~186 kB). Es la primera optimización
  pendiente (recortar ejes o glifos), independiente de la experiencia inmersiva.
- **El coste de la portada en escritorio es el WebGL dibujado por software** (ver
  limitaciones): con WebGL desactivado, la misma página no tiene tareas largas.
- **CLS = 0** en todas las páginas: los efectos no mueven el contenido.

## Después: portada inmersiva «Cámara oscura» (rama `experiencia-inmersiva`)

Producción (catálogo real vacío), mismo método:

| Perfil | Ruta | FCP ms | LCP ms | CLS | TBT ms | Fotograma mediana / p95 ms |
| --- | --- | --- | --- | --- | --- | --- |
| escritorio | / | 168 | 1560 | 0 | 2561 | 116,7 / 216,7 |
| escritorio | / sin WebGL | 204 | 264 | 0 | 0 | 16,7 / 16,7 |
| escritorio | /tienda/ | 176 | 292 | 0 | 158 | 16,7 / 16,8 |
| movil | / | 816 | 2232 | 0 | 1682 | 16,7 / 166,7 |
| movil | / sin WebGL | 808 | 2068 | 0 | 0 | 16,7 / 16,8 |
| movil | /tienda/ | 744 | 1056 | 0 | 141 | 16,7 / 16,8 |

Demostración (datos de prueba, con paneles de colecciones): portada LCP 1720 ms en
escritorio y 2280 ms en móvil; la ficha de producto, LCP 268 ms y 940 ms, TBT ~120 ms (la
ficha no lleva 3D).

Peso del 3D (gzip, se carga aparte): núcleo con la geometría ~8,9 kB, mundo de la portada
~4,4 kB, KYRO del pie y del menú ~1,7 kB: **~15 kB en total**.

Lectura:

- **LCP por debajo de 2,5 s** en ambos perfiles. La frase de la portada entra a los 0,45 s
  (al retrasarla 1,6 s por la apertura, el LCP subía a ~2,9 s; se corrigió).
- **Todo el TBT de la portada es WebGL por software**: con WebGL desactivado es 0 ms. En
  un dispositivo con GPU ese trabajo no ocupa el hilo principal del mismo modo, pero
  **no se ha podido comprobar aquí**.
- El resto de páginas no cambia (la tienda sigue en ~0,3 s de LCP en escritorio).
- El dibujo se detiene cuando la escena está quieta o fuera de pantalla: el coste se
  concentra en la apertura y mientras se desplaza.

## Limitaciones del entorno de desarrollo

- **No hay GPU.** Chromium dibuja WebGL con SwiftShader (una GPU emulada en la CPU). Por
  eso el WebGL aparece aquí como trabajo de CPU (tareas largas, ~12–15 fps en un lienzo
  grande) cuando en un dispositivo real lo hace la GPU. Las cifras de WebGL de este
  entorno son un **límite pesimista**, no una predicción.
- **No hay ningún dispositivo Android real.** La ralentización de CPU 4× y la red
  simulada son aproximaciones. **La fluidez en Android no está validada** hasta probarla
  en un teléfono.
- `astro preview` sirve los archivos **sin comprimir**; los tamaños de red de la tabla de
  arriba no llevan gzip/brotli. Los pesos comprimidos se calculan aparte sobre `dist/`.
- **Vídeo:** grabado en tiempo real, con WebGL por software saldría a ~12 fps. Los vídeos
  de demostración se graban con el reloj de la página detenido y avanzado 1/30 s por
  fotograma (reloj de Playwright): muestran el ritmo real del 3D, pero no prueban que un
  dispositivo lo dibuje a 30/60 fps. Las animaciones CSS (la frase, la pista) no siguen
  ese reloj y en el vídeo aparecen antes de tiempo.
- Lighthouse no está instalado; se usan Playwright y DevTools directamente.

## Qué hay que comprobar en un dispositivo real

En un Android de gama media (Chrome) y en un escritorio con GPU:

1. La apertura de la portada se ve fluida (sin saltos) y no calienta el teléfono.
2. Con la pantalla quieta, el uso de CPU/GPU vuelve a reposo (el dibujo se detiene).
3. Desplazamiento de portada, colecciones y ficha sin tirones.
4. Con "ahorro de batería" y con "reducir movimiento" activados, todo sigue funcionando.
