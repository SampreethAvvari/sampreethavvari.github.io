// The Work world's engine: one renderer, one scene, one loop. The station and
// the trail live in the same space; the page tells the engine where it is
// scrolled, and the engine turns that into a camera. It survives moves between
// /work and /work/<slug>, so flying into a bay never drops a frame. Everything
// it makes is released by destroy().

import { Governor } from "../gl-governor";
import { breathe, prelink, quietShaderChecks, warmAhead } from "../gl-warm";
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  LinearSRGBColorSpace,
  NoToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  type Object3D,
} from "three";
import { BAY_IDS, buildBays, type BayId } from "./bays";
import { Post } from "./post";
import { INSIDE_PHI, STATION_PHI, Track, bayToWorld, bayUp, indexKeys, interiorKeys, newPose, worldToBay, type Pose } from "./shots";
import { SUN_DIR, buildSky } from "./sky";
import { buildStation, bayAngle } from "./station";
import { buildTrail } from "./trail";
import { DEG, clamp, damp, inOut, lerp, range, smooth } from "./util";

export type Hit =
  | { kind: "bay"; bay: number; id: BayId; part?: { id: string; note: number } }
  | { kind: "body"; stop: string; id: string; note: number };

export interface WorldOptions {
  low: boolean;
  reduced: boolean;
  /** Draws one frame on request and never loops. */
  still?: boolean;
}

export interface FrameInfo {
  camera: PerspectiveCamera;
  q: number;
  vel: number;
  flying: boolean;
}

type PageMode = { kind: "index" } | { kind: "bay"; id: BayId; stops: number };

const IDX = (id: BayId) => BAY_IDS.indexOf(id);

