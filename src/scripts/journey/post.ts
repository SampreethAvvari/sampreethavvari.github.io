// The finishing pass. The scene renders into a linear HDR target, a small
// bloom chain blurs what is brighter than white, and one final shader adds
// the lens flare, the pointer's gravitational lens, edge colour fringing,
// tone mapping, vignette and grain on the way to the screen.

import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  Color,
  CustomBlending,
  AddEquation,
  OneFactor,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoBlending,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Scene,
  type WebGLRenderer,
} from "three";
import { FULLSCREEN_VS, NOISE } from "./glsl";

const PREFILTER_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  s *= 0.25;
  // Drop any invalid pixel so it cannot spread through the blur.
  if (!(max(s.r, max(s.g, s.b)) < 6.0e4) || min(s.r, min(s.g, s.b)) < 0.0) s = vec3(0.0);
  float br = max(s.r, max(s.g, s.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-4);
  float w = max(rq, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(s * w, vec3(40.0)), 1.0);
}
`;

const DOWN_FS = /* glsl */ `
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

const UP_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uWeight;
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
}
`;

const FINAL_FS = /* glsl */ `
${NOISE}
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uAspect;
uniform float uTime;
uniform float uBloom;
uniform float uCA;
uniform float uGrain;
uniform float uVignette;
uniform float uExposure;
uniform float uFade;
uniform vec3 uFlare;      // uv x, uv y, strength
uniform vec3 uFlareColor;
uniform vec4 uLens;       // uv x, uv y, strength, Einstein radius in screen heights
uniform vec3 uLensColor;
uniform vec3 uShip;       // uv x, uv y, radius in screen heights
uniform float uJump;      // 0..1, the hyperspace jump
uniform float uFlash;     // 0..1, the flash at the crossover
uniform float uDip;       // 0..1, a dip through dark (reduced motion)
uniform vec3 uFlashColor;
uniform vec4 uDof;       // focus uv x, y, strength, clear radius
uniform float uDofH;     // horizon uv y: above it nothing blurs
uniform vec2 uHeat;      // horizon uv y, strength
uniform vec3 uRays;      // sun uv x, y, strength
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
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 uv = vUv;
  vec2 asp = vec2(uAspect, 1.0);
  float ring = 0.0;

#ifdef LENS
  // Bend the light around an invisible mass under the pointer. Each pixel
  // samples where its light came from: r_src = r - rE^2 / r.
  if (uLens.z > 0.001) {
    vec2 d = (uv - uLens.xy) * asp;
    float r = length(d);
    float rE = uLens.w;
    float reach = 1.0 - smoothstep(rE * 2.2, rE * 6.5, r);
    float shipMask = smoothstep(uShip.z * 0.85, uShip.z * 1.45, length((uv - uShip.xy) * asp));
    float k = uLens.z * reach * shipMask;
    vec2 dir = d / max(r, 1e-5);
    vec2 off = dir * (rE * rE / max(r, rE * 0.4)) * k;
    uv -= off / asp;
    float ang = atan(d.y, d.x);
    float glint = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(ang * 2.0 + uTime * 1.3), 4.0);
    float rr = (r - rE) / (rE * 0.07);
    ring = exp(-rr * rr) * glint * k;
  }
#endif

  // The jump pulls the image in at the middle and pushes the edges out.
  if (uJump > 0.001) {
    vec2 jd = uv - 0.5;
    uv = 0.5 + jd * (1.0 - uJump * 0.16 + uJump * 0.42 * dot(jd, jd));
  }
  // Hot air: the world shimmers in a thin band over the horizon.
  if (uHeat.y > 0.0001) {
    float hb = exp(-pow((uv.y - uHeat.x) / 0.05, 2.0));
    if (hb > 0.01) {
      float nz = sin(uv.y * 310.0 + uTime * 5.3) * 0.5 + sin(uv.y * 170.0 - uTime * 3.1 + uv.x * 9.0) * 0.5;
      uv.x += nz * hb * uHeat.y;
    }
  }
  vec3 col;
  vec2 cd = uv - 0.5;
#ifdef CA
  float split = dot(cd, cd) * uCA + uJump * 0.05;
#else
  float split = uJump * 0.04;
