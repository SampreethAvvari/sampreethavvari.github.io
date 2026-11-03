// The journey engine: a procedural ship flying through space as the page
// scrolls. The page owns the canvas and tells the engine where it is
// scrolled and where the pointer is; the engine owns its loop, its sizing
// and every GPU resource it creates.
//
// Usage:
//   const { mountJourney } = await import("./journey/engine");
//   const j = mountJourney(canvas, { chapters, quality: "high" });
//   j.setScroll(progress, velocity); j.setPointer(nx, ny); j.setPaused(false);
//   j.destroy();

import {
  BackSide,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
  type WebGLRenderTarget,
} from "three";
import { approachPoint, approachU, FlightPath, landingPhase } from "./path";
import { Post, type PostFrame } from "./post";
import { buildShip, type ShipInput } from "./ship";
import { buildSpace, chapterColor, type Chapter } from "./space";
import { cloudTexture, glowTexture, panelTextures } from "./textures";

export interface JourneyChapter {
  id: string;
  /** Hex colour, the chapter's light. */
  color: string;
}

export interface Journey {
  /** progress 0..chapters.length-1 (continuous). velocity in chapters per second, signed. */
  setScroll(progress: number, velocity: number): void;
  /** -1..1 each. nx: left to right. ny: top to bottom (DOM direction). */
  setPointer(nx: number, ny: number): void;
  /** Stop rendering entirely while paused. */
  setPaused(paused: boolean): void;
  destroy(): void;
}

export interface JourneyOptions {
  chapters: JourneyChapter[];
  quality?: "high" | "low";
  reducedMotion?: boolean;
}

// Scratch objects reused every frame so the loop never allocates.
const _v = new Vector3();
const _v2 = new Vector3();
const _right = new Vector3();
const _up = new Vector3();
const _fwd = new Vector3();
const _rigPos = new Vector3();
const _rigQuat = new Quaternion();
const _camOff = new Vector3();
const _look = new Vector3();
const _color = new Color();
const _rimColor = new Color();
const _white = new Color(1, 1, 1);

