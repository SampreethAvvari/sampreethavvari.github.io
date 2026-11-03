// Exhaust: thrust plume cones for any set of nozzles in one draw call, and
// the shaders for plumes and ion trails.

import { BufferAttribute, BufferGeometry, type Vector3 } from "three";
import { NOISE } from "./glsl";

export interface Nozzle {
  o: Vector3;
  d: Vector3;
  r: number;
  kind: number; // 0 main, 1 brake, 2+ attitude thruster index
}


export const PLUME_VS = /* glsl */ `
attribute vec3 aOrigin;
attribute vec3 aDir;
attribute vec4 aParams; // radius, layer, seed, kind
uniform float uLen;
uniform float uIntensity;
uniform float uBrake;
uniform float uRcs[8];
varying float vAlong;
varying float vLayer;
varying float vSeed;
varying float vInt;
varying vec3 vN;
varying vec3 vV;
void main() {
  float a = position.z;
  float layer = aParams.y;
  float kind = aParams.w;
  float inner = 1.0 - step(0.5, layer);
  float len;
  float inten;
  if (kind < 0.5) {
    len = uLen;
    inten = uIntensity;
  } else if (kind < 1.5) {
    len = uBrake * 3.2;
    inten = uBrake * 2.2;
  } else {
    int idx = int(kind - 2.0 + 0.5);
    float r = 0.0;
    for (int i = 0; i < 8; i++) { if (i == idx) r = uRcs[i]; }
    len = r * 1.5;
    inten = r * 2.4;
  }
  float w = aParams.x * mix(1.05, 0.5, inner);
  float prof = inner > 0.5 ? (1.0 - a * 0.92) : (1.0 + 0.22 * sin(a * 3.1416)) * (1.0 - a * 0.8);
  len *= mix(1.0, 0.45, inner) * (0.9 + 0.2 * fract(aParams.z * 7.0));
  vec3 d = normalize(aDir);
  vec3 t1 = normalize(cross(d, abs(d.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 t2 = cross(d, t1);
  vec3 side = t1 * position.x + t2 * position.y;
  vec3 p = aOrigin + side * w * prof + d * a * len;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * (side + d * 0.15));
  vV = normalize(-mv.xyz);
  vAlong = a;
  vLayer = layer;
  vSeed = aParams.z;
  vInt = inten;
  gl_Position = projectionMatrix * mv;
}
`;

export const PLUME_FS = /* glsl */ `
#define OCTAVES 1
${NOISE}
uniform vec3 uColor;
uniform float uTime;
varying float vAlong;
varying float vLayer;
varying float vSeed;
varying float vInt;
varying vec3 vN;
varying vec3 vV;
void main() {
  if (vInt <= 0.001) discard;
  float inner = 1.0 - step(0.5, vLayer);
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float core = pow(facing, mix(1.4, 2.6, inner));
  float fade = pow(max(1.0 - vAlong, 0.0), mix(1.5, 2.4, inner)) * smoothstep(0.0, 0.04, vAlong);
  float n = vnoise(vec3(vAlong * 7.0 - uTime * 16.0, vSeed * 13.0, uTime * 4.0));
  float diamonds = 0.72 + 0.28 * sin(vAlong * 42.0 - uTime * 30.0);
  vec3 col = mix(uColor, vec3(1.0, 0.97, 0.94), inner * 0.8 + 0.15);
  float a = core * fade * (0.62 + 0.55 * n) * mix(0.92, diamonds, inner);
  gl_FragColor = vec4(col * a * vInt * mix(0.32, 1.25, inner), 1.0);
}
`;

export const TRAIL_VS = /* glsl */ `
attribute vec2 aUv;
varying vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const TRAIL_FS = /* glsl */ `
#define OCTAVES 1
${NOISE}
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying vec2 vUv;
void main() {
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float along = vUv.x;
  float flow = 0.55 + 0.45 * vnoise(vec3(along * 9.0 - uTime * 3.0, vUv.y * 2.0, uTime * 0.7));
  float a = pow(max(across, 0.0), 2.2) * pow(max(1.0 - along, 0.0), 1.6) * smoothstep(0.0, 0.05, along) * flow;
  gl_FragColor = vec4(uColor * a * uIntensity, 1.0);
}
`;


/** Cone shells for every nozzle: position.xy is the unit circle, position.z runs 0..1 along the plume. */
export function buildPlumes(nozzles: Nozzle[], radial: number, along: number): BufferGeometry {
  const layers = 2;
  const perCone = (radial + 1) * (along + 1);
  const total = nozzles.length * layers * perCone;
  const pos = new Float32Array(total * 3);
  const origin = new Float32Array(total * 3);
  const dir = new Float32Array(total * 3);
  const params = new Float32Array(total * 4);
  const idx: number[] = [];
  let v = 0;
  nozzles.forEach((n, ni) => {
    for (let l = 0; l < layers; l++) {
      const base = v;
      for (let i = 0; i <= along; i++) {
        const a = Math.pow(i / along, 1.4);
        for (let j = 0; j <= radial; j++) {
          const th = (j / radial) * Math.PI * 2;
          pos.set([Math.cos(th), Math.sin(th), a], v * 3);
          origin.set([n.o.x, n.o.y, n.o.z], v * 3);
          dir.set([n.d.x, n.d.y, n.d.z], v * 3);
          params.set([n.r, l, ni * 0.137 + 0.05, n.kind], v * 4);
          v++;
        }
      }
      for (let i = 0; i < along; i++) {
        for (let j = 0; j < radial; j++) {
          const A = base + i * (radial + 1) + j;
          const C = A + radial + 1;
          idx.push(A, C, A + 1, A + 1, C, C + 1);
        }
      }
    }
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aOrigin", new BufferAttribute(origin, 3));
  g.setAttribute("aDir", new BufferAttribute(dir, 3));
  g.setAttribute("aParams", new BufferAttribute(params, 4));
  g.setIndex(idx);
  return g;
}
