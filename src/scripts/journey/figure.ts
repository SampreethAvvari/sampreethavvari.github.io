// The astronaut: one real figure in the world, so he stands on what he stands on.
// Everything he does is read from where the scroll is and which way it is going,
// never from a clock, so any position in either direction has one correct pose.
//
// Going on, he comes out of the hatch, down the ramp one tread at a time and stops
// on the sand. Further out on the plain he takes his helmet off, walks to the sapling
// and kneels. Coming back he does not play that backwards: he turns round through a
// real turn, stepping as he goes, walks back the way he came, and puts the helmet on
// by a different path.
//
// Each foot is set down at a fixed point and stays there until it lifts; the legs are
// solved to reach those points. How far he has walked is a position, so the feet can
// never slide, whatever the scroll does. A foot that moves is off the ground.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { WALK_ON, WALK_OUT } from "./plan";

/** His height in world units. The lander's legs stand 0.93 and its door 0.86 clear. */
export const FIGURE_H = 0.78;

// The ramp as the lander holds it open: the pivot, its slope, and the treads on it.
const PIVOT_Y = 0.91;
const PIVOT_Z = 1.82;
const RAMP_COS = 0.35;
const RAMP_SIN = 0.937;
const TREAD_FIRST = 0.12;
const TREAD_GAP = 0.2;
const TREAD_TOP = 0.05;
const RAMP_PITCH = Math.atan2(RAMP_COS, RAMP_SIN);
const RAMP_END_Z = PIVOT_Z + 2.6 * RAMP_SIN;

/** A point on the top of tread k, in the world. */
const tread = (k: number) => {
  const ly = TREAD_FIRST + TREAD_GAP * k;
  return { y: PIVOT_Y - RAMP_COS * ly + RAMP_SIN * TREAD_TOP, z: PIVOT_Z + RAMP_SIN * ly + RAMP_COS * TREAD_TOP };
};

// Proportions, all from the same scale: soles at 0, helmet top at FIGURE_H.
const ANKLE = 0.045;
const THIGH = 0.18;
const SHIN = 0.18;
const HIP_W = 0.055;
const HIP_STAND = 0.392;
const ARM_UP = 0.155;
const ARM_FORE = 0.16;

interface Foot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const seg = (x: number, a: number, b: number) => clamp((x - a) / (b - a), 0, 1);
/** Smooth from a to b; a may be above b. */
const ss = (x: number, a: number, b: number) => smooth(seg(x, a, b));
/** A soft minimum: the body settles under what the legs can reach without a kink. */
const smin = (a: number, b: number, k: number) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
};
const wrap = (a: number) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;

const blobVS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const blobFS = /* glsl */ `
  uniform float uOp;
  uniform float uPrint;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float a = pow(max(1.0 - r, 0.0), 1.4);
    // A boot print: pressed in, with a faint lip of sand around it.
    float lip = smoothstep(0.55, 0.8, r) * smoothstep(1.0, 0.8, r);
    vec3 col = mix(vec3(0.012, 0.007, 0.005), vec3(0.09, 0.05, 0.025), lip * uPrint);
    gl_FragColor = vec4(col, a * uOp);
  }
`;

// A small soft sprite that always faces the camera: the breath out of the seal, the glint on the visor.
const spotVS = /* glsl */ `
  uniform vec3 uAt;
  uniform float uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0;
    vec4 mv = modelViewMatrix * vec4(uAt, 1.0);
    mv.xy += position.xy * uSize * 2.0;
    gl_Position = projectionMatrix * mv;
  }
`;
const glintFS = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float a = exp(-r * r * 26.0) + 0.5 * exp(-abs(vUv.y) * 34.0) * exp(-abs(vUv.x) * 3.2) + 0.5 * exp(-abs(vUv.x) * 34.0) * exp(-abs(vUv.y) * 3.2);
    gl_FragColor = vec4(uColor * a * smoothstep(1.0, 0.6, r), 1.0);
  }
