// The star everything orbits: the platform the projects run on. It is a blue
// giant (Projects is the blue tab) with 45 loops of plasma standing on its face,
// one per live service, and a thin ring of 14 knots around it, one per cloud
// project. The numbers come from the site's Hybridge Platform entry.

import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NOISE, fibSphere, glow, rng, tor, type Part, type Shared } from "./toolkit";

export const STAR_R = 30;

export function buildStar(shared: Shared) {
  const group = new Group();
  const uHeat = { value: 0 };

  // the face: boiling granules, dark at the limb
  const faceMat = new ShaderMaterial({
    uniforms: { uTime: shared.time, uHeat },
    vertexShader: /* glsl */ `
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() {
  vP = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
${NOISE}
uniform float uTime; uniform float uHeat;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() {
  vec3 d = normalize(vP);
  float t = uTime * 0.035;
  vec3 warp = vec3(fbm3(d * 3.0 + t), fbm3(d * 3.0 + 7.0 - t), fbm3(d * 3.0 + 13.0 + t * 0.5));
  float g = fbm5(d * 7.0 + warp * 2.4 + vec3(0.0, t * 1.5, 0.0));
  float fine = fbm3(d * 34.0 + warp * 5.0 - t * 2.0);
  float nv = max(dot(normalize(vN), normalize(vV)), 0.0);
  float limb = pow(nv, 0.42);
  vec3 hot = vec3(2.9, 3.7, 5.6);
  vec3 cool = vec3(0.42, 0.86, 2.3);
  vec3 c = mix(cool, hot, smoothstep(0.3, 0.72, g));
  c *= 0.76 + fine * 0.62;
  c *= limb;
  c += vec3(0.8, 1.2, 2.3) * pow(1.0 - nv, 3.0);
  c *= 1.0 + uHeat * 0.45;
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const face = new Mesh(new SphereGeometry(STAR_R, 64, 44), faceMat);
  group.add(face);

  // the corona: a shell with long streamers, facing the camera
  const coronaMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uTime: shared.time, uHeat },
    vertexShader: /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy * 2.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sc = length(modelMatrix[0].xyz);
  mv.xy += position.xy * sc;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
${NOISE}
uniform float uTime; uniform float uHeat;
varying vec2 vP;
void main() {
  float r = length(vP);
  if (r > 1.0) discard;
  float a = atan(vP.y, vP.x);
  float inner = 0.1579; // the star's edge, in units of this quad
  float x = max(r - inner, 0.0) / (1.0 - inner);
  vec3 q = vec3(cos(a) * 2.6, sin(a) * 2.6, uTime * 0.04);
  float streak = fbm5(q + vec3(0.0, 0.0, x * 0.6));
  float fine = fbm3(vec3(cos(a) * 9.0, sin(a) * 9.0, uTime * 0.07));
  float s = smoothstep(0.28, 0.78, streak) * 0.75 + smoothstep(0.36, 0.76, fine) * 0.32;
  float fall = exp(-x * (12.0 - s * 8.0));
  vec3 c = mix(vec3(0.62, 1.05, 2.3), vec3(0.06, 0.13, 0.42), smoothstep(0.0, 0.4, x)) * fall;
  c *= smoothstep(1.0, 0.72, r);
  c *= 0.8 + uHeat * 0.5;
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const corona = new Mesh(new PlaneGeometry(1, 1), coronaMat);
  corona.scale.setScalar((STAR_R / 0.1579) * 2);
  corona.frustumCulled = false;
  group.add(corona);
  group.add(glow("#5f8fff", STAR_R * 10, { intensity: 0.022, power: 3.4 }));
  group.add(glow("#a8c6ff", STAR_R * 3.4, { intensity: 0.07, power: 2.8 }));

  // 45 loops of plasma, one per live service
  const r = rng(45);
  const loops: BufferGeometry[] = [];
  for (let i = 0; i < 45; i++) {
    const base = fibSphere(i, 45, new Vector3());
    const tangent = new Vector3(r() - 0.5, r() - 0.5, r() - 0.5).cross(base).normalize();
    const span = 3.2 + r() * 6.5;
    const lift = 3.2 + r() * 8.5;
    const a = base.clone().multiplyScalar(STAR_R * 0.985).addScaledVector(tangent, -span);
    const b = base.clone().multiplyScalar(STAR_R * 0.985).addScaledVector(tangent, span);
    const m1 = base.clone().multiplyScalar(STAR_R + lift).addScaledVector(tangent, -span * 0.72);
    const m2 = base.clone().multiplyScalar(STAR_R + lift * 1.1).addScaledVector(tangent, span * 0.1 * (r() - 0.5));
    const m3 = base.clone().multiplyScalar(STAR_R + lift).addScaledVector(tangent, span * 0.72);
    const curve = new CatmullRomCurve3([a, m1, m2, m3, b]);
    const tube = new TubeGeometry(curve, 20, 0.2 + r() * 0.22, 5, false);
    const n = tube.getAttribute("position").count;
    const uv = tube.getAttribute("uv");
    const arr = new Float32Array(n * 2);
    const seed = r();
    for (let k = 0; k < n; k++) {
      arr[k * 2] = uv.getX(k);
      arr[k * 2 + 1] = seed;
    }
    tube.setAttribute("aLoop", new BufferAttribute(arr, 2));
    for (const key of Object.keys(tube.attributes)) if (key !== "position" && key !== "aLoop") tube.deleteAttribute(key);
    loops.push(tube);
  }
  const loopGeo = mergeGeometries(loops, false)!;
  const loopMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: shared.time, uHeat },
    vertexShader: /* glsl */ `
attribute vec2 aLoop;
varying vec2 vL;
void main() { vL = aLoop; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
uniform float uTime; uniform float uHeat;
varying vec2 vL;
void main() {
  float flow = 0.5 + 0.5 * sin(vL.x * 18.0 - uTime * (1.2 + vL.y * 2.4) + vL.y * 40.0);
  float pulse = 0.6 + 0.4 * sin(uTime * 0.6 + vL.y * 30.0);
  vec3 c = mix(vec3(0.4, 0.8, 2.2), vec3(2.6, 3.2, 4.6), flow * flow);
  c *= pulse * (1.25 + uHeat * 1.4) * smoothstep(0.0, 0.08, vL.x) * smoothstep(1.0, 0.92, vL.x);
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const loopMesh = new Mesh(loopGeo, loopMat);
  loopMesh.frustumCulled = false;
  group.add(loopMesh);

  // a thin ring with 14 knots, one per cloud project
  const ring = new Group();
  ring.rotation.set(0.24, 0, -0.14);
  const ringMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uHeat },
    vertexShader: /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uHeat; void main() { gl_FragColor = vec4(vec3(0.6, 0.86, 1.8) * (0.55 + uHeat * 1.2), 1.0); }`,
  });
  const ringMesh = new Mesh(tor(STAR_R * 1.9, 0.09, 4, 180).rotateX(Math.PI / 2), ringMat);
  ring.add(ringMesh);
  const knots: Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const k = glow("#cfe2ff", 7.5, { intensity: 2.2, power: 2.4 });
    k.position.set(Math.cos(a) * STAR_R * 1.9, 0, Math.sin(a) * STAR_R * 1.9);
    ring.add(k);
    knots.push(k);
  }
  group.add(ring);

  const parts: Part[] = [{ key: "services", at: new Vector3(STAR_R * 0.7, STAR_R * 0.7, 0), r: STAR_R }];
  // the system's only light; a back side shell keeps depth clean behind the corona
  const backShell = new Mesh(new SphereGeometry(STAR_R * 1.02, 24, 16), new ShaderMaterial({ side: BackSide, colorWrite: false, depthWrite: false, vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}", fragmentShader: "void main(){gl_FragColor=vec4(0.0);}" }));
  backShell.visible = false;
  group.add(backShell);

  return {
    group,
    parts,
    color: new Color("#a6c6ff"),
    setHeat(v: number) {
      uHeat.value = v;
    },
    update(t: number) {
      ring.rotation.y = t * 0.012;
      loopMesh.rotation.y = t * 0.004;
    },
  };
}