function clamp(x: number, a: number, b: number) {
  return x < a ? a : x > b ? b : x;
}
function ease(x: number) {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function smooth(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function damp(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** A dark studio of soft panels, baked once into a reflection map. */
function environment(renderer: WebGLRenderer): WebGLRenderTarget {
  const s = new Scene();
  const dome = new Mesh(
    new SphereGeometry(60, 32, 16),
    new ShaderMaterial({
      side: BackSide,
      vertexShader: /* glsl */ `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `varying vec3 vP; void main(){
        float y = vP.y;
        vec3 top = vec3(0.09, 0.11, 0.16);
        vec3 mid = vec3(0.025, 0.03, 0.045);
        vec3 low = vec3(0.006, 0.006, 0.01);
        vec3 c = y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.9, y)) : mix(mid, low, smoothstep(0.0, -0.6, y));
        gl_FragColor = vec4(c, 1.0);
      }`,
    }),
  );
  s.add(dome);
  const panel = (w: number, h: number, x: number, y: number, z: number, r: number, g: number, b: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(r, g, b), side: DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(34, 20, 18, 34, 14, 5.5, 5.1, 4.6); // warm key above and to the right
  panel(4, 46, -36, 6, -6, 1.2, 1.9, 3.6); // cool strip on the left
  panel(46, 3, 0, 4, -40, 2.6, 2.7, 3.0); // thin bar ahead for a crisp edge
  panel(20, 8, 6, -30, 12, 0.35, 0.3, 0.28); // faint bounce from below
  panel(6, 26, 34, 2, -20, 1.8, 1.2, 0.8); // warm strip behind on the right
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(s, 0.015);
  pmrem.dispose();
  s.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (mesh.material as Material).dispose();
    }
  });
  return rt;
}

export function mountJourney(canvas: HTMLCanvasElement, opts: JourneyOptions): Journey {
  const low = opts.quality === "low";
  const reduced = !!opts.reducedMotion;
  const list = opts.chapters && opts.chapters.length ? opts.chapters : [{ id: "launch", color: "#5B8DEF" }];
  const chapters: Chapter[] = list.map((c) => ({ id: c.id, color: new Color(c.color) }));
  const N = chapters.length;
  const maxP = N - 1;
  const dprCap = low ? 1.25 : 1.75;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: low ? "default" : "high-performance",
  });
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(1);

  const scene = new Scene();
  scene.fog = new FogExp2(0x03040a, 0.0009);
  const camera = new PerspectiveCamera(46, 1, 0.3, 7000);

  let envRT = environment(renderer);
  scene.environment = envRT.texture;

  // Lights: a warm key from above, a rim in the chapter colour from ahead,
  // and a faint sky fill. They move with the ship so it is always well lit.
  const key = new DirectionalLight(0xfff0e0, 2.4);
  const rim = new DirectionalLight(0xffffff, 3.2);
  const fill = new HemisphereLight(0x8090c0, 0x08090e, 0.4);
  scene.add(key, key.target, rim, rim.target, fill);

  const panels = panelTextures(low ? 512 : 1024);
  const glowTex = glowTexture();
  const cloudTex = cloudTexture(low ? 96 : 128);
  const textures: Texture[] = [panels.map, panels.rough, panels.glow, glowTex, cloudTex];

  const path = new FlightPath(N);
  const ship = buildShip({ low, panels });
  const landing = path.landing(ship.standHeight);
  const rig = new Group();
  rig.add(ship.root, ship.trails);
  scene.add(rig);
  const engineLight = low ? null : new PointLight(0xffffff, 0, 16, 2);
  if (engineLight) {
    engineLight.position.set(0, 0.4, 6.6);
    ship.root.add(engineLight);
  }
  ship.root.rotation.order = "YXZ";

  const space = buildSpace(path, chapters, low, glowTex, cloudTex, landing);
  scene.add(space.group);

  // Multisampling only where the pixel ratio is too low to hide jagged edges.
  const dpr0 = Math.min(window.devicePixelRatio || 1, dprCap);
  const msaa = !low && dpr0 < 1.5 ? 4 : 0;
  const lensOn = !low && !reduced;
  const post = new Post(renderer, { low, msaa, lens: lensOn });

  // ------------------------------------------------------------ state
  let targetP = 0;
  let p = 0;
  let v = 0;
  let snapped = false;
  let repVel = 0;
  let repVelEased = 0;
  let lastScrollAt = 0;
  let ptx = 0;
  let pty = 0;
  let px = 0;
  let py = 0;
  let lensX = 0.5;
  let lensY = 0.5;
  let lensAmt = 0;
  let lensEnergy = 0;
  let hasPointer = false;
  let pVelX = 0;
  let boost = 0;
  let time = 0;
  let last = 0;
  let raf = 0;
  let paused = false;
  let disposed = false;
  let ready = false;
  let lost = false;
  let fadeIn = 0;
  let sized = false;
  let resizeDirty = true;
  let width = 0;
  let height = 0;
  let cssW = 1;
  let cssH = 1;
  let dpr = 1;
  let pxScale = 800;
  let firstFrame = false;
  const camQuat = new Quaternion();
  let camInit = false;
  let prevL = 0;
  let bounceT = -1;
  const shipIn: ShipInput = { time: 0, dt: 0, speed: 0, boost: 0, color: _color, reduced, gear: 0, brake: 0, idle: 0 };

  // Framing, recomputed on resize: distance, offsets and field of view.
  const frameCfg = { fov: 46, dist: 22, camX: -5, camY: 5.6, lookX: -5, lookY: 2.6 };
  const endCfg = { x: -11, y: 3.4, back: 24, lookX: -9, lookY: 8.5, fov: 44 };
  function computeFraming() {
    const aspect = cssW / Math.max(1, cssH);
    // 0 = portrait phone, 1 = wide desktop.
    const k = clamp((aspect - 0.7) / 0.7, 0, 1);
    const fov = 64 - k * 18;
    const tanH = Math.tan((fov * Math.PI) / 360) * aspect;
    const ndc = 0.6 - k * 0.26; // how much of the half width the ship's half span takes
    const dist = clamp(4.0 / (ndc * tanH), 14, 60);
    frameCfg.fov = fov;
    frameCfg.dist = dist;
    frameCfg.camX = -dist * 0.25 * k;
    frameCfg.lookX = frameCfg.camX * 0.9;
    frameCfg.camY = dist * (0.36 + (1 - k) * 0.04);
    frameCfg.lookY = frameCfg.camY - (dist + 40) * (0.13 + (1 - k) * 0.05);
    // The closing shot: wide and still, ship lower right on wide screens and
    // lower centre on phones, with open sky above for the last headline.
    endCfg.x = -1.5 - 9.5 * k;
    endCfg.y = 5.5 - 2.1 * k;
    endCfg.back = 34 - 10 * k;
    endCfg.lookX = -1.0 - 8 * k;
    endCfg.lookY = 13 - 4.5 * k;
    endCfg.fov = 62 - 18 * k;
  }

  function applySize() {
    resizeDirty = false;
    const cw = canvas.clientWidth || canvas.width || 1;
    const ch = canvas.clientHeight || canvas.height || 1;
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = Math.max(1, Math.round(cw * dpr));
    const h = Math.max(1, Math.round(ch * dpr));
    cssW = cw;
    cssH = ch;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
      post.setSize(w, h);
    }
    camera.aspect = cw / ch;
    computeFraming();
    camera.fov = frameCfg.fov;
    camera.updateProjectionMatrix();
    sized = true;
  }

  const ro = new ResizeObserver(() => {
    resizeDirty = true;
  });
  ro.observe(canvas);

  // ------------------------------------------------------------ frame
  function step(dt: number) {
    time += dt;

    // Scroll: a critically damped spring toward the page's progress, so
    // coarse scroll events still give smooth flight.
    const w = 5.0;
    const acc = w * w * (targetP - p) - 2 * w * v;
    v += acc * dt;
    p += v * dt;
    if (p < -0.05) {
      p = -0.05;
      v = Math.max(0, v);
    } else if (p > maxP + 0.05) {
      p = maxP + 0.05;
      v = Math.min(0, v);
    }
    // The page's own velocity fades if scroll events stop arriving.
    if (performance.now() - lastScrollAt > 140) repVel = damp(repVel, 0, 8, dt);
    repVelEased = damp(repVelEased, repVel, 6, dt);
    const speed = v * 0.8 + repVelEased * 0.2;
    boost = damp(boost, clamp(Math.abs(speed) / 1.3, 0, 1), 4, dt);

    // Pointer.
    const prevPx = px;
    px = damp(px, ptx, 3.2, dt);
    py = damp(py, pty, 3.2, dt);
    pVelX = damp(pVelX, (px - prevPx) / Math.max(dt, 1e-3), 6, dt);

    chapterColor(chapters, p, _color);

    // Rig on the path.
    path.frame(p, _rigPos, _rigQuat, _right, _up, _fwd);
    const bend = path.bend(p, _right);
    const lift = path.lift(p, _up);

    // Landing: over the last half chapter the rig leaves the path, curves
    // down onto the pad and levels out. Everything here follows progress, so
    // scrolling back up plays it as a lift off.
    const L = landingPhase(landing, p);
    if (L > 0) {
      approachPoint(landing, approachU(L), _v);
      _rigPos.lerp(_v, smooth(0, 0.45, L));
      _rigQuat.slerp(landing.quat, smooth(0.05, 0.7, L));
    }
    rig.position.copy(_rigPos);
    rig.quaternion.copy(_rigQuat);
    const dyn = 1 - smooth(0.3, 0.8, L);
    const gear = smooth(0.36, 0.7, L);
    const brake = smooth(0.3, 0.48, L) * (1 - smooth(0.8, 0.9, L));
    const idle = smooth(0.86, 1, L);
    // A small bounce when the legs take the weight, played in real time.
    if (L >= 0.84 && prevL < 0.84 && !reduced) bounceT = 0;
    if (L < 0.8) bounceT = -1;
    prevL = L;
    let bounce = 0;
    if (bounceT >= 0) {
      bounceT += dt;
      bounce = -0.26 * Math.sin(bounceT * 10) * Math.exp(-bounceT * 4);
      if (bounceT > 2.5) bounceT = -1;
    }
    const flare = 0.2 * Math.sin(Math.PI * clamp((L - 0.25) / 0.6, 0, 1));

    // Ship motion inside the rig.
    const sr = ship.root;
    if (reduced) {
      sr.position.set(0, 0, 0);
      sr.rotation.set(clamp(lift * 0.01, -0.2, 0.2) * dyn + flare, 0, clamp(-bend * 0.035, -0.35, 0.35) * dyn);
    } else {
      const t = time;
      const upY = -py;
      const surge = clamp(speed, -0.8, 2.2);
      sr.position.set(
        (px * 2.2 + Math.sin(t * 0.37) * 0.22) * dyn,
        (upY * 1.1 + Math.sin(t * 1.3) * 0.13 + Math.sin(t * 0.61) * 0.08) * dyn + bounce,
        -surge * 2.6 * dyn,
      );
      // Rolls through some chapter changes, driven by progress so they reverse.
      let roll = 0;
      for (let k = 1; k < N - 1; k += 3) {
        const c = k + 0.5;
        roll += ease((p - (c - 0.17)) / 0.34) * Math.PI * 2 * (k % 2 === 0 ? 1 : -1);
      }
      const yaw = -px * 0.3 - pVelX * 0.04;
      const pitch = upY * 0.15 - surge * 0.06 + clamp(lift * 0.012, -0.25, 0.25) + Math.sin(t * 0.9) * 0.014;
      const bank = -px * 0.5 - clamp(pVelX * 0.12, -0.4, 0.4) + clamp(-bend * 0.035, -0.45, 0.45) + Math.sin(t * 0.7) * 0.03;
      sr.rotation.set(pitch * dyn + flare, yaw * dyn, bank * dyn + roll);
    }

    shipIn.time = time;
    shipIn.dt = dt;
    shipIn.speed = speed;
    shipIn.boost = boost * (1 - smooth(0.2, 0.7, L));
    shipIn.color = _color;
    shipIn.gear = gear;
    shipIn.brake = brake;
    shipIn.idle = idle;
    ship.update(shipIn);
    if (engineLight) {
      engineLight.color.copy(_color).lerp(_white, 0.4);
      engineLight.intensity = (6 + boost * 30) * (1 - idle * 0.8);
    }

    // Camera: a chase shot that follows a softened copy of the path frame,
    // easing into a wide still shot once the ship has landed.
    if (!camInit) {
      camQuat.copy(_rigQuat);
      camInit = true;
    } else {
      camQuat.slerp(_rigQuat, 1 - Math.exp(-3.0 * dt));
    }
    const f = frameCfg;
    const cb = ease(smooth(0.12, 1, L));
    const sway = (reduced ? 0 : 1) * (1 - cb * 0.85);
    const dist = f.dist + boost * 3.5;
    _camOff.set(
      f.camX + sway * (Math.sin(time * 0.21) * 0.5 - px * 0.7),
      f.camY + sway * (Math.sin(time * 0.27 + 1) * 0.3 + py * 0.35),
      dist,
    );
    _camOff.applyQuaternion(camQuat);
    camera.position.copy(_rigPos).add(_camOff);
    _look.set(f.lookX, f.lookY, -40).applyQuaternion(camQuat).add(_rigPos);
    camera.up.set(0, 1, 0).applyQuaternion(camQuat);
    let fov = f.fov + (reduced ? 0 : boost * 6);
    if (cb > 0) {
      const e = endCfg;
      _v.copy(landing.touch).addScaledVector(landing.right, e.x).addScaledVector(landing.up, e.y).addScaledVector(landing.fwd, -e.back);
      _v.addScaledVector(landing.right, sway * Math.sin(time * 0.17) * 0.3).addScaledVector(landing.up, sway * Math.sin(time * 0.23) * 0.15);
      camera.position.lerp(_v, cb);
      _v.copy(landing.touch).addScaledVector(landing.right, e.lookX).addScaledVector(landing.up, e.lookY).addScaledVector(landing.fwd, 60);
      _look.lerp(_v, cb);
      camera.up.lerp(landing.up, cb).normalize();
      fov += (e.fov - fov) * cb;
    }
    camera.lookAt(_look);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    pxScale = height / (2 * Math.tan((camera.fov * Math.PI) / 360));

    // Lights ride with the camera frame.
    _v.set(0.55, 1.0, 0.5).applyQuaternion(camQuat).multiplyScalar(60).add(_rigPos);
    key.position.copy(_v);
    key.target.position.copy(_rigPos);
    _v.set(0.3, 0.18, -1.0).applyQuaternion(camQuat).multiplyScalar(60).add(_rigPos);
    rim.position.copy(_v);
    rim.target.position.copy(_rigPos);
    _rimColor.copy(_color);
    rim.color.copy(_rimColor);
    key.target.updateMatrixWorld();
    rim.target.updateMatrixWorld();
    (scene.fog as FogExp2).color.setRGB(0.012, 0.014, 0.03).lerp(_color, 0.04);

    space.update({ p, time, dt, speed, boost, color: _color, camera, fwd: _fwd, reduced, pxScale, dpr });

    // Where the ship sits on screen, so the lens can leave it alone.
    sr.getWorldPosition(_v);
    _v2.copy(_v).project(camera);
    const sx = _v2.x * 0.5 + 0.5;
    const sy = _v2.y * 0.5 + 0.5;
    const depth = _v.sub(camera.position).dot(camera.getWorldDirection(_v2));
    const sRad = ship.radius / Math.max(1, depth) / (2 * Math.tan((camera.fov * Math.PI) / 360));

    // Flare from the brightest light in view.
    const fl = space.flare;
    let flareStrength = 0;
    let fx = 0;
    let fy = 0;
    if (fl.strength > 0.001) {
      _v.copy(fl.pos).project(camera);
      if (_v.z < 1 && _v.z > -1) {
        fx = _v.x * 0.5 + 0.5;
        fy = _v.y * 0.5 + 0.5;
        const edge = Math.min(fx + 0.15, 1.15 - fx, fy + 0.15, 1.15 - fy);
        flareStrength = fl.strength * clamp(edge / 0.2, 0, 1);
      }
    }

    // Pointer lens: strong while the pointer moves fast, a gentle bend at rest.
    let lensStrength = 0;
    if (lensOn && hasPointer) {
      const tx = ptx * 0.5 + 0.5;
      const ty = 0.5 - pty * 0.5;
      const moved = Math.hypot(tx - lensX, ty - lensY) / Math.max(dt, 1e-3);
      lensX = damp(lensX, tx, 14, dt);
      lensY = damp(lensY, ty, 14, dt);
      const energy = clamp(moved * 0.35, 0, 1);
      lensEnergy = energy > lensEnergy ? damp(lensEnergy, energy, 10, dt) : damp(lensEnergy, energy, 1.6, dt);
      lensAmt = damp(lensAmt, 1, 2, dt);
      lensStrength = lensAmt * (0.32 + 0.68 * lensEnergy);
    }

    fadeIn = Math.min(1, fadeIn + dt * 1.6);
    pf.time = reduced ? 0 : time;
    pf.fade = fadeIn;
    pf.flare.x = fx;
    pf.flare.y = fy;
    pf.flare.strength = flareStrength;
    pf.flare.color.copy(fl.color);
    pf.lens.x = lensX;
    pf.lens.y = lensY;
    pf.lens.strength = lensStrength;
    pf.lens.radius = 0.035 + 0.03 * lensEnergy;
    pf.lens.color.copy(_color);
    pf.ship.x = sx;
    pf.ship.y = sy;
    pf.ship.radius = sRad;
    post.render(scene, camera, pf);
  }

  // One frame description reused by the post pass so the loop stays allocation free.
  const pf: PostFrame = {
    time: 0,
    fade: 0,
    flare: { x: 0, y: 0, strength: 0, color: new Color() },
    lens: { x: 0.5, y: 0.5, strength: 0, radius: 0.05, color: new Color() },
    ship: { x: 0.7, y: 0.3, radius: 0.1 },
  };

  function loop(now: number) {
    raf = 0;
    if (paused || disposed || lost) return;
    raf = requestAnimationFrame(loop);
    if (resizeDirty || !sized) applySize();
    const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 1 / 60;
    last = now;
    step(dt);
    if (!firstFrame) {
      firstFrame = true;
      canvas.dispatchEvent(new CustomEvent("journeyready"));
    }
  }

  function start() {
    if (raf || paused || disposed || lost || !ready) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // Warm up every shader before the first frame, including set pieces that
  // are hidden until later chapters, so nothing stutters mid flight.
  applySize();
  path.frame(0, _rigPos, _rigQuat);
  camera.position.copy(_rigPos).add(_v.set(0, 5, 20));
  camera.lookAt(_rigPos);
  camera.updateMatrixWorld();
  const hidden: Object3D[] = [];
  for (const pc of space.pieces) {
    if (!pc.group.visible) hidden.push(pc.group);
    pc.group.visible = true;
  }
  const warm = (renderer as unknown as { compileAsync?: (s: Scene, c: PerspectiveCamera) => Promise<unknown> }).compileAsync;
  const afterCompile = () => {
    for (const g of hidden) g.visible = false;
    if (disposed) return;
    ready = true;
    start();
  };
  if (warm) warm.call(renderer, scene, camera).then(afterCompile, afterCompile);
  else {
    renderer.compile(scene, camera);
    afterCompile();
  }

  // DEBUG_HOOK_START
  (window as unknown as { __jdbg: unknown }).__jdbg = { scene, ship, rig, space, camera, post };
  // DEBUG_HOOK_END

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    stop();
  };
  const onRestored = () => {
    lost = false;
    envRT.dispose();
    envRT = environment(renderer);
    scene.environment = envRT.texture;
    width = 0;
    height = 0;
    resizeDirty = true;
    start();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  return {
    setScroll(progress: number, velocity: number) {
      if (!Number.isFinite(progress)) return;
      targetP = clamp(progress, 0, maxP);
      repVel = Number.isFinite(velocity) ? clamp(velocity, -6, 6) : 0;
      lastScrollAt = performance.now();
      // The first value jumps straight there, so a reload mid page does not
      // replay the whole flight.
      if (!snapped) {
        snapped = true;
        p = targetP;
        v = 0;
      }
    },
    setPointer(nx: number, ny: number) {
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
      ptx = clamp(nx, -1, 1);
      pty = clamp(ny, -1, 1);
      if (!hasPointer) {
        hasPointer = true;
        lensX = ptx * 0.5 + 0.5;
        lensY = 0.5 - pty * 0.5;
      }
    },
    setPaused(next: boolean) {
      if (paused === next) return;
      paused = next;
      if (paused) stop();
      else start();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      const mats = new Set<Material>();
      scene.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as Material | Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
        else if (mat) mats.add(mat);
        const inst = o as unknown as { dispose?: () => void; isInstancedMesh?: boolean };
        if (inst.isInstancedMesh && inst.dispose) inst.dispose();
      });
      for (const m of mats) m.dispose();
      for (const t of textures) t.dispose();
      envRT.dispose();
      post.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
