// The sky: amber dust around one enormous star, black beyond it. The nebula
// is drawn once into a cube map, so it costs almost nothing per frame, and
// the same cube lights the hull through its reflections.

import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CubeCamera,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector3,
  WebGLCubeRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import { rng } from "./util";

/** Where the star is, as a unit direction from anywhere in the world. */
export const SUN_DIR = new Vector3(-0.3, 0.2, -1).normalize();

const NEBULA = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 7; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(17.1, 9.2, 3.7); a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  // Fold the noise twice, so the dust curls instead of blotching.
  vec3 q = vec3(fbm(d * 2.1 + 1.7), fbm(d * 2.1 + vec3(5.2, 1.3, 8.1)), fbm(d * 2.1 + vec3(9.1, 4.4, 2.2)));
  vec3 r = vec3(fbm(d * 2.6 + q * 2.4 + vec3(1.7, 9.2, 0.0)), fbm(d * 2.6 + q * 2.4 + vec3(8.3, 2.8, 4.0)), 0.0);
  float n = fbm(d * 2.2 + r * 2.8);
  float lanes = smoothstep(0.38, 0.86, n);
  float fine = fbm(d * 11.0 + r * 3.0);
  float cosA = clamp(dot(d, uSun), -1.0, 1.0);
  float ang = acos(cosA);
  // Light falls off with the angle from the star, in three scales.
  float near = exp(-ang * 6.2);
  float mid = exp(-ang * 2.1);
  float far = exp(-ang * 0.8);
  vec3 ember = vec3(1.0, 0.42, 0.09);
  vec3 honey = vec3(1.0, 0.62, 0.24);
  vec3 umber = vec3(0.34, 0.14, 0.05);
  vec3 col = umber * (0.012 + 0.16 * lanes * lanes) * far;
  col += ember * mid * mid * (0.02 + 0.5 * lanes * lanes * (0.4 + 0.6 * fine));
  col += honey * near * (0.1 + 1.25 * lanes);
  // Dark lanes cut through the glow.
  float dark = smoothstep(0.42, 0.66, fbm(d * 3.6 + r * 3.4 + vec3(3.0, 7.0, 2.0)));
  col *= mix(1.0, 0.16, dark * (1.0 - near * 0.8));
  // A broad band of far stars and dust across the back of the sky.
  float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.9, 0.2))) * 3.2, 2.0));
  col += vec3(0.20, 0.11, 0.05) * band * (0.08 + 0.3 * lanes) * (1.0 - mid);
  gl_FragColor = vec4(col, 1.0);
}`;

const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const CORONA_VS = /* glsl */ `
uniform float uSize;
varying vec2 vP;
void main() {
  vP = position.xy * 2.0;
  vec3 c = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 p = c + vec3(position.xy * uSize * 2.0, 0.0);
  gl_Position = projectionMatrix * vec4(p, 1.0);
  gl_Position.z = gl_Position.w * 0.99999;
}`;

const CORONA_FS = /* glsl */ `
uniform float uPower; uniform float uTime; uniform float uDisc;
varying vec2 vP;
float h(float x) { return fract(sin(x * 91.17) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }
void main() {
  float r = length(vP);
  float a = atan(vP.y, vP.x);
  float disc = 1.0 - smoothstep(uDisc * 0.97, uDisc * 1.02, r);
  float limb = pow(clamp(1.0 - r / uDisc, 0.0, 1.0), 0.5);
  // Streamers in the corona.
  float s = 0.5 * n1(a * 7.0 + uTime * 0.05) + 0.3 * n1(a * 19.0 - uTime * 0.03) + 0.2 * n1(a * 53.0 + uTime * 0.02);
  float cor = exp(-(r - uDisc) * (11.0 - 6.0 * s)) * step(uDisc, r);
  float halo = exp(-max(r - uDisc, 0.0) * 3.2) * 0.2;
  vec3 c = vec3(1.0, 0.76, 0.46) * disc * (10.0 + 26.0 * limb);
  c += vec3(1.0, 0.5, 0.16) * cor * 3.2;
  c += vec3(1.0, 0.36, 0.1) * halo * 0.7;
  float edge = 1.0 - smoothstep(0.82, 1.0, r);
  gl_FragColor = vec4(c * uPower * edge, 1.0);
}`;

export function buildSky(renderer: WebGLRenderer, opts: { low: boolean; hdr: boolean }) {
  // Bake the nebula.
  const bake = new Scene();
  const bakeMat = new ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: NEBULA, side: BackSide, depthTest: false, depthWrite: false, uniforms: { uSun: { value: SUN_DIR } } });
  bake.add(new Mesh(new SphereGeometry(10, 32, 16), bakeMat));
  const size = opts.low ? 512 : 1024;
  const target = new WebGLCubeRenderTarget(size, {
    type: opts.hdr ? HalfFloatType : UnsignedByteType,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
  });
  const cubeCam = new CubeCamera(0.1, 100, target);
  cubeCam.update(renderer, bake);

  const dome = new Mesh(
    new SphereGeometry(10, 32, 16),
    new ShaderMaterial({
      vertexShader: SKY_VS,
      fragmentShader: /* glsl */ `
        uniform samplerCube tCube; uniform float uBright; varying vec3 vDir;
        void main() { gl_FragColor = vec4(textureCube(tCube, vDir).rgb * uBright, 1.0); }`,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      uniforms: { tCube: { value: target.texture }, uBright: { value: 1 } },
    }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -100;

  // The lit environment for the hull: the nebula plus the star itself.
  const envScene = new Scene();
  const envSphere = new Mesh(new SphereGeometry(10, 32, 16), new ShaderMaterial({
    vertexShader: SKY_VS,
    fragmentShader: /* glsl */ `
      uniform samplerCube tCube; uniform vec3 uSun; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float a = acos(clamp(dot(d, uSun), -1.0, 1.0));
        vec3 c = textureCube(tCube, d).rgb * 2.2 + vec3(1.0, 0.54, 0.22) * 5.0 * exp(-a * 6.0) + vec3(0.26, 0.24, 0.24) * 0.32;
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    uniforms: { tCube: { value: target.texture }, uSun: { value: SUN_DIR } },
  }));
  envScene.add(envSphere);
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0, 0.1, 100);
  pmrem.dispose();
  envSphere.geometry.dispose();
  (envSphere.material as ShaderMaterial).dispose();

  // Stars, and the star.
  const N = opts.low ? 1800 : 5200;
  const r = rng(913);
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const sz = new Float32Array(N);
  const v = new Vector3();
  const c = new Color();
  for (let i = 0; i < N; i++) {
    v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    pos.set([v.x, v.y, v.z], i * 3);
    const m = r();
    const warm = r();
    c.setRGB(1, 0.62 + warm * 0.34, 0.34 + warm * 0.56);
    const k = 0.5 + m * m * m * 5.5;
    col.set([c.r * k, c.g * k, c.b * k], i * 3);
    sz[i] = 0.7 + Math.pow(m, 6) * 3.4;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aColor", new BufferAttribute(col, 3));
  g.setAttribute("aSize", new BufferAttribute(sz, 1));
  const starMat = new ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; uniform float uPx; varying vec3 vC;
      void main() {
        vC = aColor;
        vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position * 10.0, 1.0);
        gl_Position = p.xyww;
        gl_PointSize = aSize * uPx;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.05, length(q));
        gl_FragColor = vec4(vC * a, 1.0);
      }`,
    blending: AdditiveBlending,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    uniforms: { uPx: { value: 1 } },
  });
  const stars = new Points(g, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -99;
  // Sits at the very back, so anything in front of it covers it.

  const coronaMat = new ShaderMaterial({
    vertexShader: CORONA_VS,
    fragmentShader: CORONA_FS,
    blending: AdditiveBlending,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    uniforms: { uSize: { value: 1 }, uPower: { value: 1 }, uTime: { value: 0 }, uDisc: { value: 0.14 } },
  });
  const corona = new Mesh(new PlaneGeometry(1, 1), coronaMat);
  corona.frustumCulled = false;
  corona.renderOrder = -98;

  const domeMat = dome.material as ShaderMaterial;
  return {
    dome,
    stars,
    corona,
    env: env.texture as Texture,
    /** Keep the sky around the camera. `grow` scales the star; `bright` the dust. */
    update(camPos: Vector3, time: number, grow: number, bright: number, dpr: number) {
      dome.position.copy(camPos);
      stars.position.copy(camPos);
      corona.position.copy(camPos).addScaledVector(SUN_DIR, 12000);
      coronaMat.uniforms.uSize.value = 5400 * grow;
      coronaMat.uniforms.uTime.value = time;
      coronaMat.uniforms.uPower.value = bright;
      domeMat.uniforms.uBright.value = bright;
      starMat.uniforms.uPx.value = dpr;
    },
    dispose() {
      target.dispose();
      env.dispose();
      dome.geometry.dispose();
      domeMat.dispose();
      bakeMat.dispose();
      coronaMat.dispose();
      corona.geometry.dispose();
      g.dispose();
      starMat.dispose();
    },
  };
}
export type Sky = ReturnType<typeof buildSky>;
