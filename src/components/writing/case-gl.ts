// The 3D scene behind the six case studies: one WebGL context for the page.
//
// Each case study's art hangs on a curved glass slab in a nebula, the six
// slabs in a line receding into space. Scroll flies the camera from one
// slab to the next: the slab you leave dissolves from a glowing edge as you
// pass through it, the next one grows out of the dark with a light sweep
// across its glass. Star dust streaks with the speed of the flight, and a
// fast scroll splits the colour at the edges. The words stay in the DOM.
//
// Quality tiers set the pixel ratio, the dust and the texture width, and a
// governor steps down if frames run slow. The loop runs only while the
// section is on screen and the tab is visible.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";

export type FlightState = {
  /** Which case study is up, 0 to n - 1, with holds at whole numbers. */
  t: number;
  /** Raw scroll position in steps, without the holds. */
  x: number;
};

type Tier = { dpr: number; stars: number; tex: 1280 | 2560 };

const GAP = 30; // distance between slabs
const W = 16; // slab size, 16 by 9
const H = 9;
const FOV = 36;

// Where each slab hangs and how it turns. The art sits on the right so the
// words have the left; each slab turns its right edge away.
const LAYOUT = [
  { x: 0.0, y: 0.0, ry: 0.2 },
  { x: 2.6, y: 1.0, ry: 0.14 },
  { x: -2.2, y: -0.9, ry: 0.22 },
  { x: 2.4, y: 0.8, ry: 0.15 },
  { x: -2.6, y: -0.7, ry: 0.21 },
  { x: 1.8, y: 0.6, ry: 0.16 },
];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const inOut = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

function pickTier(): Tier {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
  const high = !coarse && cores >= 8 && mem >= 8;
  return high ? { dpr: 1.5, stars: 2400, tex: 2560 } : { dpr: 1, stars: 1100, tex: 1280 };
}

