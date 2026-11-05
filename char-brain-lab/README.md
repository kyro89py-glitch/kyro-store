# Char · Dual Brain Lab

Primer incremento funcional del ciclo de aprendizaje controlado de Char y Claude: dos
memorias independientes, basadas en eventos, con procedencia, evidencia, criterios fijados
antes de ejecutar, revisión explícita e historial verificable.

> **Ubicación provisional.** Este directorio vive en el repositorio de la tienda KYRO solo
> porque era el único repositorio con escritura disponible en la sesión en que se creó. No
> importa nada de la tienda ni la tienda importa nada de él. Se puede mover tal cual a su
> propio repositorio (no tiene dependencias).

## Punto de partida (2026-11-03)

| Afirmación | Estado |
| --- | --- |
| El prototipo `char_dual_brain_autonomy_prototype.html` y los documentos de memoria de Char no están en `kyro-store` (árbol ni historial), en `kyro-oficial` (vacío), en los archivos subidos a la sesión ni en el sistema de archivos del contenedor. | CONFIRMADO (registrado como experimento en `data/claude-brain.ledger.json`) |
| El prototipo existe en otro lugar (dispositivo del usuario, conversaciones con ChatGPT). | PENDIENTE DE VERIFICAR |
| Los resultados de pruebas de la fase 1 (navegación, integridad, clasificación, Chromium). | PENDIENTE DE VERIFICAR: sin el prototipo no pueden repetirse |
| Las cuatro capas, los estados de aprendizaje y los estados epistemológicos que usa el laboratorio. | DOCUMENTADO en el encargo; PENDIENTE DE VERIFICAR contra los documentos de Char |

Por eso este laboratorio no modifica el prototipo: lo sustituye como base funcional, y el
prototipo podrá integrarse cuando esté disponible.

## Uso

Requiere Node 22 o superior. Sin dependencias de producción.

```bash
cd char-brain-lab
node scripts/serve.mjs            # http://127.0.0.1:4410/ui/
node --test "tests/unit/**/*.test.mjs"
node --test "tests/browser/**/*.test.mjs"   # requiere Playwright (ver abajo)
node scripts/verify-ledger.mjs data/claude-brain.ledger.json
```

Las pruebas de navegador usan Playwright si está instalado (`playwright` o
`playwright-core`); si no, se marcan como **omitidas**, nunca como superadas. Si la versión
encontrada no tiene su navegador descargado, `LAB_CHROMIUM_PATH=/ruta/a/chrome` usa un
Chromium ya instalado. `LAB_SCREENSHOTS=<carpeta>` guarda capturas.

## Qué hace

```
OBSERVAR     experience.recorded      fuente obligatoria; "hecho respaldado" exige evidencia;
                                      relación declarada con experiencias anteriores
COMPRENDER   (parcial) clasificación epistemológica manual; experience.amended conserva el valor anterior
HIPOTETIZAR  hypothesis.formulated    afirmación estructurada sujeto | propiedad | valor
PLANIFICAR   experiment.proposed      criterios de éxito obligatorios, fijados con SHA-256
ACTUAR       (parcial) experiment.executed  el laboratorio no ejecuta; registra una ejecución externa
PROBAR       result.observed          comparación automática con los criterios
VERIFICAR    result.verified          con evidencia; marca si la verificación es independiente
APRENDER     learning.proposed        CANDIDATO, solo desde resultados verificados
ACTUALIZAR   learning.reviewed / consolidated / superseded / discarded, contradiction.resolved
```

Etapas distintas, con estados distintos:

| Etapa | Dónde se ve |
| --- | --- |
| Experiencia registrada | registro `EXP`, estado epistemológico propio |
| Experimento propuesto | `EXM` en `propuesto` (criterios y hash fijados) |
| Experimento ejecutado | `ejecutado` o `fallo-de-infraestructura` |
| Resultado observado | `resultado-observado` (comparado, **sin** veredicto) |
| Resultado verificado | `resultado-verificado`, `resultado-refutado` o `resultado-no-verificable` |
| Aprendizaje candidato | `APR` en `CANDIDATO` |
| Aprendizaje consolidado | `CONSOLIDADO` (solo una persona) |

### Reglas que el motor hace cumplir

Todas se comprueban en `src/rules.js`, igual para los comandos en vivo que al importar o
recargar un registro.

- **Identidad.** Un registro por Brain. Un Brain no puede escribir en el registro del otro
  ni citar sus identificadores (no hay protocolo de coordinación todavía). Los
  identificadores llevan el Brain de origen (`claude:EXP-001`).
- **Sin cambios silenciosos.** Solo se añaden eventos; cada uno lleva el hash del anterior.
  El estado es una proyección congelada de los eventos. Una corrección guarda el valor
  anterior, el autor y el motivo. Un registro guardado que no supera la verificación queda
  bloqueado: no se repara ni se sustituye solo.
- **Capa base inmutable.** El primer evento graba identidad y política; no se puede
  redefinir ni hay eventos para cambiar el núcleo.
- **Criterios antes de ejecutar.** Sin criterios no hay experimento; la ejecución queda
  ligada a su hash; no se añaden métricas a posteriori; un reintento usa exactamente los
  mismos criterios (máximo 3 por experimento original).
- **Incertidumbre.** Una medición ausente da `desconocido` y la hipótesis queda
  `no-resuelta`, nunca `debilitada`. Un fallo de infraestructura no debilita la hipótesis.
  `respaldada` significa "en las condiciones probadas", no "demostrada".
