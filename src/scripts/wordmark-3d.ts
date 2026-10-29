/*
 * Wordmark dimensional de KYRO — EXPLORACIÓN VISUAL, no es un logotipo oficial.
 *
 * Renderiza "KYRO" en 3D real con WebGL, sin librerías: letras extruidas a partir de la
 * tipografía del logotipo provisional (scripts/generate-wordmark-geometry.mjs), con un
 * bisel fino a 45° que atrapa la luz, caras de obsidiana satinada, laterales de grafito
 * y metal oscuro, una luz principal lateral, un contraluz y reflejos de estudio.
 *
 * Se aplica a los elementos [data-wordmark-3d] (la cabecera de revista de Wordmark.astro):
 *   "hero"    la palabra emerge de la oscuridad mientras la cámara se acerca y la luz
 *             recorre las letras; después, con ratón, la luz sigue al cursor.
 *   "static"  pie y menú: la misma revelación, más corta, al entrar en pantalla.
 * La portada usa además un mundo completo (./3d/escena.ts) con el mismo núcleo.
 *
 * Accesibilidad y rendimiento:
 *   - El texto "KYRO" sigue en el HTML; el lienzo es decorativo (aria-hidden).
 *   - Sin WebGL, sin JavaScript, con colores forzados o si algo falla, se ven las
 *     letras planas de siempre (data-3d="failed").
 *   - Con "reducir movimiento" se dibuja directamente la pose final, sin animación.
 *   - Solo se dibuja mientras hay algo que animar y el elemento está en pantalla; en
 *     pantallas pequeñas, menos resolución y sin seguimiento del cursor.
 */
import {
  bindWordmarkAttributes,
  buildWordmarkMesh,
  clamp01,
  createProgram,
  DEPTH,
  lookAt,
  media,
  multiply,
  perspective,
  rad,
  revealAt,
  STRIDE,
  uniformsOf,
  WORD_WIDTH,
  WORDMARK_FRAGMENT,
  WORDMARK_UNIFORMS,
  WORDMARK_VERTEX,
  type Uniforms,
} from './3d/nucleo';

type Mode = 'hero' | 'static';

// Teleobjetivo: el lienzo es muy panorámico y un campo amplio deformaría los extremos.
const FOV = (6 * Math.PI) / 180;
const { reducedMotion, finePointer, small } = media;

// ---------- Renderizador por elemento ----------

class Wordmark3D {
  #host: HTMLElement;
  #mode: Mode;
  #canvas = document.createElement('canvas');
  #gl: WebGLRenderingContext | null = null;
  #program: WebGLProgram | null = null;
  #uniforms: Uniforms = {};
  #count = 0;
  #start = -1;
  #duration: number;
  #frame = 0;
  #visible = false;
  #pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  #done = false;

  constructor(host: HTMLElement, mode: Mode) {
    this.#host = host;
    this.#mode = mode;
    this.#duration = mode === 'hero' ? (small.matches ? 2200 : 3000) : 1700;
    this.#canvas.className = 'masthead__canvas';
    this.#canvas.setAttribute('aria-hidden', 'true');
    host.append(this.#canvas);

    new ResizeObserver(() => this.#resize()).observe(host);
    new IntersectionObserver(
      ([entry]) => {
        this.#visible = Boolean(entry?.isIntersecting);
        if (this.#visible) this.#request();
      },
      { threshold: 0.15 },
    ).observe(host);

    if (mode === 'hero' && finePointer.matches && !small.matches) {
      const area = host.closest('section') ?? host;
      area.addEventListener('pointermove', (event) => {
        const rect = (area as HTMLElement).getBoundingClientRect();
        this.#pointer.tx = ((event as PointerEvent).clientX - rect.left) / rect.width - 0.5;
        this.#pointer.ty = ((event as PointerEvent).clientY - rect.top) / rect.height - 0.5;
        this.#request();
      });
      area.addEventListener('pointerleave', () => {
        this.#pointer.tx = 0;
        this.#pointer.ty = 0;
        this.#request();
      });
    }
  }

  #fail() {
    this.#host.dataset['3d'] = 'failed';
    this.#canvas.remove();
    cancelAnimationFrame(this.#frame);
  }

  #setup(): boolean {
    const gl = this.#canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) return false;
    this.#canvas.addEventListener('webglcontextlost', () => this.#fail());
    const program = createProgram(gl, WORDMARK_VERTEX, WORDMARK_FRAGMENT);
    if (!program) return false;
    gl.useProgram(program);

    const mesh = buildWordmarkMesh();
    this.#count = mesh.length / STRIDE;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
    bindWordmarkAttributes(gl, program);
    this.#uniforms = uniformsOf(gl, program, WORDMARK_UNIFORMS);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    this.#gl = gl;
    this.#program = program;
    return true;
  }

  #resize() {
    const rect = this.#canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (!this.#gl && !this.#setup()) {
      this.#fail();
      return;
    }
    // Resolución: nítida en escritorio, contenida en móvil y nunca por encima de ~3 MP.
    let dpr = Math.min(window.devicePixelRatio || 1, small.matches ? 1.5 : 2);
    while (rect.width * rect.height * dpr * dpr > 3_000_000 && dpr > 1) dpr -= 0.25;
    this.#canvas.width = Math.round(rect.width * dpr);
    this.#canvas.height = Math.round(rect.height * dpr);
    this.#request();
  }

