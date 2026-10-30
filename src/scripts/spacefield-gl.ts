// The star field's WebGL: the shaders and one frame of drawing. Shared by the
// worker, which draws on an OffscreenCanvas so nothing here ever runs on the
// page's main thread, and by the main thread fallback for browsers without
// OffscreenCanvas. See SpaceField.astro for what the sky looks like and why.

/** What the page tells the sky: where it is scrolled, the section colours,
 *  and when the loader handed over (epoch ms), if it has. */
export type SkyInput = { scrollY: number; th1: number[]; th2: number[]; arrivedAt: number | null };

export type Sky = {
  /** Calls back once the shaders are linked (true) or failed (false). */
  whenReady: (cb: (ok: boolean) => void, later: (cb: () => void) => void) => void;
  resize: (width: number, height: number, dpr: number) => void;
  frame: (input: SkyInput) => void;
};

/** Epoch milliseconds, comparable between the page and a worker. */
export const epochNow = () => performance.timeOrigin + performance.now();


const STAR_VS = `
attribute float aZ;     // depth seed in [0,1)
attribute float aS;     // per-star seed in [0,1)
uniform float uCam; uniform float uT; uniform float uAspect; uniform float uDpr;
uniform vec3 uTheme1; uniform vec3 uTheme2;
varying vec3 vC; varying float vA; varying float vAng; varying float vStr;
const float DEPTH = 40.0;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  // Life cycle: fade in, live, fade out, respawn at a fresh position.
  float period = 6.0 + aS * 10.0;
  float cycle = floor(uT / period + aS * 7.0);
  float phase = fract(uT / period + aS * 7.0);
  float hx = hash(aS * 127.1 + cycle * 311.7);
  float hy = hash(aS * 269.5 + cycle * 183.3);
  vec2 base = (vec2(hx, hy) * 2.0 - 1.0) * 7.0;
  base += vec2(sin(uT * 0.2 + aS * 40.0), cos(uT * 0.17 + aS * 29.0)) * 0.25;
  float z = mod(aZ * DEPTH - uCam, DEPTH) + 0.6;
  vec2 ndc = vec2(base.x / (z * 0.16 * uAspect), base.y / (z * 0.16));
  gl_Position = vec4(ndc, 0.0, 1.0);
  float life = smoothstep(0.0, 0.16, phase) * (1.0 - smoothstep(0.82, 1.0, phase));
  float tw = 0.78 + 0.22 * sin(uT * (0.5 + aS * 1.6) + aS * 43.0);
  float far = clamp(1.6 - z / 26.0, 0.18, 1.0);
  float near = smoothstep(0.6, 2.2, z);
  vA = life * tw * far * near;
  vec3 theme = mix(uTheme1, uTheme2, hash(aS * 7.3));
  vC = mix(vec3(0.94, 0.95, 1.0), theme, hash(aS * 17.7) * 0.85);
  // Radial angle of this star on screen, so the fragment can streak it
  // outward from center when the camera accelerates (warp feel). Near
  // stars streak more than far ones.
  vAng = atan(ndc.y, ndc.x);
  vStr = mix(2.4, 0.4, clamp(z / DEPTH, 0.0, 1.0));
  gl_PointSize = clamp((0.7 + aS * 1.6) * (22.0 / z) * uDpr, 1.0, 26.0);
}`;
const STAR_FS = `
precision mediump float;
uniform float uVel;
varying vec3 vC; varying float vA; varying float vAng; varying float vStr;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vAng), s = sin(vAng);
  p = vec2(c * p.x + s * p.y, -s * p.x + c * p.y); // +x = radially outward
  p.x /= (1.0 + uVel * vStr);                       // streak with speed
  float d2 = dot(p, p);
  float core = exp(-d2 * 95.0);                     // soft gaussian core
  float halo = exp(-d2 * 13.0) * 0.4;               // wide faint halo
  float a = (core + halo) * vA;
  gl_FragColor = vec4(vC + vec3(core * 0.35), min(a * 1.15, 1.0));
}`;

const NEB_VS = `
attribute vec2 aP;
varying vec2 vUv;
void main() { gl_Position = vec4(aP, 0.0, 1.0); vUv = aP; }`;
const NEB_FS = `
precision mediump float;
varying vec2 vUv;
uniform float uT; uniform float uCam; uniform float uAspect;
uniform vec3 uTheme1; uniform vec3 uTheme2;
float vhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(vhash(i), vhash(i + vec2(1.0, 0.0)), f.x),
    mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.13 + vec2(7.3, 3.1); a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = vec2(vUv.x * uAspect, vUv.y);
  uv.y += uCam * 0.12;                    // gas slides past as you fly
  float n1 = fbm(uv * 1.4 + uT * 0.014);
  float n2 = fbm(uv * 2.3 - uT * 0.01 + 5.0);
  float neb = smoothstep(0.52, 0.86, n1) * 0.55 + smoothstep(0.6, 0.9, n2) * 0.3;
  vec3 col = mix(uTheme1, uTheme2, noise(uv * 0.8 + 2.0));
  gl_FragColor = vec4(col, neb * 0.13);
}`;


