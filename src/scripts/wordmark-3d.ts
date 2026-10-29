/*
 * Wordmark dimensional de KYRO — EXPLORACIÓN VISUAL, no es un logotipo oficial.
 *
 * Renderiza "KYRO" en 3D real con WebGL, sin librerías: letras extruidas a partir de la
 * tipografía del logotipo provisional (scripts/generate-wordmark-geometry.mjs), con un
 * bisel fino a 45° que atrapa la luz, caras de obsidiana satinada, laterales de grafito
 * y metal oscuro, una luz principal lateral, un contraluz y reflejos de estudio.
 *
 * Se aplica a los elementos [data-wordmark-3d] (la cabecera de revista de Wordmark.astro):
 *   "hero"    portada: la palabra emerge de la oscuridad mientras la cámara se acerca y
 *             la luz recorre las letras; después, con ratón, la luz sigue al cursor.
 *   "static"  pie y menú: la misma revelación, más corta, al entrar en pantalla.
 *
 * Accesibilidad y rendimiento:
 *   - El texto "KYRO" sigue en el HTML; el lienzo es decorativo (aria-hidden).
 *   - Sin WebGL, sin JavaScript, con colores forzados o si algo falla, se ven las
 *     letras planas de siempre (data-3d="failed").
 *   - Con "reducir movimiento" se dibuja directamente la pose final, sin animación.
 *   - Solo se dibuja mientras hay algo que animar y el elemento está en pantalla; en
 *     pantallas pequeñas, menos resolución y sin seguimiento del cursor.
 */
import geometry from './wordmark-geometry.json';

type Mode = 'hero' | 'static';

interface Letter {
  contours: number[][];
  insets: number[][];
  face: number[];
  triangles: number[];
}

/** Profundidad de la extrusión, en alturas de mayúscula. */
const DEPTH = 0.42;
const BEVEL = geometry.bevel;
// Teleobjetivo: el lienzo es muy panorámico y un campo amplio deformaría los extremos.
const FOV = (6 * Math.PI) / 180;
/** Ángulo por debajo del cual dos lados contiguos se suavizan (curvas de la O y la R). */
const SMOOTH_COS = Math.cos((30 * Math.PI) / 180);
const STRIDE = 8;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const small = matchMedia('(max-width: 47.99rem)');

// ---------- Geometría ----------

function buildMesh(): Float32Array {
  const data: number[] = [];
  const cx = geometry.width / 2;
  const cy = 0.5;
  const push = (x: number, y: number, z: number, n: number[], part: number, letter: number) =>
    data.push(x - cx, y - cy, z, n[0] ?? 0, n[1] ?? 0, n[2] ?? 1, part, letter);

  (geometry.letters as Letter[]).forEach((letter, li) => {
    // Cara frontal.
    const f = letter.face;
    for (const index of letter.triangles) {
      push(f[index * 2] ?? 0, f[index * 2 + 1] ?? 0, 0, [0, 0, 1], 0, li);
    }

    letter.contours.forEach((contour, ci) => {
      const inset = letter.insets[ci] ?? contour;
      const n = contour.length / 2;
      const at = (arr: number[], i: number): [number, number] => {
        const k = ((i % n) + n) % n;
        return [arr[k * 2] ?? 0, arr[k * 2 + 1] ?? 0];
      };
      // Normal exterior de cada lado (el relleno queda a la derecha del avance).
      const edgeNormal = (i: number): [number, number] => {
        const [ax, ay] = at(contour, i);
        const [bx, by] = at(contour, i + 1);
        const l = Math.hypot(bx - ax, by - ay) || 1;
        return [-(by - ay) / l, (bx - ax) / l];
      };
      const vertexNormal = (i: number, edge: [number, number]): [number, number] => {
        const prev = edgeNormal(i - 1);
        const next = edgeNormal(i);
        if (prev[0] * next[0] + prev[1] * next[1] < SMOOTH_COS) return edge;
        const x = prev[0] + next[0];
        const y = prev[1] + next[1];
        const l = Math.hypot(x, y) || 1;
        return [x / l, y / l];
      };

      for (let i = 0; i < n; i++) {
        const edge = edgeNormal(i);
        const na = vertexNormal(i, edge);
        const nb = vertexNormal(i + 1, edge);
        const [ax, ay] = at(contour, i);
        const [bx, by] = at(contour, i + 1);
        const [sax, say] = at(inset, i);
        const [sbx, sby] = at(inset, i + 1);
        const bevelA = normalize3([na[0], na[1], 1]);
        const bevelB = normalize3([nb[0], nb[1], 1]);
        // Bisel: del contorno desplazado (z = 0) al contorno real (z = -bisel).
        push(sax, say, 0, bevelA, 1, li);
        push(bx, by, -BEVEL, bevelB, 1, li);
        push(ax, ay, -BEVEL, bevelA, 1, li);
        push(sax, say, 0, bevelA, 1, li);
        push(sbx, sby, 0, bevelB, 1, li);
        push(bx, by, -BEVEL, bevelB, 1, li);
        // Lateral: la extrusión hacia el fondo.
        const sa = [na[0], na[1], 0];
        const sb = [nb[0], nb[1], 0];
        push(ax, ay, -BEVEL, sa, 2, li);
        push(bx, by, -BEVEL, sb, 2, li);
        push(bx, by, -DEPTH, sb, 2, li);
        push(ax, ay, -BEVEL, sa, 2, li);
        push(bx, by, -DEPTH, sb, 2, li);
        push(ax, ay, -DEPTH, sa, 2, li);
      }
    });
  });
  return new Float32Array(data);
}

