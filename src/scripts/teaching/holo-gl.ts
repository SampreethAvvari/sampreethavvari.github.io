// A material's cover as an object in space. The covers are bright things on a
// dark ground, so the ground is keyed away and only the light stays: a stack of
// slices that gives it real depth when it turns, and thousands of points sampled
// from the picture's own bright pixels. They swarm into the picture on arrival,
// part around the pointer, and burst past the camera as the page is scrolled.
// Scrolling back up gathers them again, since all of it answers to one number.
//
// Hand written WebGL, no three.js, so the opening of these pages costs a phone a
// few kilobytes and not half a megabyte. It arrives after the first paint, the
// page's own picture stays underneath until it is up, and that picture takes over
// if the GPU goes. Everything is built again from what is still held if it returns.

import { Governor } from "../gl-governor";
import { DUST_FS, DUST_VS, SKY_FS, SKY_VS } from "../post-fx/sky-shaders";

export type HoloBox = { cx: number; cy: number; w: number; h: number };

export type HoloState = {
  /** Scroll through the opening, 0 to 1. */
  p: number;
  /** Scroll speed, 0 to 1. */
  speed: number;
  /** Pointer, smoothed, -1 to 1. */
  px: number;
  py: number;
  /** Pointer in pixels, and how much it pushes the light apart. */
  hx: number;
  hy: number;
  push: number;
};

// The file to use, when it is known: a cover may still be loading on the page.
export type HoloItem = { url: () => Promise<string>; box: HoloBox; z: number; seed: number };

export type Holo = {
  draw: (now: number) => void;
  resize: () => void;
  setBoxes: (boxes: HoloBox[]) => void;
  stop: () => void;
};

const FOV = 30;
const CAM_Z = 40;
// The plane is 16 wide; a cover keeps its own proportions.
const PLANE_W = 16;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// What a library would have put at the top of the vertex shaders.
const PRE = /* glsl */ `precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
`;

const SLICE_VS = /* glsl */ `
uniform float uBend; uniform vec2 uPlane;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = vec3(position.xy * uPlane, 0.0);
  p.z += uBend * (p.x * p.x) / 90.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const SLICE_FS = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec3 uAccent;
uniform float uA; uniform float uLo; uniform float uHi; uniform float uGain;
uniform float uChroma; uniform float uSweep; uniform float uTime;
void main() {
  // No edge of the picture may ever show: it fades out well inside its frame.
  vec2 q = (vUv - 0.5) * vec2(1.0, 1.08);
  float mask = 1.0 - smoothstep(0.26, 0.5, length(q));
  if (mask < 0.003) discard;
  vec2 dir = vUv - 0.5;
  float c = uChroma * 0.022;
  // A step sharper than the mipmaps would pick: thin lines of light stay bright.
  vec3 col = vec3(texture2D(uTex, vUv + dir * c, -1.0).r, texture2D(uTex, vUv, -1.0).g, texture2D(uTex, vUv - dir * c, -1.0).b);
  float l = max(col.r, max(col.g, col.b));
  float k = smoothstep(uLo, uHi, l);
  // A band of light crosses now and then, and the light breathes a little.
  float band = exp(-pow((vUv.x + (1.0 - vUv.y) * 0.42 - uSweep) * 5.0, 2.0));
  float breathe = 0.94 + 0.06 * sin(uTime * 0.7);
  vec3 out3 = col * k * (breathe + band * 1.1) + uAccent * k * band * 0.2;
  gl_FragColor = vec4(out3 * mask * uA * uGain, 0.0);
}`;