#endif
  if (split > 0.0005) {
    vec2 co = cd * split;
    col.r = texture2D(tScene, uv + co).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - co).b;
  } else {
    col = texture2D(tScene, uv).rgb;
  }
  // A soft lens: only the focus stays sharp.
  if (uDof.z > 0.001) {
    float fr = length((vUv - uDof.xy) * asp);
    float blur = smoothstep(uDof.w, uDof.w + 0.42, fr) * uDof.z;
    // The stars stay sharp; only the near and far sand go soft.
    blur *= 1.0 - smoothstep(uDofH + 0.005, uDofH + 0.05, uv.y);
    if (blur > 0.01) {
      vec3 acc = col;
      float rad = blur * 0.012;
      for (int i = 0; i < 10; i++) {
        float fi = float(i);
        float ang = fi * 2.399963;
        float rr = sqrt((fi + 0.5) / 10.0) * rad;
        acc += texture2D(tScene, uv + vec2(cos(ang) / uAspect, sin(ang)) * rr).rgb;
      }
      col = acc / 11.0;
    }
  }
  // Faint shafts of the low sun through the dust.
  if (uRays.z > 0.001) {
    vec2 dir = (uRays.xy - vUv) / 12.0;
    vec2 sp = vUv + dir * (hash12(gl_FragCoord.xy) * 0.9);
    float acc = 0.0;
    float wgt = 1.0;
    for (int i = 0; i < 12; i++) {
      vec3 sc = texture2D(tScene, sp).rgb;
      acc += max(dot(sc, vec3(0.3, 0.6, 0.1)) - 0.62, 0.0) * wgt;
      wgt *= 0.9;
      sp += dir;
    }
    col += vec3(1.0, 0.55, 0.26) * acc * uRays.z * 0.11;
  }
#ifdef BLOOM
  col += texture2D(tBloom, uv).rgb * uBloom;
#endif
  col += uLensColor * ring * 0.9;

  // Anamorphic flare from the brightest light in view.
  if (uFlare.z > 0.001) {
    vec2 fd = (vUv - uFlare.xy) * asp;
    float streak = exp(-abs(fd.y) * 150.0) * exp(-abs(fd.x) * 1.7) * 0.8;
    float hair = exp(-abs(fd.y) * 900.0) * exp(-abs(fd.x) * 0.7) * 0.35;
    float glow = exp(-length(fd) * 6.0) * 0.35;
    vec2 axis = vec2(0.5) - uFlare.xy;
    float ghosts = 0.0;
    for (int i = 1; i <= 3; i++) {
      vec2 gp = uFlare.xy + axis * (0.55 * float(i));
      float gr = 0.018 + 0.028 * float(i);
      ghosts += (1.0 - smoothstep(gr * 0.6, gr, length((vUv - gp) * asp))) * 0.05 / float(i);
    }
    col += uFlareColor * uFlare.z * (streak + hair + glow + ghosts);
  }

  col += uFlashColor * uFlash * 3.2;
  col = aces(col * uExposure);
  col *= 1.0 - uDip;
  vec2 vc = (vUv - 0.5) * vec2(1.0, 0.9);
  float vig = smoothstep(0.82, 0.18, length(vc));
  col *= mix(1.0 - uVignette, 1.0, vig);
  col = toSrgb(col);
  float g = hash12(gl_FragCoord.xy + fract(uTime * 7.13) * vec2(113.0, 71.0)) - 0.5;
  col += g * uGrain;
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

export interface PostFrame {
  time: number;
  fade: number;
  flare: { x: number; y: number; strength: number; color: Color };
  lens: { x: number; y: number; strength: number; radius: number; color: Color };
  ship: { x: number; y: number; radius: number };
  jump: number;
  flash: number;
  dip: number;
  flashColor: Color;
  /** Bloom, fringing, grain and exposure scales for the world in view (1 = as built). */
  bloom?: number;
  ca?: number;
  grain?: number;
  exposure?: number;
  /** Focus: uv x, y, strength, clear radius. */
  dof?: [number, number, number, number];
  dofH?: number;
  /** Horizon uv y and shimmer strength. */
  heat?: [number, number];
  /** Sun uv x, y and shaft strength. */
  rays?: [number, number, number];
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
  private readonly levels: number;
  private readonly bloomBase: number;
  private readonly grainBase: number;
  private readonly start: number;
  private readonly bloom: boolean;
  private w = 1;
  private h = 1;

