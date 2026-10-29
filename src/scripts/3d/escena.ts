/*
 * «Cámara oscura»: el mundo de la portada (EXPLORACIÓN; el KYRO tipográfico es provisional,
 * no un logotipo oficial).
 *
 * Un único lienzo fijo detrás de la portada y de las colecciones. En él:
 *   - KYRO en volumen, de pie sobre un suelo de obsidiana pulida que lo refleja;
 *   - un haz de luz que entra en diagonal y lo revela (la luz principal sale del haz);
 *   - polvo en suspensión que solo brilla dentro del haz: hace visible el volumen de luz.
 *
 * La cámara la mueve el desplazamiento (con inercia): orbita KYRO, se acerca y sube; al
 * llegar a las colecciones, KYRO queda atrás y el polvo pasa junto a la cámara mientras los
 * paneles (HTML, ver Colecciones.astro) avanzan desde el fondo.
 *
 * Interacción: con ratón, la luz y la cámara siguen al cursor; en pantallas táctiles, un
 * gesto horizontal gira la escena (el vertical sigue siendo el desplazamiento normal).
 *
 * Rendimiento y accesibilidad: solo se dibuja mientras hay algo que mover y la escena se
 * ve; resolución contenida en móvil; con ahorro de datos o poca memoria, sin polvo; con
 * "reducir movimiento", pose final quieta. Si WebGL falla, data-escena3d="failed" y la
 * portada muestra el KYRO plano (el HTML no depende del lienzo).
 */
import {
  bindWordmarkAttributes,
  buildWordmarkMesh,
  clamp01,
  createProgram,
  DEPTH,
  easeInOut,
  easeOut,
  lookAt,
  lowPower,
  media,
  mix,
  multiply,
  normalize3,
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
} from './nucleo';

const FOV = rad(24);
const { reducedMotion, finePointer, small } = media;

// ---------- Suelo de obsidiana ----------

const FLOOR_VERTEX = `
attribute vec2 aXZ;
uniform mat4 uViewProj;
varying vec3 vPos;
void main() {
  vPos = vec3(aXZ.x, -0.5, aXZ.y);
  gl_Position = uViewProj * vec4(vPos, 1.0);
}`;

const FLOOR_FRAGMENT = `
precision mediump float;
varying vec3 vPos;
uniform vec3 uEye;
uniform vec3 uKey;
uniform float uExposure;
uniform float uFade;
void main() {
  // Charco de luz bajo KYRO y un brillo especular de la luz principal sobre el pulido.
  vec2 d = (vPos.xz - vec2(0.3, -0.3)) / vec2(4.6, 2.2);
  float pool = exp(-dot(d, d) * 1.4);
  vec3 v = normalize(uEye - vPos);
  vec3 h = normalize(normalize(uKey) + v);
  float spec = pow(max(h.y, 0.0), 90.0) * 0.6;
  vec3 c = vec3(0.012, 0.012, 0.014) + vec3(0.14, 0.125, 0.1) * pool * 0.5 + vec3(1.0, 0.9, 0.75) * spec * pool;
  c *= uExposure;
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  // Opaco junto a KYRO; se funde con el fondo de la página hacia el horizonte.
  float alpha = (0.5 + 0.45 * pool) * (1.0 - smoothstep(6.0, 26.0, length(vPos.xz))) * uFade;
  gl_FragColor = vec4(pow(c, vec3(0.4545)) * alpha, alpha);
}`;

// ---------- Haz de luz ----------

const BEAM_VERTEX = `
attribute vec2 aST;
uniform mat4 uViewProj;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uSide;
uniform vec2 uWidth;
varying vec2 vST;
void main() {
  vST = aST;
  vec3 axis = mix(uA, uB, aST.y);
  gl_Position = uViewProj * vec4(axis + uSide * mix(uWidth.x, uWidth.y, aST.y) * aST.x, 1.0);
}`;

const BEAM_FRAGMENT = `
precision mediump float;
varying vec2 vST;
uniform float uIntensity;
void main() {
  float across = 1.0 - vST.x * vST.x;
  float i = across * across * smoothstep(0.0, 0.35, vST.y) * (1.0 - smoothstep(0.7, 1.0, vST.y));
  i *= uIntensity * 0.16;
  gl_FragColor = vec4(vec3(1.0, 0.9, 0.74) * i, i * 0.6);
}`;

// ---------- Polvo en el haz ----------

