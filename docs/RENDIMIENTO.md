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
- **Vídeo:** Playwright puede grabar el recorrido, pero con WebGL por software el vídeo
  saldría a ~12 fps y no representaría el movimiento real.
- Lighthouse no está instalado; se usan Playwright y DevTools directamente.

## Qué hay que comprobar en un dispositivo real

En un Android de gama media (Chrome) y en un escritorio con GPU:

1. La apertura de la portada se ve fluida (sin saltos) y no calienta el teléfono.
2. Con la pantalla quieta, el uso de CPU/GPU vuelve a reposo (el dibujo se detiene).
3. Desplazamiento de portada, colecciones y ficha sin tirones.
4. Con "ahorro de batería" y con "reducir movimiento" activados, todo sigue funcionando.