  constructor(renderer: WebGLRenderer, opts: { low: boolean; msaa: number; lens: boolean }) {
    this.renderer = renderer;
    const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    const type = hdr ? HalfFloatType : UnsignedByteType;
    this.bloom = true;
    this.bloomBase = opts.low ? 0.7 : 0.62;
    this.grainBase = opts.low ? 0.028 : 0.034;
    // Low quality starts the bloom chain at a quarter size and uses fewer levels.
    this.start = opts.low ? 4 : 2;
    this.levels = opts.low ? 4 : 5;
    this.scene = new WebGLRenderTarget(1, 1, { type, samples: opts.msaa, depthBuffer: true, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    for (let i = 0; i < this.levels; i++) {
      this.mips.push(new WebGLRenderTarget(1, 1, { type, depthBuffer: false, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter }));
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const base = { vertexShader: FULLSCREEN_VS, depthTest: false, depthWrite: false };
    this.prefilter = new ShaderMaterial({
      ...base,
      fragmentShader: PREFILTER_FS,
      uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: hdr ? 1.6 : 0.85 }, uKnee: { value: 0.45 } },
      blending: NoBlending,
    });
    this.down = new ShaderMaterial({ ...base, fragmentShader: DOWN_FS, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } }, blending: NoBlending });
    this.up = new ShaderMaterial({
      ...base,
      fragmentShader: UP_FS,
      uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uWeight: { value: 1 } },
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    });
    const defines: Record<string, string> = { OCTAVES: "1", BLOOM: "1" };
    if (!opts.low) defines.CA = "1";
    if (opts.lens) defines.LENS = "1";
    this.final = new ShaderMaterial({
      ...base,
      defines,
      fragmentShader: FINAL_FS,
      uniforms: {
        tScene: { value: this.scene.texture },
        tBloom: { value: this.mips[0].texture },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uBloom: { value: opts.low ? 0.7 : 0.62 },
        uCA: { value: 0.018 },
        uGrain: { value: opts.low ? 0.028 : 0.034 },
        uVignette: { value: 0.42 },
        uExposure: { value: 1.0 },
        uFade: { value: 0 },
        uFlare: { value: { x: 0, y: 0, z: 0 } },
        uFlareColor: { value: new Color() },
        uLens: { value: { x: 0.5, y: 0.5, z: 0, w: 0.05 } },
        uLensColor: { value: new Color() },
        uShip: { value: { x: 0.7, y: 0.3, z: 0.1 } },
        uJump: { value: 0 },
        uFlash: { value: 0 },
        uDip: { value: 0 },
        uFlashColor: { value: new Color(1, 1, 1) },
        uDof: { value: new Vector4(0, 0, 0, 0.2) },
        uDofH: { value: 1 },
        uHeat: { value: new Vector2(0.5, 0) },
        uRays: { value: new Vector3(0, 0, 0) },
      },
      blending: NoBlending,
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

    if (this.bloom) {
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
        this.up.uniforms.uWeight.value = 1.0;
        this.pass(this.up, m[i]);
      }
    }

    const u = this.final.uniforms;
    u.uTime.value = f.time;
    u.uBloom.value = this.bloomBase * (f.bloom ?? 1);
    u.uCA.value = 0.018 * (f.ca ?? 1);
    u.uGrain.value = this.grainBase * (f.grain ?? 1);
    u.uExposure.value = f.exposure ?? 1;
    u.uDofH.value = f.dofH ?? 1;
    if (f.dof) u.uDof.value.set(f.dof[0], f.dof[1], f.dof[2], f.dof[3]);
    else u.uDof.value.z = 0;
    if (f.heat) u.uHeat.value.set(f.heat[0], f.heat[1]);
    else u.uHeat.value.y = 0;
    if (f.rays) u.uRays.value.set(f.rays[0], f.rays[1], f.rays[2]);
    else u.uRays.value.z = 0;
    u.uFade.value = f.fade;
    u.uFlare.value.x = f.flare.x;
    u.uFlare.value.y = f.flare.y;
    u.uFlare.value.z = f.flare.strength;
    u.uFlareColor.value.copy(f.flare.color);
    u.uLens.value.x = f.lens.x;
    u.uLens.value.y = f.lens.y;
    u.uLens.value.z = f.lens.strength;
    u.uLens.value.w = f.lens.radius;
    u.uLensColor.value.copy(f.lens.color);
    u.uShip.value.x = f.ship.x;
    u.uShip.value.y = f.ship.y;
    u.uShip.value.z = f.ship.radius;
    u.uJump.value = f.jump;
    u.uFlash.value = f.flash;
    u.uDip.value = f.dip;
    u.uFlashColor.value.copy(f.flashColor);
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