const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}`;

const SKY_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;

const SKY_FS = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime; uniform float uAspect; uniform float uOff; uniform float uWarp;
uniform vec3 uCol1; uniform vec3 uCol2;
${NOISE}
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 q = p * 1.5 + vec2(uOff * 0.32, uOff * 0.1);
  float n = fbm(q + vec2(uTime * 0.012, -uTime * 0.008));
  float m = fbm(q * 1.7 - n * 1.25 + vec2(-uTime * 0.01, uTime * 0.007) + 3.1);
  vec3 col = vec3(0.004, 0.006, 0.014);
  col += uCol1 * pow(smoothstep(0.28, 0.92, m), 1.7) * 0.95;
  col += uCol2 * pow(smoothstep(0.42, 1.0, n), 2.4) * 0.6;
  col += vec3(0.55, 0.6, 0.75) * pow(smoothstep(0.6, 1.0, m), 3.0) * 0.22;
  col *= 0.7 + 0.3 * smoothstep(0.18, 0.72, n);
  // The tunnel of light while flying between slabs.
  float r = length(p);
  col += mix(uCol1, uCol2, 0.5) * uWarp * 0.34 * (1.0 - smoothstep(0.0, 0.85, r));
  col *= 1.0 - 0.5 * dot(p * 0.85, p * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

const SLAB_VS = /* glsl */ `
uniform float uBend;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() {
  vUv = uv;
  // Scroll speed flexes the glass: the middle bows, the sides hold.
  vec3 p = position;
  float xn = p.x / 8.0;
  p.z += uBend * (1.0 - xn * xn) * 1.8;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vView = cameraPosition - wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SLAB_FS = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
uniform sampler2D uTex; uniform float uHasTex;
uniform vec3 uAccent; uniform float uOpacity; uniform float uDissolve; uniform float uChroma;
uniform float uSweep; uniform float uDim; uniform float uRim; uniform float uSeed; uniform float uTime;
uniform vec2 uPointer;
${NOISE}
float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(16.0 / 9.0, 1.0);
  float d = box(p, vec2(8.0 / 9.0, 0.5), 0.05);
  float inside = 1.0 - smoothstep(-0.0015, 0.0015, d);
  if (inside < 0.01) discard;

  // Colour split toward the edges when the flight is fast.
  vec2 dir = uv - 0.5;
  float c = uChroma * 0.022;
  vec3 col = vec3(0.02, 0.025, 0.04) + uAccent * 0.05;
  if (uHasTex > 0.5) {
    // Depth from the blurred brightness: bright subjects sit near, dark
    // space sits far, so the pointer moves them apart and the art breathes.
    float depth = dot(texture2D(uTex, uv, 5.0).rgb, vec3(0.3, 0.59, 0.11));
    vec2 duv = uv + uPointer * (depth * 1.6 - 0.22) * 0.03;
    duv = clamp(duv, 0.002, 0.998);
    col.r = texture2D(uTex, duv + dir * c).r;
    col.g = texture2D(uTex, duv).g;
    col.b = texture2D(uTex, duv - dir * c).b;
  }

  // Glass: a fresnel sheen, a bright rim in the post's colour with a thin
  // colour fringe, and a band of light that sweeps across.
  vec3 V = normalize(vView);
  float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
  float edge = 1.0 - smoothstep(0.0, 0.03, -d);
  float edgeIn = 1.0 - smoothstep(0.0, 0.12, -d);
  col += uAccent * fres * 0.35;
  col += uAccent * edgeIn * 0.16 * uRim;
  col += (uAccent * 0.8 + 0.35) * edge * 0.9 * uRim;
  col.r += edge * 0.25 * uRim * step(0.0, p.x);
  col.b += edge * 0.25 * uRim * step(p.x, 0.0);
  float band = exp(-pow((uv.x * 1.0 + (1.0 - uv.y) * 0.42 - uSweep) * 6.5, 2.0));
  col += (vec3(1.0) * 0.26 + uAccent * 0.3) * band;
  col *= 1.0 - uDim;

  // Dissolve from a glowing edge while the camera passes through.
  float alpha = inside * uOpacity;
  if (uDissolve > 0.001) {
    float n = fbm(uv * vec2(10.0, 5.6) + uSeed * 7.0);
    float th = uDissolve * 1.25 - 0.12;
    float keep = smoothstep(th, th + 0.02, n);
    float burn = (1.0 - smoothstep(0.0, 0.03, abs(n - th - 0.02))) * step(0.02, uDissolve);
    col = mix(col, uAccent * 1.5 + vec3(0.12), burn * 0.9);
    alpha *= max(keep, burn);
  }
  gl_FragColor = vec4(col, alpha);
}`;

const DUST_VS = /* glsl */ `
attribute float aSeed; attribute float aTail;
uniform float uTime; uniform float uStretch; uniform float uDpr;
varying float vA; varying float vSeed;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.11 + aSeed * 40.0) * 0.35;
  p.y += cos(uTime * 0.09 + aSeed * 23.0) * 0.25;
  p.z -= aTail * uStretch;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  vA = clamp(1.5 - depth / 110.0, 0.0, 1.0) * smoothstep(0.5, 3.5, depth);
  vA *= 0.6 + 0.4 * sin(uTime * (0.6 + aSeed * 1.7) + aSeed * 50.0);
  vSeed = aSeed;
  gl_PointSize = clamp((0.7 + aSeed * 2.0) * 40.0 / depth * uDpr, 1.2, 10.0);
  gl_Position = projectionMatrix * mv;
}`;

const DUST_FS = /* glsl */ `
precision mediump float;
uniform vec3 uTint; uniform float uLine; uniform float uGain;
varying float vA; varying float vSeed;
void main() {
  float a = vA * uGain;
  if (uLine < 0.5) {
    vec2 c = gl_PointCoord - 0.5;
    a *= smoothstep(0.5, 0.0, length(c));
  }
  vec3 col = mix(vec3(0.92, 0.95, 1.0), uTint, fract(vSeed * 7.31) * 0.7 + uLine * 0.3);
  gl_FragColor = vec4(col * a, a);
}`;

export type GLHandle = { stop: () => void };

export function mountCaseGL(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  heroes: HTMLElement[],
  state: FlightState,
  onReady: () => void,
): GLHandle | null {
  const tier = pickTier();
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: tier.dpr > 1,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x010205, 1);
  let dpr = Math.min(devicePixelRatio || 1, tier.dpr);
  renderer.setPixelRatio(dpr);

  const n = heroes.length;
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 16 / 9, 0.1, 400);
  const accents = heroes.map((h) => {
    const [r, g, b] = (h.style.getPropertyValue("--a") || "52,211,153").split(",").map((v) => (parseFloat(v) || 0) / 255);
    return new Color(r, g, b);
  });

  // Sky
  const skyMat = new ShaderMaterial({
    vertexShader: SKY_VS,
    fragmentShader: SKY_FS,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1.6 },
      uOff: { value: 0 },
      uWarp: { value: 0 },
      uCol1: { value: accents[0].clone() },
      uCol2: { value: (accents[1] || accents[0]).clone() },
    },
  });
  const skyGeo = new PlaneGeometry(2, 2);
  const sky = new Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // Slabs: a 16 by 9 plane bent gently so its sides come toward you.
  const slabGeo = new PlaneGeometry(W, H, 64, 1);
  {
    const pos = slabGeo.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, (x * x) / (2 * 34));
    }
    pos.needsUpdate = true;
    slabGeo.computeVertexNormals();
  }
  const loader = new TextureLoader();
  // Shared by every slab: where the pointer is, smoothed.
  const pointer = { x: 0, y: 0 } as { x: number; y: number };
  const textures: Texture[] = [];
  const slabs = heroes.map((h, i) => {
    const L = LAYOUT[i % LAYOUT.length];
    const mat = new ShaderMaterial({
      vertexShader: SLAB_VS,
      fragmentShader: SLAB_FS,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: null },
        uHasTex: { value: 0 },
        uAccent: { value: accents[i] },
        uOpacity: { value: 1 },
        uDissolve: { value: 0 },
        uChroma: { value: 0 },
        uSweep: { value: -1 },
        uDim: { value: 0 },
        uRim: { value: 1 },
        uSeed: { value: i * 1.37 },
        uTime: { value: 0 },
        uBend: { value: 0 },
        uPointer: { value: pointer },
      },
    });
    const mesh = new Mesh(slabGeo, mat);
    mesh.position.set(L.x, L.y, -i * GAP);
    mesh.rotation.y = L.ry;
    mesh.renderOrder = 10 + (n - i);
    scene.add(mesh);
    return { mesh, mat, base: L };
  });

  let readyFired = false;
  // The same file the page already chose for the first picture, so the
  // first texture comes from the cache.
  const first = heroes[0]?.querySelector<HTMLImageElement>(".cx-img");
  const ext = first?.currentSrc?.endsWith(".avif") ? "avif" : "webp";
  heroes.forEach((h, i) => {
    const art = h.dataset.art;
    const img = h.querySelector<HTMLImageElement>(".cx-img");
    const url = art ? `${art}-${tier.tex}.${ext}` : img?.currentSrc || img?.src;
    if (!url) return;
    loader.load(url, (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.generateMipmaps = true;
      tex.minFilter = LinearMipmapLinearFilter;
      tex.magFilter = LinearFilter;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures.push(tex);
      slabs[i].mat.uniforms.uTex.value = tex;
      slabs[i].mat.uniforms.uHasTex.value = 1;
      if (i === 0 && !readyFired) {
        readyFired = true;
        // Draw once with the art, then let the page swap the layers.
        draw(performance.now());
        onReady();
      }
    });
  });

  // Star dust, as points, and as streaks when the flight is fast.
  const span = n * GAP + 120;
  const count = tier.stars;
  const pts = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.pow(Math.random(), 0.7) * 46;
    pts[i * 3] = Math.cos(a) * r * 1.3;
    pts[i * 3 + 1] = Math.sin(a) * r * 0.75;
    pts[i * 3 + 2] = 40 - Math.random() * span;
    seeds[i] = Math.random();
  }
  const dustUniforms = {
    uTime: { value: 0 },
    uStretch: { value: 0 },
    uDpr: { value: dpr },
    uTint: { value: accents[0].clone() },
    uLine: { value: 0 },
    uGain: { value: 1 },
  };
  const pointGeo = new BufferGeometry();
  pointGeo.setAttribute("position", new BufferAttribute(pts, 3));
  pointGeo.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  pointGeo.setAttribute("aTail", new BufferAttribute(new Float32Array(count), 1));
  const pointMat = new ShaderMaterial({
    vertexShader: DUST_VS,
    fragmentShader: DUST_FS,
    uniforms: dustUniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(pointGeo, pointMat);
  points.frustumCulled = false;
  points.renderOrder = 50;
  scene.add(points);

  const linePos = new Float32Array(count * 6);
  const lineSeed = new Float32Array(count * 2);
  const lineTail = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 2; k++) {
      linePos[i * 6 + k * 3] = pts[i * 3];
      linePos[i * 6 + k * 3 + 1] = pts[i * 3 + 1];
      linePos[i * 6 + k * 3 + 2] = pts[i * 3 + 2];
      lineSeed[i * 2 + k] = seeds[i];
      lineTail[i * 2 + k] = k;
    }
  }
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute("position", new BufferAttribute(linePos, 3));
  lineGeo.setAttribute("aSeed", new BufferAttribute(lineSeed, 1));
  lineGeo.setAttribute("aTail", new BufferAttribute(lineTail, 1));
  const lineUniforms = { ...dustUniforms, uLine: { value: 1 }, uGain: { value: 0 } };
  const lineMat = new ShaderMaterial({
    vertexShader: DUST_VS,
    fragmentShader: DUST_FS,
    uniforms: lineUniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const lines = new LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 51;
  scene.add(lines);

  // Camera stops: in front of each slab, shifted left so the slab sits on
  // the right of the screen.
  let aspect = 1.6;
  let dist = 20;
  let offX = 2;
  const stopPos = (i: number, out: Vector3) => {
    const L = slabs[Math.max(0, Math.min(n - 1, i))].mesh.position;
    return out.set(L.x - offX, L.y, L.z + dist);
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const tanH = Math.tan(((FOV / 2) * Math.PI) / 180);
    // The slab spans about three quarters of the view, whichever side
    // is tighter.
    dist = Math.max(W / (0.74 * 2 * tanH * aspect), H / (0.72 * 2 * tanH));
    offX = 2 * dist * tanH * aspect * 0.1;
    skyMat.uniforms.uAspect.value = aspect;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Pointer parallax.
  let mx = 0;
  let my = 0;
  let pmx = 0;
  let pmy = 0;
  const onMove = (e: PointerEvent) => {
    mx = (e.clientX / innerWidth) * 2 - 1;
    my = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener("pointermove", onMove, { passive: true });

  const A = new Vector3();
  const B = new Vector3();
  const look = new Vector3();
  const col = new Color();
  let velS = 0;
  let lastX = state.x;
  let lastZ = 0;
  let lastNow = performance.now();
  const born = performance.now();
  // A short arrival when the page opens at the top.
  const arrive = scrollY < 40 ? 1 : 0;

  // Governor: if frames run slow, step down once or twice.
  let slowFrames = 0;
  let sampled = 0;
  let steps = 0;

  function draw(now: number) {
    const dtMs = Math.min(64, now - lastNow);
    lastNow = now;
    const time = (now - born) / 1000;
    const t = state.t;
    const k = Math.min(n - 1, Math.floor(t));
    const e = t - k;
    const ez = inOut(e);

    // Scroll speed in steps per second, smoothed.
    const vx = dtMs > 0 ? ((state.x - lastX) / dtMs) * 1000 : 0;
    lastX = state.x;
    velS += (vx - velS) * 0.12;
    const speed = Math.min(1, Math.abs(velS) / 1.6);

    // Camera along the line of stops, with a lift and a bank mid flight.
    stopPos(k, A);
    stopPos(k + 1, B);
    const camPos = camera.position;
    camPos.lerpVectors(A, B, k >= n - 1 ? 0 : ez);
    const arc = Math.sin(Math.PI * e);
    camPos.y += arc * 1.3;
    pmx += (mx - pmx) * 0.04;
    pmy += (my - pmy) * 0.04;
    pointer.x = pmx;
    pointer.y = -pmy;
    camPos.x += pmx * 0.7;
    camPos.y -= pmy * 0.4;
    // Arrival: fly in from deep behind on first open.
    const ar = arrive ? 1 - inOut(clamp01((now - born - 300) / 1800)) : 0;
    camPos.z += ar * 26;
    camPos.y += ar * 2.5;
    look.set(lerp(A.x, B.x, k >= n - 1 ? 0 : ez), lerp(A.y, B.y, k >= n - 1 ? 0 : ez), camPos.z - dist);
    look.x += pmx * 0.25;
    camera.lookAt(look);
    camera.rotation.z += arc * 0.05 * (k % 2 === 0 ? 1 : -1);

    const camVz = dtMs > 0 ? ((camPos.z - lastZ) / dtMs) * 16.67 : 0;
    lastZ = camPos.z;
    const warp = Math.min(1, Math.abs(camVz) / 0.9) * (ar > 0 ? 0.6 : 1);

    // Slabs
    slabs.forEach((s, i) => {
      const u = s.mat.uniforms;
      const L = s.base;
      s.mesh.rotation.y = L.ry + Math.sin(time * 0.17 + i) * 0.035 + (i === k ? e * 0.25 : 0);
      s.mesh.rotation.x = Math.sin(time * 0.13 + i * 2.1) * 0.02;
      const d = s.mesh.position.distanceTo(camPos);
      // Far slabs fade into the nebula.
      u.uDim.value = clamp01((d - dist * 1.1) / 70) * 0.85;
      u.uChroma.value = speed;
      u.uBend.value = Math.max(-1, Math.min(1, velS / 2.2));
      u.uTime.value = time;
      let dissolve = 0;
      let opacity = 1;
      if (i < k) opacity = 0;
      if (i === k && k < n - 1) dissolve = clamp01((e - 0.08) / 0.46);
      if (i === k + 1) {
        // The light sweeps across the arriving slab.
        u.uSweep.value = lerp(-0.6, 1.7, clamp01((e - 0.25) / 0.75));
        u.uRim.value = 0.6 + 0.8 * Math.sin(Math.PI * clamp01(e));
      } else if (i === k) {
        u.uSweep.value = ((time * 0.09 + i * 0.37) % 1) * 3.4 - 1.2;
        u.uRim.value = 1 - e * 0.5;
      } else {
        u.uSweep.value = -1;
        u.uRim.value = 0.55;
      }
      u.uDissolve.value = dissolve;
      u.uOpacity.value = opacity;
      s.mesh.visible = opacity > 0 && (dissolve < 0.999);
    });

    // Sky
    const su = skyMat.uniforms;
    su.uTime.value = time;
    su.uOff.value = t;
    su.uWarp.value = warp * 0.8 + ar * 0.5;
    col.copy(accents[k]).lerp(accents[Math.min(n - 1, k + 1)], ez);
    su.uCol1.value.copy(col);
    su.uCol2.value.copy(accents[Math.min(n - 1, k + 1)]).lerp(accents[k], 0.35);

    // Dust
    dustUniforms.uTime.value = time;
    dustUniforms.uTint.value.copy(col);
    lineUniforms.uStretch.value = Math.min(14, Math.abs(camVz) * 9) + ar * 8;
    lineUniforms.uGain.value = Math.min(1, warp * 1.6 + ar);

    renderer.render(scene, camera);

    // Governor
    if (sampled < 240) {
      sampled++;
      if (dtMs > 26) slowFrames++;
      if (sampled === 120 || sampled === 240) {
        if (slowFrames > 40 && steps < 2) {
          steps++;
          dpr = Math.max(0.75, dpr * 0.72);
          renderer.setPixelRatio(dpr);
          dustUniforms.uDpr.value = dpr;
          resize();
          pointGeo.setDrawRange(0, Math.floor(count * 0.6));
          lineGeo.setDrawRange(0, Math.floor(count * 0.6) * 2);
        }
        slowFrames = 0;
      }
    }
  }

  let raf = 0;
  let running = false;
  let disposed = false;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    draw(now);
  };
  const start = () => {
    if (running || disposed || document.hidden) return;
    running = true;
    lastNow = performance.now();
    lastX = state.x;
    raf = requestAnimationFrame(loop);
  };
  const halt = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  let onScreen = false;
  const io = new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting;
    if (onScreen) start();
    else halt();
  });
  io.observe(root);
  const onVis = () => (document.hidden ? halt() : onScreen && start());
  document.addEventListener("visibilitychange", onVis);
  const onLost = (e: Event) => {
    e.preventDefault();
    halt();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    stop() {
      disposed = true;
      halt();
      io.disconnect();
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      textures.forEach((t) => t.dispose());
      slabs.forEach((s) => s.mat.dispose());
      slabGeo.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      pointGeo.dispose();
      pointMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
