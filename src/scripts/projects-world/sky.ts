// The sky. A nebula is painted once into a cube (so it costs nothing per frame
// and every metal surface can reflect it), real points carry the sharp stars,
// and a box of dust travels with the camera so speed has something to streak.

import {
  type Camera,
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CubeCamera,
  DoubleSide,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLCubeRenderTarget,
  type WebGLRenderer,
} from "three";
import { breathe, prelink } from "../gl-warm";
import { NOISE, rng, type Shared, type U } from "./toolkit";

const NEBULA_FS = /* glsl */ `
${NOISE}
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  // the galaxy's plane, tipped against the system's
  vec3 axis = normalize(vec3(0.34, 0.86, -0.38));
  float lat = dot(d, axis);
  float bandMask = exp(-lat * lat * 7.5);
  vec3 q = d * 2.1;
  vec3 warp = vec3(fbm5(q + vec3(3.1, 1.3, 7.7)), fbm5(q + vec3(9.2, 5.1, 2.8)), fbm5(q + vec3(1.7, 8.3, 4.6)));
  float n = fbm5(q + warp * 1.9);
  float n2 = fbm5(q * 2.3 + warp * 2.6 + 11.0);
  float gas = smoothstep(0.34, 0.86, n);
  float lanes = smoothstep(0.42, 0.62, n2);
  vec3 deep = vec3(0.0035, 0.005, 0.014);
  vec3 indigo = vec3(0.028, 0.045, 0.13);
  vec3 magenta = vec3(0.125, 0.03, 0.115);
  vec3 teal = vec3(0.012, 0.09, 0.105);
  vec3 ember = vec3(0.17, 0.065, 0.028);
  vec3 c = deep;
  c += indigo * gas * (0.5 + bandMask * 1.5);
  c = mix(c, c + magenta * 1.3, smoothstep(0.42, 0.78, warp.x) * gas * (0.25 + bandMask));
  c = mix(c, c + teal * 1.1, smoothstep(0.46, 0.76, warp.y) * gas * 0.8);
  // dust lanes darken the bright band, warm at their edges
  c += ember * bandMask * bandMask * smoothstep(0.5, 0.66, n) * (1.0 - lanes) * 0.8;
  c *= mix(1.0, 0.25 + 0.75 * lanes, bandMask * 0.9);
    c += vec3(0.08, 0.1, 0.16) * bandMask * bandMask * 0.32 * (0.55 + 0.45 * lanes);
  gl_FragColor = vec4(c * 0.42, 1.0);
}`;

/** Paint the sky into a cube once. */
export async function bakeSky(renderer: WebGLRenderer, low: boolean): Promise<WebGLCubeRenderTarget> {
  const size = low ? 512 : 1024;
  const rt = new WebGLCubeRenderTarget(size, {
    type: HalfFloatType,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
  });
  const scene = new Scene();
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NEBULA_FS,
  });
  const mesh = new Mesh(new SphereGeometry(50, 48, 32), mat);
  scene.add(mesh);
  const cam = new CubeCamera(1, 100, rt);
  // The nebula is a long shader: it links in the background before it is used.
  await prelink(renderer, scene, cam.children[0] as Camera, rt);
  await breathe();
  cam.update(renderer, scene);
  mesh.geometry.dispose();
  mat.dispose();
  return rt;
}

/** The sharp stars. A shell that stays centred on the camera. */
export function starField(shared: Shared, px: U<number>): Points {
  const n = shared.low ? 2600 : 5200;
  const r = rng(77);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const mag = new Float32Array(n);
  const axis = new Vector3(0.34, 0.86, -0.38).normalize();
  const v = new Vector3();
  const c = new Color();
  for (let i = 0; i < n; i++) {
    // half of them crowd the galaxy's band
    let tries = 0;
    do {
      const z = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const q = Math.sqrt(1 - z * z);
      v.set(Math.cos(a) * q, z, Math.sin(a) * q);
      tries++;
    } while (tries < 4 && r() > 0.32 + Math.exp(-Math.pow(v.dot(axis), 2) * 9));
    pos.set([v.x * 3000, v.y * 3000, v.z * 3000], i * 3);
    const m = r();
    mag[i] = Math.pow(m, 9) * 2.8 + 0.16 + r() * 0.34;
    const temp = r();
    c.setHSL(temp < 0.28 ? 0.07 + r() * 0.05 : 0.58 + r() * 0.05, 0.2 + r() * 0.5, 0.82);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aCol", new BufferAttribute(col, 3));
  g.setAttribute("aMag", new BufferAttribute(mag, 1));
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: shared.time, uPr: px },
    vertexShader: /* glsl */ `
attribute vec3 aCol; attribute float aMag;
uniform float uTime; uniform float uPr;
varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.86 + 0.14 * sin(uTime * (1.0 + aMag) + position.x * 0.05);
  gl_PointSize = clamp((0.8 + aMag * 0.62) * uPr, 1.0, 4.0);
  vC = aCol * min(aMag, 1.8) * tw * 0.62;
}`,
    fragmentShader: /* glsl */ `
varying vec3 vC;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float f = pow(max(1.0 - r, 0.0), 1.8);
  gl_FragColor = vec4(vC * f, 1.0);
}`,
  });
  const p = new Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = -10;
  return p;
}

/** Dust around the camera: nearly still at rest, long streaks at speed. */
export function dustBox(shared: Shared) {
  const n = shared.low ? 260 : 620;
  const r = rng(5);
  const base = new PlaneGeometry(1, 1);
  base.translate(0, 0.5, 0);
  const geo = new InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.instanceCount = n;
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) a.set([r(), r(), r(), r()], i * 4);
  geo.setAttribute("aP", new InstancedBufferAttribute(a, 4));
  const uCam = { value: new Vector3() };
  const uVel = { value: new Vector3() };
  const uBox = { value: 90 };
  const uTint = { value: new Color(0.62, 0.76, 1) };
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: { uCam, uVel, uBox, uTint },
    vertexShader: /* glsl */ `
attribute vec4 aP;
uniform vec3 uCam; uniform vec3 uVel; uniform float uBox;
varying float vX; varying float vF; varying float vT;
void main() {
  vec3 rel = mod(aP.xyz * uBox - uCam, uBox) - uBox * 0.5;
  vec3 a = uCam + rel;
  vec3 b = a - uVel * (0.5 + aP.w * 0.9);
  float t = position.y;
  vec3 c = mix(a, b, t);
  vec3 dir = b - a;
  float len = length(dir);
  vec3 toCam = cameraPosition - c;
  vec3 side = len > 0.001 ? normalize(cross(dir, toCam)) : normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  float dist = length(rel);
  float w = 0.012 + dist * 0.0009;
  c += side * position.x * w * 2.0;
  if (len < 0.02) c += normalize(cross(side, toCam)) * (t - 0.5) * w * 2.0;
  vX = position.x * 2.0;
  vT = t;
  // nothing right at the lens, nothing at the far edge of the box
  vF = smoothstep(2.0, 8.0, dist) * smoothstep(uBox * 0.5, uBox * 0.3, dist) * (0.14 + 0.5 * aP.w * aP.w);
  gl_Position = projectionMatrix * viewMatrix * vec4(c, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uTint;
varying float vX; varying float vF; varying float vT;
void main() {
  float k = 1.0 - abs(vX);
  gl_FragColor = vec4(uTint * k * k * vF * (1.0 - vT * 0.8) * 1.3, 1.0);
}`,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, uCam, uVel };
}
