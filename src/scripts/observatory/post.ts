// The finishing pass for the observatory. The scene renders into a linear
// HDR target, a small bloom chain blurs what is brighter than white, and one
// last shader tone maps, adds a vignette and a little grain. Phones start
// the bloom at a quarter size with fewer levels, so the targets stay small.

import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  Camera,
  CustomBlending,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoBlending,
  OneFactor,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type Scene,
  type WebGLRenderer,
} from "three";

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  s *= 0.25;
  if (!(max(s.r, max(s.g, s.b)) < 6.0e4) || min(s.r, min(s.g, s.b)) < 0.0) s = vec3(0.0);
  float br = max(s.r, max(s.g, s.b));
  float knee = 0.5;
  float rq = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 1e-4);
  float w = max(rq, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(s * w, vec3(30.0)), 1.0);
}
`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 sum = texture2D(tSrc, vUv).rgb * 4.0;
  sum += texture2D(tSrc, vUv - uTexel).rgb;
  sum += texture2D(tSrc, vUv + uTexel).rgb;
  sum += texture2D(tSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
  sum += texture2D(tSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
  gl_FragColor = vec4(sum / 8.0, 1.0);
}
`;

const UP = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 sum = texture2D(tSrc, vUv + vec2(-2.0 * o.x, 0.0)).rgb;
  sum += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  sum += texture2D(tSrc, vUv + vec2(0.0, 2.0 * o.y)).rgb;
  sum += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.0;
  sum += texture2D(tSrc, vUv + vec2(2.0 * o.x, 0.0)).rgb;
  sum += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  sum += texture2D(tSrc, vUv + vec2(0.0, -2.0 * o.y)).rgb;
  sum += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  gl_FragColor = vec4(sum / 12.0, 1.0);
}
`;

const FINAL = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uTime;
uniform float uBloom;
uniform float uFade;
uniform float uGrain;
uniform float uAlert;
varying vec2 vUv;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 uv = vUv;
  vec3 col;
#ifdef CA
  vec2 cd = uv - 0.5;
  vec2 co = cd * dot(cd, cd) * 0.012;
  col = vec3(texture2D(tScene, uv + co).r, texture2D(tScene, uv).g, texture2D(tScene, uv - co).b);
#else
  col = texture2D(tScene, uv).rgb;
#endif
  col += texture2D(tBloom, uv).rgb * uBloom;
  col = aces(col * 0.9);
  vec2 vc = (vUv - 0.5) * vec2(1.0, 0.92);
  float vig = smoothstep(0.85, 0.2, length(vc));
  col *= mix(0.55, 1.0, vig);
  // A red rim at the edges while a world shows how it fails.
  col += vec3(0.5, 0.03, 0.06) * uAlert * (1.0 - vig) * 0.35;
  col = toSrgb(col);
  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.13) * vec2(113.0, 71.0)) - 0.5) * uGrain;
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

export class Post {
  private readonly r: WebGLRenderer;
  private readonly scene: WebGLRenderTarget;
  private readonly mips: WebGLRenderTarget[] = [];
  private readonly quad: Mesh;
  private readonly cam = new Camera();
  private readonly pre: ShaderMaterial;
  private readonly down: ShaderMaterial;
  private readonly up: ShaderMaterial;
  private readonly fin: ShaderMaterial;
  private readonly start: number;
  private w = 1;
  private h = 1;

  constructor(renderer: WebGLRenderer, opts: { low: boolean; msaa: number }) {
    this.r = renderer;
    const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    const type = hdr ? HalfFloatType : UnsignedByteType;
    this.start = opts.low ? 4 : 2;
    const levels = opts.low ? 4 : 5;
    const rt = { type, depthBuffer: false, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter };
    this.scene = new WebGLRenderTarget(1, 1, { ...rt, depthBuffer: true, samples: opts.msaa });
    for (let i = 0; i < levels; i++) this.mips.push(new WebGLRenderTarget(1, 1, rt));

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const base = { vertexShader: VS, depthTest: false, depthWrite: false };
    this.pre = new ShaderMaterial({ ...base, fragmentShader: PREFILTER, blending: NoBlending, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: hdr ? 1.0 : 0.72 } } });
    this.down = new ShaderMaterial({ ...base, fragmentShader: DOWN, blending: NoBlending, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } } });
    this.up = new ShaderMaterial({
      ...base,
      fragmentShader: UP,
      uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } },
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    });
    this.fin = new ShaderMaterial({
      ...base,
      defines: opts.low ? {} : { CA: "1" },
      fragmentShader: FINAL,
      blending: NoBlending,
      uniforms: {
        tScene: { value: this.scene.texture },
        tBloom: { value: this.mips[0].texture },
        uTime: { value: 0 },
        uBloom: { value: opts.low ? 0.8 : 0.72 },
        uFade: { value: 0 },
        uGrain: { value: opts.low ? 0.026 : 0.032 },
        uAlert: { value: 0 },
      },
    });
    this.quad = new Mesh(geo, this.fin);
    this.quad.frustumCulled = false;
  }

  setSize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.scene.setSize(w, h);
    let mw = Math.max(1, Math.round(w / this.start));
    let mh = Math.max(1, Math.round(h / this.start));
    for (const m of this.mips) {
      m.setSize(mw, mh);
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
    }
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.quad, this.cam);
  }

  render(scene: Scene, camera: Camera, f: { time: number; fade: number; alert: number }) {
    const r = this.r;
    r.setRenderTarget(this.scene);
    r.clear(true, true, false);
    r.render(scene, camera);
    const m = this.mips;
    this.pre.uniforms.tSrc.value = this.scene.texture;
    this.pre.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    this.pass(this.pre, m[0]);
    for (let i = 1; i < m.length; i++) {
      this.down.uniforms.tSrc.value = m[i - 1].texture;
      this.down.uniforms.uTexel.value.set(1 / m[i - 1].width, 1 / m[i - 1].height);
      this.pass(this.down, m[i]);
    }
    for (let i = m.length - 2; i >= 0; i--) {
      this.up.uniforms.tSrc.value = m[i + 1].texture;
      this.up.uniforms.uTexel.value.set(1 / m[i + 1].width, 1 / m[i + 1].height);
      this.pass(this.up, m[i]);
    }
    const u = this.fin.uniforms;
    u.uTime.value = f.time;
    u.uFade.value = f.fade;
    u.uAlert.value = f.alert;
    this.pass(this.fin, null);
  }

  dispose() {
    this.scene.dispose();
    for (const m of this.mips) m.dispose();
    this.quad.geometry.dispose();
    this.pre.dispose();
    this.down.dispose();
    this.up.dispose();
    this.fin.dispose();
  }
}
