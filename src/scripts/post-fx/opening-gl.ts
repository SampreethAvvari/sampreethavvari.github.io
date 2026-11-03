// The opening of a post: its art on a curved glass slab in a nebula, in the
// post's own colour, the same space the Writing tab flies through.
//
// The whole scene answers to one number, how far the opening has settled.
// At 0 the slab hangs in space, turned and bent, and leans toward the pointer.
// At 1 it is flat and sits exactly on the picture at the head of the reading
// column, the sky has gone, and the page takes over from the canvas without a
// visible change. The page measures both rectangles in pixels and this file
// solves for the slab that covers them, so the landing is exact at any size.

import { Governor } from "../gl-governor";
import { decodedTexture, prelink, quietShaderChecks } from "../gl-warm";
import { DUST_FS, DUST_VS, SKY_FS, SKY_VS } from "./sky-shaders";
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
  NoBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderer,
} from "three";

export type Box = { cx: number; cy: number; w: number; h: number };

export type OpeningState = {
  /** 0 in space, 1 settled on the page. */
  e: number;
  /** Scroll speed, 0 to 1. */
  speed: number;
  /** Pointer, smoothed, -1 to 1. */
  px: number;
  py: number;
  /** The light that crosses the glass. */
  sweep: number;
  from: Box;
  to: Box;
  /** Corner radius of the picture on the page, in pixels. */
  radius: number;
};

const FOV = 30;
const CAM_Z = 40;

const SLAB_VS = /* glsl */ `
uniform float uBend;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() {
  vUv = uv;
  vec3 p = position;
  // Curved glass: the sides come toward the camera, and flat when settled.
  p.z += uBend * (p.x * p.x) / 68.0;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vView = cameraPosition - wp.xyz;
  vec3 nrm = normalize(vec3(-uBend * p.x / 34.0, 0.0, 1.0));
  vN = normalize(mat3(modelMatrix) * nrm);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SLAB_FS = /* glsl */ `