const DUST_VERTEX = `
attribute vec4 aSeed;
uniform mat4 uViewProj;
uniform float uTime;
uniform float uStream;
uniform vec3 uBoxMin;
uniform vec3 uBoxSize;
uniform float uPx;
uniform vec3 uA;
uniform vec3 uB;
uniform vec2 uWidth;
uniform float uAmbient;
varying float vGlow;
void main() {
  vec3 p = uBoxMin + aSeed.xyz * uBoxSize;
  float t = uTime * (0.06 + aSeed.w * 0.08);
  p += vec3(sin(t + aSeed.w * 40.0), sin(t * 1.3 + aSeed.x * 30.0) * 0.6, cos(t * 0.9 + aSeed.y * 20.0)) * 0.22;
  // Corriente hacia la cámara en las colecciones: cada mota vuelve a empezar al fondo.
  p.z = uBoxMin.z + mod(p.z - uBoxMin.z + uStream, uBoxSize.z);
  vec3 ab = uB - uA;
  float k = clamp(dot(p - uA, ab) / dot(ab, ab), 0.0, 1.0);
  float dist = length(p - (uA + ab * k)) / mix(uWidth.x, uWidth.y, k);
  vGlow = exp(-dist * dist * 1.6) * 0.95 + uAmbient;
  gl_Position = uViewProj * vec4(p, 1.0);
  // Cerca de la cámara se apagan, para no tapar nada.
  vGlow *= smoothstep(1.0, 4.0, gl_Position.w);
  gl_PointSize = clamp(uPx * (0.5 + aSeed.w) / gl_Position.w, 1.0, 22.0);
}`;

const DUST_FRAGMENT = `
precision mediump float;
varying float vGlow;
uniform float uAlpha;
void main() {
  float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  float i = a * a * vGlow * uAlpha;
  gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * i, i);
}`;

