// The astronaut in chapter 07: a real figure in the world, so he stands on what he
// stands on. He comes out of the hatch, down the ramp one tread at a time, onto the
// sand, and stops. Each foot is set down at a fixed point and stays there until it
// lifts; the legs are solved to reach those points. His height is one number.
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from "three";

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
/** A soft minimum: the body settles under what the legs can reach without a kink. */
const smin = (a: number, b: number, k: number) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
};

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

export function buildFigure(low: boolean, shadows: boolean, groundAt: (x: number, z: number) => number) {
  const group = new Group();
  group.name = "figure";
  group.visible = false;

  // ---------------------------------------------------------------- the suit
  const seg = low ? 8 : 14;
  const suit = new MeshStandardMaterial({ color: new Color(0.26, 0.235, 0.205), roughness: 0.84, metalness: 0, envMapIntensity: 0.9 });
  const pale = new MeshStandardMaterial({ color: new Color(0.42, 0.385, 0.34), roughness: 0.72, metalness: 0, envMapIntensity: 0.9 });
  const dark = new MeshStandardMaterial({ color: new Color(0.05, 0.05, 0.052), roughness: 0.62, metalness: 0.2, envMapIntensity: 0.7 });
  const metal = new MeshStandardMaterial({ color: new Color(0.55, 0.55, 0.56), roughness: 0.42, metalness: 0.9, envMapIntensity: 1 });
  const visor = new MeshStandardMaterial({ color: new Color(0.62, 0.4, 0.16), roughness: 0.13, metalness: 1, envMapIntensity: 1.5 });
  const mats = [suit, pale, dark, metal, visor];
  const rimCol = { value: new Color(0, 0, 0) };
  for (const m of [suit, pale, dark, metal]) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRimCol = rimCol;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uRimCol;")
        .replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uRimCol * pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.6);",
        );
    };
  }
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
  const cap = (r: number, h: number) => new CapsuleGeometry(r, h, 3, seg);
  const ring = (r: number, h: number) => new CylinderGeometry(r, r, h, seg);

  // Everything above the hips hangs from here. A bulky pressure suit: big helmet, wide
  // shoulders with the pack showing behind them, thick limbs with rings at the joints.
  const pelvis = new Group();
  group.add(pelvis);
  part(new SphereGeometry(0.08, seg, 10), suit, pelvis, 0, 0, 0, 1.1, 0.76, 0.84);
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
    part(new SphereGeometry(0.05, seg, 8), pale, torso, sx * 0.122, 0.176, 0);
    part(ring(0.044, 0.014).rotateZ(Math.PI / 2), dark, torso, sx * 0.094, 0.172, 0);
  }
  // The pack on his back, standing clear of the shoulders.
  part(new BoxGeometry(0.2, 0.235, 0.09), pale, torso, 0, 0.13, -0.098);
  part(new BoxGeometry(0.16, 0.034, 0.066), dark, torso, 0, 0.26, -0.098);
  part(new BoxGeometry(0.13, 0.014, 0.014), metal, torso, 0, 0.03, -0.146);

  const neck = new Group();
  neck.position.set(0, 0.19, 0);
  torso.add(neck);
  part(ring(0.066, 0.02), metal, neck, 0, 0.008, 0);
  const head = new Group();
  head.position.y = 0.02;
  neck.add(head);
  part(new SphereGeometry(0.074, seg + 2, 12), pale, head, 0, 0.056, 0, 0.97, 1.03, 1);
  // The visor catches the sky.
  const visorG = new SphereGeometry(0.0752, seg + 2, 10, Math.PI / 2 - 1.08, 2.16, Math.PI / 2 - 0.72, 1.24);
  part(visorG, visor, head, 0, 0.056, 0.002, 0.97, 1.03, 1);

  type Arm = { up: Group; fore: Group; side: number };
  const arms: Arm[] = [];
  for (const side of [1, -1]) {
    const up = new Group();
    up.position.set(side * 0.128, 0.172, 0);
    torso.add(up);
    part(cap(0.039, 0.088), suit, up, 0, -0.08, 0);
    const fore = new Group();
    fore.position.y = -0.155;
    up.add(fore);
    part(ring(0.039, 0.016), dark, fore, 0, 0, 0);
    part(cap(0.034, 0.078), suit, fore, 0, -0.07, 0);
    part(ring(0.036, 0.014), metal, fore, 0, -0.128, 0);
    part(new SphereGeometry(0.036, seg, 8), dark, fore, 0, -0.16, 0.002, 0.84, 1.14, 0.94);
    arms.push({ up, fore, side });
  }

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
    part(new CapsuleGeometry(0.038, 0.066, 3, seg).rotateX(Math.PI / 2), pale, boot, 0, 0.04, 0.018, 0.96, 0.84, 1);
    part(ring(0.046, 0.034), pale, boot, 0, 0.062, -0.014);
    legs.push({ thigh, shin, boot, side });
  }

  // ---------------------------------------------------------------- where each foot goes
  const F: Foot[] = [];
  const add = (x: number, y: number, z: number, yaw = 0, pitch = 0) => F.push({ x, y, z, yaw, pitch });
  const W = 0.062;
  // Behind the door plane, feet together. Then every second tread, then the sand.
  add(W, tread(0).y + 0.02, PIVOT_Z - 0.16);
  add(-W, tread(0).y + 0.02, PIVOT_Z - 0.2);
  [1, 3, 5, 7, 9, 11].forEach((k, i) => {
    const t = tread(k);
    add(i % 2 === 0 ? W : -W, t.y, t.z, 0, RAMP_PITCH);
  });
  const sand: [number, number, number][] = [
    [W - 0.07, RAMP_END_Z + 0.3, -0.08],
    [-W - 0.2, RAMP_END_Z + 0.66, -0.3],
    [W - 0.42, RAMP_END_Z + 0.96, -0.5],
    [-W - 0.47, RAMP_END_Z + 1.02, -0.6],
  ];
  const onRampFeet = F.length;
  for (const [x, z, yaw] of sand) add(x, groundAt(x, z), z, yaw, 0);
  const stepsN = F.length - 2;

  // When each swing starts and ends: careful through the door and down, easier on the sand, slowing to stop.
  const T: number[] = [0];
  for (let i = 0; i < stepsN; i++) {
    const d = i === 0 ? 0.95 : i < onRampFeet - 2 ? 0.76 : i === stepsN - 1 ? 0.92 : 0.7;
    T.push(T[i] + d);
  }
  const duration = T[stepsN];
  /** Progress at which he comes off the ramp onto the sand. */
  const rampEndP = T[onRampFeet - 2] / duration;

  /** The surface under a point: the treads' plane on the ramp, the sand off it. */
  const surfaceY = (x: number, z: number) => {
    const g = groundAt(x, z);
    if (Math.abs(x) > 0.46 || z > RAMP_END_Z) return g;
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
    const f = F[onRampFeet + i];
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
  const footNow: Foot[] = [
    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
    { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
  ];
  const lift = [0, 0];

  const placeBone = (bone: Group, from: Vector3, to: Vector3, len: number) => {
    dir.copy(to).sub(from);
    const d = dir.length();
    bone.position.copy(from);
    bone.quaternion.copy(q.setFromUnitVectors(down, dir.multiplyScalar(1 / Math.max(d, 1e-5))));
    // A leg at full stretch gives a hair rather than let the foot leave its point.
    bone.scale.set(1, d / len, 1);
  };

  /**
   * Pose him at t seconds into the walk. Past the walk he stands, alive: weight
   * easing from foot to foot, breathing, looking about. His soles stay put.
   */
  function update(t: number, time: number, reduced: boolean, rim: Color) {
    rimCol.value.copy(rim);
    let i: number;
    let u: number;
    if (t >= duration) {
      i = stepsN - 1;
      u = 1;
    } else {
      i = 0;
      while (i < stepsN - 1 && t >= T[i + 1]) i++;
      u = clamp((t - T[i]) / (T[i + 1] - T[i]), 0, 1);
    }
    const a = F[i];
    const stance = F[i + 1];
    const b = F[i + 2];
    const e = smooth(u);
    const swingSide = i % 2 === 0 ? 0 : 1;
    const sw = footNow[swingSide];
    sw.x = lerp(a.x, b.x, e);
    sw.z = lerp(a.z, b.z, e);
    sw.yaw = lerp(a.yaw, b.yaw, e);
    const arc = Math.sin(Math.PI * u) * 0.04 * (1 - 0.3 * Math.abs(u - 0.5));
    sw.y = Math.max(lerp(a.y, b.y, e) + arc, surfaceY(sw.x, sw.z) + (u > 0 && u < 1 ? 0.006 : 0));
    if (u <= 0) sw.y = a.y;
    if (u >= 1) sw.y = b.y;
    // Heel up as it leaves, toes up a touch as it reaches.
    sw.pitch = lerp(a.pitch, b.pitch, e) + Math.sin(Math.PI * clamp(u * 1.4, 0, 1)) * 0.42 * (1 - u) - Math.sin(Math.PI * clamp((u - 0.55) / 0.45, 0, 1)) * 0.18;
    const st = footNow[1 - swingSide];
    st.x = stance.x;
    st.y = stance.y;
    st.z = stance.z;
    st.yaw = stance.yaw;
    st.pitch = stance.pitch;
    lift[swingSide] = sw.y - surfaceY(sw.x, sw.z);
    lift[1 - swingSide] = 0;

    // The hips travel between the feet, a little over whichever foot bears the weight.
    const m0x = (a.x + stance.x) * 0.5;
    const m0z = (a.z + stance.z) * 0.5;
    const m1x = (stance.x + b.x) * 0.5;
    const m1z = (stance.z + b.z) * 0.5;
    // Start and stop gently; steady in between.
    const gait = i === 0 ? u * u * (2 - u) * 0.999 + 0.001 : i === stepsN - 1 ? 1 - (1 - u) * (1 - u) : u;
    const standK = t >= duration ? 1 : 0;
    const shift = reduced ? 0 : standK * (Math.sin(time * 0.61) * 0.0065 + Math.sin(time * 0.23 + 1) * 0.004);
    const sway = (stance.x - lerp(m0x, m1x, gait)) * 0.34 * Math.sin(Math.PI * u) * (1 - standK);
    const px = lerp(m0x, m1x, gait) + sway + shift;
    const pz = lerp(m0z, m1z, gait);
    const yawNow = lerp(lerp(a.yaw, stance.yaw, 0.5), lerp(stance.yaw, b.yaw, 0.5), gait);

    // As high as standing allows, then as low as the feet need: stepping down, the back knee folds.
    let py = surfaceY(px, pz) + HIP_STAND + Math.cos(Math.PI * 2 * u) * -0.004 * (1 - standK);
    const reach = THIGH + SHIN - 0.002;
    for (let k = 0; k < 2; k++) {
      const f = footNow[k];
      const side = legs[k].side;
      const hx = px + Math.cos(yawNow) * side * HIP_W;
      const hz = pz - Math.sin(yawNow) * side * HIP_W;
      const dh = Math.hypot(hx - f.x, hz - f.z);
      const most = f.y + ANKLE + Math.sqrt(Math.max(reach * reach - dh * dh, 0.01));
      py = smin(py, most, 0.012);
    }
    pelvis.position.set(px, py, pz);
    const twist = (i % 2 === 0 ? 1 : -1) * Math.sin(Math.PI * u) * 0.09 * (1 - standK);
    pelvis.rotation.set(0, yawNow + twist * 0.6, 0);
    // Leaning a little back into the slope on the way down, upright on the sand.
    const onRamp = clamp((RAMP_END_Z + 0.1 - pz) / 0.5, 0, 1);
    torso.rotation.set(-0.02 + 0.09 * onRamp, -twist * 1.5, 0);
    // Breathing swells the chest, and never the height.
    const breath = reduced ? 0 : Math.sin(time * 1.15);
    torso.scale.set(1 + 0.007 * breath, 1, 1 + 0.012 * breath);
    // Eyes on his feet on the ramp, then up and looking about.
    const look = reduced ? 0 : standK * (Math.sin(time * 0.19) * 0.42 + Math.sin(time * 0.47 + 2) * 0.12);
    neck.rotation.set(0.34 * onRamp + 0.03 * (1 - onRamp), look, 0);

    // Arms swing against the legs; one comes out a little for balance on the ramp.
    const swing = (i % 2 === 0 ? 1 : -1) * Math.cos(Math.PI * u) * (0.2 + 0.12 * (1 - onRamp)) * (1 - standK);
    for (const arm of arms) {
      const s = arm.side === 1 ? swing : -swing;
      const rest = reduced ? 0 : standK * Math.sin(time * 0.61 + arm.side) * 0.018;
      arm.up.rotation.set(s - 0.03 + rest, 0, arm.side * (0.13 + 0.05 * onRamp));
      arm.fore.rotation.set(-0.3 - Math.max(s, 0) * 0.5, 0, 0);
    }

    // Each leg solved from hip to the ankle over its foot, knee forward.
    for (let k = 0; k < 2; k++) {
      const f = footNow[k];
      const leg = legs[k];
      const cy = Math.cos(yawNow);
      const sy = Math.sin(yawNow);
      hip.set(px + cy * leg.side * HIP_W, py - 0.012, pz - sy * leg.side * HIP_W);
      const fy = Math.cos(f.yaw);
      const sf = Math.sin(f.yaw);
      ankle.set(f.x - sf * 0.012, f.y + ANKLE, f.z - fy * 0.012);
      dir.copy(ankle).sub(hip);
      const d = Math.min(dir.length(), THIGH + SHIN - 1e-4);
      dir.normalize();
      const along = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d);
      const out = Math.sqrt(Math.max(THIGH * THIGH - along * along, 0));
      pole.set(sf, 0, fy).addScaledVector(dir, -(sf * dir.x + fy * dir.z)).normalize();
      knee.copy(hip).addScaledVector(dir, along).addScaledVector(pole, out);
      placeBone(leg.thigh, hip, knee, THIGH);
      placeBone(leg.shin, knee, ankle, SHIN);
      leg.boot.position.set(f.x, f.y, f.z);
      leg.boot.rotation.order = "YXZ";
      leg.boot.rotation.set(f.pitch, f.yaw, 0);
      // The boot's soft shadow meets it on whatever it stands on, and thins as it lifts.
      const c = contacts[k];
      const ground = surfaceY(f.x, f.z);
      const onSlope = f.z < RAMP_END_Z && f.z > PIVOT_Z && Math.abs(f.x) < 0.46 ? RAMP_PITCH : 0;
      c.position.set(f.x, ground + 0.004, f.z + 0.008);
      c.rotation.set(onSlope, f.yaw, 0);
      c.scale.set(0.105 + lift[k] * 0.7, 1, 0.2 + lift[k] * 0.7);
      (c.material as ShaderMaterial).uniforms.uOp.value = 0.72 * (1 - clamp(lift[k] / 0.075, 0, 1) * 0.8);
    }
    // Prints stay where he has trodden.
    prints.forEach((o, n) => {
      const landed = t >= T[Math.max(0, onRampFeet + n - 2)] + 0.7 && n < sand.length - 2;
      o.visible = landed;
      if (landed) (o.material as ShaderMaterial).uniforms.uOp.value = 0.34;
    });
  }

  return {
    group,
    duration,
    rampEndP,
    update,
    dispose() {
      for (const g of geoms) g.dispose();
      for (const m of mats) m.dispose();
      blobG.dispose();
      for (const o of [...contacts, ...prints]) (o.material as ShaderMaterial).dispose();
    },
  };
}