`;
const breathFS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOp;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float a = pow(max(1.0 - r, 0.0), 1.8) * uOp;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** What he is doing, this frame. Everything here comes from the scroll, the turn blend and the pointer. */
export interface FigureFrame {
  /** 0 out of the lander, 1 across the plain to the sapling. */
  walk: 0 | 1;
  /** Into that walk, in its own measure: distance covered, not time. */
  t: number;
  /** 0 as he walked it, 1 turned round to go back. In between he is stepping round. */
  back: number;
  /** How far round that turn takes him, in radians. */
  turnBy: number;
  /** Helmet: 0 on, 1 off and under his arm. */
  helm: number;
  /** 0 the way he takes it off, 1 the way he puts it on. */
  helmBack: number;
  /** 0 standing, 1 down on one knee. */
  kneel: number;
  /** 0 arm at his side, 1 reaching for reachAt. */
  reach: number;
  reachAt: Vector3;
  /** A point in the world he looks toward, and how much. */
  lookAt: Vector3;
  lookW: number;
  time: number;
  dt: number;
  reduced: boolean;
  rim: Color;
  /** Wind across his hair, 0..1. */
  gust: number;
  /** The wrist lamp: its colour, and where it is in view space. */
  lampCol: Color;
  lampView: Vector3;
}

interface HelmetPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  tilt: number;
  /** 1 sitting on his shoulders. */
  worn: number;
  gripL: number;
  gripR: number;
  /** The right hand under it, against his side. */
  tuck: number;
  headPitch: number;
  headYaw: number;
  lean: number;
  bodyYaw: number;
  puff: number;
  glint: number;
}

/** Which way he faces where he stands on the plain: side on to the camera, a little away from it, looking along the horizon at the moons. */
export const PLAIN_FACE = -Math.PI + 1.25;

const HEAD_Y = 0.266;
/** Under his left arm, the side the camera is on, so it stays in sight wherever he goes. */
const TUCK = [0.178, 0.03, 0.06];

const mix3 = (o: HelmetPose, a: number[], b: number[], k: number) => {
  o.x = lerp(a[0], b[0], k);
  o.y = lerp(a[1], b[1], k);
  o.z = lerp(a[2], b[2], k);
};

/** Taking it off, h from 0 to 1: hands up, ring turned, straight up and clear, down to his chest, under his arm. */
function helmetOff(h: number, o: HelmetPose) {
  const up = ss(h, 0.42, 0.56) * 0.012 + ss(h, 0.56, 0.68) * 0.175;
  const chest = ss(h, 0.68, 0.84);
  const tuck = ss(h, 0.84, 0.97);
  if (tuck > 0) mix3(o, [0, 0.13, 0.17], TUCK, tuck);
  else if (chest > 0) mix3(o, [0, HEAD_Y + up, 0.02], [0, 0.13, 0.17], chest);
  else {
    o.x = 0;
    o.y = HEAD_Y + up;
    o.z = 0.02 * ss(h, 0.56, 0.68);
  }
  o.yaw = ss(h, 0.42, 0.56) * 0.5 + tuck * 0.6;
  o.tilt = -0.55 * chest + tuck * 0.9;
  o.worn = 1 - ss(h, 0.56, 0.6);
  o.gripL = ss(h, 0.12, 0.38);
  o.gripR = ss(h, 0.12, 0.38) * (1 - ss(h, 0.84, 0.95));
  o.tuck = tuck;
  // Looks out at the light, down at the thing in his hands, then shakes his head and looks up.
  const shake = h > 0.84 ? Math.sin(((h - 0.84) / 0.14) * Math.PI * 3) * (1 - ss(h, 0.92, 0.99)) : 0;
  o.headPitch = -0.16 * ss(h, 0.02, 0.2) * (1 - ss(h, 0.66, 0.74)) + 0.34 * ss(h, 0.68, 0.76) * (1 - ss(h, 0.84, 0.94)) - 0.3 * ss(h, 0.86, 0.98);
  // Bare headed he looks along the horizon, in profile, hair in the wind.
  o.headYaw = shake * 0.34 + 0.2 * ss(h, 0.92, 1);
  o.lean = 0.05 * ss(h, 0.68, 0.76) * (1 - ss(h, 0.86, 0.96));
  o.bodyYaw = 0;
  o.puff = ss(h, 0.42, 0.47) * (1 - ss(h, 0.47, 0.64));
  o.glint = 0;
}

/** Putting it on, read as h falls from 1 to 0: out from under his arm, held up in front to look at, down over his head, sealed, and the light on the visor. */
function helmetOn(h: number, o: HelmetPose) {
  const low = [0.02, 0.03, 0.19];
  const high = [0, 0.3, 0.23];
  const over = [0, 0.45, 0.1];
  const head = [0, HEAD_Y, 0];
  if (h > 0.88) mix3(o, low, TUCK, ss(h, 0.88, 1));
  else if (h > 0.76) mix3(o, high, low, ss(h, 0.76, 0.88));
  else if (h > 0.66) mix3(o, over, high, ss(h, 0.66, 0.76));
  else if (h > 0.56) mix3(o, head, over, ss(h, 0.56, 0.66));
  else mix3(o, head, head, 0);
  o.yaw = 1.1 * ss(h, 0.88, 1) + 0.36 * ss(h, 0.46, 0.56) * (1 - ss(h, 0.56, 0.7));
  o.tilt = 0.35 * ss(h, 0.9, 1) - 0.7 * ss(h, 0.7, 0.8) * (1 - ss(h, 0.84, 0.94));
  o.worn = 1 - ss(h, 0.565, 0.6);
  o.gripL = ss(h, 0.3, 0.42);
  o.gripR = ss(h, 0.34, 0.44) * (1 - ss(h, 0.9, 0.98));
  o.tuck = ss(h, 0.9, 1);
  // Looks into it, tips his head to take it, then lifts his face to the last of the light.
  o.headPitch = 0.3 * ss(h, 0.72, 0.8) * (1 - ss(h, 0.92, 0.99)) - 0.3 * ss(h, 0.94, 1) - 0.06 * ss(h, 0.56, 0.66) * (1 - ss(h, 0.7, 0.78)) + 0.14 * ss(h, 0.48, 0.56) * (1 - ss(h, 0.56, 0.62)) - 0.26 * ss(h, 0.46, 0.38) * (1 - ss(h, 0.28, 0.12));
  // His face comes round to the light, in profile, and then the rest of him follows it round.
  o.headYaw = 0.22 * ss(h, 0.46, 0.38) * (1 - ss(h, 0.24, 0.12)) + 0.2 * ss(h, 0.92, 1);
  o.lean = 0.07 * ss(h, 0.68, 0.76) * (1 - ss(h, 0.86, 0.96));
  o.bodyYaw = 0.06 * ss(h, 0.46, 0.38) * (1 - ss(h, 0.2, 0.08));
  o.puff = 0;
  // It seals; the visor catches what is left of the light.
  o.glint = Math.exp(-Math.pow((h - 0.385) / 0.05, 2));
}

export function buildFigure(low: boolean, shadows: boolean, groundAt: (x: number, z: number) => number, plain: { standX: number; standZ: number; kneelX: number; kneelZ: number }) {
  const group = new Group();
  group.name = "figure";
  group.visible = false;

  // ---------------------------------------------------------------- the suit
  const seg_ = low ? 8 : 14;
  const suit = new MeshStandardMaterial({ color: new Color(0.26, 0.235, 0.205), roughness: 0.84, metalness: 0, envMapIntensity: 0.9 });
  const pale = new MeshStandardMaterial({ color: new Color(0.42, 0.385, 0.34), roughness: 0.72, metalness: 0, envMapIntensity: 0.9 });
  const dark = new MeshStandardMaterial({ color: new Color(0.05, 0.05, 0.052), roughness: 0.62, metalness: 0.2, envMapIntensity: 0.7 });
  const metal = new MeshStandardMaterial({ color: new Color(0.55, 0.55, 0.56), roughness: 0.42, metalness: 0.9, envMapIntensity: 1 });
  const visor = new MeshStandardMaterial({ color: new Color(0.62, 0.4, 0.16), roughness: 0.13, metalness: 1, envMapIntensity: 1.5, emissive: new Color(1, 0.62, 0.3), emissiveIntensity: 0 });
  const skin = new MeshStandardMaterial({ color: new Color(0.3, 0.19, 0.13), roughness: 0.72, metalness: 0, envMapIntensity: 0.5 });
  const hairMat = new MeshStandardMaterial({ color: new Color(0.018, 0.014, 0.012), roughness: 0.6, metalness: 0, envMapIntensity: 0.5, side: DoubleSide });
  const mats = [suit, pale, dark, metal, visor, skin, hairMat];
  const rimCol = { value: new Color(0, 0, 0) };
  const lampCol = { value: new Color(0, 0, 0) };
  const lampView = { value: new Vector3() };
  const hairT = { value: 0 };
  const hairWind = { value: new Vector3() };
  const hairAmt = { value: 0 };
  // The rim of the sky on his edge, and the wrist lamp, which falls off like it does on the sand.
  const lit = (m: MeshStandardMaterial, hair: boolean) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRimCol = rimCol;
      sh.uniforms.uLampCol = lampCol;
      sh.uniforms.uLampView = lampView;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uRimCol;\nuniform vec3 uLampCol;\nuniform vec3 uLampView;")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += ${hair ? "0.12 * " : ""}uRimCol * pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.6);
          if (uLampCol.r > 0.0005) {
            vec3 toLamp = uLampView + vViewPosition;
            float lampD2 = dot(toLamp, toLamp);
            totalEmissiveRadiance += diffuseColor.rgb * uLampCol * max(dot(normal, toLamp / sqrt(lampD2)), 0.0) * 0.0045 / (lampD2 + 0.006);
          }`,
        );
      if (hair) {
        sh.uniforms.uHairT = hairT;
        sh.uniforms.uHairWind = hairWind;
        sh.uniforms.uHairAmt = hairAmt;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute vec2 aHair;\nuniform float uHairT;\nuniform vec3 uHairWind;\nuniform float uHairAmt;")
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            {
              // Each lock lies with the wind, more toward its tip, and flutters on its own beat.
              float w = aHair.x * aHair.x;
              float flut = sin(uHairT * (5.5 + aHair.y * 4.0) + aHair.y * 40.0 + aHair.x * 3.0);
              float slow = 0.6 + 0.4 * sin(uHairT * 1.3 + aHair.y * 11.0);
              transformed += uHairWind * w * uHairAmt * (0.022 * slow + 0.008 * flut);
              transformed.y += w * uHairAmt * 0.006 * flut;
            }`,
          );
      }
    };
  };
  for (const m of [suit, pale, dark, metal, skin]) lit(m, false);
  lit(hairMat, true);
  // Three tells programs apart by this function's text, which is the same for hair and suit.
  hairMat.customProgramCacheKey = () => "figure-hair";
  const geoms: BufferGeometry[] = [];
  const part = (g: BufferGeometry, m: MeshStandardMaterial, parent: Group, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    geoms.push(g);
    const o = new Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = shadows;
    o.receiveShadow = shadows;
    parent.add(o);
    return o;
  };
  const cap = (r: number, h: number) => new CapsuleGeometry(r, h, 3, seg_);
  const ring = (r: number, h: number) => new CylinderGeometry(r, r, h, seg_);

  // Everything above the hips hangs from here. A bulky pressure suit: big helmet, wide
  // shoulders with the pack showing behind them, thick limbs with rings at the joints.
  const pelvis = new Group();
  group.add(pelvis);
  part(new SphereGeometry(0.08, seg_, 10), suit, pelvis, 0, 0, 0, 1.1, 0.76, 0.84);
  part(ring(0.074, 0.018), dark, pelvis, 0, 0.044, 0, 1.03, 1, 0.82);

  const torso = new Group();
  torso.position.y = 0.045;
  pelvis.add(torso);
  part(cap(0.074, 0.03), suit, torso, 0, 0.04, 0, 1.04, 1, 0.82);
  part(cap(0.09, 0.066), pale, torso, 0, 0.124, 0, 1.14, 1, 0.8);
  // Chest controls and the straps that hold the pack on.
  part(new BoxGeometry(0.1, 0.056, 0.026), dark, torso, 0, 0.122, 0.07);
  part(new BoxGeometry(0.034, 0.013, 0.006), metal, torso, -0.02, 0.138, 0.085);
  part(new BoxGeometry(0.018, 0.018, 0.006), metal, torso, 0.024, 0.114, 0.085);
  for (const sx of [1, -1]) {
    part(new BoxGeometry(0.015, 0.14, 0.012), dark, torso, sx * 0.056, 0.14, 0.064);
    part(new SphereGeometry(0.05, seg_, 8), pale, torso, sx * 0.122, 0.176, 0);
    part(ring(0.044, 0.014).rotateZ(Math.PI / 2), dark, torso, sx * 0.094, 0.172, 0);
  }
  // The pack on his back, standing clear of the shoulders.
  part(new BoxGeometry(0.2, 0.215, 0.09), pale, torso, 0, 0.116, -0.098);
  part(new BoxGeometry(0.16, 0.03, 0.066), dark, torso, 0, 0.234, -0.098);
  part(new BoxGeometry(0.13, 0.014, 0.014), metal, torso, 0, 0.03, -0.146);

  const neck = new Group();
  neck.position.set(0, 0.19, 0);
  torso.add(neck);
  part(ring(0.066, 0.02), metal, torso, 0, 0.198, 0);

  // His head, under the helmet. Bare from then on, hair moving in the wind.
  const head = new Group();
  head.position.y = 0.02;
  neck.add(head);
  part(new CylinderGeometry(0.026, 0.03, 0.05, seg_), skin, head, 0, 0.0, 0);
  part(new SphereGeometry(0.052, seg_, 10), skin, head, 0, 0.052, 0.002, 0.92, 1.1, 1);
  // Hair: a close cap and locks that the wind takes, one mesh.
  {
    const capG = new SphereGeometry(0.0555, seg_, 8, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const capMesh = new Mesh(capG, hairMat);
    capMesh.position.set(0, 0.056, -0.004);
    capMesh.rotation.x = -0.28;
    capMesh.scale.set(0.97, 1.02, 1.04);
    geoms.push(capG);
    head.add(capMesh);
    const capVerts = capG.getAttribute("position").count;
    capG.setAttribute("aHair", new BufferAttribute(new Float32Array(capVerts * 2), 2));
    const LOCKS = low ? 14 : 30;
    const pos: number[] = [];
    const nor: number[] = [];
    const hair: number[] = [];
    const idx: number[] = [];
    let seed = 11;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let k = 0; k < LOCKS; k++) {
      // Rooted over the crown and the back of the head.
      const az = Math.PI * (0.25 + 1.5 * (k / LOCKS)) + (rnd() - 0.5) * 0.3;
      const el = 0.25 + rnd() * 1.05;
      const rootX = Math.sin(az) * Math.cos(el) * 0.053;
      const rootY = 0.056 + Math.sin(el) * 0.056;
      const rootZ = Math.cos(az) * Math.cos(el) * 0.055 - 0.004;
      const len = 0.04 + rnd() * 0.035;
      const wid = 0.0055 + rnd() * 0.0045;
      const base = pos.length / 3;
      const dirX = Math.sin(az) * 0.5;
      const dirZ = Math.cos(az) * 0.5;
      const sx = Math.cos(az);
      const sz = -Math.sin(az);
      for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        const w = wid * (1 - t * 0.75);
        const y = rootY - len * t * t * 0.9 + len * t * 0.18;
        const x = rootX + dirX * len * t;
        const z = rootZ + dirZ * len * t;
        pos.push(x - sx * w, y, z - sz * w, x + sx * w, y, z + sz * w);
        nor.push(dirX, 0.6, dirZ, dirX, 0.6, dirZ);
        hair.push(t, k / LOCKS, t, k / LOCKS);
        if (i < 3) {
          const a = base + i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
    g.setAttribute("aHair", new BufferAttribute(new Float32Array(hair), 2));
    g.setIndex(idx);
    geoms.push(g);
    const locks = new Mesh(g, hairMat);
    locks.frustumCulled = false;
    locks.castShadow = shadows;
    head.add(locks);
  }

  // The helmet: on his shoulders, in his hands or under his arm. It hangs from the torso,
  // so what his hands hold and what his head wears are in the same space.
  const helmet = new Group();
  torso.add(helmet);
  part(new SphereGeometry(0.074, seg_ + 2, 12), pale, helmet, 0, 0, 0, 0.97, 1.03, 1);
  part(ring(0.066, 0.016), metal, helmet, 0, -0.066, 0);
  // The visor catches the sky.
  const visorG = new SphereGeometry(0.0752, seg_ + 2, 10, Math.PI / 2 - 1.08, 2.16, Math.PI / 2 - 0.72, 1.24);
  part(visorG, visor, helmet, 0, 0, 0.002, 0.97, 1.03, 1);

  // A breath out of the seal, and the point of light on the visor.
  const spotG = new PlaneGeometry(1, 1);
  const breathMat = new ShaderMaterial({ vertexShader: spotVS, fragmentShader: breathFS, uniforms: { uAt: { value: new Vector3() }, uSize: { value: 0.1 }, uColor: { value: new Color(0.55, 0.5, 0.55) }, uOp: { value: 0 } }, transparent: true, depthWrite: false, premultipliedAlpha: true, fog: false });
  const breath = new Mesh(spotG, breathMat);
  breath.frustumCulled = false;
  breath.renderOrder = 7;
  group.add(breath);
  const glintMat = new ShaderMaterial({ vertexShader: spotVS, fragmentShader: glintFS, uniforms: { uAt: { value: new Vector3() }, uSize: { value: 0.16 }, uColor: { value: new Color(0, 0, 0) } }, transparent: true, depthWrite: false, depthTest: false, blending: 2, fog: false });
  const glint = new Mesh(spotG, glintMat);
  glint.frustumCulled = false;
  glint.renderOrder = 8;
  group.add(glint);

  type Arm = { up: Group; fore: Group; side: number };
  const arms: Arm[] = [];
  for (const side of [1, -1]) {
    const up = new Group();
    up.position.set(side * 0.128, 0.172, 0);
    torso.add(up);
    part(cap(0.039, 0.088), suit, up, 0, -0.08, 0);
    const fore = new Group();
    fore.position.y = -ARM_UP;
    up.add(fore);
    part(ring(0.039, 0.016), dark, fore, 0, 0, 0);
    part(cap(0.034, 0.078), suit, fore, 0, -0.07, 0);
    part(ring(0.036, 0.014), metal, fore, 0, -0.128, 0);
    part(new SphereGeometry(0.036, seg_, 8), dark, fore, 0, -ARM_FORE, 0.002, 0.84, 1.14, 0.94);
    arms.push({ up, fore, side });
  }
  // The small lamp on the wrist of the arm that reaches.
  const lampDot = new Mesh(new SphereGeometry(0.009, 6, 5), new MeshBasicMaterial({ color: new Color(0, 0, 0) }));
  geoms.push(lampDot.geometry);
  lampDot.position.set(0, -0.128, 0.034);
  arms[1].fore.add(lampDot);

  // Legs: bones from joint to joint, set from the solved knee and ankle each frame.
  type Leg = { thigh: Group; shin: Group; boot: Group; side: number };
  const legs: Leg[] = [];
  for (const side of [1, -1]) {
    const thigh = new Group();
    group.add(thigh);
    part(cap(0.054, THIGH - 0.09), suit, thigh, 0, -THIGH * 0.5, 0);
    part(new BoxGeometry(0.036, 0.06, 0.012), pale, thigh, side * 0.022, -THIGH * 0.52, 0.05);
    const shin = new Group();
    group.add(shin);
    part(ring(0.052, 0.02), dark, shin, 0, 0, 0);
    part(cap(0.046, SHIN - 0.076), suit, shin, 0, -SHIN * 0.5, 0);
    part(new BoxGeometry(0.05, 0.085, 0.012), pale, shin, 0, -SHIN * 0.52, 0.042);
    const boot = new Group();
    group.add(boot);
    part(new BoxGeometry(0.076, 0.016, 0.155), dark, boot, 0, 0.008, 0.014);
    part(new CapsuleGeometry(0.038, 0.066, 3, seg_).rotateX(Math.PI / 2), pale, boot, 0, 0.04, 0.018, 0.96, 0.84, 1);
    part(ring(0.046, 0.034), pale, boot, 0, 0.062, -0.014);
    boot.rotation.order = "YXZ";
    legs.push({ thigh, shin, boot, side });
  }

  // ---------------------------------------------------------------- where each foot goes
  const W = 0.062;
  const F0: Foot[] = [];
  const add = (list: Foot[], x: number, y: number, z: number, yaw = 0, pitch = 0) => list.push({ x, y, z, yaw, pitch });
  // Behind the door plane, feet together. Then every second tread, then the sand.
  add(F0, W, tread(0).y + 0.02, PIVOT_Z - 0.16);
  add(F0, -W, tread(0).y + 0.02, PIVOT_Z - 0.2);
  [1, 3, 5, 7, 9, 11].forEach((k, i) => {
    const t = tread(k);
    add(F0, i % 2 === 0 ? W : -W, t.y, t.z, 0, RAMP_PITCH);
  });
  const sand: [number, number, number][] = [
    [W - 0.07, RAMP_END_Z + 0.3, -0.08],
    [-W - 0.2, RAMP_END_Z + 0.66, -0.3],
    [W - 0.42, RAMP_END_Z + 0.96, -0.5],
    [-W - 0.47, RAMP_END_Z + 1.02, -0.6],
  ];
  const onRampFeet = F0.length;
  for (const [x, z, yaw] of sand) add(F0, x, groundAt(x, z), z, yaw, 0);

  // Across the plain, facing the last of the light, to the right of the sapling, then a
  // turn toward it: the last two plants are the back foot and the front foot he kneels on.
  const F1: Foot[] = [];
  {
    const { standX: sx, standZ: sz, kneelX: kx, kneelZ: kz } = plain;
    // He stands side on to the camera, looking along the horizon toward the moons, so what his
    // hands do in front of him reads against the light, and his head is clear of the pack. Then he
    // sets off for the sapling, passing to its right, and turns toward it at the last.
    const FACE = PLAIN_FACE;
    const HEADING = Math.atan2(kx + 0.3 - sx, kz + 0.02 - sz) - Math.PI * 2;
    const END = -Math.PI / 2;
    const place = (x: number, z: number, yaw: number) => add(F1, x, groundAt(x, z), z, yaw, 0);
    place(sx + Math.cos(FACE) * W, sz - Math.sin(FACE) * W, FACE);
    place(sx - Math.cos(FACE) * W, sz + Math.sin(FACE) * W, FACE);
    const STEPS = WALK_ON.length - 2;
    for (let k = 1; k <= STEPS; k++) {
      const q = k / (STEPS + 0.6);
      const cx = lerp(sx, kx + 0.3, q);
      const cz = lerp(sz, kz + 0.02, q);
      const yaw = lerp(lerp(FACE, HEADING, ss(k / STEPS, 0, 0.3)), END, ss(k / STEPS, 0.5, 1));
      // The left foot takes the odd plants here.
      const side = (k - 1) % 2 === 0 ? 1 : -1;
      place(cx + Math.cos(yaw) * side * W, cz - Math.sin(yaw) * side * W, yaw);
    }
    // Right foot ahead, then the left comes to rest behind him. Facing -X, his left is +Z.
    place(kx - 0.17, kz - 0.06, END);
    place(kx + 0.18, kz + 0.06, END);
  }

  const makeWalk = (F: Foot[], d: number[]) => {
    const T: number[] = [0];
    for (const v of d) T.push(T[T.length - 1] + v);
    return { F, T, steps: d.length, duration: T[d.length] };
  };
  const walks = [makeWalk(F0, WALK_OUT), makeWalk(F1, WALK_ON)];
  const duration = walks[0].duration;
  const durationOn = walks[1].duration;
  /** Progress at which he comes off the ramp onto the sand. */
  const rampEndP = walks[0].T[onRampFeet - 2] / duration;

  /** The surface under a point: the treads' plane on the ramp, the sand off it. */
  const surfaceY = (x: number, z: number) => {
    const g = groundAt(x, z);
    if (Math.abs(x) > 0.46 || z > RAMP_END_Z || z < -4) return g;
    if (z < PIVOT_Z) return Math.max(g, PIVOT_Y + RAMP_SIN * TREAD_TOP);
    return Math.max(g, PIVOT_Y + RAMP_SIN * TREAD_TOP - ((z - PIVOT_Z) / RAMP_SIN) * RAMP_COS);
  };

  // ---------------------------------------------------------------- contact and prints
  const blobG = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const makeBlob = (print: number) => {
    const m = new ShaderMaterial({ vertexShader: blobVS, fragmentShader: blobFS, uniforms: { uOp: { value: 0 }, uPrint: { value: print } }, transparent: true, depthWrite: false, side: DoubleSide, fog: false });
    const o = new Mesh(blobG, m);
    o.frustumCulled = false;
    o.renderOrder = 2;
    o.rotation.order = "YXZ";
    group.add(o);
    return o;
  };
  const contacts = [makeBlob(0), makeBlob(0)];
  const prints = sand.map(() => makeBlob(1));
  prints.forEach((o, i) => {
    const f = F0[onRampFeet + i];
    o.position.set(f.x, f.y + 0.004, f.z);
    o.rotation.set(0, f.yaw, 0);
    o.scale.set(0.085, 1, 0.17);
    o.visible = false;
  });

  // ---------------------------------------------------------------- the pose
  const hip = new Vector3();
  const ankle = new Vector3();
  const knee = new Vector3();
  const dir = new Vector3();
  const pole = new Vector3();
  const down = new Vector3(0, -1, 0);
  const q = new Quaternion();
  const q2 = new Quaternion();
  const m1 = new Matrix4();
  const m2 = new Matrix4();
  const elbow = new Vector3();
  const target = new Vector3();
  const shoulder = new Vector3();
  const wristLocal = new Vector3(0, -0.128, 0.03);
  /** Where the wrist lamp is, in the figure's space (site space). */
  const wrist = new Vector3();
  const headAt = new Vector3();
  const slot: Foot[] = [
    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
  ];
  const footNow: Foot[] = [
    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
  ];
  const lift = [0, 0];
  const roll = [0, 0];
  const air = [0, 0];
  const prevX = [0, 0];
  const prevZ = [0, 0];
  const pivot = [0, 0];
  const heelFwd = [0, 0];
  const heelBack = [0, 0];
  const hA: HelmetPose = { x: 0, y: 0, z: 0, yaw: 0, tilt: 0, worn: 1, gripL: 0, gripR: 0, tuck: 0, headPitch: 0, headYaw: 0, lean: 0, bodyYaw: 0, puff: 0, glint: 0 };
  const hB: HelmetPose = { ...hA };
  let lookY = 0;
  let lookP = 0;

  const placeBone = (bone: Group, from: Vector3, to: Vector3, len: number) => {
    dir.copy(to).sub(from);
    const d = dir.length();
    bone.position.copy(from);
    bone.quaternion.copy(q.setFromUnitVectors(down, dir.multiplyScalar(1 / Math.max(d, 1e-5))));
    // A leg at full stretch gives a hair rather than let the foot leave its point.
    bone.scale.set(1, d / len, 1);
  };

  /** Bring an arm to a point in torso space, by this much, elbow out and down. */
  const armTo = (arm: Arm, tx: number, ty: number, tz: number, w: number) => {
    if (w <= 0.001) return;
    shoulder.copy(arm.up.position);
    target.set(tx, ty, tz).sub(shoulder);
    const full = target.length();
    const d = Math.max(0.02, Math.min(full, ARM_UP + ARM_FORE - 1e-3));
    target.multiplyScalar(1 / Math.max(full, 1e-4));
    const along = (ARM_UP * ARM_UP - ARM_FORE * ARM_FORE + d * d) / (2 * d);
    const out = Math.sqrt(Math.max(ARM_UP * ARM_UP - along * along, 0));
    // With the hand up the elbow is out and forward, so the forearm rises in front of the shoulder.
    // With the hand down it hangs out and back, the way an arm does.
    pole.set(arm.side * 0.6, -0.25, lerp(-0.4, 0.7, ss(ty, -0.06, 0.12)));
    pole.addScaledVector(target, -pole.dot(target)).normalize();
    elbow.copy(target).multiplyScalar(along).addScaledVector(pole, out);
    q.setFromUnitVectors(down, dir.copy(elbow).normalize());
    arm.up.quaternion.slerp(q, w);
    // The forearm, in the upper arm's own frame.
    q2.copy(q).invert();
    dir.copy(target).multiplyScalar(d).sub(elbow).normalize().applyQuaternion(q2);
    q2.setFromUnitVectors(down, dir);
    arm.fore.quaternion.slerp(q2, w);
  };

  /**
   * Bring a hand to a point in torso space, grip of the way there from his side. The hand travels up
   * the front of him, past the chest and in front of the shoulder, however fast the scroll goes,
   * because the path is the hand's and not the shoulder's.
   */
  const handTo = (arm: Arm, grip: number, tx: number, ty: number, tz: number) => {
    if (grip <= 0.001) return;
    const u = clamp(grip, 0, 1);
    const iu = 1 - u;
    const s = arm.side;
    const k0 = iu * iu;
    const k1 = 2 * iu * u;
    const k2 = u * u;
    armTo(arm, k0 * s * 0.154 + k1 * s * 0.13 + k2 * tx, k0 * -0.133 + k1 * 0.17 + k2 * ty, k0 * 0.047 + k1 * 0.3 + k2 * tz, ss(u, 0, 0.1));
  };

  function update(f: FigureFrame) {
    const { time, reduced } = f;
    rimCol.value.copy(f.rim);
    lampCol.value.copy(f.lampCol);
    lampView.value.copy(f.lampView);

    // ---- where the walk has him: one step of the walk, as a position
    const wk = walks[f.walk];
    const walkT = clamp(f.t, 0, wk.duration);
    let i = 0;
    let u = 1;
    if (walkT >= wk.duration) i = wk.steps - 1;
    else {
      while (i < wk.steps - 1 && walkT >= wk.T[i + 1]) i++;
      u = clamp((walkT - wk.T[i]) / (wk.T[i + 1] - wk.T[i]), 0, 1);
    }
    const a = wk.F[i];
    const stance = wk.F[i + 1];
    const b = wk.F[i + 2];
    const e = smooth(u);
    const swingSide = i % 2 === 0 ? 0 : 1;
    const sw = slot[swingSide];
    sw.x = lerp(a.x, b.x, e);
    sw.z = lerp(a.z, b.z, e);
    sw.yaw = lerp(a.yaw, b.yaw, e);
    const arc = Math.sin(Math.PI * u) * 0.04 * (1 - 0.3 * Math.abs(u - 0.5));
    sw.y = Math.max(lerp(a.y, b.y, e) + arc, surfaceY(sw.x, sw.z) + (u > 0 && u < 1 ? 0.006 : 0));
    if (u <= 0) sw.y = a.y;
    if (u >= 1) sw.y = b.y;
    sw.pitch = lerp(a.pitch, b.pitch, e);
    const st = slot[1 - swingSide];
    st.x = stance.x;
    st.y = stance.y;
    st.z = stance.z;
    st.yaw = stance.yaw;
    st.pitch = stance.pitch;
    // Heel up as it leaves, toes up a touch as it reaches, whichever way he is walking.
    const heel = (v: number) => Math.sin(Math.PI * clamp(v * 1.4, 0, 1)) * 0.42 * (1 - v) - Math.sin(Math.PI * clamp((v - 0.55) / 0.45, 0, 1)) * 0.18;
    heelFwd[swingSide] = heel(u);
    heelFwd[1 - swingSide] = 0;
    heelBack[swingSide] = heel(1 - u);
    heelBack[1 - swingSide] = 0;

    // ---- the turn: each foot steps a quarter round the point between them, one at a time.
    // Whatever turns his body turns his feet in planted steps, so he never spins on his soles.
    const tau = reduced ? (f.back > 0.5 ? 1 : 0) : clamp(f.back, 0, 1);
    pivot[0] = 0.5 * (ss(tau, 0, 0.3) + ss(tau, 0.5, 0.8));
    pivot[1] = 0.5 * (ss(tau, 0.22, 0.52) + ss(tau, 0.72, 1));
    const bump0 = Math.sin(Math.PI * seg(tau, 0, 0.3)) + Math.sin(Math.PI * seg(tau, 0.5, 0.8));
    const bump1 = Math.sin(Math.PI * seg(tau, 0.22, 0.52)) + Math.sin(Math.PI * seg(tau, 0.72, 1));
    const cxF = (slot[0].x + slot[1].x) * 0.5;
    const czF = (slot[0].z + slot[1].z) * 0.5;
    for (let k = 0; k < 2; k++) {
      const s = slot[k];
      const o = slot[1 - k];
      const frac = pivot[k];
      const ang = f.turnBy * frac;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const dx = s.x - cxF;
      const dz = s.z - czF;
      const fn = footNow[k];
      fn.x = cxF + dx * ca + dz * sa;
      fn.z = czF - dx * sa + dz * ca;
      const bump = (k === 0 ? bump0 : bump1) * 0.026;
      const baseY = lerp(s.y, o.y, frac);
      fn.y = Math.max(baseY + bump, surfaceY(fn.x, fn.z) + (bump > 0.001 ? 0.004 : 0));
      if (bump <= 0.001 && frac <= 0) fn.y = s.y;
      if (bump <= 0.001 && frac >= 1) fn.y = o.y;
      // Where a turn and the walk overlap the point between his feet moves too: whatever moves is off the ground.
      if (tau > 0.001 && tau < 0.999 && !reduced) {
        const speed = Math.hypot(fn.x - prevX[k], fn.z - prevZ[k]) / Math.max(f.dt, 1e-3);
        air[k] += (Math.min(0.03, speed * 0.05) - air[k]) * (1 - Math.exp(-f.dt * 30));
      } else air[k] += -air[k] * (1 - Math.exp(-f.dt * 30));
      fn.y += air[k];
      prevX[k] = fn.x;
      prevZ[k] = fn.z;
      fn.yaw = lerp(s.yaw, o.yaw, frac) + ang;
      // On a slope the boot lies on the slope, whichever way it points.
      const slopeP = lerp(s.pitch, o.pitch, frac);
      const psi = ang;
      fn.pitch = slopeP * Math.cos(psi) + lerp(heelFwd[k], heelBack[1 - k], frac);
      roll[k] = slopeP * Math.sin(psi);
      lift[k] = fn.y - surfaceY(fn.x, fn.z);
    }

    // ---- the hips travel between the feet, a little over whichever foot bears the weight
    const m0x = (a.x + stance.x) * 0.5;
    const m0z = (a.z + stance.z) * 0.5;
    const m1x = (stance.x + b.x) * 0.5;
    const m1z = (stance.z + b.z) * 0.5;
    const steps = wk.steps;
    // Start and stop gently; steady in between.
    const gait = i === 0 ? u * u * (2 - u) * 0.999 + 0.001 : i === steps - 1 ? 1 - (1 - u) * (1 - u) : u;
    const atEnd = f.walk === 0 ? ss(walkT, wk.duration - 0.4, wk.duration) : 1 - ss(walkT, 0, 0.4);
    const standK = Math.max(atEnd, f.kneel);
    const shift = reduced ? 0 : standK * (Math.sin(time * 0.61) * 0.0065 + Math.sin(time * 0.23 + 1) * 0.004);
    const sway = (stance.x - lerp(m0x, m1x, gait)) * 0.34 * Math.sin(Math.PI * u) * (1 - standK);
    const px = lerp(m0x, m1x, gait) + sway + shift * Math.cos(lerp(a.yaw, b.yaw, gait));
    const pz = lerp(m0z, m1z, gait) - shift * Math.sin(lerp(a.yaw, b.yaw, gait));
    const yawGait = lerp(lerp(a.yaw, stance.yaw, 0.5), lerp(stance.yaw, b.yaw, 0.5), gait);

    // ---- the helmet: where it is, and what that asks of him
    const helmK = reduced ? (f.helmBack > 0.5 ? 1 : 0) : clamp(f.helmBack, 0, 1);
    helmetOff(f.helm, hA);
    helmetOn(f.helm, hB);
    const hp = hA;
    hp.x = lerp(hA.x, hB.x, helmK);
    hp.y = lerp(hA.y, hB.y, helmK);
    hp.z = lerp(hA.z, hB.z, helmK);
    hp.yaw = lerp(hA.yaw, hB.yaw, helmK);
    hp.tilt = lerp(hA.tilt, hB.tilt, helmK);
    hp.worn = lerp(hA.worn, hB.worn, helmK);
    hp.gripL = lerp(hA.gripL, hB.gripL, helmK);
    hp.gripR = lerp(hA.gripR, hB.gripR, helmK);
    hp.tuck = lerp(hA.tuck, hB.tuck, helmK);
    hp.headPitch = lerp(hA.headPitch, hB.headPitch, helmK);
    hp.headYaw = lerp(hA.headYaw, hB.headYaw, helmK);
    hp.lean = lerp(hA.lean, hB.lean, helmK);
    hp.bodyYaw = lerp(hA.bodyYaw, hB.bodyYaw, helmK);
    hp.puff = lerp(hA.puff, hB.puff, helmK);
    hp.glint = lerp(hA.glint, hB.glint, helmK);

    const yawNow = yawGait + f.turnBy * smooth(tau);

    // As high as standing allows, then as low as the feet need: stepping down, the back knee folds.
    let py = surfaceY(px, pz) + HIP_STAND + Math.cos(Math.PI * 2 * u) * -0.004 * (1 - standK);
    const reach = THIGH + SHIN - 0.002;
    const cyB = Math.cos(yawNow);
    const syB = Math.sin(yawNow);
    for (let k = 0; k < 2; k++) {
      const fn = footNow[k];
      const side = legs[k].side;
      const hx = px + cyB * side * HIP_W;
      const hz = pz - syB * side * HIP_W;
      const dh = Math.hypot(hx - fn.x, hz - fn.z);
      const most = fn.y + ANKLE + Math.sqrt(Math.max(reach * reach - dh * dh, 0.01));
      py = smin(py, most, 0.012);
    }
    // Down on one knee: the hips drop over the back knee.
    const kneeling = f.kneel;
    if (kneeling > 0) py = lerp(py, surfaceY(px, pz) + 0.215, kneeling);
    pelvis.position.set(px, py, pz);
    const swingFlip = 1 - 2 * smooth(tau);
    const twist = (i % 2 === 0 ? 1 : -1) * Math.sin(Math.PI * u) * 0.09 * (1 - standK) * swingFlip;
    pelvis.rotation.set(0, yawNow + twist * 0.6, 0);
    pelvis.updateMatrix();
    // Leaning a little into the slope on the ramp, upright on the sand, well forward when he kneels.
    const onRamp = f.walk === 0 ? clamp((RAMP_END_Z + 0.1 - pz) / 0.5, 0, 1) : 0;
    const leanKneel = kneeling * (0.28 + 0.56 * f.reach);
    torso.rotation.set(-0.02 + 0.09 * onRamp + hp.lean + leanKneel, -twist * 1.5 + hp.bodyYaw, 0);
    // Breathing swells the chest, and never the height.
    const breathNow = reduced ? 0 : Math.sin(time * 1.15);
    torso.scale.set(1 + 0.007 * breathNow, 1, 1 + 0.012 * breathNow);
    torso.updateMatrix();

    // ---- what he looks at
    const wander = reduced ? 0 : standK * (Math.sin(time * 0.19) * 0.42 + Math.sin(time * 0.47 + 2) * 0.12) * (1 - f.kneel);
    let wantY = wander;
    let wantP = 0;
    if (f.lookW > 0.001) {
      headAt.set(px, py + 0.32, pz);
      const dx = f.lookAt.x - headAt.x;
      const dy = f.lookAt.y - headAt.y;
      const dz = f.lookAt.z - headAt.z;
      const rel = wrap(Math.atan2(dx, dz) - yawNow);
      // Past what a neck can do he stops trying rather than twist.
      const can = 1 - ss(Math.abs(rel), 1.5, 2.1);
      const w = f.lookW * can;
      wantY = lerp(wander, clamp(rel, -1.15, 1.15), w);
      wantP = lerp(0, clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.42, 0.5), w);
    }
    if (reduced) {
      lookY = wantY;
      lookP = wantP;
    } else {
      const lk = 1 - Math.exp(-f.dt * 5);
      lookY += (wantY - lookY) * lk;
      lookP += (wantP - lookP) * lk;
    }
    // Eyes on his feet coming down the ramp, ahead of him going up it, then up and looking about.
    const feetLook = 0.34 * onRamp * (1 - 0.6 * smooth(tau));
    neck.rotation.set(feetLook + 0.03 * (1 - onRamp) + hp.headPitch + kneeling * (0.18 + 0.22 * f.reach) + lookP, lookY + hp.headYaw, 0);

    // ---- the helmet, in torso space
    // On his shoulders it turns with his head, as far as it is on his shoulders.
    const worn = hp.worn;
    helmet.position.set(0, 0.076, 0).applyQuaternion(neck.quaternion).add(neck.position);
    helmet.position.set(hp.x + helmet.position.x * worn, hp.y + (helmet.position.y - HEAD_Y) * worn, hp.z + helmet.position.z * worn);
    helmet.rotation.set(hp.tilt, hp.yaw, 0);
    q.identity().slerp(neck.quaternion, worn);
    helmet.quaternion.premultiply(q);
    head.visible = worn < 0.995;
    hairAmt.value = reduced ? 0.3 : (1 - worn) * (0.7 + 0.5 * f.gust);
    hairT.value = reduced ? 0 : time;

    // ---- arms swing against the legs; then whatever his hands are doing
    const swing = (i % 2 === 0 ? 1 : -1) * Math.cos(Math.PI * u) * (0.2 + 0.12 * (1 - onRamp)) * (1 - standK);
    for (const arm of arms) {
      const s = arm.side === 1 ? swing : -swing;
      const rest = reduced ? 0 : standK * Math.sin(time * 0.61 + arm.side) * 0.018;
      arm.up.rotation.set(s - 0.03 + rest, 0, arm.side * (0.13 + 0.05 * onRamp));
      arm.fore.rotation.set(-0.3 - Math.max(s, 0) * 0.5, 0, 0);
    }
    const [armL, armR] = arms;
    // Both hands at the sides of the helmet, a little below its middle and toward the front of it.
    const tk = hp.tuck;
    handTo(armL, hp.gripL, hp.x + lerp(0.074, 0.012, tk), hp.y + lerp(-0.028, -0.076, tk), hp.z + lerp(0.024, 0.012, tk));
    handTo(armR, hp.gripR, hp.x - 0.074, hp.y - 0.028, hp.z + 0.024);
    if (f.reach > 0.001) {
      // The free hand goes out to the point it was given, in torso space.
      m1.multiplyMatrices(pelvis.matrix, torso.matrix);
      m2.copy(m1).invert();
      target.copy(f.reachAt).applyMatrix4(m2);
      armTo(armR, target.x, target.y, target.z, f.reach);
    }
    // Where the wrist lamp is now, for the light it throws.
    m1.multiplyMatrices(pelvis.matrix, torso.matrix);
    armR.up.updateMatrix();
    armR.fore.updateMatrix();
    m2.multiplyMatrices(m1, armR.up.matrix).multiply(armR.fore.matrix);
    wrist.copy(wristLocal).applyMatrix4(m2);
    (lampDot.material as MeshBasicMaterial).color.copy(f.lampCol).multiplyScalar(2.2);

    // ---- what comes off the helmet
    breath.visible = hp.puff > 0.01;
    if (breath.visible) {
      breathMat.uniforms.uAt.value.set(0, 0.2 + 0.06 * hp.puff, 0.04).applyMatrix4(m1);
      breathMat.uniforms.uSize.value = 0.07 + (1 - hp.puff) * 0.09;
      breathMat.uniforms.uOp.value = hp.puff * 0.5;
    }
    visor.emissiveIntensity = hp.glint * 0.9;
    glint.visible = hp.glint > 0.02;
    if (glint.visible) {
      // On the front of the visor, wherever it is looking.
      glintMat.uniforms.uAt.value.set(0, 0.012, 0.07).applyQuaternion(helmet.quaternion).add(helmet.position).applyMatrix4(m1);
      glintMat.uniforms.uColor.value.setRGB(1.0, 0.66, 0.36).multiplyScalar(hp.glint * 1.7);
    }

    // ---- each leg solved from hip to the ankle over its foot, knee forward
    for (let k = 0; k < 2; k++) {
      const fn = footNow[k];
      const leg = legs[k];
      hip.set(px + cyB * leg.side * HIP_W, py - 0.012, pz - syB * leg.side * HIP_W);
      // Kneeling, the back foot goes up on its toes.
      const rearToes = kneeling * (k === 0 ? 1 : 0);
      const footY = fn.y + rearToes * 0.03;
      const fy = Math.cos(fn.yaw);
      const sf = Math.sin(fn.yaw);
      ankle.set(fn.x - sf * 0.012, footY + ANKLE, fn.z - fy * 0.012);
      dir.copy(ankle).sub(hip);
      const d = Math.min(dir.length(), THIGH + SHIN - 1e-4);
      dir.normalize();
      const along = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d);
      const out = Math.sqrt(Math.max(THIGH * THIGH - along * along, 0));
      pole.set(sf, 0, fy).addScaledVector(dir, -(sf * dir.x + fy * dir.z)).normalize();
      knee.copy(hip).addScaledVector(dir, along).addScaledVector(pole, out);
      placeBone(leg.thigh, hip, knee, THIGH);
      placeBone(leg.shin, knee, ankle, SHIN);
      leg.boot.position.set(fn.x, footY, fn.z);
      leg.boot.rotation.set(fn.pitch + rearToes * 1.05, fn.yaw, roll[k]);
      // The boot's soft shadow meets it on whatever it stands on, and thins as it lifts.
      const c = contacts[k];
      const ground = surfaceY(fn.x, fn.z);
      const onSlope = f.walk === 0 && fn.z < RAMP_END_Z && fn.z > PIVOT_Z && Math.abs(fn.x) < 0.46 ? RAMP_PITCH : 0;
      c.position.set(fn.x, ground + 0.004, fn.z + 0.008);
      c.rotation.set(onSlope, fn.yaw, 0);
      c.scale.set(0.105 + lift[k] * 0.7, 1, 0.2 + lift[k] * 0.7);
      (c.material as ShaderMaterial).uniforms.uOp.value = 0.72 * (1 - clamp(lift[k] / 0.075, 0, 1) * 0.8);
    }
    // Prints stay where he has trodden, and are his to walk back over.
    prints.forEach((o, n) => {
      const landed = f.walk === 0 && walkT >= walks[0].T[Math.max(0, onRampFeet + n - 2)] + 0.7 && n < sand.length - 2;
      o.visible = landed;
      if (landed) (o.material as ShaderMaterial).uniforms.uOp.value = 0.34;
    });
    // Wind across his hair, in the head's own frame.
    const windYaw = -(yawNow + lookY);
    hairWind.value.set(Math.cos(windYaw), 0.1, -Math.sin(windYaw));
  }

  return {
    group,
    duration,
    durationOn,
    rampEndP,
    update,
    wrist,
    /** Where his feet are, in site space: for the dust they kick, and for checks. */
    feet: footNow,
    lift,
    /** How far through each step: which foot just came down, for the dust. */
    walks,
    pelvis,
    /** For checks in development: hands and elbows in his own frame, forward +z. */
    armsNow() {
      const point = (arm: Arm, atHand: boolean) => {
        arm.up.updateMatrix();
        arm.fore.updateMatrix();
        const v = new Vector3(0, atHand ? -ARM_FORE : 0, 0).applyMatrix4(arm.fore.matrix).applyMatrix4(arm.up.matrix);
        return [v.x, v.y, v.z];
      };
      return { handL: point(arms[0], true), elbowL: point(arms[0], false), handR: point(arms[1], true), elbowR: point(arms[1], false), gripL: hA.gripL, gripR: hA.gripR };
    },
    dispose() {
      for (const g of geoms) g.dispose();
      for (const m of mats) m.dispose();
      blobG.dispose();
      spotG.dispose();
      breathMat.dispose();
      glintMat.dispose();
      (lampDot.material as MeshBasicMaterial).dispose();
      for (const o of [...contacts, ...prints]) (o.material as ShaderMaterial).dispose();
    },
  };
}