const BIT_VS = /* glsl */ `
attribute vec3 aHome; attribute vec3 aFar; attribute vec3 aCol; attribute float aSeed;
uniform float uTime; uniform float uGather; uniform float uFlight; uniform float uDpr; uniform float uSize;
uniform vec3 uHit; uniform float uPush;
varying vec3 vCol; varying float vA;
float ease(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
void main() {
  // Each point sets out at its own moment and lands on its pixel.
  float g = ease(clamp(uGather * 1.5 - aSeed * 0.5, 0.0, 1.0));
  vec3 p = mix(aFar, aHome, g);
  p.xy += vec2(sin(uTime * 0.37 + aSeed * 61.0), cos(uTime * 0.29 + aSeed * 37.0)) * 0.05;
  // The pointer parts the light.
  vec2 d = p.xy - uHit.xy;
  float r2 = dot(d, d) + 0.02;
  float near = exp(-r2 / 3.2);
  p.xy += d / sqrt(r2) * near * uPush * 1.3;
  p.z += near * uPush * 1.7;
  // The flight: out from the middle and past the camera.
  float f = smoothstep(aSeed * 0.3, 0.55 + aSeed * 0.45, uFlight);
  vec3 past = vec3(aHome.xy * (1.8 + aSeed * 3.4), 14.0 + aSeed * 40.0);
  p = mix(p, past, f * f);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = max(0.5, -mv.z);
  vCol = aCol;
  vA = (0.55 + 0.45 * sin(uTime * (0.8 + aSeed * 2.1) + aSeed * 40.0)) * smoothstep(0.5, 3.0, depth);
  // Quiet until it has nearly landed, so the swarm reads as dust and then as the shape.
  vA *= 0.5 + 0.5 * g;
  gl_PointSize = clamp((0.55 + aSeed * aSeed * 1.9) * uSize * 34.0 / depth * uDpr, 1.0, 14.0);
  gl_Position = projectionMatrix * mv;
}`;

