// The reel's cut from one film to the next: one small WebGL shader and two
// textures. The outgoing frame is uploaded once and held; the incoming clip
// is uploaded each frame while the cut runs, so one video decodes at a time.
// The screen is split into vertical slices that each start at their own
// moment; in each slice the next film slides in from below (or above, going
// back), the colour channels part for a moment, and a soft wave bends the
// picture along the seam. Nothing draws between cuts.

export type TexSource = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec2 uRes;
uniform vec2 uFromSize;
uniform vec2 uToSize;
uniform float uP;
uniform float uDir;
uniform float uTime;
uniform float uSlices;

vec2 cover(vec2 uv, vec2 size) {
  float rs = uRes.x / uRes.y;
  float ri = size.x / size.y;
  vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  return (uv - 0.5) * s + 0.5;
}

float rnd(float x) { return fract(sin(x * 91.345) * 47453.5453); }

vec3 split(sampler2D t, vec2 uv, vec2 size, float amt) {
  float r = texture2D(t, cover(uv + vec2(amt, 0.0), size)).r;
  float g = texture2D(t, cover(uv, size)).g;
  float b = texture2D(t, cover(uv - vec2(amt, 0.0), size)).b;
  return vec3(r, g, b);
}

void main() {
  vec2 uv = vUv;
  float slice = floor(uv.x * uSlices);
  float delay = rnd(slice + 1.0) * 0.42;
  float p = clamp((uP - delay) / 0.58, 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);
  float energy = sin(3.14159 * p);
  float wave = sin(uv.y * 8.0 + uTime * 2.6 + slice * 1.7) * 0.014 * energy;
  float amt = 0.009 * energy;
  float edge = uDir > 0.0 ? p : 1.0 - p;
  bool next = uDir > 0.0 ? uv.y < edge : uv.y > edge;
  vec3 col;
  if (next) {
    col = split(uTo, uv + vec2(wave, uDir * (1.0 - p) * 0.28), uToSize, amt);
  } else {
    col = split(uFrom, uv + vec2(wave, -uDir * p * 0.28), uFromSize, -amt);
  }
  float seam = smoothstep(0.014, 0.0, abs(uv.y - edge)) * energy;
  col += vec3(1.0, 0.3, 0.4) * seam * 0.85;
  col *= 1.0 - 0.18 * sin(3.14159 * clamp(uP, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

const dims = (s: TexSource): [number, number] =>
  s instanceof HTMLVideoElement
    ? [s.videoWidth || 16, s.videoHeight || 9]
    : s instanceof HTMLImageElement
      ? [s.naturalWidth || 16, s.naturalHeight || 9]
      : [s.width || 16, s.height || 9];

export type ReelGL = {
  /** Run one cut. `started` fires once its first frame is drawn; `done` on
   *  the last frame, or at once (without `started`) if it cannot run. */
  run(from: TexSource, to: TexSource, dir: 1 | -1, ms: number, done: () => void, started?: () => void): void;
  cancel(): void;
  destroy(): void;
  readonly ok: boolean;
};

export function createReelGL(canvas: HTMLCanvasElement, slices = 12): ReelGL | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;
  // A software renderer (a machine without a usable graphics card) would
  // spend whole seconds on one cut. The crossfade is the better cut there.
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  // One triangle that covers the screen.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const uRes = u("uRes");
  const uFromSize = u("uFromSize");
  const uToSize = u("uToSize");
  const uP = u("uP");
  const uDir = u("uDir");
  const uTime = u("uTime");
  gl.uniform1i(u("uFrom"), 0);
  gl.uniform1i(u("uTo"), 1);
  gl.uniform1f(u("uSlices"), slices);

  const texture = (unit: number) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
    return t;
  };
  const texFrom = texture(0);
  const texTo = texture(1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  let ok = true;
  let raf = 0;
  // Frames slower than this, on average over a cut, retire the shader.
  const SLOW_MS = 40;
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    ok = false;
    cancelAnimationFrame(raf);
  });

  const upload = (tex: WebGLTexture | null, unit: number, src: TexSource) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      return true;
    } catch {
      return false;
    }
  };

  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  };

  return {
    get ok() {
      return ok;
    },
    run(from, to, dir, ms, done, started) {
      cancelAnimationFrame(raf);
      if (!ok) return done();
      fit();
      if (!upload(texFrom, 0, from) || !upload(texTo, 1, to)) return done();
      gl.uniform2f(uFromSize, ...dims(from));
      gl.uniform1f(uDir, dir);
      let t0 = 0;
      let frames = 0;
      const frame = (now: number) => {
        if (!ok) return done();
        if (!t0) t0 = now;
        frames++;
        const p = Math.min(1, (now - t0) / ms);
        upload(texTo, 1, to);
        gl.uniform2f(uToSize, ...dims(to));
        gl.uniform1f(uP, p);
        gl.uniform1f(uTime, now / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (p === 0) started?.();
        if (p < 1) raf = requestAnimationFrame(frame);
        else {
          if ((now - t0) / Math.max(1, frames - 1) > SLOW_MS) ok = false;
          done();
        }
      };
      raf = requestAnimationFrame(frame);
    },
    cancel() {
      cancelAnimationFrame(raf);
    },
    destroy() {
      cancelAnimationFrame(raf);
      gl.deleteTexture(texFrom);
      gl.deleteTexture(texTo);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      ok = false;
    },
  };
}
