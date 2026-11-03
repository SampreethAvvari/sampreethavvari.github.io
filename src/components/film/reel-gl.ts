// The reel's cut from one film to the next: one small WebGL shader and two
// textures. The outgoing frame is uploaded once and held; the incoming clip
// is uploaded each frame while the cut runs, so one video decodes at a time.
// The screen is split into tall vertical slices that move nearly together:
// in each the next film rises in (or drops in, going back) while the one on
// screen leaves the other way, the picture stretches briefly along the
// motion, and the colour channels part at the slice edges. Nothing draws
// between cuts.

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

// Each channel a little apart along the motion: the colour fringe.
vec3 split(sampler2D t, vec2 uv, vec2 size, vec2 amt) {
  float r = texture2D(t, cover(uv + amt, size)).r;
  float g = texture2D(t, cover(uv, size)).g;
  float b = texture2D(t, cover(uv - amt, size)).b;
  return vec3(r, g, b);
}

void main() {
  vec2 uv = vUv;
  float k = floor(uv.x * uSlices);
  float sx = fract(uv.x * uSlices);
  // Tall slices, nearly together: the middle ones lead by a hair.
  float lead = abs(k + 0.5 - uSlices * 0.5) / uSlices * 0.12;
  float p = clamp((uP - lead) / 0.88, 0.0, 1.0);
  p = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;
  float energy = sin(3.14159 * p);
  // Neighbouring slices run against each other, so the cut reads as slices.
  float alt = mod(k, 2.0) < 1.0 ? 1.0 : -1.0;
  float dir = uDir * mix(1.0, alt, 0.35);
  // A brief stretch along the motion while the slices travel.
  float stretch = 1.0 + 0.28 * energy;
  // The colour fringe is strongest at the edges of each slice.
  float edge = 1.0 - smoothstep(0.0, 0.22, min(sx, 1.0 - sx));
  vec2 amt = vec2(0.004 * energy * edge, 0.016 * energy * (0.35 + 0.65 * edge) * sign(dir));
  // The incoming frame rises into its slice as the outgoing one leaves the
  // other way.
  float seam = dir > 0.0 ? p : 1.0 - p;
  bool next = dir > 0.0 ? uv.y < seam : uv.y > seam;
  vec3 col;
  if (next) {
    float y = (uv.y + dir * (1.0 - p) - 0.5) / stretch + 0.5;
    col = split(uTo, vec2(uv.x, y), uToSize, amt);
  } else {
    float y = (uv.y - dir * p - 0.5) / stretch + 0.5;
    col = split(uFrom, vec2(uv.x, y), uFromSize, -amt);
  }
  // A thin light on the seam and a hairline between slices while they move.
  float line = smoothstep(0.006, 0.0, abs(uv.y - seam)) * energy;
  col += vec3(1.0, 0.85, 0.88) * line * 0.5;
  float dpx = min(sx, 1.0 - sx) * uRes.x / uSlices;
  float gap = 1.0 - smoothstep(0.0, 1.5, dpx);
  col *= 1.0 - 0.55 * gap * energy;
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

export function createReelGL(canvas: HTMLCanvasElement, slices = 12, dprCap = 1.5): ReelGL | null {
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
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
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
