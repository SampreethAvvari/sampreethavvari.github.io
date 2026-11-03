// The finishing pass for the star system. The scene renders into a linear HDR
// target; a small bloom chain blurs what is brighter than white; one final
// shader adds light shafts from the star, the bend of light around a heavy
// mass, a zoom blur at speed, colour fringing, tone mapping, vignette and grain.

import { prelinkPasses } from "../gl-warm";
import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  Camera,
  Color,
  CustomBlending,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoBlending,
  OneFactor,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type Scene,
  type WebGLRenderer,
} from "three";
import { NOISE } from "./toolkit";

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
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
  gl_FragColor = vec4(min(s * w, vec3(7.0)), 1.0);
}`;
const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 sum = texture2D(tSrc, vUv).rgb * 4.0;
  sum += texture2D(tSrc, vUv - uTexel).rgb;
  sum += texture2D(tSrc, vUv + uTexel).rgb;
  sum += texture2D(tSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb;
  sum += texture2D(tSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
  gl_FragColor = vec4(sum / 8.0, 1.0);
}`;
const UP = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight;
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
  gl_FragColor = vec4(sum / 12.0 * uWeight, 1.0);
}`;

const FINAL = /* glsl */ `
${NOISE}
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uAspect; uniform float uTime; uniform float uBloom; uniform float uCA; uniform float uGrain; uniform float uVignette; uniform float uExposure; uniform float uFade;
uniform float uSpeed;     // 0..1 how fast the camera is going
uniform vec4 uStar;       // uv x, uv y, strength of the shafts, unused
uniform vec3 uStarCol;
uniform vec4 uLens;       // uv x, uv y, strength, Einstein radius in screen heights
uniform float uDip;       // 0..1, a dip through dark (reduced motion)
varying vec2 vUv;

vec3 rrtOdt(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= 1.0 / 0.6;
  color = inM * color;
  color = rrtOdt(color);
  color = outM * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

void main() {
  vec2 uv = vUv;
  vec2 asp = vec2(uAspect, 1.0);
  // light bends around a heavy mass: r_src = r - rE^2 / r
  if (uLens.z > 0.001) {
    vec2 d = (uv - uLens.xy) * asp;
    float r = length(d);
    float rE = uLens.w;
    float reach = 1.0 - smoothstep(rE * 2.0, rE * 6.0, r);
    vec2 dir = d / max(r, 1e-5);
    vec2 off = dir * (rE * rE / max(r, rE * 0.35)) * uLens.z * reach;
    uv -= off / asp;
  }
  vec3 col;
  vec2 cd = uv - 0.5;
  float split = dot(cd, cd) * uCA * (1.0 + uSpeed * 6.0) + uSpeed * 0.007;
#ifdef ZOOM
  if (uSpeed > 0.015) {
    // a zoom blur that follows the camera's speed
    vec3 acc = vec3(0.0);
    float w = 0.0;
    float amt = uSpeed * 0.12;
    for (int i = 0; i < 7; i++) {
      float k = float(i) / 6.0;
      float wt = 1.0 - k * 0.7;
      vec2 u2 = uv - cd * k * amt;
      vec2 co = cd * split * (1.0 + k);
      acc.r += texture2D(tScene, u2 + co).r * wt;
      acc.g += texture2D(tScene, u2).g * wt;
      acc.b += texture2D(tScene, u2 - co).b * wt;
      w += wt;
    }
    col = acc / w;
  } else
#endif
  if (split > 0.0003) {
    vec2 co = cd * split;
    col.r = texture2D(tScene, uv + co).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - co).b;
  } else {
    col = texture2D(tScene, uv).rgb;
  }
  col += texture2D(tBloom, uv).rgb * uBloom;
  if (uLens.z > 0.001) {
    float rr = length((vUv - uLens.xy) * asp) / uLens.w;
    col *= 1.0 - (1.0 - smoothstep(1.26, 1.44, rr)) * clamp(uLens.z * 2.0, 0.0, 1.0);
  }

#ifdef SHAFTS
  if (uStar.z > 0.002) {
    // light shafts: march the bloom toward the star
    vec2 toStar = uStar.xy - vUv;
    float jitter = hash12(gl_FragCoord.xy) * 0.9;
    vec3 sh = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 10; i++) {
      float k = (float(i) + jitter) / 10.0;
      float wt = 1.0 - k * 0.55;
      vec2 sp = vUv + toStar * k * 0.92;
      // only the star's own light makes a shaft, nothing bright on the way to it
      float own = exp(-length((sp - uStar.xy) * asp) * 11.0);
      sh += texture2D(tBloom, sp).rgb * wt * own;
      wsum += wt;
    }
    sh /= wsum;
    float falloff = exp(-length(toStar * asp) * 2.4);
    col += min(sh * 2.4, vec3(2.4)) * uStarCol * falloff * uStar.z;
    // the long horizontal streak of the lens
    vec2 fd = (vUv - uStar.xy) * asp;
    float streak = exp(-abs(fd.y) * 340.0) * exp(-abs(fd.x) * 3.2);
    float hair = exp(-abs(fd.y) * 1400.0) * exp(-abs(fd.x) * 1.1) * 0.35;
    col += uStarCol * (streak + hair) * uStar.z * 1.25;
  }