const BIT_FS = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec3 vCol; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = smoothstep(0.5, 0.0, length(c));
  d *= d;
  gl_FragColor = vec4(vCol * d * vA * uA, 0.0);
}`;

/** Where the light is, read from the picture itself. */
function sampleBits(pic: ImageBitmap | HTMLImageElement, count: number, seed: number, planeH: number, flipped: boolean) {
  const W = 300;
  const iw = (pic as HTMLImageElement).naturalWidth || pic.width || 1;
  const ih = (pic as HTMLImageElement).naturalHeight || pic.height || 1;
  const H = Math.max(2, Math.round((W * ih) / iw));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const home = new Float32Array(count * 3);
  const far = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  if (!cx) return { home, far, col, seeds, n: 0 };
  // A bitmap made upside down for the GPU: turn it back for this copy.
  if (flipped) {
    cx.translate(0, H);
    cx.scale(1, -1);
  }
  cx.drawImage(pic as CanvasImageSource, 0, 0, W, H);
  const data = cx.getImageData(0, 0, W, H).data;
  let s = (seed * 2147483646 + 7) | 0 || 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) & 0x7fffffff) / 2147483647;
  let n = 0;
  let tries = 0;
  const maxTries = count * 90;
  while (n < count && tries++ < maxTries) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * H);
    // Same fade as the slices, so no point lands outside the visible light.
    const qx = x / W - 0.5;
    const qy = (y / H - 0.5) * 1.08;
    if (Math.hypot(qx, qy) > 0.42) continue;
    const i = (y * W + x) * 4;
    const R = data[i] / 255;
    const G = data[i + 1] / 255;
    const B = data[i + 2] / 255;
    const l = Math.max(R, G, B);
    if (rnd() > Math.pow(Math.max(0, l - 0.12), 1.4) * 2.2) continue;
    home[n * 3] = qx * PLANE_W + (rnd() - 0.5) * 0.05;
    home[n * 3 + 1] = -(y / H - 0.5) * planeH + (rnd() - 0.5) * 0.05;
    // Bright pixels stand proud of the plane.
    home[n * 3 + 2] = (l - 0.35) * 1.5 + (rnd() - 0.5) * 0.5;
    const a = rnd() * Math.PI * 2;
    const rr = 7 + rnd() * 26;
    far[n * 3] = Math.cos(a) * rr * 1.5;
    far[n * 3 + 1] = Math.sin(a) * rr;
    far[n * 3 + 2] = -28 + rnd() * 62;
    // Lifted toward white, since a point is smaller than the pixel it stands for.
    col[n * 3] = R + (1 - R) * 0.22;
    col[n * 3 + 1] = G + (1 - G) * 0.22;
    col[n * 3 + 2] = B + (1 - B) * 0.22;
    seeds[n] = rnd();
    n++;
  }
  return { home: home.slice(0, n * 3), far: far.slice(0, n * 3), col: col.slice(0, n * 3), seeds: seeds.slice(0, n), n };
}

/** A picture ready for the GPU, decoded away from the page's thread when the browser can. */
async function loadPicture(url: string): Promise<{ pic: ImageBitmap | HTMLImageElement; flipped: boolean }> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const pic = await createImageBitmap(await res.blob(), { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" });
    return { pic, flipped: true };
  } catch {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { pic: img, flipped: false };
  }
}

/** A turn for the page: input, scrolling and frames go first. Then one more step. */
const slot = () =>
  new Promise<void>((done) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => done(), { timeout: 400 });
    else setTimeout(done, 16);
  });

type Prog = { p: WebGLProgram; u: Map<string, WebGLUniformLocation | null> };
const ATTRS = ["position", "uv", "aSeed", "aTail", "aHome", "aFar", "aCol"];

// ---- Matrices: column major, only what this scene needs -------------------------
const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function perspective(out: Float32Array, fovDeg: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
}
/** translate * rotate X, Y, Z * uniform scale, then moved back by the camera's z. */
function modelView(out: Float32Array, x: number, y: number, z: number, rx: number, ry: number, rz: number, s: number, camZ: number) {
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  out[0] = cy * cz * s;
  out[1] = (cx * sz + sx * sy * cz) * s;
  out[2] = (sx * sz - cx * sy * cz) * s;
  out[3] = 0;
  out[4] = -cy * sz * s;
  out[5] = (cx * cz - sx * sy * sz) * s;
  out[6] = (sx * cz + cx * sy * sz) * s;
  out[7] = 0;
  out[8] = sy * s;
  out[9] = -sx * cy * s;
  out[10] = cx * cy * s;
  out[11] = 0;
  out[12] = x;
  out[13] = y;
  out[14] = z - camZ;
  out[15] = 1;
}

export function mountHolo(
  canvas: HTMLCanvasElement,
  items: HoloItem[],
  rgb: [number, number, number],
  state: HoloState,
  onReady: () => void,
  onLost: () => void,
  onBack: () => void,
  opts: { low: boolean; gathered: boolean },
): Holo | null {
  const { low } = opts;
  const cores = navigator.hardwareConcurrency || 4;
  const high = !low && cores >= 8;
  const context = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: !low,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;

  const baseDpr = Math.min(devicePixelRatio || 1, low ? 1.5 : 1.75);
  let dpr = baseDpr;
  const accent = [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
  // A cooler partner for the colour, so the nebula has depth.
  const partner = accent.map((c, i) => c + ([0.45, 0.55, 0.95][i] - c) * 0.55);

  // The thick light: thin slices close together, the brightest parts the only
  // ones that reach the outer ones. Keys are the brightness each slice starts at.
  const LAYERS = low
    ? [
        { z: 0, lo: 0.06, hi: 0.32, gain: 1 },
        { z: 0.34, lo: 0.3, hi: 0.72, gain: 0.26 },
        { z: -0.3, lo: 0.34, hi: 0.76, gain: 0.2 },
      ]
    : [
        { z: -0.52, lo: 0.42, hi: 0.84, gain: 0.14 },
        { z: -0.26, lo: 0.3, hi: 0.72, gain: 0.18 },
        { z: 0, lo: 0.06, hi: 0.32, gain: 1 },
        { z: 0.22, lo: 0.22, hi: 0.6, gain: 0.2 },
        { z: 0.44, lo: 0.34, hi: 0.76, gain: 0.16 },
        { z: 0.68, lo: 0.48, hi: 0.9, gain: 0.13 },
      ];
  const BITS = Math.round((high ? 7000 : low ? 2400 : 4200) / Math.sqrt(Math.max(1, items.length)));

  type Built = {
    item: HoloItem;
    pic: ImageBitmap | HTMLImageElement | null;
    flipped: boolean;
    planeH: number;
    bits: { home: Float32Array; far: Float32Array; col: Float32Array; seeds: Float32Array; n: number } | null;
    tex: WebGLTexture | null;
    bitVao: WebGLVertexArrayObject | null;
    bob: number;
    x: number;
    y: number;
    s: number;
    rx: number;
    ry: number;
    rz: number;
  };
  const built: Built[] = items.map((item, i) => ({ item, pic: null, flipped: false, planeH: 9, bits: null, tex: null, bitVao: null, bob: i * 1.7 + item.seed * 6, x: 0, y: 0, s: 1, rx: 0, ry: 0, rz: 0 }));

  // Star dust and its streaks at speed, the same as in a post's opening. The
  // numbers are kept here, so the GPU's copies can be made again after a loss.
  const count = high ? 1500 : 700;
  const dustPos = new Float32Array(count * 3);
  const dustSeed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.pow(Math.random(), 0.7) * 40;
    dustPos[i * 3] = Math.cos(a) * r * 1.4;
    dustPos[i * 3 + 1] = Math.sin(a) * r * 0.8;
    dustPos[i * 3 + 2] = 28 - Math.random() * 80;
    dustSeed[i] = Math.random();
  }
  const linePos = new Float32Array(count * 6);
  const lineSeed = new Float32Array(count * 2);
  const lineTail = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 2; k++) {
      linePos[i * 6 + k * 3] = dustPos[i * 3];
      linePos[i * 6 + k * 3 + 1] = dustPos[i * 3 + 1];
      linePos[i * 6 + k * 3 + 2] = dustPos[i * 3 + 2];
      lineSeed[i * 2 + k] = dustSeed[i];
      lineTail[i * 2 + k] = k;
    }
  }

  // ---- GPU objects, made now and again after a lost context ----------------
  let sky: Prog;
  let slice: Prog;
  let bit: Prog;
  let dust: Prog;
  let skyVao: WebGLVertexArrayObject | null = null;
  let stripVao: WebGLVertexArrayObject | null = null;
  let dustVao: WebGLVertexArrayObject | null = null;
  let lineVao: WebGLVertexArrayObject | null = null;
  const STRIP_SEGS = 40;
  let shaders: WebGLShader[] = [];
  let progs: WebGLProgram[] = [];
  let buffers: WebGLBuffer[] = [];
  let vaos: WebGLVertexArrayObject[] = [];
  let parallel: KHR_parallel_shader_compile | null = null;

  const program = (vs: string, fs: string): Prog => {
    const p = gl.createProgram()!;
    const sv = gl.createShader(gl.VERTEX_SHADER)!;
    const sf = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(sv, PRE + vs);
    gl.shaderSource(sf, fs);
    gl.compileShader(sv);
    gl.compileShader(sf);
    gl.attachShader(p, sv);
    gl.attachShader(p, sf);
    ATTRS.forEach((name, i) => gl.bindAttribLocation(p, i, name));
    gl.linkProgram(p);
    shaders.push(sv, sf);
    progs.push(p);
    return { p, u: new Map() };
  };
  const loc = (pr: Prog, name: string) => {
    let l = pr.u.get(name);
    if (l === undefined) {
      l = gl.getUniformLocation(pr.p, name);
      pr.u.set(name, l);
    }
    return l;
  };
  const attr = (i: number, data: Float32Array, size: number) => {
    const b = gl.createBuffer()!;
    buffers.push(b);
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, size, gl.FLOAT, false, 0, 0);
  };
  const vao = () => {
    const v = gl.createVertexArray()!;
    vaos.push(v);
    gl.bindVertexArray(v);
    return v;
  };
  const uploadBits = (b: Built) => {
    if (!b.bits || !b.bits.n) return;
    b.bitVao = vao();
    attr(0, b.bits.home, 3);
    attr(4, b.bits.home, 3);
    attr(5, b.bits.far, 3);
    attr(6, b.bits.col, 3);
    attr(2, b.bits.seeds, 1);
    gl.bindVertexArray(null);
  };

  function uploadPicture(b: Built) {
    const t = gl.createTexture()!;
    b.tex = t;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, b.flipped ? 0 : 1);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, b.pic as TexImageSource);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (low) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    } else {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }
  }

  // In small steps, so that no one task holds the page. Only the first needs the
  // GPU process to answer at once, and linking carries on in the background.
  let buildGen = 0;
  async function buildGL() {
    const gen = ++buildGen;
    const stale = () => gen !== buildGen || disposed || lost;
    shaders = [];
    progs = [];
    buffers = [];
    vaos = [];
    // Extensions have to be asked for again after a lost context.
    parallel = gl.getExtension("KHR_parallel_shader_compile");
    await slot();
    if (stale()) return;
    sky = program(SKY_VS, SKY_FS);
    await slot();
    if (stale()) return;
    slice = program(SLICE_VS, SLICE_FS);
    await slot();
    if (stale()) return;
    bit = program(BIT_VS, BIT_FS);
    await slot();
    if (stale()) return;
    dust = program(DUST_VS, DUST_FS);
    await slot();
    if (stale()) return;

    skyVao = vao();
    attr(0, new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3);
    attr(1, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2);

    // A strip of quads, curved in the shader, unit sized.
    const sp = new Float32Array((STRIP_SEGS + 1) * 2 * 3);
    const su = new Float32Array((STRIP_SEGS + 1) * 2 * 2);
    for (let i = 0; i <= STRIP_SEGS; i++) {
      const t = i / STRIP_SEGS;
      sp.set([t - 0.5, 0.5, 0, t - 0.5, -0.5, 0], i * 6);
      su.set([t, 1, t, 0], i * 4);
    }
    stripVao = vao();
    attr(0, sp, 3);
    attr(1, su, 2);

    dustVao = vao();
    attr(0, dustPos, 3);
    attr(2, dustSeed, 1);
    attr(3, new Float32Array(count), 1);

    lineVao = vao();
    attr(0, linePos, 3);
    attr(2, lineSeed, 1);
    attr(3, lineTail, 1);
    gl.bindVertexArray(null);

    // After a lost context: whatever was already held goes back, one at a time.
    for (const b of built) {
      if (!b.pic) continue;
      await slot();
      if (stale()) return;
      uploadPicture(b);
      await slot();
      if (stale()) return;
      uploadBits(b);
    }
    return gen;
  }

  let disposed = false;
  let lost = false;
  let readyFired = false;
  let readyAt = 0;
  let linkedOnce = false;

  // Asking a program whether it is done, without making the GPU answer at once.
  function whenLinked(done: () => void) {
    const t0 = performance.now();
    const check = () => {
      if (disposed || lost) return;
      const ext = parallel;
      const ready = !ext || progs.every((p) => gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR));
      // A driver that never says it is ready gets used anyway.
      if (ready || performance.now() - t0 > 12000) {
        if (import.meta.env.DEV) {
          for (const p of progs) if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p), shaders.map((s) => gl.getShaderInfoLog(s)).join("\n"));
        }
        done();
      } else setTimeout(check, 16);
    };
    check();
  }

  // One cover at a time, each step in its own idle slot: pictures decode off the
  // page's thread, shaders link in the background, the sampling is a small loop over
  // a 300 pixel copy. The canvas shows nothing until all of it is done, so the page's
  // pictures stay on screen until then and nothing pops in late.
  void (async () => {
    await slot();
    if (disposed) return;
    await buildGL();
    for (const b of built) {
      if (disposed) return;
      let got: Awaited<ReturnType<typeof loadPicture>> | null = null;
      try {
        got = await loadPicture(await b.item.url());
      } catch {
        continue; // this cover stays out of the scene
      }
      if (disposed) {
        (got.pic as ImageBitmap).close?.();
        return;
      }
      await slot();
      if (disposed) {
        (got.pic as ImageBitmap).close?.();
        return;
      }
      const { pic, flipped } = got;
      const w = (pic as HTMLImageElement).naturalWidth || pic.width || 16;
      const hh = (pic as HTMLImageElement).naturalHeight || pic.height || 9;
      b.flipped = flipped;
      b.planeH = (PLANE_W * hh) / w;
      b.bits = sampleBits(pic, BITS, b.item.seed, b.planeH, flipped);
      b.pic = pic;
      await slot();
      if (disposed) return;
      // A lost context gets these when it comes back.
      if (lost || b.tex) continue;
      uploadPicture(b);
      await slot();
      if (disposed || lost || b.bitVao) continue;
      uploadBits(b);
    }
    if (disposed) return;
    whenLinked(() => {
      if (disposed || lost || readyFired) return;
      linkedOnce = true;
      readyAt = performance.now();
      draw(readyAt);
      readyFired = true;
      onReady();
    });
  })();

  let vw = 1;
  let vh = 1;
  const unitAt = (z: number) => (2 * (CAM_Z - z) * Math.tan((FOV / 2) * (Math.PI / 180))) / vh;
  const applySize = () => {
    canvas.width = Math.max(1, Math.round(vw * dpr));
    canvas.height = Math.max(1, Math.round(vh * dpr));
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    vw = Math.max(1, Math.round(canvas.clientWidth || r.width));
    vh = Math.max(1, Math.round(canvas.clientHeight || r.height));
    applySize();
  };
  resize();

  const born = performance.now();
  let lastNow = born;
  const governor = new Governor({
    steps: [1, 0.85, 0.72],
    apply: (scale) => {
      dpr = Math.max(0.8, baseDpr * scale);
      applySize();
    },
  });

  const proj = identity();
  const mv = identity();
  const mvSlice = identity();
  const mvStill = identity();

  const set1 = (pr: Prog, n: string, v: number) => gl.uniform1f(loc(pr, n), v);

  function draw(now: number) {
    const prevNow = lastNow;
    lastNow = now;
    const time = (now - born) / 1000;
    const { p } = state;
    const flight = smooth(0.05, 1, p);
    const free = 1 - flight;
    const ptrX = state.px * free;
    const ptrY = -state.py * free;

    // The camera goes in, and through.
    const camZ = CAM_Z - Math.pow(flight, 1.35) * (CAM_Z + 5);
    const fov = FOV + flight * 16;
    perspective(proj, fov, vw / vh, 0.1, 400);

    const gather = opts.gathered ? 1 : readyAt ? Math.min(1, (now - readyAt) / 2300) : 0;
    const sliceA = smooth(0, 0.22, gather) * (1 - smooth(0.42, 0.8, flight));
    const sweep = ((time * 0.085) % 1) * 3.6 - 1.1;
    // It drifts to the middle as the camera comes for it, so the flight goes through its heart.
    const toMiddle = 1 - smooth(0, 0.7, flight);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    // The sky, opaque and then thinning away.
    gl.disable(gl.BLEND);
    gl.useProgram(sky.p);
    set1(sky, "uTime", time);
    set1(sky, "uAspect", vw / vh);
    set1(sky, "uA", 1 - smooth(0.6, 0.97, p));
    set1(sky, "uSeed", (items[0]?.seed ?? 0.3) % 1);
    // A bloom as the camera crosses the object, and at speed.
    set1(sky, "uWarp", state.speed * 0.5 + Math.exp(-Math.pow((flight - 0.72) * 6, 2)) * 0.9);
    gl.uniform3f(loc(sky, "uCol1"), accent[0], accent[1], accent[2]);
    gl.uniform3f(loc(sky, "uCol2"), partner[0], partner[1], partner[2]);
    gl.uniform2f(loc(sky, "uPointer"), ptrX, ptrY);
    gl.bindVertexArray(skyVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    for (const b of built) {
      const u = unitAt(b.item.z);
      b.x = (b.item.box.cx - vw / 2) * u * toMiddle;
      b.y = -(b.item.box.cy - vh / 2) * u * toMiddle;
      b.s = (b.item.box.w * u) / PLANE_W;
      b.ry = free * (-0.3 + Math.sin(time * 0.17 + b.bob) * 0.05 + state.px * 0.2);
      b.rx = free * (0.1 + Math.sin(time * 0.13 + b.bob) * 0.03 - state.py * 0.14);
      b.rz = free * Math.sin(time * 0.09 + b.bob) * 0.012;
      if (!b.tex) continue;
      modelView(mv, b.x, b.y, b.item.z, b.rx, b.ry, b.rz, b.s, camZ);

      // The slices
      if (sliceA > 0.002) {
        gl.useProgram(slice.p);
        gl.uniformMatrix4fv(loc(slice, "projectionMatrix"), false, proj);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, b.tex);
        gl.uniform1i(loc(slice, "uTex"), 0);
        gl.uniform3f(loc(slice, "uAccent"), accent[0], accent[1], accent[2]);
        gl.uniform2f(loc(slice, "uPlane"), PLANE_W, b.planeH);
        set1(slice, "uA", sliceA);
        set1(slice, "uChroma", Math.min(1, state.speed * 1.4 + flight * 0.8));
        set1(slice, "uSweep", sweep);
        set1(slice, "uTime", time);
        set1(slice, "uBend", free);
        gl.bindVertexArray(stripVao);
        for (const l of LAYERS) {
          mvSlice.set(mv);
          // Along the object's own z, so the slices part as it turns.
          mvSlice[12] = mv[12] + mv[8] * l.z;
          mvSlice[13] = mv[13] + mv[9] * l.z;
          mvSlice[14] = mv[14] + mv[10] * l.z;
          gl.uniformMatrix4fv(loc(slice, "modelViewMatrix"), false, mvSlice);
          set1(slice, "uLo", l.lo);
          set1(slice, "uHi", l.hi);
          set1(slice, "uGain", l.gain);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, (STRIP_SEGS + 1) * 2);
        }
      }

      // The points
      if (b.bitVao && b.bits) {
        gl.useProgram(bit.p);
        gl.uniformMatrix4fv(loc(bit, "projectionMatrix"), false, proj);
        gl.uniformMatrix4fv(loc(bit, "modelViewMatrix"), false, mv);
        set1(bit, "uTime", time);
        set1(bit, "uGather", gather);
        set1(bit, "uFlight", flight);
        set1(bit, "uDpr", dpr);
        set1(bit, "uSize", low ? 0.72 : 1);
        set1(bit, "uA", 1 - smooth(0.88, 1, p));
        set1(bit, "uPush", state.push);
        // Where the pointer falls in this cover's own plane.
        gl.uniform3f(loc(bit, "uHit"), ((state.hx - vw / 2) * u - b.x) / b.s, (-(state.hy - vh / 2) * u - b.y) / b.s, 0);
        gl.bindVertexArray(b.bitVao);
        gl.drawArrays(gl.POINTS, 0, b.bits.n);
      }
    }

    // The dust: the same soft points, then streaks when moving fast.
    modelView(mvStill, 0, 0, 0, 0, 0, 0, 1, camZ);
    gl.useProgram(dust.p);
    gl.uniformMatrix4fv(loc(dust, "projectionMatrix"), false, proj);
    gl.uniformMatrix4fv(loc(dust, "modelViewMatrix"), false, mvStill);
    set1(dust, "uTime", time);
    set1(dust, "uDpr", dpr);
    gl.uniform3f(loc(dust, "uTint"), accent[0], accent[1], accent[2]);
    gl.uniform2f(loc(dust, "uPointer"), ptrX, ptrY);
    set1(dust, "uStretch", 0);
    set1(dust, "uLine", 0);
    set1(dust, "uGain", 1 - smooth(0.82, 1, p));
    gl.bindVertexArray(dustVao);
    gl.drawArrays(gl.POINTS, 0, count);
    const lineGain = Math.min(1, state.speed * 1.4 + flight * 0.5) * (1 - smooth(0.85, 1, p));
    if (lineGain > 0.003) {
      set1(dust, "uStretch", state.speed * 12 + flight * 6);
      set1(dust, "uLine", 1);
      set1(dust, "uGain", lineGain);
      gl.bindVertexArray(lineVao);
      gl.drawArrays(gl.LINES, 0, count * 2);
    }
    gl.bindVertexArray(null);

    governor.frame(now - prevNow, state.speed > 0.02);
  }

  // The GPU can be taken away at any time. The page's pictures carry on until it
  // comes back, and everything is made again from what this file still holds.
  const lostContext = (e: Event) => {
    e.preventDefault();
    lost = true;
    onLost();
  };
  const restored = () => {
    lost = false;
    for (const b of built) {
      b.tex = null;
      b.bitVao = null;
    }
    void buildGL().then((gen) => {
      if (gen === undefined) return; // lost again, or taken down, while building
      whenLinked(() => {
        if (disposed || lost) return;
        opts.gathered = true;
        linkedOnce = true;
        lastNow = performance.now();
        governor.reset();
        draw(lastNow);
        if (readyFired) onBack();
        else {
          readyFired = true;
          readyAt = performance.now();
          onReady();
        }
      });
    });
  };
  canvas.addEventListener("webglcontextlost", lostContext);
  canvas.addEventListener("webglcontextrestored", restored);

  return {
    draw: (now) => {
      if (!lost && !disposed && linkedOnce) draw(now);
    },
    resize,
    setBoxes(boxes) {
      boxes.forEach((b, i) => {
        if (built[i]) built[i].item.box = b;
      });
    },
    stop() {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", lostContext);
      canvas.removeEventListener("webglcontextrestored", restored);
      for (const b of built) {
        (b.pic as ImageBitmap | null)?.close?.();
        b.pic = null;
        if (b.tex) gl.deleteTexture(b.tex);
      }
      vaos.forEach((v) => gl.deleteVertexArray(v));
      buffers.forEach((x) => gl.deleteBuffer(x));
      progs.forEach((x) => gl.deleteProgram(x));
      shaders.forEach((x) => gl.deleteShader(x));
      // Give the memory back now, not when the browser gets round to it.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