  #request() {
    if (!this.#gl || this.#frame) return;
    this.#frame = requestAnimationFrame((time) => this.#draw(time));
  }

  #draw(time: number) {
    this.#frame = 0;
    const gl = this.#gl;
    if (!gl || !this.#program) return;

    // La revelación empieza cuando el elemento se ve por primera vez.
    if (this.#start < 0 && this.#visible) this.#start = time + (this.#mode === 'hero' ? 350 : 120);
    const t = reducedMotion.matches ? 1 : this.#start < 0 ? 0 : clamp01((time - this.#start) / this.#duration);
    const pose = revealAt(t);

    const p = this.#pointer;
    p.x += (p.tx - p.x) * 0.08;
    p.y += (p.ty - p.y) * 0.08;
    const yaw = pose.yaw + p.x * rad(7);
    const pitch = pose.pitch - p.y * rad(4);

    // Encuadre: la cara frontal ocupa exactamente la caja del título (las letras planas).
    const canvasRect = this.#canvas.getBoundingClientRect();
    const hostRect = this.#host.getBoundingClientRect();
    const aspect = canvasRect.width / canvasRect.height;
    const distance =
      ((WORD_WIDTH * canvasRect.height) / (2 * hostRect.width * Math.tan(FOV / 2))) * pose.dolly;
    const shiftX = (2 * (hostRect.left + hostRect.width / 2 - canvasRect.left)) / canvasRect.width - 1;
    const shiftY = 1 - (2 * (hostRect.top + hostRect.height / 2 - canvasRect.top)) / canvasRect.height;
    const eye = [
      distance * Math.sin(yaw) * Math.cos(pitch),
      distance * Math.sin(pitch),
      distance * Math.cos(yaw) * Math.cos(pitch),
    ];
    const viewProj = multiply(
      perspective(FOV, aspect, distance * 0.3, distance * 3, shiftX, shiftY),
      lookAt(eye, [0, 0, -DEPTH / 2]),
    );

    gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const u = this.#uniforms;
    gl.uniformMatrix4fv(u['uViewProj'] ?? null, false, new Float32Array(viewProj));
    gl.uniform4fv(u['uEmerge'] ?? null, pose.emerge);
    gl.uniform3fv(u['uEye'] ?? null, eye);
    gl.uniform3fv(u['uKey'] ?? null, [-Math.cos(pose.key) * 0.9 + p.x * 1.1, 0.55 - p.y * 0.5, Math.sin(pose.key)]);
    gl.uniform3fv(u['uRim'] ?? null, [0.85, 0.3, -0.55]);
    gl.uniform1f(u['uExposure'] ?? null, pose.exposure);
    gl.uniform1f(u['uStrip'] ?? null, pose.strip + p.x * 0.24);
    gl.uniform1f(u['uDepth'] ?? null, DEPTH);
    gl.uniform1f(u['uMirror'] ?? null, 0);
    gl.uniform1f(u['uFade'] ?? null, 1);
    gl.drawArrays(gl.TRIANGLES, 0, this.#count);

    if (!this.#done) {
      this.#done = true;
      this.#host.dataset['3d'] = 'ready';
    }

    const animating = !reducedMotion.matches && (this.#start < 0 || t < 1);
    const following = Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) > 0.0005;
    if (this.#visible && (animating || following)) this.#request();
  }
}

export function init(hosts: Iterable<HTMLElement>) {
  for (const host of hosts) {
    if (host.dataset['3d']) continue;
    try {
      new Wordmark3D(host, host.dataset['wordmark3d'] === 'hero' ? 'hero' : 'static');
    } catch {
      host.dataset['3d'] = 'failed';
    }
  }
}
