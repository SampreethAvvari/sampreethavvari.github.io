// The far sky and the tile of gas. A nebula in the Mind tab's violet is painted
// once into a cube, one face at a time, so it costs nothing per frame. A tile of
// warped noise is painted once too: every cloud samples it, which is what turns soft
// blobs into wisps. Both are only ever seen outside the map: where the map is, the
// backdrop is dark.

import {
  BackSide,
  CubeCamera,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderTarget,
  BufferGeometry,
  BufferAttribute,
  Camera,
  NoBlending,
  type Color,
  type WebGLRenderer,
} from "three";
import { breathe, prelink } from "../gl-warm";
import { NOISE, OUTSIDE_MAP, type U } from "./glsl";

const NEBULA_FS = /* glsl */ `
${NOISE}
uniform float uEncode;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 axis = normalize(vec3(-0.28, 0.88, 0.38));
  float lat = dot(d, axis);
  float band = exp(-lat * lat * 5.2);
  vec3 q = d * 1.9;
  vec3 warp = vec3(fbm5(q + vec3(3.1, 1.3, 7.7)), fbm5(q + vec3(9.2, 5.1, 2.8)), fbm5(q + vec3(1.7, 8.3, 4.6)));
  float n = fbm5(q + warp * 2.3);
  float n2 = fbm5(q * 2.5 + warp * 3.1 + 11.0);
  float gas = smoothstep(0.36, 0.86, n);
  float lanes = smoothstep(0.40, 0.63, n2);
  vec3 c = vec3(0.0024, 0.0028, 0.0092);
  // the tab's violet carries the sky
  c += vec3(0.052, 0.026, 0.142) * gas * (0.42 + band * 1.5);
  // a few colder and warmer pockets, so it is not one flat wash
  c += vec3(0.125, 0.018, 0.078) * smoothstep(0.46, 0.80, warp.x) * gas * (0.2 + band * 0.9);
  c += vec3(0.008, 0.058, 0.09) * smoothstep(0.48, 0.78, warp.y) * gas * 0.72;
  c += vec3(0.014, 0.03, 0.098) * (1.0 - gas) * band * 0.55;
  c *= mix(1.0, 0.3 + 0.7 * lanes, band * 0.86);
  c = c * 0.62;
  gl_FragColor = vec4(mix(c, sqrt(c), uEncode), 1.0);
}`;

const TILE_FS = /* glsl */ `
${NOISE}
varying vec2 vUv;
// A tile: the same noise on a torus, so clouds can sample anywhere in it.
vec3 torus(vec2 uv, float r) {
  float a = uv.x * 6.2831853;
  float b = uv.y * 6.2831853;
  return vec3(cos(a), sin(a), 0.0) * r + vec3(0.0, 0.0, 0.0) + vec3(cos(b), 0.0, sin(b)) * r * 0.62;
}
void main() {
  vec3 p = torus(vUv, 2.1);
  vec3 w = vec3(fbm5(p + 3.1), fbm5(p + 7.7), fbm5(p + 1.3));
  float n = fbm5(p + w * 2.8);
  float m = fbm5(p * 1.9 + w * 3.4 + 5.0);
  gl_FragColor = vec4(smoothstep(0.22, 0.78, n), smoothstep(0.26, 0.74, m), n, 1.0);
}`;

export interface SkyBake {
  cube: WebGLCubeRenderTarget;
  tile: WebGLRenderTarget;
  encoded: boolean;
  dispose(): void;
}