function normalize3(v: number[]): number[] {
  const l = Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0) || 1;
  return v.map((x) => x / l);
}

// ---------- Sombreado ----------

const VERTEX = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute float aPart;
attribute float aLetter;
uniform mat4 uViewProj;
uniform vec4 uEmerge;
varying vec3 vPos;
varying vec3 vNormal;
varying float vPart;
varying float vEmerge;
void main() {
  float e = aLetter < 0.5 ? uEmerge.x : aLetter < 1.5 ? uEmerge.y : aLetter < 2.5 ? uEmerge.z : uEmerge.w;
  vec3 p = aPos;
  // Cada letra llega desde el fondo oscuro hasta su sitio.
  p.z -= (1.0 - e) * 1.1;
  vPos = p;
  vNormal = aNormal;
  vPart = aPart;
  vEmerge = e;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vPos;
varying vec3 vNormal;
varying float vPart;
varying float vEmerge;
uniform vec3 uEye;
uniform vec3 uKey;
uniform vec3 uRim;
uniform float uExposure;
uniform float uStrip;
uniform float uDepth;

// Estudio: un fondo casi negro, una caja de luz vertical (uStrip) y más luz arriba.
vec3 studio(vec3 r, float rough) {
  // Perfil suave: en las caras deja un brillo en degradado; en los biseles, un filo.
  // Con teleobjetivo el reflejo apenas varía a lo ancho de la palabra (~0,3): el brillo
  // tiene que ser estrecho para leerse como un reflejo y no como un velo gris.
  float spread = 0.012 + rough * 0.07;
  float d = (r.x - uStrip) / spread;
  float strip = exp(-d * d) * (1.0 - rough);
  float top = smoothstep(0.05 - spread, 0.5 + spread, r.y);
  return vec3(0.006) + vec3(0.09, 0.087, 0.083) * top + vec3(1.0, 0.93, 0.84) * strip * 0.8;
}

vec3 light(vec3 n, vec3 v, vec3 l, vec3 color, vec3 albedo, vec3 f0, float metal, float rough) {
  float ndl = max(dot(n, l), 0.0);
  vec3 h = normalize(l + v);
  float shininess = clamp(2.0 / (rough * rough * rough * rough) - 2.0, 4.0, 2048.0);
  float spec = pow(max(dot(n, h), 0.0), shininess) * (shininess + 8.0) / 25.13;
  vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - max(dot(h, v), 0.0), 5.0);
  return (albedo * (1.0 - metal) * 0.318 + fresnel * spec) * ndl * color;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uEye - vPos);
  vec3 albedo;
  vec3 tint;
  float metal;
  float rough;
  if (vPart < 0.5) {
    // Cara: obsidiana satinada.
    albedo = vec3(0.02, 0.021, 0.024); tint = vec3(0.2, 0.196, 0.19); metal = 0.7; rough = 0.34;
  } else if (vPart < 1.5) {
    // Bisel: metal oscuro pulido, atrapa la luz.
    albedo = vec3(0.1, 0.096, 0.09); tint = vec3(0.86, 0.8, 0.69); metal = 0.95; rough = 0.14;
  } else {
    // Laterales: grafito.
    albedo = vec3(0.085, 0.088, 0.095); tint = vec3(0.24, 0.24, 0.25); metal = 0.4; rough = 0.42;
  }
  vec3 f0 = mix(vec3(0.04), tint, metal);
  vec3 c = vec3(0.0);
  c += light(n, v, normalize(uKey), vec3(2.6, 2.35, 2.05), albedo, f0, metal, rough);
  c += light(n, v, normalize(uRim), vec3(1.25, 1.35, 1.55), albedo, f0, metal, rough);
  // Ambiente mínimo (sin brillo propio: una luz frontal velaría las caras de gris).
  c += albedo * 0.12;
  vec3 fv = f0 + (1.0 - f0) * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  c += studio(reflect(-v, n), rough) * fv * (1.4 - rough);
  if (vPart > 1.5) {
    // Oclusión: el fondo de la extrusión se pierde en la sombra.
    c *= mix(0.25, 1.0, smoothstep(-uDepth, -0.02, vPos.z + (1.0 - vEmerge) * 1.1));
  }
  c *= uExposure * smoothstep(0.0, 0.85, vEmerge);
  // Tonemapping fílmico (ACES aproximado) y gamma.
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  // La silueta sale de la oscuridad: primero sombra, después volumen. Alfa premultiplicado.
  float alpha = smoothstep(0.0, 0.6, vEmerge);
  gl_FragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(0.4545)) * alpha, alpha);
}`;

// ---------- Matrices (columna mayor, como WebGL) ----------

function perspective(fov: number, aspect: number, near: number, far: number, sx: number, sy: number) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  // sx, sy: desplazamiento de lente (en coordenadas normalizadas), como en una cámara de cine.
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, -sx, -sy, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

function lookAt(eye: number[], target: number[]) {
  const z = normalize3([(eye[0] ?? 0) - (target[0] ?? 0), (eye[1] ?? 0) - (target[1] ?? 0), (eye[2] ?? 0) - (target[2] ?? 0)]);
  const x = normalize3([z[2] ?? 0, 0, -(z[0] ?? 0)]);
  const y = [
    (z[1] ?? 0) * (x[2] ?? 0) - (z[2] ?? 0) * (x[1] ?? 0),
    (z[2] ?? 0) * (x[0] ?? 0) - (z[0] ?? 0) * (x[2] ?? 0),
    (z[0] ?? 0) * (x[1] ?? 0) - (z[1] ?? 0) * (x[0] ?? 0),
  ];
  const dot = (a: number[]) => (a[0] ?? 0) * (eye[0] ?? 0) + (a[1] ?? 0) * (eye[1] ?? 0) + (a[2] ?? 0) * (eye[2] ?? 0);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x), -dot(y), -dot(z), 1].map(
    (value) => value ?? 0,
  );
}

function multiply(a: number[], b: number[]) {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += (a[k * 4 + row] ?? 0) * (b[col * 4 + k] ?? 0);
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

// ---------- Animación ----------

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = (deg: number) => (deg * Math.PI) / 180;

interface Pose {
  yaw: number;
  pitch: number;
  dolly: number;
  key: number;
  strip: number;
  exposure: number;
  emerge: [number, number, number, number];
}

/** Pose de la escena a lo largo de la revelación (t de 0 a 1). */
function poseAt(t: number): Pose {
  const camera = easeOut(t);
  const light = easeInOut(t * 1.05);
  return {
    yaw: mix(rad(-22), rad(-11), camera),
    pitch: mix(rad(12), rad(6), camera),
    dolly: mix(1.22, 1, camera),
    // La luz principal pasa de rasante (desde detrás) a lateral delantera.
    key: mix(rad(-70), rad(48), light),
    // La caja de luz cruza las letras de izquierda a derecha y se detiene.
    strip: mix(-0.35, 0.12, easeInOut(t * 1.1)),
    exposure: easeOut(t * 1.7),
    emerge: [0, 1, 2, 3].map((i) => easeOut((t - 0.04 - i * 0.075) / 0.5)) as Pose['emerge'],
  };
}

// ---------- Renderizador por elemento ----------

class Wordmark3D {
  #host: HTMLElement;
  #mode: Mode;
  #canvas = document.createElement('canvas');
  #gl: WebGLRenderingContext | null = null;
  #program: WebGLProgram | null = null;
  #uniforms: Record<string, WebGLUniformLocation | null> = {};
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
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);

    const mesh = buildMesh();
    this.#count = mesh.length / STRIDE;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
    const attribute = (name: string, size: number, offset: number) => {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
    };
    attribute('aPos', 3, 0);
    attribute('aNormal', 3, 3);
    attribute('aPart', 1, 6);
    attribute('aLetter', 1, 7);
    for (const name of ['uViewProj', 'uEmerge', 'uEye', 'uKey', 'uRim', 'uExposure', 'uStrip', 'uDepth']) {
      this.#uniforms[name] = gl.getUniformLocation(program, name);
    }
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
    const pose = poseAt(t);

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
      ((geometry.width * canvasRect.height) / (2 * hostRect.width * Math.tan(FOV / 2))) * pose.dolly;
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
