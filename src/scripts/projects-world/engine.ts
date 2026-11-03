// The live star system on /projects. The page owns the canvas and the scroll;
// this owns its loop, its sizing and every GPU resource. It reports where things
// are on screen each frame, so the page can pin real HTML to them.
//
//   const e = await mountSystem(canvas, opts);
//   e.setScroll(g, ...); e.setPointer(...); e.drag(dx, dy); e.fly(toG); e.destroy();

import {
  AdditiveBlending,
  LinearSRGBColorSpace,
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineLoop,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
  type WebGLCubeRenderTarget,
} from "three";
import { clamp, damp, glow, lerp, pxScale, smooth, type Part, type Shared, type U, type World, type WorldBuilder, type WorldCtx } from "./toolkit";
import { CameraPath, ORBITS, STAGE_COUNT, angularSpeed, orbitAt, type PathState } from "./path";
import { Post } from "./post";
import { bakeSky, dustBox, starField } from "./sky";
import { buildStar, STAR_R } from "./star";
import { buildBelt } from "./belt";
import { buildTypeRing } from "./type-ring";
import { buildMirror } from "./worlds/mirror";
import { buildRing } from "./worlds/ring";
import { buildListener } from "./worlds/listener";
import { buildDisk } from "./worlds/disk";
import { buildGeode } from "./worlds/geode";
import { buildArch } from "./worlds/arch";
import { buildNets } from "./worlds/nets";
import { buildComet } from "./worlds/comet";

const BUILDERS: WorldBuilder[] = [buildMirror, buildRing, buildListener, buildDisk, buildGeode, buildArch, buildNets, buildComet];

export type Pick =
  | { kind: "part"; world: number; part: number }
  | { kind: "world"; world: number }
  | { kind: "star" }
  | { kind: "body"; body: number }
  | null;

export interface FrameInfo {
  g: number;
  /** 0..1, how fast the camera is moving. */
  speed: number;
  /** 1 at the far system view, 0 once the tour has started. */
  overview: number;
  /** x, y in CSS pixels; z 1 when in front; w radius in CSS pixels. One per world. */
  worlds: Float32Array;
  star: Float32Array;
  /** Same layout, for the parts of the world in focus. */
  parts: Float32Array;
  partsOf: number;
  /** Same layout, one per belt body. */
  bodies: Float32Array;
}

export interface SystemOptions {
  tier: "high" | "mid" | "low";
  reduced: boolean;
  phone: boolean;
  /** Which belt body goes where: their ids in tour order. */
  bodies: string[];
  title: string[];
  fontFamily: string;
  onFrame(f: FrameInfo): void;
  onReady?(): void;
}

export interface System {
  setScroll(g: number, velocity: number): void;
  setPointer(x: number, y: number, on: boolean): void;
  pick(x: number, y: number): Pick;
  setHeat(p: Pick): void;
  drag(dx: number, dy: number): void;
  release(): void;
  fly(g: number, ms: number): void;
  setPaused(p: boolean): void;
  resize(): void;
  destroy(): void;
}

const STAR_COL = new Color(0.68, 0.82, 1);
const Y_AXIS = new Vector3(0, 1, 0);
const lean3 = new Vector3();
const tmp = new Vector3();
const tmp2 = new Vector3();
const tmp3 = new Vector3();