/** Paint the sky and the gas tile. Each face gets a turn of its own, so no single frame carries them. */
export async function bakeSky(renderer: WebGLRenderer, opts: { tier: "high" | "mid" | "low"; hdr: boolean; noise: unknown; stopped: () => boolean }): Promise<SkyBake> {
  const size = opts.tier === "high" ? 512 : opts.tier === "mid" ? 384 : 256;
  const encoded = !opts.hdr;
  const cube = new WebGLCubeRenderTarget(size, {
    type: opts.hdr ? HalfFloatType : UnsignedByteType,
    generateMipmaps: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  const scene = new Scene();
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: { uEncode: { value: encoded ? 1 : 0 }, uNoise: { value: opts.noise } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NEBULA_FS,
  });
  const sphere = new SphereGeometry(50, 32, 20);
  scene.add(new Mesh(sphere, mat));
  const cubeCam = new CubeCamera(1, 100, cube);
  cubeCam.coordinateSystem = renderer.coordinateSystem;
  cubeCam.updateCoordinateSystem();
  cubeCam.updateMatrixWorld();
  await prelink(renderer, scene, cubeCam.children[0] as PerspectiveCamera, cube);
  const was = renderer.getRenderTarget();
  for (let f = 0; f < 6; f++) {
    if (opts.stopped()) break;
    await breathe();
    if (opts.stopped()) break;
    renderer.setRenderTarget(cube, f);
    renderer.render(scene, cubeCam.children[f] as PerspectiveCamera);
  }
  renderer.setRenderTarget(was);
  sphere.dispose();
  mat.dispose();

  // the gas tile
  const tile = new WebGLRenderTarget(256, 256, {
    type: UnsignedByteType,
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    wrapS: RepeatWrapping,
    wrapT: RepeatWrapping,
  });
  const tileGeo = new BufferGeometry();
  tileGeo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  tileGeo.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const tileMat = new ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    blending: NoBlending,
    uniforms: { uNoise: { value: opts.noise } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: TILE_FS,
  });
  const tileMesh = new Mesh(tileGeo, tileMat);
  tileMesh.frustumCulled = false;
  const tileCam = new Camera();
  await prelink(renderer, tileMesh, tileCam, tile);
  if (!opts.stopped()) {
    renderer.setRenderTarget(tile);
    renderer.render(tileMesh, tileCam);
    renderer.setRenderTarget(was);
  }
  tileGeo.dispose();
  tileMat.dispose();

  return {
    cube,
    tile,
    encoded,
    dispose() {
      cube.dispose();
      tile.dispose();
    },
  };
}

export interface BackdropU {
  tSky: U<unknown>;
  tAtmo: U<unknown>;
  uRight: U<Vector3>;
  uUp: U<Vector3>;
  uBack: U<Vector3>;
  /** Half the screen over the focal length, and the shift of the principal point. */
  uHalf: U<Vector2>;
  uShift: U<Vector2>;
  uSkyLum: U<number>;
  uTint: U<Color>;
  uTintAmt: U<number>;
  uDecode: U<number>;
  uMapDir: U<Vector3>;
  uMapA: U<number>;
  uMapFade: U<number>;
}

/** The first thing drawn: the painted sky with the gas laid over it, dark wherever the map is. */
export function makeBackdrop(u: BackdropU): Mesh {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    uniforms: u as unknown as Record<string, { value: unknown }>,
    vertexShader: /* glsl */ `
uniform vec3 uRight; uniform vec3 uUp; uniform vec3 uBack;
uniform vec2 uHalf; uniform vec2 uShift;
varying vec3 vDir;
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  vec2 p = position.xy * uHalf - uShift;
  vDir = uRight * p.x + uUp * p.y - uBack;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform samplerCube tSky;
uniform sampler2D tAtmo;
uniform float uSkyLum;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uDecode;
${OUTSIDE_MAP}
varying vec3 vDir;
varying vec2 vUv;
void main() {
  // The promise: wherever the map is, whatever the camera does, this is dark.
  float clear = outsideMap(normalize(vDir), 0.0);
  vec3 dark = vec3(0.0016, 0.0017, 0.0042);
  if (clear <= 0.0) {
    gl_FragColor = vec4(dark, 1.0);
    return;
  }
  vec3 s = textureCube(tSky, vDir).rgb;
  s = mix(s, s * s, uDecode);
  float y = dot(s, vec3(0.3333));
  s = mix(s, uTint * y * 1.6, uTintAmt) * uSkyLum;
  vec4 a = texture2D(tAtmo, vUv);
  gl_FragColor = vec4(dark + (s * a.a + a.rgb) * clear, 1.0);
}`,
  });
  const m = new Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -100;
  return m;
}

