// The finishing pass for the Work world. The scene renders to a linear HDR
// target; a bloom chain blurs what is brighter than white; a radial pass
// drags the star's light past whatever eclipses it, so the ring's spokes
// throw real shafts; one final shader adds the anamorphic streak, the fly
// through warp, colour fringing, the amber grade, vignette and grain.

import { prelinkPasses } from "../gl-warm";
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
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Scene,
  type WebGLRenderer,
} from "three";

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee; varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  s *= 0.25;
  if (!(max(s.r, max(s.g, s.b)) < 6.0e4) || min(s.r, min(s.g, s.b)) < 0.0) s = vec3(0.0);
  float br = max(s.r, max(s.g, s.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-4);
  float w = max(rq, br - uThreshold) / max(br, 1e-4);
  vec3 lit = s * w;
  float top = max(lit.r, max(lit.g, lit.b));
  gl_FragColor = vec4(lit * min(1.0, 9.0 / max(top, 1e-3)), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec3 sum = texture2D(tSrc, vUv).rgb * 4.0;
  sum += texture2D(tSrc, vUv - uTexel).rgb;
  sum += texture2D(tSrc, vUv + uTexel).rgb;
  sum += texture2D(tSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
  sum += texture2D(tSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
  gl_FragColor = vec4(sum / 8.0, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
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
}`;

// Shafts: march from each pixel toward the star through the bright parts of
// the frame. Whatever eclipses the star leaves a dark gap in the light.
const RAYS = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uSun; uniform float uDensity; uniform float uAspect; varying vec2 vUv;
void main() {
  vec2 d = (uSun - vUv) * uDensity / float(SAMPLES);
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec2 p = vUv + d * j * 0.8;
  vec3 sum = vec3(0.0);
  float w = 1.0;
  for (int i = 0; i < SAMPLES; i++) {
    vec3 c = texture2D(tSrc, p).rgb;
    float b = max(c.r, max(c.g, c.b));
    // Clamp by scale, never per channel: per channel turns amber grey.
    sum += c * min(1.0, 5.0 / max(b, 1e-3)) * smoothstep(2.0, 7.0, b) * w;
    w *= 0.968;
    p += d;
  }
  float reach = exp(-length((vUv - uSun) * vec2(uAspect, 1.0)) * 1.9);
  gl_FragColor = vec4(min(sum / float(SAMPLES), vec3(12.0)) * reach, 1.0);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tRays;
uniform float uAspect, uTime, uBloom, uRays, uCA, uGrain, uVignette, uExposure, uFade, uWarp, uFlash;
uniform vec3 uSun; // uv x, uv y, strength
uniform vec4 uShade; // direction x, y, strength, how much is radial
uniform vec3 uLift;
varying vec2 vUv;
vec3 rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 color) {
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= 1.0 / 0.6; color = inM * color; color = rrtOdt(color); color = outM * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec2 uv = vUv;
  vec2 cd = uv - 0.5;
  // Speed pulls the middle in and throws the edges out.
  if (uWarp > 0.001) uv = 0.5 + cd * (1.0 - uWarp * 0.1 + uWarp * 0.34 * dot(cd, cd));
  vec3 col;
#ifdef CA
  float split = dot(cd, cd) * uCA + uWarp * 0.02;
  vec2 co = cd * split;
  col.r = texture2D(tScene, uv + co).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - co).b;
#else
  col = texture2D(tScene, uv).rgb;
#endif
#ifdef WARP_BLUR
  if (uWarp > 0.02) {
    vec3 s = vec3(0.0);
    for (int i = 1; i <= 6; i++) s += texture2D(tScene, 0.5 + (uv - 0.5) * (1.0 - float(i) * uWarp * 0.018)).rgb;
    col = mix(col, s / 6.0, clamp(uWarp * 1.6, 0.0, 0.92));
  }
#endif
  col += texture2D(tBloom, uv).rgb * uBloom;
  vec2 ro = vec2(1.6) / vec2(textureSize(tRays, 0));
  col += (texture2D(tRays, uv + ro).rgb + texture2D(tRays, uv - ro).rgb + texture2D(tRays, uv + vec2(ro.x, -ro.y)).rgb + texture2D(tRays, uv - vec2(ro.x, -ro.y)).rgb) * 0.25 * uRays;
  // The anamorphic streak from the star.
  if (uSun.z > 0.001) {
    vec2 fd = (vUv - uSun.xy) * vec2(uAspect, 1.0);
    float streak = exp(-abs(fd.y) * 130.0) * exp(-abs(fd.x) * 1.5) * 0.3;
    float hair = exp(-abs(fd.y) * 800.0) * exp(-abs(fd.x) * 0.8) * 0.2;
    col += vec3(1.0, 0.62, 0.28) * uSun.z * (streak + hair);
  }
  col += vec3(1.0, 0.72, 0.42) * uFlash * 3.0;
  // Room for the words: done in linear light, so a star under it stays hot
  // and amber instead of turning into a grey disc.
  if (uShade.z > 0.003) {
    vec2 sd = uShade.xy;
    float sl = length(sd);
    float side = sl > 0.01 ? smoothstep(-0.2, 1.05, dot((vUv - 0.5) * 2.0, sd / sl)) : 0.0;
    float round_ = 1.0 - smoothstep(0.15, 1.0, length((vUv - 0.5) * 2.0));
    float m = mix(side, round_, uShade.w);
    col *= mix(1.0, 0.05, m * uShade.z);
  }
  // Filmic, but holding on to the hue, so bright amber stays amber instead of
  // washing out to grey and white.
  vec3 expo = max(col * uExposure, vec3(0.0));
  vec3 filmic = aces(expo);
  float lum0 = dot(expo, vec3(0.2126, 0.7152, 0.0722));
  float lum1 = dot(filmic, vec3(0.2126, 0.7152, 0.0722));
  vec3 kept = min(expo * (lum1 / max(lum0, 1e-4)), vec3(1.0));
  col = mix(mix(filmic, kept, 0.62), filmic, smoothstep(0.5, 2.6, lum0));
  // Warm the floor of the picture a touch, so black stays amber.
  col += uLift * (1.0 - smoothstep(0.0, 0.24, dot(col, vec3(0.33))));
  float vig = 1.0 - smoothstep(0.2, 0.86, length(cd * vec2(1.0, 0.92)));
  col *= mix(1.0 - uVignette, 1.0, vig);
  col = toSrgb(col);
  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.13) * vec2(113.0, 71.0)) - 0.5) * uGrain;
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

export interface PostFrame {
  time: number;
  fade: number;
  warp: number;
  flash: number;
  /** Star position in the frame: uv x, uv y, strength (0 when it is far off screen). */
  sun: Vector3;
  rays: number;
  exposure: number;
  shade: Vector4;
}

export class Post {
  private scene: WebGLRenderTarget;
  private mips: WebGLRenderTarget[] = [];
  private rays: WebGLRenderTarget;
  private quad: Mesh;
  private cam = new Camera();
  private prefilter: ShaderMaterial;
  private down: ShaderMaterial;
  private up: ShaderMaterial;
  private raysMat: ShaderMaterial;
  private final: ShaderMaterial;
  private w = 1;
  private h = 1;
  private start: number;
  private raysDiv: number;

  constructor(private renderer: WebGLRenderer, opts: { low: boolean; msaa: number }) {
    const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    const type = hdr ? HalfFloatType : UnsignedByteType;
    this.start = opts.low ? 4 : 2;
    this.raysDiv = opts.low ? 6 : 2;
    const levels = opts.low ? 4 : 6;
    const t = { type, minFilter: LinearFilter, magFilter: LinearFilter, stencilBuffer: false };
    this.scene = new WebGLRenderTarget(1, 1, { ...t, samples: opts.msaa, depthBuffer: true });
    for (let i = 0; i < levels; i++) this.mips.push(new WebGLRenderTarget(1, 1, { ...t, depthBuffer: false }));
    this.rays = new WebGLRenderTarget(1, 1, { ...t, depthBuffer: false });

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const base = { vertexShader: VS, depthTest: false, depthWrite: false };
    this.prefilter = new ShaderMaterial({ ...base, fragmentShader: PREFILTER, blending: NoBlending, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: hdr ? 1.5 : 0.85 }, uKnee: { value: 0.5 } } });
    this.down = new ShaderMaterial({ ...base, fragmentShader: DOWN, blending: NoBlending, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } } });
    this.up = new ShaderMaterial({ ...base, fragmentShader: UP, blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } } });
    this.raysMat = new ShaderMaterial({ ...base, fragmentShader: RAYS, blending: NoBlending, defines: { SAMPLES: opts.low ? "24" : "56" }, uniforms: { tSrc: { value: null }, uSun: { value: new Vector2() }, uDensity: { value: 0.92 }, uAspect: { value: 1 } } });
    const defines: Record<string, string> = {};
    if (!opts.low) {
      defines.CA = "1";
      defines.WARP_BLUR = "1";
    }
    this.final = new ShaderMaterial({
      ...base,
      defines,
      fragmentShader: FINAL,
      blending: NoBlending,
      uniforms: {
        tScene: { value: this.scene.texture },
        tBloom: { value: this.mips[0].texture },
        tRays: { value: this.rays.texture },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uBloom: { value: 0.42 },
        uRays: { value: 1 },
        uCA: { value: 0.006 },
        uGrain: { value: opts.low ? 0.018 : 0.02 },
        uVignette: { value: 0.5 },
        uExposure: { value: 1 },
        uFade: { value: 0 },
        uWarp: { value: 0 },
        uFlash: { value: 0 },
        uSun: { value: new Vector3() },
        uShade: { value: new Vector4() },
        uLift: { value: new Vector3(0.012, 0.006, 0.002) },
      },
    });
    this.quad = new Mesh(geo, this.final);
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
    this.rays.setSize(Math.max(1, Math.round(w / this.raysDiv)), Math.max(1, Math.round(h / this.raysDiv)));
    this.final.uniforms.uAspect.value = w / Math.max(1, h);
    this.raysMat.uniforms.uAspect.value = w / Math.max(1, h);
  }

  /** Where the scene is drawn. Shaders are warmed against this. */
  get sceneTarget() {
    return this.scene;
  }

  /** Link the passes in the background, so the first frame finds them ready. */
  warm() {
    const m0 = this.mips[0];
    return prelinkPasses(this.renderer, this.quad, this.cam, [
      [this.prefilter, m0],
      [this.down, m0],
      [this.up, m0],
      [this.raysMat, this.rays],
      [this.final, null],
    ]);
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quad, this.cam);
  }

  render(scene: Scene, camera: Camera, f: PostFrame) {
    const r = this.renderer;
    r.setRenderTarget(this.scene);
    r.clear(true, true, false);
    r.render(scene, camera);

    const m = this.mips;
    this.prefilter.uniforms.tSrc.value = this.scene.texture;
    this.prefilter.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    this.pass(this.prefilter, m[0]);
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

    const on = f.rays > 0.004 && f.sun.z > 0.001;
    if (on) {
      this.raysMat.uniforms.tSrc.value = this.scene.texture;
      this.raysMat.uniforms.uSun.value.set(f.sun.x, f.sun.y);
      this.pass(this.raysMat, this.rays);
    }

    const u = this.final.uniforms;
    u.uTime.value = f.time;
    u.uFade.value = f.fade;
    u.uWarp.value = f.warp;
    u.uFlash.value = f.flash;
    u.uSun.value.copy(f.sun);
    u.uShade.value.copy(f.shade);
    u.uRays.value = on ? f.rays : 0;
    u.uExposure.value = f.exposure;
    this.pass(this.final, null);
  }

  dispose() {
    this.scene.dispose();
    this.rays.dispose();
    for (const m of this.mips) m.dispose();
    this.quad.geometry.dispose();
    [this.prefilter, this.down, this.up, this.raysMat, this.final].forEach((m) => m.dispose());
  }
}