export async function mountWorld(canvas: HTMLCanvasElement, opts: WorldOptions) {
  const { low, reduced } = opts;
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false, alpha: false });
  quietShaderChecks(renderer);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.autoClear = false;
  const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
  const shadows = !low;
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
  }
  const post = new Post(renderer, { low, msaa: low ? 0 : 4 });

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 1, 26000);
  camera.matrixAutoUpdate = true;

  // Built in steps, with the page's turn between them, so a scroll that starts
  // while the world loads is never held up.
  await breathe();
  const sky = await buildSky(renderer, { low, hdr });
  scene.add(sky.dome, sky.stars, sky.corona);
  scene.environment = sky.env;
  scene.environmentIntensity = 0.85;

  const station = buildStation({ low });
  scene.add(station.root);
  await breathe();
  const baysKit = buildBays({ low });
  baysKit.bays.forEach((b) => station.ring.add(b.group));
  await breathe();

  const trail = buildTrail({ low, font: "Inter, Arial, sans-serif" });
  scene.add(trail.group);
  await breathe();

  // Light: the star, a little bounce, and three lamps the active bay borrows.
  const sun = new DirectionalLight(new Color(1, 0.72, 0.44), 5.6);
  sun.position.copy(SUN_DIR).multiplyScalar(1600);
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -430;
    c.right = 430;
    c.top = 430;
    c.bottom = -430;
    c.near = 900;
    c.far = 2400;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.8;
  }
  scene.add(new HemisphereLight(new Color(0.4, 0.34, 0.3), new Color(0.03, 0.03, 0.04), 0.5));
  // Light coming back off the dust: it shows the plating on the shadowed side.
  const bounce = new DirectionalLight(new Color(0.72, 0.78, 0.92), 0.95);
  bounce.position.set(380, -520, 900);
  scene.add(bounce);
  const lamps = [0, 1, 2].map(() => {
    const l = new PointLight(new Color(1, 0.64, 0.3), 0, 160, 1.7);
    scene.add(l);
    return l;
  });

  // Tracks.
  const curveAt = (u: number) => trail.curve.getPointAt(clamp(u));
  let wide = innerWidth / Math.max(1, innerHeight) > 1;
  let indexTrack = new Track(indexKeys(curveAt, trail.uAtZ, wide));
  let page: PageMode = { kind: "index" };
  let track = indexTrack;
  // Set by a flight into a bay: the scroll of the page being left no longer
  // counts, and the words stay hidden, until the next page takes over.
  let holding = false;

  // Where things are.
  const pose = newPose();
  const shown = newPose();
  let q = 0;
  let qs = 0;
  let vel = 0;
  let snapNext = true;
  let time = 0;
  let last = performance.now();
  let raf = 0;
  let paused = false;
  let dead = false;
  const ptr = new Vector2();
  const ptrS = new Vector2();
  let ringNow = 0;
  let ringPrev = 1e9;
  let fade = 0;
  let intro = reduced ? 1 : 0;
  let flash = 0;
  let extraWarp = 0;
  let irisOpen = 0;
  let insideK = 0;
  let compiling = false;
  const shadeNow = new Vector4();
  const shadeT = new Vector4();

  // Bay state.
  const open = [0, 0, 0, 0];
  const openT = [0, 0, 0, 0];
  const power = [0, 0, 0, 0];
  const powerT = [0, 0, 0, 0];

  // Flights: moves the scroll does not drive, written in the frame of one bay
  // so the ring can turn underneath them.
  type Flight = {
    bay: number;
    t0: number;
    dur: number;
    from: { p: Vector3; l: Vector3; up: Vector3; f: number; r: number };
    via: Vector3 | null;
    to: () => { p: Vector3; l: Vector3; f: number; r: number };
    phi0: number;
    phi1: number;
    done?: () => void;
    settled?: boolean;
    /** Set on a move between two bays: the bay left behind, and the ring's start and end. */
    across?: { from: number; a0: number; a1: number; out: Vector3; lookOut: Vector3 };
  };
  let flight: Flight | null = null;

  const camUp = new Vector3();
  const look = new Vector3();
  const tmp = new Vector3();
  const tmp2 = new Vector3();
  const qRoll = new Quaternion();
  const dir = new Vector3();
  const sunNdc = new Vector3();
  const sunFrame = new Vector3();
  const raycaster = new Raycaster();

  const sizeState = { w: 0, h: 0, dpr: 1, scale: 1 };
  let stopWarm: (() => void) | null = null;
  const maxDpr = low ? 1.5 : Math.min(2, devicePixelRatio || 1);
  // The canvas's size comes from an observer: reading it here, every frame, made
  // the browser lay out the page just before the frame's own writes.
  let cssW = 0;
  let cssH = 0;
  const sizeWatch = new ResizeObserver(([e]) => {
    cssW = Math.round(e.contentRect.width);
    cssH = Math.round(e.contentRect.height);
  });
  sizeWatch.observe(canvas);
  function resize(force = false) {
    if (!cssW || !cssH) {
      const rect = canvas.getBoundingClientRect();
      cssW = Math.round(rect.width);
      cssH = Math.round(rect.height);
    }
    const w = Math.max(1, cssW);
    const h = Math.max(1, cssH);
    // Phones fire resize as the address bar moves; only a change of width, or a
    // large change of height, is a real one.
    if (!force && w === sizeState.w && Math.abs(h - sizeState.h) < 120) return;
    sizeState.w = w;
    sizeState.h = h;
    const dpr = Math.min(maxDpr, devicePixelRatio || 1) * sizeState.scale;
    sizeState.dpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    post.setSize(Math.round(w * dpr), Math.round(h * dpr));
    camera.aspect = w / h;
    const nowWide = w / h > 1;
    if (nowWide !== wide) {
      wide = nowWide;
      indexTrack = new Track(indexKeys(curveAt, trail.uAtZ, wide));
      if (page.kind === "index") track = indexTrack;
    }
  }

  // Fewer pixels when frames run slow and that helps, and back again when there
  // is room. Never the picture's parts.
  const governor = new Governor({
    steps: low ? [1, 0.88, 0.78] : [1, 0.85, 0.72, 0.6],
    apply: (scale) => {
      sizeState.scale = scale;
      resize(true);
    },
  });

  function poseFor(o: Pose) {
    track.at(qs, o);
  }

  function applyCamera(p: Vector3, l: Vector3, up: Vector3, rollDeg: number, fov: number) {
    camera.position.copy(p);
    camera.up.copy(up);
    camera.lookAt(l);
    dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    qRoll.setFromAxisAngle(dir, rollDeg * DEG);
    camera.quaternion.premultiply(qRoll);
    if (camera.fov !== fov) {
      camera.fov = fov;
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  const idleTurn = (t: number) => t * 0.012;

  function phiForBay(i: number, ringAngle: number) {
    return ringAngle + bayAngle(i);
  }

  function setRing(a: number) {
    ringNow = a;
    station.ring.rotation.z = a;
  }

  function lightBay(i: number, gain: number) {
    const bay = baysKit.bays[i];
    const phi = phiForBay(i, ringNow);
    bay.lights.forEach((l, k) => {
      const lamp = lamps[k];
      bayToWorld(phi, tmp.set(...l.p), lamp.position);
      lamp.intensity = l.i * gain;
      lamp.distance = l.d * 1.8;
      if (l.c) lamp.color.setRGB(...l.c);
      else lamp.color.setRGB(1, 0.64, 0.3);
    });
  }

  function frame() {
    if (dead) return;
    raf = opts.still ? 0 : requestAnimationFrame(frame);
    const now = performance.now();
    if (paused) {
      last = now;
      return;
    }
    const dtMs = clamp(now - last, 0, 100);
    governor.frame(now - last, Math.abs(vel) > 0.02 || !!flight);
    last = now;
    const dt = dtMs / 1000;
    time += dt;
    resize();

    // Scroll eases toward where the page is.
    const prev = qs;
    if (snapNext) {
      qs = q;
      snapNext = false;
    } else {
      qs = damp(qs, q, reduced ? 60 : 7.5, dt);
    }
    vel = damp(vel, (qs - prev) / Math.max(1e-3, dt), 10, dt);

    poseFor(pose);
    if (debugPose) {
      pose.p.fromArray(debugPose.p);
      pose.l.fromArray(debugPose.l);
      pose.r = debugPose.r ?? pose.r;
      pose.f = debugPose.f ?? pose.f;
      if (debugPose.a !== undefined) pose.a = debugPose.a;
      if (debugPose.u !== undefined) pose.u = debugPose.u;
      if (debugPose.up) pose.up.fromArray(debugPose.up);
    }
    let flying = false;
    let pFinal = pose.p;
    let lFinal = pose.l;
    let upFinal = pose.up;
    let rFinal = pose.r;
    let fFinal = pose.f;
    let a = pose.a;

    if (flight) {
      flying = true;
      const f = flight;
      const k = clamp((now - f.t0) / f.dur);
      const e = inOut(k);
      const phi = lerp(f.phi0, f.phi1, e);
      a = phi - bayAngle(f.bay);
      const to = f.to();
      if (f.across) {
        // Three moves in one: back out, the ring turns, then in. Only the ring moves in the middle.
        const x = f.across;
        const out = smooth(k / 0.36);
        const turn = inOut(range(k, 0.26, 0.74));
        const inn = smooth((k - 0.64) / 0.36);
        a = lerp(x.a0, x.a1, turn);
        bayToWorld(INSIDE_PHI, tmp.copy(f.from.p).lerp(x.out, out).lerp(to.p, inn), shown.p);
        bayToWorld(INSIDE_PHI, tmp2.copy(f.from.l).lerp(x.lookOut, out).lerp(to.l, inn), shown.l);
        bayUp(INSIDE_PHI, shown.up);
        pFinal = shown.p;
        lFinal = shown.l;
        upFinal = shown.up;
        rFinal = lerp(f.from.r, to.r, inn);
        fFinal = lerp(f.from.f, to.f, inn) + Math.sin(k * Math.PI) * 10;
        extraWarp = Math.sin(turn * Math.PI) * 0.5;
        if (k >= 1 && !f.settled) {
          f.settled = true;
          flight = null;
          f.done?.();
        }
      } else {
      // In the bay's own frame: a curve through the mouth.
      const u = 1 - e;
      if (f.via) {
        tmp.copy(f.from.p).multiplyScalar(u * u).addScaledVector(f.via, 2 * u * e).addScaledVector(to.p, e * e);
      } else {
        tmp.copy(f.from.p).lerp(to.p, e);
      }
      tmp2.copy(f.from.l).lerp(to.l, e);
      bayToWorld(phi, tmp, shown.p);
      bayToWorld(phi, tmp2, shown.l);
      bayUp(phi, shown.up);
      pFinal = shown.p;
      lFinal = shown.l;
      upFinal = shown.up.lerp(f.from.up, 1 - smooth(k * 2)).normalize();
      rFinal = lerp(f.from.r, to.r, e);
      fFinal = lerp(f.from.f, to.f, e);
      // A hump of wide lens at the moment of passing the doors.
      const pass = Math.sin(k * Math.PI);
      fFinal += pass * 12;
      extraWarp = pass * 0.8;
      flash = Math.max(flash, 0);
      if (k >= 1 && !f.settled) {
        f.settled = true;
        flight = null;
        f.done?.();
      }
      }
    } else {
      extraWarp = damp(extraWarp, 0, 6, dt);
    }

    // On the first screen the ring keeps turning, and its spokes sweep the light.
    if (page.kind === "index" && !reduced) a += idleTurn(time) * (1 - smooth(qs * 2.2));
    setRing(a);
    station.hub.rotation.z = -a * 0.3 + time * 0.006;

    // Hand and breath: the pointer leans the camera, very slightly.
    ptrS.x = damp(ptrS.x, ptr.x, 3, dt);
    ptrS.y = damp(ptrS.y, ptr.y, 3, dt);
    look.copy(lFinal);
    tmp.copy(pFinal);
    if (!reduced) {
      const dist = tmp2.subVectors(lFinal, pFinal).length();
      const lean = (flying ? 0.004 : 0.018) * dist;
      camUp.copy(upFinal);
      dir.copy(tmp2).normalize();
      const right = tmp2.crossVectors(dir, camUp).normalize();
      tmp.addScaledVector(right, ptrS.x * lean).addScaledVector(camUp, -ptrS.y * lean * 0.7);
      tmp.addScaledVector(camUp, Math.sin(time * 0.31) * lean * 0.08);
      tmp.addScaledVector(right, Math.sin(time * 0.23) * lean * 0.1);
    }
    const kick = reduced ? 0 : Math.min(16, Math.abs(vel) * 22);
    applyCamera(tmp, look, upFinal, rFinal, fFinal + kick);

    // Which parts of the world are worth drawing.
    const onIndex = page.kind === "index";
    const trailOn = onIndex && qs > 4.4;
    const stationOn = !onIndex || qs < 5.7 || qs > 9.4;
    trail.group.visible = trailOn;
    station.root.visible = stationOn;
    const focus = page.kind === "bay" ? IDX(page.id) : onIndex && qs > 0.45 && qs < 4.6 ? clamp(Math.round(qs - 1), 0, 3) : -1;

    // Bays.
    for (let i = 0; i < 4; i++) {
      open[i] = reduced ? openT[i] : damp(open[i], openT[i], 3.4, dt);
      power[i] = reduced ? powerT[i] : damp(power[i], powerT[i], 2.4, dt);
      const bay = baysKit.bays[i];
      const phi = phiForBay(i, ringNow);
      const near = i === focus || flight?.bay === i || flight?.across?.from === i || (onIndex && Math.abs(phi - STATION_PHI[0] * DEG) < 1.2 && qs < 1.5);
      bay.inside.visible = stationOn && (near || (onIndex && open[i] > 0.02));
      bay.update(time, dt, open[i], power[i], page.kind === "bay" && !flight && IDX(page.id) === i);
    }
    baysKit.tick(time);
    station.setTime(time);
    const lampBay = flight ? flight.bay : focus;
    if (stationOn && lampBay >= 0) {
      lightBay(lampBay, (0.16 + 0.84 * power[lampBay]) * (0.1 + 0.9 * Math.max(open[lampBay], page.kind === "bay" ? 1 : 0)));
    } else {
      for (const l of lamps) l.intensity = 0;
    }

    // The trail.
    const u = pose.u;
    if (trailOn) {
      irisOpen = range(qs, 8.5, 9.0) * 0.32 + range(qs, 9.05, 9.5) * 0.68;
      const nowOn = range(qs, 10.6, 11);
      // The giant is small and far until the path swings toward it, and again after.
      const giantScale = lerp(0.2, 1, smooth((qs - 7.1) / 0.8)) * lerp(1, 0.2, smooth((qs - 9.1) / 0.7));
      trail.update(time, dt, u, sizeState.dpr, sizeState.h, camera.fov, { servicesOn: nowOn, irisOpen, giantScale, cam: camera.position, speed: Math.abs(vel) });
      // The comet carries a lamp along.
      if (qs > 5.5 && qs < 10.8) {
        lamps[0].position.copy(trail.headPosition);
        lamps[0].intensity = 9000;
        lamps[0].distance = 700;
        lamps[0].color.setRGB(1, 0.68, 0.34);
      }
    }

    // Indoors, only the bay's own lamps count. The dock has no walls.
    const indoors = page.kind === "bay" && page.id !== "fde" && (!flight || now - flight.t0 > flight.dur * 0.45) ? 1 : 0;
    insideK = damp(insideK, indoors, 2.2, dt);
    bounce.intensity = 0.95 * (1 - insideK * 0.92);
    sun.intensity = 5.6 * (1 - insideK * 0.97);
    // The star comes up as the page opens.
    const rise = reduced ? 1 : smooth(time / 2.8);
    sky.update(camera.position, time, pose.sun * (0.55 + 0.45 * rise), pose.sky * (0.3 + 0.7 * rise), sizeState.dpr);

    // Shadows only change when the ring does.
    if (shadows && stationOn && Math.abs(ringNow - ringPrev) > 0.0025) {
      ringPrev = ringNow;
      sun.target.updateMatrixWorld();
      renderer.shadowMap.needsUpdate = true;
    }

    // Where the star is in the frame, for the shafts and the streak.
    sunNdc.copy(camera.position).addScaledVector(SUN_DIR, 12000).project(camera);
    const inFront = dir.set(0, 0, -1).applyQuaternion(camera.quaternion).dot(SUN_DIR) > 0;
    const sx = sunNdc.x * 0.5 + 0.5;
    const sy = sunNdc.y * 0.5 + 0.5;
    const off = Math.max(Math.abs(sunNdc.x), Math.abs(sunNdc.y));
    const sunVis = inFront ? 1 - smooth((off - 1.1) / 0.9) : 0;
    sunFrame.set(sx, sy, sunVis * pose.sun);

    fade = reduced ? 1 : damp(fade, 1, 3.2, dt);
    intro = smooth(time / 2.6);
    flash = damp(flash, 0, 5, dt);
    const speed = Math.abs(vel);
    const warp = reduced ? 0 : clamp(speed * 0.5 * (trailOn ? 1.6 : 0.5) + extraWarp, 0, 1.1);

    post.render(scene, camera, {
      time,
      fade,
      warp,
      flash,
      sun: sunFrame,
      rays: sunVis * (0.34 + 0.66 * pose.sun) * 0.5 * (0.1 + 0.9 * rise),
      shade: shadeNow.set(
        (shadeNow.x = damp(shadeNow.x, shadeT.x, 3.5, dt)),
        (shadeNow.y = damp(shadeNow.y, shadeT.y, 3.5, dt)),
        (shadeNow.z = damp(shadeNow.z, shadeT.z, 3.5, dt)),
        (shadeNow.w = damp(shadeNow.w, shadeT.w, 3.5, dt)),
      ),
      exposure: reduced ? 1 : 0.62 + 0.38 * intro,
    });
    listeners.forEach((cb) => cb({ camera, q: qs, vel, flying: flying || holding }));
  }

  const listeners = new Set<(f: FrameInfo) => void>();
  let debugPose: { p: number[]; l: number[]; r?: number; f?: number; a?: number; u?: number; up?: number[] } | null = null;

  const v2 = new Vector2();
  const shown3 = (o: Object3D | null) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };

  return {
    canvas,
    camera,
    debug: import.meta.env.DEV ? { renderer, scene, post, sky, station, trail, baysKit, lamps, sun, pose, setPose: (x: typeof debugPose) => { debugPose = x; } } : null,
    onFrame(cb: (f: FrameInfo) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    setScroll(p: number, snap = false) {
      if (holding && !snap) return;
      if (snap) holding = false;
      q = p;
      if (snap) snapNext = true;
    },
    setPointer(nx: number, ny: number) {
      ptr.set(nx, ny);
    },
    setPaused(p: boolean) {
      paused = p;
    },
    setBay(i: number, openTarget: number, powerTarget: number) {
      openT[i] = openTarget;
      powerT[i] = powerTarget;
    },
    bayState(i: number) {
      return { open: open[i], power: power[i] };
    },
    /** Which side of the picture the words want dark: bl, br, tl, tr, b, all, or nothing. */
    setShade(kind: string) {
      const map: Record<string, [number, number, number, number]> = {
        bl: [-1, -1, 0.74, 0],
        br: [1, -1, 0.74, 0],
        tl: [-1, 1, 0.7, 0],
        tr: [1, 1, 0.7, 0],
        b: [0, -1, 0.74, 0],
        all: [0, 0, 0.62, 1],
      };
      const m = map[kind] ?? [shadeT.x, shadeT.y, 0, 0];
      if (!wide && kind && kind !== "all") shadeT.set(0, -1, 0.88, 0);
      else shadeT.set(m[0], m[1], m[2], m[3]);
    },
    setHotStop(id: string, v: number) {
      trail.setHot(id, v);
    },
    /** Switch what the scroll means, for the page being shown. */
    setPage(m: PageMode) {
      page = m;
      if (m.kind === "index") track = indexTrack;
      else track = new Track(interiorKeys(m.id, m.stops));
    },
    pageKind: () => page,
    /** The camera pose of any stop on the current page. */
    stopPose(i: number, o: Pose) {
      return track.at(i, o);
    },
    pick(nx: number, ny: number): Hit | null {
      v2.set(nx, -ny);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(v2, camera);
      const inTrail = trail.group.visible;
      if (inTrail) {
        for (const h of trail.hits) {
          if (!shown3(h.mesh.parent)) continue;
          const r = raycaster.intersectObject(h.mesh, false);
          if (r.length) {
            const x = h.read(h.mesh);
            return { kind: "body", stop: h.stop, id: x.id, note: x.note };
          }
        }
      }
      if (station.root.visible) {
        let best: Hit | null = null;
        let bestD = 1e9;
        for (const bay of baysKit.bays) {
          if (bay.inside.visible) {
            for (const part of bay.parts) {
              const r = raycaster.intersectObject(part.mesh, false);
              if (r.length && r[0].distance < bestD) {
                const info = part.read(r[0].uv ?? undefined);
                part.touch?.(r[0].uv ?? null);
                bestD = r[0].distance;
                best = { kind: "bay", bay: bay.index, id: bay.id, part: info };
              } else if (!r.length) part.touch?.(null);
            }
          }
          const r = raycaster.intersectObject(bay.hit, false);
          if (r.length && r[0].distance <= bestD + 0.01) {
            if (!best || (best.kind === "bay" && best.bay !== bay.index) ) {
              bestD = r[0].distance;
              best = { kind: "bay", bay: bay.index, id: bay.id };
            }
          }
        }
        if (best) return best;
      }
      return null;
    },
    /** Fly from wherever the camera is into a bay's first interior stop. */
    flyIn(id: BayId, stops: number, done?: () => void, dur = 1500) {
      const i = IDX(id);
      const phi0 = phiForBay(i, ringNow);
      const from = {
        p: worldToBay(phi0, camera.position.clone()),
        l: worldToBay(phi0, look.clone()),
        up: camera.up.clone(),
        f: camera.fov,
        r: rollNow(),
      };
      const nextTrack = new Track(interiorKeys(id, stops));
      const inner = nextTrack.at(0, newPose());
      const toP = worldToBay(INSIDE_PHI, inner.p.clone());
      const toL = worldToBay(INSIDE_PHI, inner.l.clone());
      // The hall is what the camera lands in, whether or not the page has come yet.
      page = { kind: "bay", id, stops };
      track = nextTrack;
      q = 0;
      qs = 0;
      vel = 0;
      holding = true;
      flight = {
        bay: i,
        t0: performance.now(),
        dur: reduced ? 1 : dur,
        from,
        via: new Vector3(0, -2, 60),
        to: () => ({ p: toP, l: toL, f: inner.f, r: inner.r }),
        phi0,
        phi1: INSIDE_PHI,
        done,
      };
    },
    /** Fly out of a bay to a stop on the index track. */
    flyOut(id: BayId, toStop: number, done?: () => void, dur = 1500) {
      const i = IDX(id);
      const target = indexTrack.at(toStop, newPose());
      const phi0 = phiForBay(i, ringNow);
      const phi1 = phiForBay(i, target.a);
      const from = {
        p: worldToBay(phi0, camera.position.clone()),
        l: worldToBay(phi0, look.clone()),
        up: camera.up.clone(),
        f: camera.fov,
        r: rollNow(),
      };
      const toP = worldToBay(phi1, target.p.clone());
      const toL = worldToBay(phi1, target.l.clone());
      flight = {
        bay: i,
        t0: performance.now(),
        dur: reduced ? 1 : dur,
        from,
        via: new Vector3(0, -2, 70),
        to: () => ({ p: toP, l: toL, f: target.f, r: target.r }),
        phi0,
        phi1,
        done,
      };
    },
    /** Out of one bay, the ring turns, into the next, inside one shot. */
    flyAcross(fromId: BayId, toId: BayId, stops: number, done?: () => void, dur = 2200) {
      const fromI = IDX(fromId);
      const toI = IDX(toId);
      const inner = new Track(interiorKeys(toId, stops)).at(0, newPose());
      const a0 = INSIDE_PHI - bayAngle(fromI);
      let a1 = INSIDE_PHI - bayAngle(toI);
      // The short way round.
      while (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
      while (a1 - a0 < -Math.PI) a1 += Math.PI * 2;
      const from = {
        p: worldToBay(INSIDE_PHI, camera.position.clone()),
        l: worldToBay(INSIDE_PHI, look.clone()),
        up: camera.up.clone(),
        f: camera.fov,
        r: rollNow(),
      };
      const toP = worldToBay(INSIDE_PHI, inner.p.clone());
      const toL = worldToBay(INSIDE_PHI, inner.l.clone());
      flight = {
        bay: toI,
        t0: performance.now(),
        dur: reduced ? 1 : dur,
        from,
        via: null,
        to: () => ({ p: toP, l: toL, f: inner.f, r: inner.r }),
        phi0: INSIDE_PHI,
        phi1: INSIDE_PHI,
        done,
        across: { from: fromI, a0, a1, out: new Vector3(0, -6, 150), lookOut: new Vector3(0, -2, -60) },
      };
      openT[fromI] = 1;
      powerT[fromI] = 1;
    },
    flying: () => !!flight,
    snap() {
      snapNext = true;
      qs = q;
    },
    /** Render one frame now, for testing and for the calm version. */
    renderOnce() {
      const was = paused;
      paused = false;
      frame();
      paused = was;
    },
    start() {
      resize(true);
      last = performance.now();
      if (opts.still) {
        frame();
        return;
      }
      if (raf || compiling) return;
      compiling = true;
      const go = () => {
        compiling = false;
        if (dead || raf) return;
        last = performance.now();
        governor.reset();
        raf = requestAnimationFrame(frame);
        // Everything not on screen yet goes to the GPU a piece at a time, so no
        // bay or stretch of the trail arrives with a stall.
        if (!stopWarm) stopWarm = warmAhead(renderer, scene, camera, [station.root, ...baysKit.bays.map((b) => b.group), trail.group], trail.textures);
      };
      // Against the target the scene is really drawn to: the shaders differ by what they output to.
      Promise.race([Promise.all([prelink(renderer, scene, camera, post.sceneTarget), post.warm()]), new Promise((r) => setTimeout(r, 6000))]).then(go, go);
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      stopWarm?.();
      sizeWatch.disconnect();
      listeners.clear();
      station.dispose();
      baysKit.dispose();
      trail.dispose();
      sky.dispose();
      post.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };

  function rollNow() {
    // The roll we are showing, read back as what the last pose asked for.
    return flight ? 0 : pose.r;
  }
}
export type World = Awaited<ReturnType<typeof mountWorld>>;
export { mountPanels } from "./panels";
export { newPose } from "./shots";