export async function mountSystem(canvas: HTMLCanvasElement, o: SystemOptions): Promise<System> {
  const low = o.tier === "low";
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", stencil: false, depth: false });
  renderer.toneMapping = NoToneMapping;
  // every material writes linear light; the final pass does its own conversion
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  renderer.debug.checkShaderErrors = false;

  const shared: Shared = {
    time: { value: 0 },
    env: { value: null as Texture | null },
    low,
    density: o.tier === "high" ? 1 : o.tier === "mid" ? 0.75 : 0.5,
    reduced: o.reduced,
  };
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 1, 12000);
  const msaa = o.tier === "high" ? 4 : o.tier === "mid" ? 2 : 0;
  const post = new Post(renderer, { low, msaa });

  // -------------------------------------------------------- sky
  let skyRT: WebGLCubeRenderTarget = bakeSky(renderer, low);
  // from here on the finishing pass clears for itself, and its blur adds up
  renderer.autoClear = false;
  shared.env.value = skyRT.texture;
  scene.background = skyRT.texture;
  const prUniform: U<number> = { value: 1 };
  const stars = starField(shared, prUniform);
  scene.add(stars);
  const dust = dustBox(shared);
  scene.add(dust.mesh);

  // -------------------------------------------------------- star, worlds, orbits
  const star = buildStar(shared);
  scene.add(star.group);

  const suns = ORBITS.map(() => ({ value: new Vector3(1, 0, 0) } as U<Vector3>));
  const worlds: World[] = BUILDERS.map((b, i) => b(shared, suns[i]));
  worlds.forEach((w) => scene.add(w.group));

  // a soft dot marks each world from far off
  const beacons = worlds.map((_, i) => {
    const m = glow(new Color("#cfe0ff"), 26, { intensity: 0.22, power: 2.5, depthTest: true });
    m.visible = false;
    scene.add(m);
    return m;
  });

  // orbits: a hairline with a bright stretch trailing each world
  const orbitLines: { line: Line; phase: U<number>; heat: U<number> }[] = ORBITS.map((orb, i) => {
    const seg = 480;
    const arr = new Float32Array(seg * 3);
    const ang = new Float32Array(seg);
    for (let k = 0; k < seg; k++) {
      const th = (k / seg) * Math.PI * 2;
      orbitAt(orb, th, tmp);
      arr.set([tmp.x, tmp.y, tmp.z], k * 3);
      ang[k] = th;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(arr, 3));
    g.setAttribute("aA", new BufferAttribute(ang, 1));
    const phase = { value: 0 };
    const heat = { value: 0 };
    const uDim = i === 7 ? 0.8 : 0.9;
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uPhase: phase, uHeat: heat, uOver: overviewU, uDim: { value: uDim } },
      vertexShader: /* glsl */ `
attribute float aA; uniform float uPhase; varying float vT;
void main() {
  float d = mod(uPhase - aA, 6.2831853) / 6.2831853;
  vT = d;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform float uHeat; uniform float uOver; uniform float uDim;
varying float vT;
void main() {
  float tail = pow(1.0 - vT, 7.0);
  float i = 0.07 + tail * 1.25 + uHeat * 0.55;
  i *= 0.1 + uOver * 0.9;
  vec3 c = mix(vec3(0.34, 0.5, 0.95), vec3(0.84, 0.92, 1.45), tail + uHeat * 0.5);
  gl_FragColor = vec4(c * i * uDim, 1.0);
}`,
    });
    const line = new LineLoop(g, mat);
    line.frustumCulled = false;
    scene.add(line);
    return { line, phase, heat };
  });

  // the belt with its named bodies
  const belt = buildBelt(shared, o.bodies);
  scene.add(belt.group);

  // the title, lying on the system's plane
  const typeRing = buildTypeRing(shared, o.title, o.fontFamily, o.phone);
  typeRing.group.visible = !o.phone;
  scene.add(typeRing.group);

  // -------------------------------------------------------- state
  const locks = ORBITS.map(() => 0);
  const thetas = ORBITS.map((orb) => orb.phase);
  const positions = ORBITS.map(() => new Vector3());
  const place = () => ORBITS.forEach((orb, i) => orbitAt(orb, thetas[i], positions[i]));
  place();
  let beltAngle = 0;
  const path = new CameraPath(
    (stage, out) => out.copy(positions[Math.min(positions.length - 1, Math.max(0, stage - 1))]),
    () => beltAngle,
    o.phone,
  );

  let firstScroll = true;
  let gTarget = 0;
  let gNow = 0;
  let vel = 0;
  const pose: PathState = { pos: new Vector3(0, 300, 900), look: new Vector3(), fov: 32, roll: 0, sx: 0, sy: 0 };
  const shown: PathState = { pos: new Vector3(0, 300, 900), look: new Vector3(), fov: 32, roll: 0, sx: 0, sy: 0 };
  // a direct flight overrides the path for its duration
  let flight: null | { from: PathState; t: number; ms: number; arc: number } = null;
  let lastPos = new Vector3(0, 300, 900);
  const velV = new Vector3();
  let speed = 0;

  let px = 0;
  let py = 0;
  let pxS = 0;
  let pyS = 0;
  let ptrOn = false;
  let ptrScreen: [number, number] = [-1, -1];
  // drag: an angle around whatever the camera is looking at, with a throw
  let yaw = 0;
  let pitch = 0;
  let yawV = 0;
  let pitchV = 0;
  let dragging = false;
  let dragStage = 0;

  const heats: number[][] = worlds.map((w) => w.parts.map(() => 0));
  let heatPick: Pick = null;
  const ctxs: WorldCtx[] = worlds.map((_, i) => ({ t: 0, dt: 0, near: 0, ptr: new Vector3(0, 1e3, 0), ptrOn: 0, heat: heats[i], cam: new Vector3(), sun: new Vector3(), overview: 1, reduced: o.reduced }));
  const worldHeat = worlds.map(() => 0);
  let starHeat = 0;

  const maxParts = Math.max(...worlds.map((w) => w.parts.length));
  const info: FrameInfo = {
    g: 0,
    speed: 0,
    overview: 1,
    worlds: new Float32Array(worlds.length * 4),
    star: new Float32Array(4),
    parts: new Float32Array(maxParts * 4),
    partsOf: -1,
    bodies: new Float32Array(belt.bodies.length * 4),
  };

  let cssW = 1;
  let cssH = 1;
  let scale = 1;
  let budget = o.tier === "high" ? 3.4e6 : o.tier === "mid" ? 2.2e6 : 1.5e6;
  const sizeNow = () => {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, Math.round(rect.width));
    cssH = Math.max(1, Math.round(rect.height));
    const dprCap = o.phone ? 1.5 : 2;
    let dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    if (cssW * cssH * dpr * dpr > budget) dpr = Math.sqrt(budget / (cssW * cssH));
    dpr = Math.max(0.6, dpr) * scale;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    prUniform.value = Math.max(1, dpr);
    pxScale.value = (h * 0.5) / Math.tan((32 * Math.PI) / 360);
  };
  sizeNow();

  const project = (p: Vector3, out: Float32Array, i: number, radius = 0) => {
    tmp.copy(p).project(camera);
    const inFront = tmp.z < 1;
    out[i] = (tmp.x * 0.5 + 0.5) * cssW;
    out[i + 1] = (-tmp.y * 0.5 + 0.5) * cssH;
    out[i + 2] = inFront ? 1 : 0;
    if (radius > 0) {
      const d = Math.max(1, camera.position.distanceTo(p));
      out[i + 3] = (radius / d / Math.tan((camera.fov * Math.PI) / 360)) * (cssH * 0.5);
    } else out[i + 3] = 0;
  };

  // -------------------------------------------------------- the loop
  let raf = 0;
  let paused = false;
  let disposed = false;
  let lost = false;
  let fade = 0;
  let prev = performance.now();
  let time = 0;
  let slowT = 0;
  let dip = 0;
  let lastStage = -1;
  let hoverSlow = 1;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (paused || lost || disposed) {
      prev = now;
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - prev) / 1000));
    prev = now;
    time += dt;
    shared.time.value = o.reduced ? time * 0.2 : time;

    // adaptive resolution: only ever a small step, never below 0.65
    if (dt > 0.03) slowT += dt;
    else slowT = Math.max(0, slowT - dt * 0.5);
    if (slowT > 2.4 && scale > 0.65) {
      scale = Math.max(0.65, scale - 0.12);
      slowT = 0;
      sizeNow();
    }

    gNow = o.reduced ? gTarget : damp(gNow, gTarget, 6.5, dt);
    const g = gNow;
    const overview = 1 - smooth(0.32, 0.86, g);
    overviewU.value = overview;

    // orbits: at speed from far away, nearly stopped close up
    hoverSlow = damp(hoverSlow, heatPick && heatPick.kind !== "star" ? 0.16 : 1, 4, dt);
    const orbitRate = (o.reduced ? 0.15 : 1) * lerp(0.1, 1, overview) * hoverSlow;
    ORBITS.forEach((orb, i) => {
      thetas[i] += angularSpeed(orb) * dt * orbitRate;
    });
    place();
    beltAngle += dt * 0.0016 * (o.reduced ? 0.2 : 1);
    belt.setAngle(beltAngle);

    // the camera
    path.solve(g, pose);
    if (flight) {
      flight.t += (dt * 1000) / flight.ms;
      const k = clamp(flight.t);
      const e = k < 0.5 ? 16 * k * k * k * k * k : 1 - Math.pow(-2 * k + 2, 5) / 2;
      const f = flight.from;
      shown.pos.lerpVectors(f.pos, pose.pos, e);
      const lift = Math.sin(k * Math.PI);
      shown.pos.y += lift * flight.arc * 0.36;
      shown.look.lerpVectors(f.look, pose.look, e < 0.5 ? e * e * 2 : 1 - Math.pow(-2 * e + 2, 2) / 2);
      shown.fov = lerp(f.fov, pose.fov, e) + lift * 8;
      shown.roll = lerp(f.roll, pose.roll, e);
      shown.sx = lerp(f.sx, pose.sx, e);
      shown.sy = lerp(f.sy, pose.sy, e);
      if (k >= 1) flight = null;
    } else {
      shown.pos.copy(pose.pos);
      shown.look.copy(pose.look);
      shown.fov = pose.fov;
      shown.roll = pose.roll;
      shown.sx = pose.sx;
      shown.sy = pose.sy;
    }

    // the view leans a little toward the part being pointed at
    {
      const hp = heatPick && heatPick.kind === "part" ? heatPick : null;
      if (hp && !o.reduced) {
        const w = worlds[hp.world];
        tmp2.copy(w.parts[hp.part].at).multiplyScalar(0.12 * w.group.scale.x).applyAxisAngle(Y_AXIS, locks[hp.world]);
      } else tmp2.set(0, 0, 0);
      lean3.lerp(tmp2, 1 - Math.exp(-3.5 * dt));
      shown.look.add(lean3);
    }

    // what the drag has done
    const stageNow = Math.round(g);
    if (stageNow !== dragStage && !dragging) {
      // a new stage starts level
      yaw = damp(yaw, 0, 2.4, dt);
      pitch = damp(pitch, 0, 2.4, dt);
      if (Math.abs(yaw) < 0.002 && Math.abs(pitch) < 0.002) dragStage = stageNow;
    }
    if (!dragging) {
      yaw += yawV * dt;
      pitch += pitchV * dt;
      yawV *= Math.exp(-dt * 2.6);
      pitchV *= Math.exp(-dt * 2.6);
      // scrolling eases the view back onto the rail
      if (Math.abs(vel) > 0.02) {
        yaw = damp(yaw, 0, 2.2, dt);
        pitch = damp(pitch, 0, 2.2, dt);
      }
    }
    pitch = clamp(pitch, -1.05, 1.05);

    pxS = damp(pxS, px, 3, dt);
    pyS = damp(pyS, py, 3, dt);
    tmp.copy(shown.pos).sub(shown.look);
    const dist = tmp.length();
    if (yaw || pitch) {
      tmp.applyAxisAngle(tmp2.set(0, 1, 0), yaw);
      tmp2.crossVectors(tmp, tmp3.set(0, 1, 0)).normalize();
      tmp.applyAxisAngle(tmp2, pitch);
    }
    camera.position.copy(shown.look).add(tmp);
    camera.up.set(0, 1, 0);
    camera.lookAt(shown.look);
    // the pointer leans the camera a little
    const lean = o.reduced ? 0 : Math.min(dist * 0.016, 16) * (1 - clamp(speed * 2));
    camera.position.addScaledVector(tmp2.setFromMatrixColumn(camera.matrix, 0), pxS * lean);
    camera.position.addScaledVector(tmp2.setFromMatrixColumn(camera.matrix, 1), -pyS * lean * 0.62);
    camera.lookAt(shown.look);
    camera.rotateZ(shown.roll);
    camera.fov = shown.fov;
    if (shown.sx || shown.sy) camera.setViewOffset(cssW, cssH, -shown.sx * cssW, shown.sy * cssH, cssW, cssH);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // speed, measured from the camera itself
    velV.copy(shown.pos).sub(lastPos).multiplyScalar(1 / dt);
    lastPos.copy(shown.pos);
    const sNow = clamp((velV.length() - 40) / 700);
    speed = damp(speed, sNow, 5, dt);
    dust.uCam.value.copy(camera.position);
    // dust streaks stay a sensible length at any speed
    dust.uVel.value.copy(velV).multiplyScalar(0.05);
    if (dust.uVel.value.length() > 34) dust.uVel.value.setLength(34);
    stars.position.copy(camera.position);

    // the pointer's ray
    tmp3.set((ptrScreen[0] / cssW) * 2 - 1, -(ptrScreen[1] / cssH) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();


    // the world in focus, for parts and sound
    const focus = g < 0.5 || g >= STAGE_COUNT - 1 ? -1 : Math.min(worlds.length - 1, Math.floor(g) - 1);

    // worlds
    worlds.forEach((w, i) => {
      const pos = positions[i];
      const distTo = camera.position.distanceTo(pos);
      // grow a little when far off, so they read in the system view
      const grow = lerp(1, o.phone ? 2.05 : 2.5, smooth(90, 520, distTo) * smooth(0.1, 0.9, overview));
      const near = 1 - smooth(w.radius * 3, w.radius * 11, distTo);
      // up close, only the world in focus: the others come in for the sling either side of it
      const inView = overview > 0.01 || (g > i + 0.8 && g < i + 2.2);
      w.group.visible = inView;
      beacons[i].visible = !inView;
      beacons[i].position.copy(pos);
      if (!inView) return;
      w.group.position.copy(pos);
      w.group.scale.setScalar(grow);
      // every world keeps one face to the star, so a shot is lit the same
      // wherever the world has got to on its orbit
      const lock = Math.atan2(pos.x, pos.z);
      locks[i] = lock;
      w.group.rotation.y = lock;
      suns[i].value.copy(pos).negate().normalize();
      const c = ctxs[i];
      c.t = o.reduced ? time * 0.2 : time;
      c.dt = dt;
      c.near = near;
      c.overview = overview;
      c.sun.copy(suns[i].value);
      c.cam.copy(camera.position).sub(pos).applyAxisAngle(Y_AXIS, -lock).multiplyScalar(1 / grow);
      // the pointer on this world's sphere
      let hit = 0;
      if (ptrOn && !dragging) {
        const R = w.radius * grow * 1.15;
        const oc = tmp.copy(camera.position).sub(pos);
        const b = oc.dot(tmp3);
        const cc = oc.lengthSq() - R * R;
        const h = b * b - cc;
        if (h > 0) {
          const tt = -b - Math.sqrt(h);
          if (tt > 0) {
            c.ptr.copy(camera.position).addScaledVector(tmp3, tt).sub(pos).applyAxisAngle(Y_AXIS, -lock).multiplyScalar(1 / grow);
            hit = 1;
          }
        }
      }
      c.ptrOn = damp(c.ptrOn, hit, hit ? 8 : 3, dt);
      // parts light when they are hovered
      const hp = heatPick && heatPick.kind === "part" && heatPick.world === i ? heatPick.part : -1;
      heats[i].forEach((_, k) => {
        heats[i][k] = damp(heats[i][k], k === hp ? 1 : 0, 6, dt);
      });
      const wh = heatPick && (heatPick.kind === "world" || heatPick.kind === "part") && heatPick.world === i ? 1 : 0;
      worldHeat[i] = damp(worldHeat[i], wh, 6, dt);
      orbitLines[i].heat.value = worldHeat[i];
      w.update(c);
      project(pos, info.worlds, i * 4, w.radius * grow);
    });
    orbitLines.forEach((l, i) => {
      l.phase.value = thetas[i];
    });

    star.update(o.reduced ? time * 0.2 : time);
    starHeat = damp(starHeat, heatPick?.kind === "star" ? 1 : 0, 6, dt);
    star.setHeat(starHeat);
    project(star.group.position, info.star, 0, STAR_R * 1.4);

    // the belt only draws when it is part of the picture
    belt.group.visible = overview > 0.01 || g > STAGE_COUNT - 1.14;
    belt.update(o.reduced ? time * 0.2 : time, dt, camera.position, heatPick?.kind === "body" ? heatPick.body : -1);
    belt.bodies.forEach((b, i) => project(b.world, info.bodies, i * 4, b.radius));

    typeRing.update(overview, time);
    scene.updateMatrixWorld();

    // parts of the world in focus
    info.partsOf = focus;
    if (focus >= 0) {
      const w = worlds[focus];
      w.parts.forEach((pt: Part, k) => {
        tmp2.copy(pt.at).multiplyScalar(w.group.scale.x).applyAxisAngle(Y_AXIS, locks[focus]).add(w.group.position);
        project(tmp2, info.parts, k * 4, pt.r * w.group.scale.x);
      });
    }

    // the star on screen drives the shafts and the lens streak
    tmp.copy(star.group.position).project(camera);
    const starOn = tmp.z < 1 ? 1 : 0;
    const sx = tmp.x * 0.5 + 0.5;
    const sy = tmp.y * 0.5 + 0.5;
    const off = Math.max(0, Math.abs(sx - 0.5) - 0.62, Math.abs(sy - 0.5) - 0.62);
    const shaft = starOn * clamp(1 - off * 3) * lerp(0.16, 0.24, overview);

    // reduced motion dips through dark when the stage changes
    if (o.reduced) {
      if (g !== lastStage) {
        if (lastStage !== -1) dip = 1;
        lastStage = g;
      }
      dip = damp(dip, 0, 3, dt);
    }

    // the black hole bends light when the camera is at it
    let lensS = 0;
    let lensX = 0.5;
    let lensY = 0.5;
    let lensR = 0.05;
    const diskI = 3;
    if (worlds[diskI].group.visible) {
      const dd = camera.position.distanceTo(positions[diskI]);
      const dn = 1 - smooth(170, 260, dd);
      if (dn > 0.01) {
        tmp.copy(positions[diskI]).project(camera);
        if (tmp.z < 1) {
          lensX = tmp.x * 0.5 + 0.5;
          lensY = tmp.y * 0.5 + 0.5;
          lensS = dn * 0.9;
          const rr = 5.6 * worlds[diskI].group.scale.x;
          lensR = (rr / dd / Math.tan((camera.fov * Math.PI) / 360)) * 0.5;
        }
      }
    }

    info.g = g;
    info.speed = speed;
    info.overview = overview;
    o.onFrame(info);

    fade = damp(fade, 1, o.reduced ? 8 : 1.6, dt);
    post.render(scene, camera, {
      time,
      fade,
      speed: o.reduced ? 0 : speed,
      star: { x: sx, y: sy, strength: shaft, color: STAR_COL },
      lens: { x: lensX, y: lensY, strength: lensS, radius: lensR },
      dip,
    });
  };

  // compile before the first frame so nothing hitches on the way in
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    /* it will compile on first use instead */
  }
  raf = requestAnimationFrame(frame);
  o.onReady?.();

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    lost = false;
    // the baked sky is gone with the context: paint it again
    renderer.autoClear = true;
    const fresh = bakeSky(renderer, low);
    renderer.autoClear = false;
    skyRT.dispose();
    skyRT = fresh;
    shared.env.value = fresh.texture;
    scene.background = fresh.texture;
    sizeNow();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const sys: System = {
    setScroll(g, velocity) {
      if (firstScroll) {
        firstScroll = false;
        gNow = g;
      }
      gTarget = g;
      vel = velocity;
    },
    setPointer(x, y, on) {
      ptrScreen = [x, y];
      ptrOn = on;
      px = on ? (x / Math.max(1, cssW)) * 2 - 1 : 0;
      py = on ? (y / Math.max(1, cssH)) * 2 - 1 : 0;
    },
    pick(x, y) {
      if (!Number.isFinite(x)) return null;
      const scr = [x, y];
      const near2 = (ax: number, ay: number) => Math.hypot(ax - scr[0], ay - scr[1]);
      const g = gNow;
      // parts of the focus world come first
      if (info.partsOf >= 0) {
        const w = worlds[info.partsOf];
        const c = info.worlds;
        const i = info.partsOf * 4;
        // the world's near face: a part on the far side does not catch the mouse
        let best = -1;
        let bestD = 1e9;
        w.parts.forEach((pt, k) => {
          const px4 = k * 4;
          if (info.parts[px4 + 2] < 0.5) return;
          const d = near2(info.parts[px4], info.parts[px4 + 1]);
          const reach = Math.max(22, Math.min(info.parts[px4 + 3], 90));
          if (d < reach && d < bestD) {
            bestD = d;
            best = k;
          }
        });
        if (best >= 0) return { kind: "part", world: info.partsOf, part: best };
        if (c[i + 2] > 0.5 && near2(c[i], c[i + 1]) < Math.max(40, c[i + 3] * 1.05)) return { kind: "world", world: info.partsOf };
      }
      // in the belt, the bodies
      if (g > STAGE_COUNT - 1.2) {
        let best = -1;
        let bestR = 0;
        belt.bodies.forEach((b, k) => {
          const c = info.bodies;
          if (c[k * 4 + 2] < 0.5) return;
          const R = Math.max(26, c[k * 4 + 3] * 1.2);
          if (near2(c[k * 4], c[k * 4 + 1]) < R && R > bestR) {
            best = k;
            bestR = R;
          }
        });
        if (best >= 0) return { kind: "body", body: best };
      }
      // from far away, any world and the star
      if (info.overview > 0.05 || g < 1) {
        let best = -1;
        let bestD = 1e9;
        worlds.forEach((_, i) => {
          const c = info.worlds;
          if (c[i * 4 + 2] < 0.5) return;
          const d = near2(c[i * 4], c[i * 4 + 1]);
          const R = Math.max(30, c[i * 4 + 3] * 1.15);
          if (d < R && d < bestD) {
            bestD = d;
            best = i;
          }
        });
        if (best >= 0) return { kind: "world", world: best };
        const s = info.star;
        if (s[2] > 0.5 && near2(s[0], s[1]) < Math.max(36, s[3] * 1.1)) return { kind: "star" };
      }
      return null;
    },
    setHeat(p) {
      heatPick = p;
    },
    drag(dx, dy) {
      dragging = true;
      dragStage = Math.round(gNow);
      const k = 0.0052;
      yaw -= dx * k;
      pitch -= dy * k * 0.7;
      yawV = (-dx * k) / 0.016;
      pitchV = (-dy * k * 0.7) / 0.016;
      yawV = clamp(yawV, -3, 3);
      pitchV = clamp(pitchV, -2, 2);
    },
    release() {
      dragging = false;
    },
    fly(g, ms) {
      flight = {
        from: { pos: camera.position.clone(), look: shown.look.clone(), fov: camera.fov, roll: shown.roll, sx: shown.sx, sy: shown.sy },
        t: 0,
        ms: o.reduced ? 1 : ms,
        arc: 0,
      };
      flight.arc = Math.min(260, camera.position.distanceTo(pose.pos) * 0.5);
      gTarget = g;
      gNow = g;
      yaw = pitch = yawV = pitchV = 0;
    },
    setPaused(p) {
      paused = p;
    },
    resize() {
      sizeNow();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      scene.background = null;
      scene.traverse((obj: Object3D) => {
        const m = obj as Mesh;
        if (m.geometry) m.geometry.dispose();
        const inst = obj as unknown as { isInstancedMesh?: boolean; dispose?: () => void };
        if (inst.isInstancedMesh && inst.dispose) inst.dispose();
        const mat = m.material as Material | Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      typeRing.dispose();
      skyRT.dispose();
      post.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
  return sys;
}

const overviewU: U<number> = { value: 1 };