#endif

  col = aces(col * uExposure);
  col *= 1.0 - uDip;
  vec2 vc = (vUv - 0.5) * vec2(1.0, 0.92);
  float vig = smoothstep(0.86, 0.2, length(vc));
  col *= mix(1.0 - uVignette, 1.0, vig);
  col = toSrgb(col);
  float g = hash12(gl_FragCoord.xy + fract(uTime * 7.13) * vec2(113.0, 71.0)) - 0.5;
  col += g * uGrain;
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

export interface PostFrame {
  time: number;
  fade: number;
  speed: number;
  star: { x: number; y: number; strength: number; color: Color };
  lens: { x: number; y: number; strength: number; radius: number };
  dip: number;
  /** 1 is the full bloom. At 0 the blur chain does not run at all: the cheap form of the scene. */
  bloom?: number;
}

export class Post {
  private readonly renderer: WebGLRenderer;
  private readonly scene: WebGLRenderTarget;
  private readonly mips: WebGLRenderTarget[] = [];
  private readonly quad: Mesh;
  private readonly cam = new Camera();
  private readonly prefilter: ShaderMaterial;
  private readonly down: ShaderMaterial;
  private readonly up: ShaderMaterial;
  private readonly final: ShaderMaterial;
  private readonly start: number;
  private readonly bloomLevel: number;
  private w = 1;
  private h = 1;

  constructor(renderer: WebGLRenderer, opts: { low: boolean; msaa: number }) {
    this.renderer = renderer;
    const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    const type = hdr ? HalfFloatType : UnsignedByteType;
    this.start = opts.low ? 4 : 2;
    this.bloomLevel = opts.low ? 0.3 : 0.27;
    const levels = opts.low ? 4 : 5;
    this.scene = new WebGLRenderTarget(1, 1, { type, samples: opts.msaa, depthBuffer: true, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    for (let i = 0; i < levels; i++) this.mips.push(new WebGLRenderTarget(1, 1, { type, depthBuffer: false, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter }));

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const base = { vertexShader: VS, depthTest: false, depthWrite: false };
    this.prefilter = new ShaderMaterial({ ...base, fragmentShader: PREFILTER, blending: NoBlending, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: hdr ? 1.5 : 0.85 }, uKnee: { value: 0.5 } } });
    this.down = new ShaderMaterial({ ...base, fragmentShader: DOWN, blending: NoBlending, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } } });
    this.up = new ShaderMaterial({ ...base, fragmentShader: UP, blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uWeight: { value: 0.62 } } });
    const defines: Record<string, string> = { SHAFTS: "1" };
    if (!opts.low) defines.ZOOM = "1";
    this.final = new ShaderMaterial({
      ...base,
      defines,
      fragmentShader: FINAL,
      blending: NoBlending,
      uniforms: {
        tScene: { value: this.scene.texture },
        tBloom: { value: this.mips[0].texture },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uBloom: { value: this.bloomLevel },
        uCA: { value: opts.low ? 0.002 : 0.004 },
        uGrain: { value: opts.low ? 0.022 : 0.03 },
        uVignette: { value: 0.46 },
        uExposure: { value: 1.0 },
        uFade: { value: 0 },
        uSpeed: { value: 0 },
        uStar: { value: new Vector4(0.5, 0.5, 0, 0) },
        uStarCol: { value: new Color(0.7, 0.82, 1) },
        uLens: { value: new Vector4(0.5, 0.5, 0, 0.05) },
        uDip: { value: 0 },
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
    this.final.uniforms.uAspect.value = w / Math.max(1, h);
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

    const bloom = f.bloom ?? 1;
    if (bloom > 0) {
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
    }

    const u = this.final.uniforms;
    u.uBloom.value = this.bloomLevel * bloom;
    u.uTime.value = f.time;
    u.uFade.value = f.fade;
    u.uSpeed.value = f.speed;
    u.uStar.value.set(f.star.x, f.star.y, f.star.strength, 0);
    u.uStarCol.value.copy(f.star.color);
    u.uLens.value.set(f.lens.x, f.lens.y, f.lens.strength, f.lens.radius);
    u.uDip.value = f.dip;
    this.pass(this.final, null);
  }

  dispose() {
    this.scene.dispose();
    for (const m of this.mips) m.dispose();
    this.quad.geometry.dispose();
    this.prefilter.dispose();
    this.down.dispose();
    this.up.dispose();
    this.final.dispose();
  }
}
