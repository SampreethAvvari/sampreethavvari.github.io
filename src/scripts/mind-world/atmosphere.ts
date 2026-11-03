// The atmosphere lives outside the map. Clouds of gas and a little dust hang in a
// wide shell around it, never among it. Each cloud works out, from the camera's own
// view, how far it is from the map's bounds and fades to nothing well before it gets
// there, so turning or flying can never bring it behind a star, a link or a name.
// The visitor sees it framing the map at the edges, and sees more by flying out.
// It is drawn into a small target of its own, which makes soft light cheap on a phone.

import {
  AddEquation,
  Color,
  CustomBlending,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Matrix4,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  ZeroFactor,
  type Texture,
} from "three";
import { gaussFrom, lightUniforms, mapUniforms, OUTSIDE_MAP, rng, WORLD_LIGHT, type Shared } from "./glsl";

const TAU = Math.PI * 2;
// The site's tab colours. Violet is this tab's own and carries the clouds.
const VIOLET = new Color("#A78BFA");
const BLUE = new Color("#5B8DEF");
const CYAN = new Color("#22D3EE");
const ROSE = new Color("#F43F5E");

const CLOUD_VS = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iCol;
attribute vec4 iMeta; // size, turn, u offset, v offset
uniform float uLum;
uniform float uNear;
varying vec2 vUv;
varying vec2 vT;
varying vec3 vC;
varying float vA;
${WORLD_LIGHT}
${OUTSIDE_MAP}
void main() {
  vec4 wp = modelMatrix * vec4(iPos, 1.0);
  vec4 mv = viewMatrix * wp;
  float d = -mv.z;
  float size = iMeta.x * length(modelMatrix[0].xyz);
  vec3 toCloud = wp.xyz - cameraPosition;
  float dist = length(toCloud);
  // The whole cloud must clear the map, so its own width counts against it.
  float vis = outsideMap(toCloud / max(dist, 1.0), atan(size * 0.7, max(dist, 1.0)));
  float near = smoothstep(uNear * 0.2, uNear, d) * smoothstep(0.0, size * 1.4, d) * vis;
  float c = cos(iMeta.y), s = sin(iMeta.y);
  vec2 q = position.xy * 2.0;
  vUv = q;
  vT = (mat2(c, -s, s, c) * q) * 0.26 + iMeta.zw;
  mv.xy += q * size;
  vC = worldLight(wp.xyz, iCol.rgb) * uLum * near;
  vA = iCol.a * near;
  gl_Position = projectionMatrix * mv;
  // Nothing of it reaches the screen, so it costs nothing either.
  if (near <= 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const GAS_FS = /* glsl */ `
uniform sampler2D tTile;
varying vec2 vUv;
varying vec2 vT;
varying vec3 vC;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 >= 1.0) discard;
  float f = 1.0 - r2;
  f = f * f;
  vec4 t = texture2D(tTile, vT);
  float a = f * (t.r * 0.86 + t.g * t.g * 0.5);
  gl_FragColor = vec4(vC * a, 0.0);
}`;

const DUST_FS = /* glsl */ `
uniform sampler2D tTile;
varying vec2 vUv;
varying vec2 vT;
varying float vA;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 >= 1.0) discard;
  float f = 1.0 - r2;
  f = f * f;
  vec4 t = texture2D(tTile, vT);
  float a = f * smoothstep(0.3, 0.9, t.g) * vA;
  gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(a, 0.0, 0.8));
}`;

export interface Atmosphere {
  gas: Mesh;
  dust: Mesh;
  scene: Scene;
  target: WebGLRenderTarget;
  setTile(t: Texture): void;
  setRadius(R: number): void;
  update(lum: number, near: number): void;
  setSize(w: number, h: number): void;
  dispose(): void;
}

export function buildAtmosphere(s: Shared, tile: Texture, hdr: boolean): Atmosphere {
  const r = rng(20261104);
  const gauss = gaussFrom(r);
  // Places in the shell where clouds gather: no pattern to it, and no plane.
  const banks = Array.from({ length: s.low ? 9 : 14 }, () => {
    const z = r() * 2 - 1;
    const a = r() * TAU;
    const q = Math.sqrt(1 - z * z);
    const rr = 1.9 + r() * 1.9;
    const hue = r();
    return { x: Math.cos(a) * q * rr, y: z * rr, z: Math.sin(a) * q * rr, hue, spread: 0.26 + r() * 0.4 };
  });
  const G = s.tier === "high" ? 460 : s.tier === "mid" ? 340 : 200;
  const D = s.tier === "high" ? 130 : s.tier === "mid" ? 90 : 50;
  const c = new Color();
  const makeClouds = (n: number, fill: (i: number, p: Float32Array, q: Float32Array, m: Float32Array) => void) => {
    const base = new PlaneGeometry(1, 1);
    const ig = new InstancedBufferGeometry();
    ig.index = base.index;
    ig.setAttribute("position", base.getAttribute("position"));
    ig.instanceCount = n;
    const p = new Float32Array(n * 3);
    const q = new Float32Array(n * 4);
    const m = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) fill(i, p, q, m);
    ig.setAttribute("iPos", new InstancedBufferAttribute(p, 3));
    ig.setAttribute("iCol", new InstancedBufferAttribute(q, 4));
    ig.setAttribute("iMeta", new InstancedBufferAttribute(m, 4));
    return ig;
  };
  const gasGeo = makeClouds(G, (i, p, q, m) => {
    const b = banks[i % banks.length];
    p.set([b.x + gauss() * b.spread, b.y + gauss() * b.spread, b.z + gauss() * b.spread], i * 3);
    const u = (b.hue + r() * 0.3) % 1;
    c.copy(u < 0.66 ? VIOLET : u < 0.86 ? BLUE : u < 0.95 ? CYAN : ROSE);
    const lum = 0.04 + r() * 0.07;
    q.set([c.r * lum, c.g * lum, c.b * lum, 1], i * 4);
    m.set([0.12 + r() * 0.3, r() * TAU, r(), r()], i * 4);
  });
  const dustGeo = makeClouds(D, (i, p, q, m) => {
    const b = banks[i % banks.length];
    p.set([b.x + gauss() * b.spread * 0.8, b.y + gauss() * b.spread * 0.8, b.z + gauss() * b.spread * 0.8], i * 3);
    q.set([0, 0, 0, 0.12 + r() * 0.24], i * 4);
    m.set([0.1 + r() * 0.2, r() * TAU, r(), r()], i * 4);
  });
  const tTile = { value: tile };
  const uLum = { value: 1 };
  const uNear = { value: 200 };
  const shared = { tTile, uLum, uNear, ...lightUniforms(s), ...mapUniforms(s) };
  const gasMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    uniforms: shared,
    vertexShader: CLOUD_VS,
    fragmentShader: GAS_FS,
  });
  const dustMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: ZeroFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    uniforms: shared,
    vertexShader: CLOUD_VS,
    fragmentShader: DUST_FS,
  });
  const gas = new Mesh(gasGeo, gasMat);
  const dust = new Mesh(dustGeo, dustMat);
  gas.frustumCulled = dust.frustumCulled = false;
  gas.matrixAutoUpdate = dust.matrixAutoUpdate = false;
  gas.renderOrder = 0;
  dust.renderOrder = 1;
  const scene = new Scene();
  scene.add(gas, dust);

  // Gas is soft, so a fraction of the screen holds it with nothing lost.
  const target = new WebGLRenderTarget(1, 1, {
    type: hdr ? HalfFloatType : UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  const frac = s.tier === "high" ? 0.5 : s.tier === "mid" ? 0.42 : 0.34;
  const mat = new Matrix4();
  const one = new Vector3();

  return {
    gas,
    dust,
    scene,
    target,
    setTile(t: Texture) {
      tTile.value = t;
    },
    setRadius(R: number) {
      one.setScalar(R);
      mat.makeScale(one.x, one.y, one.z);
      for (const m of [gas, dust]) {
        m.matrix.copy(mat);
        m.matrixWorld.copy(mat);
      }
    },
    update(lum, near) {
      uLum.value = lum;
      uNear.value = near;
    },
    setSize(w, h) {
      target.setSize(Math.max(2, Math.round(w * frac)), Math.max(2, Math.round(h * frac)));
    },
    dispose() {
      gasGeo.dispose();
      dustGeo.dispose();
      gasMat.dispose();
      dustMat.dispose();
      target.dispose();
    },
  };
}
