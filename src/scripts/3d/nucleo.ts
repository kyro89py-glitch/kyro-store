/*
 * Núcleo 3D compartido (EXPLORACIÓN; el KYRO tipográfico es provisional, no un logotipo
 * oficial): malla del wordmark, su sombreado, utilidades de matrices y de animación.
 * Lo usan el wordmark del pie y del menú (../wordmark-3d.ts) y el mundo de la portada
 * (./escena.ts). WebGL 1, sin librerías.
 */
import geometry from '../wordmark-geometry.json';

interface Letter {
  contours: number[][];
  insets: number[][];
  face: number[];
  triangles: number[];
}

/** Ancho de la palabra y profundidad de la extrusión, en alturas de mayúscula. */
export const WORD_WIDTH = geometry.width;
export const DEPTH = 0.42;
const BEVEL = geometry.bevel;
/** Ángulo por debajo del cual dos lados contiguos se suavizan (curvas de la O y la R). */
const SMOOTH_COS = Math.cos((30 * Math.PI) / 180);
/** Floats por vértice: posición (3), normal (3), parte (1), letra (1). */
export const STRIDE = 8;

// ---------- Geometría ----------

/** Malla centrada en el origen: x ∈ ±ancho/2, y ∈ ±0,5 (la base de las letras en y = -0,5). */
export function buildWordmarkMesh(): Float32Array {
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

export function normalize3(v: number[]): number[] {
  const l = Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0) || 1;
  return v.map((x) => x / l);
}

// ---------- Sombreado del wordmark ----------

/** uMirror = 1 dibuja el reflejo sobre el suelo (y = -0,5); uFade funde la palabra. */
export const WORDMARK_VERTEX = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute float aPart;
attribute float aLetter;
uniform mat4 uViewProj;
uniform vec4 uEmerge;
uniform float uMirror;
varying vec3 vPos;
varying vec3 vNormal;
varying float vPart;
varying float vEmerge;
void main() {
  float e = aLetter < 0.5 ? uEmerge.x : aLetter < 1.5 ? uEmerge.y : aLetter < 2.5 ? uEmerge.z : uEmerge.w;
  vec3 p = aPos;
  vec3 n = aNormal;
  // Cada letra llega desde el fondo oscuro hasta su sitio.
  p.z -= (1.0 - e) * 1.1;
  if (uMirror > 0.5) {
    p.y = -1.0 - p.y;
    n.y = -n.y;
  }
  vPos = p;
  vNormal = n;
  vPart = aPart;
  vEmerge = e;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

export const WORDMARK_FRAGMENT = `
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
uniform float uMirror;
uniform float uFade;

// Estudio: un fondo casi negro, una caja de luz vertical (uStrip) y más luz arriba.
vec3 studio(vec3 r, float rough) {
  // Perfil suave: en las caras deja un brillo en degradado; en los biseles, un filo.
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
  float alpha = smoothstep(0.0, 0.6, vEmerge) * uFade;
  if (uMirror > 0.5) {
    // Reflejo en obsidiana pulida: tenue y que se apaga al alejarse de la base.
    float k = exp(-(-0.5 - vPos.y) * 2.4) * 0.34;
    c *= k;
    alpha *= k;
  }
  gl_FragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(0.4545)) * alpha, alpha);
}`;

export const WORDMARK_UNIFORMS = [
  'uViewProj',
  'uEmerge',
  'uEye',
  'uKey',
  'uRim',
  'uExposure',
  'uStrip',
  'uDepth',
  'uMirror',
  'uFade',
] as const;

// ---------- WebGL ----------

export type Uniforms = Record<string, WebGLUniformLocation | null>;

/** Compila y enlaza un programa; null si el dispositivo no lo admite. */
export function createProgram(gl: WebGLRenderingContext, vertex: string, fragment: string): WebGLProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

export function uniformsOf(gl: WebGLRenderingContext, program: WebGLProgram, names: readonly string[]): Uniforms {
  return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
}

/** Enlaza los atributos de la malla del wordmark (búfer ya activo). */
export function bindWordmarkAttributes(gl: WebGLRenderingContext, program: WebGLProgram) {
  const attribute = (name: string, size: number, offset: number) => {
    const location = gl.getAttribLocation(program, name);
    if (location < 0) return;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
  };
  attribute('aPos', 3, 0);
  attribute('aNormal', 3, 3);
  attribute('aPart', 1, 6);
  attribute('aLetter', 1, 7);
}

// ---------- Matrices (columna mayor, como WebGL) ----------

export function perspective(fov: number, aspect: number, near: number, far: number, sx = 0, sy = 0) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  // sx, sy: desplazamiento de lente (en coordenadas normalizadas), como en una cámara de cine.
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, -sx, -sy, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

export function lookAt(eye: number[], target: number[]) {
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

export function multiply(a: number[], b: number[]) {
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

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
export const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const rad = (deg: number) => (deg * Math.PI) / 180;

export interface Reveal {
  yaw: number;
  pitch: number;
  dolly: number;
  key: number;
  strip: number;
  exposure: number;
  emerge: [number, number, number, number];
}

/** Revelación del wordmark (t de 0 a 1): sale de la oscuridad mientras la luz lo recorre. */
export function revealAt(t: number): Reveal {
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
    emerge: [0, 1, 2, 3].map((i) => easeOut((t - 0.04 - i * 0.075) / 0.5)) as Reveal['emerge'],
  };
}

export const media = {
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)'),
  finePointer: matchMedia('(hover: hover) and (pointer: fine)'),
  small: matchMedia('(max-width: 47.99rem)'),
};

/** Modo ligero: ahorro de datos activado o muy poca memoria. */
export function lowPower(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return Boolean(nav.connection?.saveData) || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2);
}