precision highp float;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
uniform sampler2D uTex; uniform vec2 uCrop;
uniform vec3 uAccent; uniform float uA; uniform float uChroma; uniform float uSweep;
uniform float uRim; uniform float uDepth; uniform vec2 uPointer; uniform float uRadius; uniform float uAA;
float box(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(16.0 / 9.0, 1.0);
  float d = box(p, vec2(8.0 / 9.0, 0.5), uRadius);
  float inside = 1.0 - smoothstep(-uAA, uAA, d);
  if (inside < 0.004) discard;

  // The picture as the page crops it, with a colour split at speed.
  vec2 t = 0.5 + (uv - 0.5) * uCrop;
  vec2 dir = uv - 0.5;
  float c = uChroma * 0.018;
  // Depth from blurred brightness: bright subjects near, dark space far.
  float depth = dot(texture2D(uTex, t, 5.0).rgb, vec3(0.3, 0.59, 0.11));
  vec2 duv = t + uPointer * (depth * 1.6 - 0.22) * 0.028 * uDepth;
  duv = clamp(duv, 0.002, 0.998);
  vec3 col = vec3(texture2D(uTex, duv + dir * c).r, texture2D(uTex, duv).g, texture2D(uTex, duv - dir * c).b);

  // Glass: sheen, a bright rim with a colour fringe, a band of light.
  vec3 V = normalize(vView);
  float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.5);
  float edge = 1.0 - smoothstep(0.0, 0.012, -d);
  float edgeIn = 1.0 - smoothstep(0.0, 0.1, -d);
  col += uAccent * fres * 0.5 * uRim;
  col += uAccent * edgeIn * 0.14 * uRim;
  col += (uAccent * 0.8 + 0.35) * edge * 0.9 * uRim;
  col.r += edge * 0.25 * uRim * step(0.0, p.x);
  col.b += edge * 0.25 * uRim * step(p.x, 0.0);
  float band = exp(-pow((uv.x + (1.0 - uv.y) * 0.42 - uSweep) * 6.5, 2.0));
  col += (vec3(0.26) + uAccent * 0.3) * band * uRim;
  float a = inside * uA;
  gl_FragColor = vec4(col * a, a);
}`;

export type OpeningGL = {
  draw: (now: number) => void;
  resize: () => void;
  stop: () => void;
};

export function mountOpeningGL(
  canvas: HTMLCanvasElement,
  url: string | undefined,
  rgb: [number, number, number],
  seed: number,
  state: OpeningState,
  onReady: () => void,
  onLost: () => void,
): OpeningGL | null {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const high = !coarse && cores >= 8;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  quietShaderChecks(renderer);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const baseDpr = Math.min(devicePixelRatio || 1, 1.5);
  let dpr = baseDpr;
  renderer.setPixelRatio(dpr);
  // A phone can take the GPU back: the page's own picture takes over again.
  const lostContext = (e: Event) => {
    e.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", lostContext);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 16 / 9, 0.1, 400);
  camera.position.set(0, 0, CAM_Z);
  const accent = new Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  // A cooler partner for the post's colour, so the nebula has depth.
  const partner = accent.clone().lerp(new Color(0.45, 0.55, 0.95), 0.55);
  const pointer = new Vector2();

  // Sky
  const skyMat = new ShaderMaterial({
    vertexShader: SKY_VS,
    fragmentShader: SKY_FS,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: NoBlending,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1.6 },
      uA: { value: 1 },
      uSeed: { value: seed },
      uWarp: { value: 0 },
      uCol1: { value: accent },
      uCol2: { value: partner },
      uPointer: { value: pointer },
    },
  });
  const skyGeo = new PlaneGeometry(2, 2);
  const sky = new Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // Slab
  const slabGeo = new PlaneGeometry(16, 9, 64, 1);
  const slabMat = new ShaderMaterial({
    vertexShader: SLAB_VS,
    fragmentShader: SLAB_FS,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    premultipliedAlpha: true,
    uniforms: {
      uTex: { value: null },
      uCrop: { value: new Vector2(1, 1) },
      uAccent: { value: accent },
      uA: { value: 0 },
      uChroma: { value: 0 },
      uSweep: { value: -1 },
      uRim: { value: 1 },
      uDepth: { value: 1 },
      uPointer: { value: pointer },
      uRadius: { value: 0.05 },
      uAA: { value: 0.002 },
      uBend: { value: 1 },
    },
  });
  const slab = new Mesh(slabGeo, slabMat);
  slab.renderOrder = 10;
  slab.visible = false;
  scene.add(slab);

  let disposed = false;
  let texture: Texture | null = null;
  // The picture decodes away from the page's thread and the shaders link in the
  // background, so the hand over from the page's picture never holds up a scroll.
  const finish = () => {
    prelink(renderer, scene, camera, null).then(() => {
      if (disposed) return;
      if (texture) renderer.initTexture(texture);
      draw(performance.now());
      onReady();
    });
  };
  if (url) {
    decodedTexture(url).then(
      (tex) => {
        if (disposed) {
          (tex.image as ImageBitmap | null)?.close?.();
          tex.dispose();
          return;
        }
        tex.generateMipmaps = true;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        texture = tex;
        const img = tex.image as { width: number; height: number };
        // object-fit: cover at 16 by 9, the same crop the page uses.
        const ia = img.width / img.height;
        const ta = 16 / 9;
        (slabMat.uniforms.uCrop.value as Vector2).set(ia > ta ? ta / ia : 1, ia > ta ? 1 : ia / ta);
        slabMat.uniforms.uTex.value = tex;
        slabMat.uniforms.uA.value = 1;
        slab.visible = true;
        finish();
      },
      () => {
        if (!disposed) finish();
      },
    );
  } else {
    requestAnimationFrame(() => {
      if (!disposed) finish();
    });
  }

  // Star dust and its streaks at speed.
  const count = high ? 1800 : 800;
  const pts = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.pow(Math.random(), 0.7) * 40;
    pts[i * 3] = Math.cos(a) * r * 1.4;
    pts[i * 3 + 1] = Math.sin(a) * r * 0.8;
    pts[i * 3 + 2] = 28 - Math.random() * 80;
    seeds[i] = Math.random();
  }
  const dustU = {
    uTime: { value: 0 },
    uStretch: { value: 0 },
    uDpr: { value: dpr },
    uTint: { value: accent },
    uLine: { value: 0 },
    uGain: { value: 1 },
    uPointer: { value: pointer },
  };
  const pointGeo = new BufferGeometry();
  pointGeo.setAttribute("position", new BufferAttribute(pts, 3));
  pointGeo.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  pointGeo.setAttribute("aTail", new BufferAttribute(new Float32Array(count), 1));
  const pointMat = new ShaderMaterial({
    vertexShader: DUST_VS,
    fragmentShader: DUST_FS,
    uniforms: dustU,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
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
  const lineU = { ...dustU, uLine: { value: 1 }, uGain: { value: 0 } };
  const lineMat = new ShaderMaterial({
    vertexShader: DUST_VS,
    fragmentShader: DUST_FS,
    uniforms: lineU,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
  });
  const lines = new LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 51;
  scene.add(lines);

  let vw = 1;
  let vh = 1;
  let unit = 1; // world units per pixel at the slab's depth
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    vw = Math.max(1, Math.round(canvas.clientWidth || r.width));
    vh = Math.max(1, Math.round(canvas.clientHeight || r.height));
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    renderer.setSize(vw, vh, false);
    unit = (2 * CAM_Z * Math.tan((FOV / 2) * (Math.PI / 180))) / vh;
    skyMat.uniforms.uAspect.value = vw / vh;
  };
  resize();

  const born = performance.now();
  let lastNow = born;
  // Fewer pixels when frames run slow and that helps, and back again when there is room.
  const governor = new Governor({
    steps: [1, 0.85, 0.72],
    apply: (scale) => {
      dpr = Math.max(0.8, baseDpr * scale);
      renderer.setPixelRatio(dpr);
      dustU.uDpr.value = dpr;
      resize();
    },
  });

  function draw(now: number) {
    const prevNow = lastNow;
    lastNow = now;
    const time = (now - born) / 1000;
    const e = state.e;
    const free = 1 - e;
    pointer.set(state.px * free, -state.py * free);

    // The slab that covers the wanted rectangle in pixels.
    const cx = state.from.cx + (state.to.cx - state.from.cx) * e;
    const cy = state.from.cy + (state.to.cy - state.from.cy) * e;
    const w = state.from.w + (state.to.w - state.from.w) * e;
    slab.position.set((cx - vw / 2) * unit, -(cy - vh / 2) * unit, 0);
    const s = (w * unit) / 16;
    slab.scale.set(s, s, s);
    slab.rotation.y = free * (-0.2 + Math.sin(time * 0.17) * 0.03 + state.px * 0.12);
    slab.rotation.x = free * (0.05 + Math.sin(time * 0.13) * 0.016 - state.py * 0.08);
    slab.rotation.z = free * -0.012;

    const u = slabMat.uniforms;
    const hPx = (w * 9) / 16;
    u.uBend.value = free;
    u.uDepth.value = free;
    u.uRim.value = Math.pow(free, 1.4);
    u.uChroma.value = state.speed * free;
    u.uSweep.value = state.sweep;
    u.uRadius.value = state.radius / hPx;
    u.uAA.value = 0.75 / hPx;

    const su = skyMat.uniforms;
    su.uTime.value = time;
    su.uA.value = Math.pow(free, 1.5);
    su.uWarp.value = state.speed * 0.5 * free;

    dustU.uTime.value = time;
    dustU.uGain.value = Math.pow(free, 1.4);
    lineU.uStretch.value = state.speed * 12;
    lineU.uGain.value = Math.min(1, state.speed * 1.4) * free;

    renderer.render(scene, camera);

    governor.frame(now - prevNow, state.speed > 0.02);
  }

  return {
    draw,
    resize,
    stop() {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", lostContext);
      (texture?.image as ImageBitmap | null)?.close?.();
      texture?.dispose();
      slabMat.dispose();
      slabGeo.dispose();
      skyMat.dispose();
      skyGeo.dispose();
      pointGeo.dispose();
      pointMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