/** Generador pseudoaleatorio con semilla: el polvo es siempre el mismo. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Programs {
  word: WebGLProgram;
  floor: WebGLProgram;
  beam: WebGLProgram;
  dust: WebGLProgram;
}

class Escena {
  #root: HTMLElement;
  #gallery: HTMLElement | null;
  #canvas = document.createElement('canvas');
  #gl: WebGLRenderingContext | null = null;
  #programs: Programs | null = null;
  #u: Record<keyof Programs, Uniforms> = { word: {}, floor: {}, beam: {}, dust: {} };
  #buffers: Record<keyof Programs, WebGLBuffer | null> = { word: null, floor: null, beam: null, dust: null };
  #counts = { word: 0, dust: 0 };
  #frame = 0;
  #last = 0;
  #clock = 0;
  #start = -1;
  #ready = false;
  #visible = { root: false, gallery: false };
  #idleUntil = 0;
  #h = { value: 0, target: 0 };
  #g = { value: 0, target: 0 };
  #pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  #drag = { value: 0, target: 0, startX: 0, active: false };

  constructor(root: HTMLElement, host: HTMLElement, gallery: HTMLElement | null) {
    this.#root = root;
    this.#gallery = gallery;
    this.#canvas.className = 'escena__lienzo';
    this.#canvas.setAttribute('aria-hidden', 'true');
    host.append(this.#canvas);

    new ResizeObserver(() => this.#resize()).observe(host);
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === root) this.#visible.root = entry.isIntersecting;
        else this.#visible.gallery = entry.isIntersecting;
      }
      // Fuera de la portada y de las colecciones el lienzo ni se ve ni se dibuja.
      host.toggleAttribute('data-oculto', !this.#visible.root && !this.#visible.gallery);
      this.#wake();
    });
    io.observe(root);
    // Con movimiento reducido las colecciones son una composición quieta: el mundo se
    // queda en la portada.
    if (gallery && !reducedMotion.matches) io.observe(gallery);

    addEventListener('scroll', () => this.#onScroll(), { passive: true });
    addEventListener('resize', () => this.#onScroll(), { passive: true });
    this.#onScroll();

    if (finePointer.matches) {
      addEventListener('pointermove', (event) => {
        if (!this.#visible.root) return;
        this.#pointer.tx = event.clientX / innerWidth - 0.5;
        this.#pointer.ty = event.clientY / innerHeight - 0.5;
        this.#wake();
      });
    }

    // Táctil: un gesto horizontal gira la escena; al soltar, vuelve con suavidad.
    const stage = root.querySelector<HTMLElement>('[data-escena-gesto]') ?? root;
    stage.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      this.#drag.active = true;
      this.#drag.startX = event.clientX;
    });
    stage.addEventListener('pointermove', (event) => {
      if (!this.#drag.active) return;
      this.#drag.target = Math.max(-1, Math.min(1, ((event.clientX - this.#drag.startX) / innerWidth) * 2.2));
      this.#wake();
    });
    const release = () => {
      this.#drag.active = false;
      this.#drag.target = 0;
      this.#wake();
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
  }

  #fail() {
    this.#root.dataset['escena3d'] = 'failed';
    this.#canvas.remove();
    cancelAnimationFrame(this.#frame);
    this.#gl = null;
  }

  /** Progreso de un tramo con escenario fijo: 0 al empezar a fijarse, 1 al soltarse. */
  #progress(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const span = rect.height - innerHeight;
    return span > 0 ? clamp01(-rect.top / span) : clamp01(-rect.top / Math.max(rect.height, 1));
  }

  #onScroll() {
    this.#h.target = this.#progress(this.#root);
    this.#g.target = this.#gallery ? this.#progress(this.#gallery) : 0;
    this.#root.style.setProperty('--h', this.#h.target.toFixed(4));
    this.#wake();
  }

  #wake() {
    this.#idleUntil = performance.now() + 2500;
    this.#request();
  }

  #setup(): boolean {
    const gl = this.#canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) return false;
    this.#canvas.addEventListener('webglcontextlost', () => this.#fail());
    const word = createProgram(gl, WORDMARK_VERTEX, WORDMARK_FRAGMENT);
    const floor = createProgram(gl, FLOOR_VERTEX, FLOOR_FRAGMENT);
    const beam = createProgram(gl, BEAM_VERTEX, BEAM_FRAGMENT);
    const dust = createProgram(gl, DUST_VERTEX, DUST_FRAGMENT);
    if (!word || !floor || !beam || !dust) return false;
    this.#programs = { word, floor, beam, dust };
    this.#u = {
      word: uniformsOf(gl, word, WORDMARK_UNIFORMS),
      floor: uniformsOf(gl, floor, ['uViewProj', 'uEye', 'uKey', 'uExposure', 'uFade']),
      beam: uniformsOf(gl, beam, ['uViewProj', 'uA', 'uB', 'uSide', 'uWidth', 'uIntensity']),
      dust: uniformsOf(gl, dust, ['uViewProj', 'uTime', 'uStream', 'uBoxMin', 'uBoxSize', 'uPx', 'uA', 'uB', 'uWidth', 'uAlpha', 'uAmbient']),
    };

    const buffer = (data: Float32Array) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return b;
    };
    const mesh = buildWordmarkMesh();
    this.#counts.word = mesh.length / STRIDE;
    this.#buffers.word = buffer(mesh);
    this.#buffers.floor = buffer(new Float32Array([-60, -80, 60, -80, 60, 40, -60, -80, 60, 40, -60, 40]));
    this.#buffers.beam = buffer(new Float32Array([-1, 0, 1, 0, 1, 1, -1, 0, 1, 1, -1, 1]));
    const count = lowPower() ? 0 : small.matches ? 260 : 900;
    const random = seeded(7);
    const seeds = new Float32Array(count * 4).map(() => random());
    this.#counts.dust = count;
    this.#buffers.dust = buffer(seeds);

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    this.#gl = gl;
    return true;
  }

  #resize() {
    const rect = this.#canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (!this.#gl && !this.#setup()) {
      this.#fail();
      return;
    }
    // Resolución: contenida en móvil y nunca por encima de ~2,6 MP.
    let dpr = Math.min(window.devicePixelRatio || 1, small.matches ? 1.5 : 1.75);
    while (rect.width * rect.height * dpr * dpr > 2_600_000 && dpr > 1) dpr -= 0.25;
    this.#canvas.width = Math.round(rect.width * dpr);
    this.#canvas.height = Math.round(rect.height * dpr);
    this.#request();
  }

  #request() {
    if (!this.#gl || this.#frame) return;
    if (!this.#visible.root && !this.#visible.gallery && this.#ready) return;
    this.#frame = requestAnimationFrame((time) => this.#draw(time));
  }

  #draw(time: number) {
    this.#frame = 0;
    const gl = this.#gl;
    const programs = this.#programs;
    if (!gl || !programs) return;

    const still = reducedMotion.matches;
    const dt = this.#last ? Math.min((time - this.#last) / 1000, 0.1) : 0;
    this.#last = time;
    if (!still) this.#clock += dt;

    // Apertura: el haz se enciende, aparece el polvo y la luz revela KYRO.
    if (this.#start < 0) this.#start = time + 250;
    const duration = small.matches ? 2600 : 3400;
    const t = still ? 1 : clamp01((time - this.#start) / duration);
    const reveal = revealAt(t);

    // Inercia: el movimiento sigue al desplazamiento con un pequeño retardo.
    const k = still ? 1 : 1 - Math.exp(-dt * 6);
    for (const s of [this.#h, this.#g, this.#drag]) s.value += (s.target - s.value) * k;
    const p = this.#pointer;
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    const h = easeInOut(this.#h.value);
    const g = this.#g.value;

    // Encuadre: KYRO ocupa casi todo el ancho en móvil y algo menos en escritorio.
    const width = this.#canvas.clientWidth || 1;
    const height = this.#canvas.clientHeight || 1;
    const aspect = width / height;
    const tanHalf = Math.tan(FOV / 2);
    const fit = small.matches ? 0.86 : 0.74;
    const d0 = WORD_WIDTH / 2 / (fit * tanHalf * aspect);
    const halfH = d0 * tanHalf;
    const halfW = halfH * aspect;

    // Cámara: orbita y se acerca con el desplazamiento; en las colecciones sube y avanza.
    // La órbita deja ver la extrusión sin que KYRO salga del encuadre (más corta en móvil).
    const orbit = small.matches ? rad(30) : rad(38);
    const yaw = reveal.yaw + orbit * h + p.x * rad(4) + this.#drag.value * rad(16);
    const pitch = reveal.pitch + rad(12) * h + rad(16) * easeInOut(g) - p.y * rad(2.5);
    const distance = d0 * reveal.dolly * (1 - 0.22 * h) * (1 - 0.3 * easeInOut(g));
    const target = [mix(0, 0.55, h), mix(0.1, 0.22, h) + g * halfH * 0.35, -DEPTH / 2 - g * d0 * 0.35];
    const eye = [
      (target[0] ?? 0) + distance * Math.sin(yaw) * Math.cos(pitch),
      (target[1] ?? 0) + distance * Math.sin(pitch),
      (target[2] ?? 0) + distance * Math.cos(yaw) * Math.cos(pitch),
    ];
    const viewProj = new Float32Array(
      multiply(perspective(FOV, aspect, distance * 0.05, distance * 6), lookAt(eye, target)),
    );

    // El haz entra desde arriba a la izquierda y cae sobre KYRO; la luz principal sale de él.
    const a = [-1.15 * halfW, 1.25 * halfH + 0.6, 0.2 * d0];
    const b = [0.5, -0.5, -0.3];
    const beamDir = normalize3([(a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0)]);
    const sweep = [-Math.cos(reveal.key) * 0.9, 0.55, Math.sin(reveal.key)];
    const lightMix = easeInOut(t);
    const key = normalize3(sweep.map((v, i) => mix(v, beamDir[i] ?? 0, lightMix) + (i === 0 ? p.x * 0.5 : 0)));
    const beamWidth = [0.04 * halfW, 0.5 * halfW];

    const fadeWord = 1 - easeInOut(clamp01(g / 0.45));
    const fadeDust = 1 - easeInOut(clamp01((g - 0.82) / 0.18));
    const ignite = still ? 1 : easeOut(clamp01(t * 2.4));

    gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 1. Suelo (sin escribir profundidad: el reflejo se ve "dentro" del pulido).
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(programs.floor);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffers.floor);
    this.#attribute(programs.floor, 'aXZ', 2, 0, 2);
    let u = this.#u.floor;
    gl.uniformMatrix4fv(u['uViewProj'] ?? null, false, viewProj);
    gl.uniform3fv(u['uEye'] ?? null, eye);
    gl.uniform3fv(u['uKey'] ?? null, key);
    gl.uniform1f(u['uExposure'] ?? null, Math.max(ignite * 0.6, reveal.exposure));
    gl.uniform1f(u['uFade'] ?? null, fadeWord);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 2. Reflejo y 3. KYRO.
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.useProgram(programs.word);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffers.word);
    bindWordmarkAttributes(gl, programs.word);
    u = this.#u.word;
    gl.uniformMatrix4fv(u['uViewProj'] ?? null, false, viewProj);
    gl.uniform4fv(u['uEmerge'] ?? null, reveal.emerge);
    gl.uniform3fv(u['uEye'] ?? null, eye);
    gl.uniform3fv(u['uKey'] ?? null, key);
    gl.uniform3fv(u['uRim'] ?? null, [0.85, 0.3, -0.55]);
    gl.uniform1f(u['uExposure'] ?? null, reveal.exposure);
    gl.uniform1f(u['uStrip'] ?? null, reveal.strip + p.x * 0.24 + this.#drag.value * 0.2);
    gl.uniform1f(u['uDepth'] ?? null, DEPTH);
    gl.uniform1f(u['uFade'] ?? null, fadeWord);
    if (fadeWord > 0.001) {
      gl.uniform1f(u['uMirror'] ?? null, 1);
      gl.drawArrays(gl.TRIANGLES, 0, this.#counts.word);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(u['uMirror'] ?? null, 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.#counts.word);
    }

    // 4. Haz (las letras lo tapan donde están delante) y 5. polvo.
    gl.depthMask(false);
    gl.useProgram(programs.beam);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffers.beam);
    this.#attribute(programs.beam, 'aST', 2, 0, 2);
    u = this.#u.beam;
    const mid = [0, 1, 2].map((i) => ((a[i] ?? 0) + (b[i] ?? 0)) / 2);
    const toEye = normalize3([0, 1, 2].map((i) => (eye[i] ?? 0) - (mid[i] ?? 0)));
    const side = normalize3([
      -(beamDir[1] ?? 0) * (toEye[2] ?? 0) + (beamDir[2] ?? 0) * (toEye[1] ?? 0),
      -(beamDir[2] ?? 0) * (toEye[0] ?? 0) + (beamDir[0] ?? 0) * (toEye[2] ?? 0),
      -(beamDir[0] ?? 0) * (toEye[1] ?? 0) + (beamDir[1] ?? 0) * (toEye[0] ?? 0),
    ]);
    gl.uniformMatrix4fv(u['uViewProj'] ?? null, false, viewProj);
    gl.uniform3fv(u['uA'] ?? null, a);
    gl.uniform3fv(u['uB'] ?? null, b);
    gl.uniform3fv(u['uSide'] ?? null, side);
    gl.uniform2fv(u['uWidth'] ?? null, beamWidth);
    gl.uniform1f(u['uIntensity'] ?? null, ignite * (1 - 0.55 * easeInOut(g)) * fadeDust);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (this.#counts.dust > 0) {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(programs.dust);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffers.dust);
      this.#attribute(programs.dust, 'aSeed', 4, 0, 4);
      u = this.#u.dust;
      gl.uniformMatrix4fv(u['uViewProj'] ?? null, false, viewProj);
      gl.uniform1f(u['uTime'] ?? null, this.#clock);
      gl.uniform1f(u['uStream'] ?? null, g * d0 * 1.4);
      gl.uniform3fv(u['uBoxMin'] ?? null, [-1.3 * halfW, -0.45, -0.9 * d0]);
      gl.uniform3fv(u['uBoxSize'] ?? null, [2.6 * halfW, 1.5 * halfH + 0.45, 1.5 * d0]);
      gl.uniform1f(u['uPx'] ?? null, (this.#canvas.height / height) * 2.6 * d0);
      gl.uniform3fv(u['uA'] ?? null, a);
      gl.uniform3fv(u['uB'] ?? null, b);
      gl.uniform2fv(u['uWidth'] ?? null, [beamWidth[0] ?? 0, (beamWidth[1] ?? 0) * 1.4]);
      gl.uniform1f(u['uAlpha'] ?? null, (still ? 1 : easeOut(clamp01((t - 0.08) * 2.2))) * fadeDust);
      // En las colecciones el polvo fuera del haz se hace visible: da profundidad a los paneles.
      gl.uniform1f(u['uAmbient'] ?? null, mix(0.05, 0.22, easeInOut(clamp01(g * 3))));
      gl.drawArrays(gl.POINTS, 0, this.#counts.dust);
    }
    gl.depthMask(true);

    if (!this.#ready) {
      this.#ready = true;
      this.#root.dataset['escena3d'] = 'ready';
    }

    const settling =
      Math.abs(this.#h.target - this.#h.value) +
        Math.abs(this.#g.target - this.#g.value) +
        Math.abs(this.#drag.target - this.#drag.value) +
        Math.abs(p.tx - p.x) +
        Math.abs(p.ty - p.y) >
      0.0005;
    const alive = !still && (t < 1 || settling || time < this.#idleUntil);
    if (alive) this.#request();
  }

  #attribute(program: WebGLProgram, name: string, size: number, offset: number, stride: number) {
    const gl = this.#gl;
    if (!gl) return;
    const location = gl.getAttribLocation(program, name);
    if (location < 0) return;
    // El programa del wordmark usa más atributos; aquí solo queda activo el que se usa.
    for (let i = 0; i < 4; i++) if (i !== location) gl.disableVertexAttribArray(i);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
  }
}

export function init(root: HTMLElement) {
  const host = root.querySelector<HTMLElement>('[data-escena-lienzo]');
  if (!host || root.dataset['escena3d']) return;
  try {
    new Escena(root, host, document.querySelector<HTMLElement>('[data-escena-galeria]'));
  } catch {
    root.dataset['escena3d'] = 'failed';
  }
}