export function createSky(canvas: HTMLCanvasElement | OffscreenCanvas, isMobile: boolean): Sky | null {
  // A browser without graphics acceleration would draw every frame of the
  // sky on the CPU; it keeps the CSS sky instead.
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    failIfMajorPerformanceCaveat: true,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  // Shaders compile on a background thread where the browser offers it
  // (KHR_parallel_shader_compile). Asking for a compile or link status any
  // earlier would wait for the graphics driver.
  const par = gl.getExtension("KHR_parallel_shader_compile");
  const build = (vsSrc: string, fsSrc: string) => {
    const p = gl.createProgram();
    if (!p) return null;
    for (const [type, src] of [[gl.VERTEX_SHADER, vsSrc], [gl.FRAGMENT_SHADER, fsSrc]] as const) {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    return p;
  };
  const starBuilt = build(STAR_VS, STAR_FS);
  const nebBuilt = isMobile ? null : build(NEB_VS, NEB_FS);
  const building = [starBuilt, nebBuilt].filter((p): p is WebGLProgram => !!p);

  let starPr: WebGLProgram | null = null;
  let nebPr: WebGLProgram | null = null;
  const N_STARS = isMobile ? 1500 : 4200;
  let starZ: WebGLBuffer | null = null;
  let starS: WebGLBuffer | null = null;
  let quad: WebGLBuffer | null = null;
  let su: Record<string, WebGLUniformLocation | null> = {};
  let nu: Record<string, WebGLUniformLocation | null> | null = null;

  const makeBuffer = (data: Float32Array) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  };
  const rand = (n: number) => Float32Array.from({ length: n }, () => Math.random());
  const bind = (pr: WebGLProgram, name: string, buf: WebGLBuffer | null, size = 1) => {
    const loc = gl.getAttribLocation(pr, name);
    if (loc === -1) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  const U = (pr: WebGLProgram, n: string) => gl.getUniformLocation(pr, n);

  const setup = () => {
    const linked = (p: WebGLProgram | null) => (p && gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null);
    starPr = linked(starBuilt);
    if (!starPr) return false;
    nebPr = linked(nebBuilt);
    starZ = makeBuffer(rand(N_STARS));
    starS = makeBuffer(rand(N_STARS));
    quad = makeBuffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
    su = {
      cam: U(starPr, "uCam"), t: U(starPr, "uT"), asp: U(starPr, "uAspect"),
      dpr: U(starPr, "uDpr"), vel: U(starPr, "uVel"),
      t1: U(starPr, "uTheme1"), t2: U(starPr, "uTheme2"),
    };
    nu = nebPr
      ? { t: U(nebPr, "uT"), cam: U(nebPr, "uCam"), asp: U(nebPr, "uAspect"), t1: U(nebPr, "uTheme1"), t2: U(nebPr, "uTheme2") }
      : null;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  };

  let dpr = 1;
  let cam = 0;
  let vel = 0;
  const t0 = epochNow();

  return {
    whenReady(cb, later) {
      const wait = () => {
        if (par && !building.every((p) => gl.getProgramParameter(p, par.COMPLETION_STATUS_KHR))) {
          later(wait);
          return;
        }
        cb(setup());
      };
      wait();
    },
    resize(width, height, d) {
      dpr = d;
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    frame(input) {
      if (!starPr) return;
      const now = epochNow();
      const t = (now - t0) / 1000;
      // Arrival from the page loader: the camera is still flying when the
      // loader hands over, then coasts to a stop, so the sky streaks and
      // settles under the page as it flies in.
      let coast = 0;
      if (input.arrivedAt) {
        const p = Math.min(1, (now - input.arrivedAt) / 1800);
        coast = 7 * (1 - Math.pow(1 - p, 3));
      }
      const target = input.scrollY * 0.006 + t * 0.22 + coast;
      const prev = cam;
      cam += (target - cam) * 0.08;
      // Smoothed camera speed drives the warp streaks.
      vel += (Math.min(Math.abs(cam - prev) * 26, 2.2) - vel) * 0.1;
      const th1 = input.th1;
      const th2 = input.th2;
      const aspect = canvas.width / Math.max(1, canvas.height);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (nebPr && nu) {
        gl.useProgram(nebPr);
        bind(nebPr, "aP", quad, 2);
        gl.uniform1f(nu.t, t);
        gl.uniform1f(nu.cam, cam);
        gl.uniform1f(nu.asp, aspect);
        gl.uniform3f(nu.t1, th1[0], th1[1], th1[2]);
        gl.uniform3f(nu.t2, th2[0], th2[1], th2[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      gl.useProgram(starPr);
      bind(starPr, "aZ", starZ);
      bind(starPr, "aS", starS);
      gl.uniform1f(su.cam, cam);
      gl.uniform1f(su.t, t);
      gl.uniform1f(su.asp, aspect);
      gl.uniform1f(su.dpr, dpr);
      gl.uniform1f(su.vel, vel);
      gl.uniform3f(su.t1, th1[0], th1[1], th1[2]);
      gl.uniform3f(su.t2, th2[0], th2[1], th2[2]);
      gl.drawArrays(gl.POINTS, 0, N_STARS);
    },
  };
}