- **Aprendizaje revisado.** Solo cuentan resultados verificados con el veredicto que
  corresponde a la postura. Aprobar exige no tener contradicciones abiertas ni evidencia en
  contra. Consolidar exige una persona, 2 respaldos verificados, al menos una verificación
  independiente (otra entidad distinta de quien observó), sin contradicciones ni evidencia
  en contra. Descartar o superar algo consolidado exige una persona.
- **Duplicados y contradicciones.** Detección estructural (texto normalizado: sin tildes,
  mayúsculas ni puntuación final). Un duplicado se rechaza y remite al existente. Una
  contradicción entre aprendizajes activos se abre sola, bloquea la aprobación y ofrece una
  **propuesta** de reconciliación que no cambia nada; resolverla es un evento explícito.
- **Relaciones entre experiencias.** Una experiencia nueva puede declarar que confirma,
  amplía o contradice experiencias anteriores del mismo Brain; nunca las modifica.
  "Contradice" abre una contradicción entre experiencias: ambas se muestran en
  `contradicción` y cualquier aprendizaje cuya hipótesis se base en ellas queda bloqueado
  hasta resolverla. Se resuelve descartando una (queda en su historial, con el estado
  anterior) o declarándolas compatibles; una experiencia no se "supera". Una experiencia
  de base descartada también bloquea aprobar y consolidar.
- **Confianza sin métricas inventadas.** No hay puntuación de confianza. Cada hipótesis
  muestra su base de evidencia (experimentos que la respaldan, la debilitan, no resueltos,
  pendientes y con verificación independiente) y cada aprendizaje sus respaldos, sus
  verificaciones independientes y la evidencia en contra.
- **Sin acciones reales.** Los modos admitidos son simulación, investigación y análisis.
  Los modos reales o financieros se rechazan con un mensaje propio. No hay conexión con
  NEXO Capital, exchanges ni servicios externos.

### Capas de memoria

| Capa | Qué contiene aquí |
| --- | --- |
| Base | identidad y política (evento `ledger.created`) |
| Operacional | hipótesis y experimentos |
| Experiencia | experiencias y su evidencia |
| Evolutiva | aprendizajes y su ciclo de revisión |

Interpretación de las cuatro capas descritas en el encargo: PENDIENTE DE VERIFICAR contra
los documentos de Char. El estado HIPÓTESIS del sistema de aprendizaje de Char se representa
como registro propio (`HIP`), porque el ciclo distingue formular una hipótesis de proponer
un aprendizaje.

## Interfaz

`ui/` muestra solo lo que existe en el motor. Cada nodo del campo neural es un registro real
y cada línea una relación registrada; un Brain sin registro aparece vacío. El canal entre
los dos Brains está vacío a propósito: el protocolo de coordinación no existe. La única
animación automática marca los registros que acaba de tocar un evento.

La incertidumbre se dibuja con el estilo de línea, igual en nodos, filas y etiquetas:
discontinua para hipótesis o pendiente, punteada para desconocido, continua para observado o
verificado, doble para consolidado.

Las acciones de la interfaz se registran como **persona** con el nombre declarado. No hay
autenticación y la interfaz nunca actúa como un Brain, para que ningún evento se atribuya a
Char o a Claude sin serlo. Char no tiene registros: si se transcribe algo que dijo Char,
queda registrado como transcripción de una persona.

## Datos incluidos

`data/claude-brain.ledger.json` es el registro real de Claude Brain en la sesión que creó el
laboratorio: la premisa del encargo, la hipótesis "el prototipo está en lo accesible", el
experimento de búsqueda (criterio fijado antes: al menos una ubicación), el resultado (0),
una autoverificación marcada como no independiente y un aprendizaje CANDIDATO pendiente de
revisión humana. Se importa desde la interfaz ("Importar la inspección inicial").

## Límites conocidos

- La cadena de hashes prueba coherencia interna, no autoría: quien pueda escribir el
  archivo puede recalcularla entera. Faltan firmas por Brain.
- La identidad "persona" es declarada; no hay autenticación.
- La detección de duplicados y contradicciones es literal: no reconoce sinónimos y supone
  que cada propiedad tiene un solo valor (la revisión puede marcarlas como compatibles).
  Entre experiencias no hay detección: la contradicción la declara quien registra.
- El almacenamiento es el `localStorage` del navegador más exportación e importación en
  JSON. La importación solo admite registros nuevos o extensiones del actual; no fusiona.
- No hay protocolo de coordinación: no se comparten ni se comparan registros entre Brains.
- Comprender y Actuar son parciales: la clasificación es manual y la ejecución es externa.
- El `tsconfig` de la tienda incluye este directorio (`allowJs`) sin comprobar sus tipos
  (`checkJs` desactivado). Desaparece al moverlo a su propio repositorio.

## Estructura

```
src/integrity.js   SHA-256 síncrono, JSON canónico, congelado
src/vocabulary.js  estados, capas, modos y política por defecto
src/analysis.js    criterios, veredicto, duplicados y contradicciones (puro)
src/ledger.js      eventos encadenados, verificación, exportación
src/rules.js       reductor que valida y aplica cada evento
src/brain.js       memoria de un Brain: comandos y consultas
src/lab.js         dos memorias, almacenamiento, importación
ui/                interfaz (HTML, CSS y JS sin frameworks, CSP estricta)
scripts/           servidor local y verificador de registros
tests/unit/        node:test, sin dependencias
tests/browser/     Chromium vía Playwright
data/              registro real de la inspección inicial
```
