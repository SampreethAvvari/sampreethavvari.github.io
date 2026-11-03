// The finishing pass for the Mind world. The scene is drawn into a linear HDR
// target; a small bloom chain blurs what is brighter than white; one final
// shader adds a zoom blur along a flight, a little colour fringing at speed,
// tone mapping, a vignette and fine grain.

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
import { prelinkPasses } from "../gl-warm";

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
  gl_FragColor = vec4(min(s * w, vec3(12.0)), 1.0);
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
uniform sampler2D tSrc; uniform vec2 uTexel;
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
}`;

const FINAL = (samples: number) => /* glsl */ `
#define ZOOM_SAMPLES ${samples}
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uGrain;
uniform float uVignette;
uniform float uExposure;
uniform float uTime;
uniform vec3 uZoom; // uv x, uv y, strength
varying vec2 vUv;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
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
  vec3 col;
  if (uZoom.z > 0.002) {
    // Light smeared toward where the camera is headed, stronger toward the edges.
    vec2 to = uZoom.xy - uv;
    float j = hash12(gl_FragCoord.xy + fract(uTime * 3.7) * 91.0);
    vec3 acc = vec3(0.0);
    float wt = 0.0;
    for (int i = 0; i < ZOOM_SAMPLES; i++) {
      float t = (float(i) + j) / float(ZOOM_SAMPLES);
      float k = 1.0 - t * 0.6;
      acc += texture2D(tScene, uv + to * t * uZoom.z).rgb * k;
      wt += k;
    }
    col = acc / wt;
    // The fringe only exists while moving, and never at rest over the labels.
    float split = uZoom.z * 0.05 * dot(uv - 0.5, uv - 0.5) * 4.0;
    if (split > 0.0004) {
      col.r = mix(col.r, texture2D(tScene, uv + (uv - 0.5) * split).r, 0.6);
      col.b = mix(col.b, texture2D(tScene, uv - (uv - 0.5) * split).b, 0.6);
    }
  } else {
    col = texture2D(tScene, uv).rgb;
  }
  col += texture2D(tBloom, uv).rgb * uBloom;
  col = aces(col * uExposure);
  vec2 vc = (vUv - 0.5) * vec2(1.0, 0.92);
  float vig = smoothstep(0.86, 0.2, length(vc));
  col *= mix(1.0 - uVignette, 1.0, vig);
  col = toSrgb(col);
  float g = hash12(gl_FragCoord.xy + fract(uTime * 7.13) * vec2(113.0, 71.0)) - 0.5;
  col += g * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;

export interface PostFrame {
  time: number;
  bloom: number;
  exposure: number;
  /** uv x, uv y, strength of the zoom blur. */
  zoom: [number, number, number];
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
  private w = 1;
  private h = 1;
  /** Whether the target can hold light brighter than white. */
  readonly hdr: boolean;

  /** Where the scene is drawn. Shaders must be linked against this target to be the ones used. */
  get sceneTarget() {
    return this.scene;
  }

  constructor(renderer: WebGLRenderer, opts: { low: boolean; msaa: number }) {
    this.renderer = renderer;
    this.hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    const type = this.hdr ? HalfFloatType : UnsignedByteType;
    this.start = opts.low ? 4 : 2;
    // Short on purpose: a little light around each star, never a haze over the map.
    const levels = 3;
    this.scene = new WebGLRenderTarget(1, 1, { type, samples: opts.msaa, depthBuffer: true, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    for (let i = 0; i < levels; i++) {
      this.mips.push(new WebGLRenderTarget(1, 1, { type, depthBuffer: false, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter }));
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const base = { vertexShader: VS, depthTest: false, depthWrite: false };
    this.prefilter = new ShaderMaterial({
      ...base,
      fragmentShader: PREFILTER,
      uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: this.hdr ? 1.3 : 0.86 }, uKnee: { value: 0.5 } },
      blending: NoBlending,
    });
    this.down = new ShaderMaterial({ ...base, fragmentShader: DOWN, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } }, blending: NoBlending });
    this.up = new ShaderMaterial({
      ...base,
      fragmentShader: UP,
      uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } },
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    });
    this.final = new ShaderMaterial({
      ...base,
      fragmentShader: FINAL(opts.low ? 5 : 9),
      uniforms: {
        tScene: { value: this.scene.texture },
        tBloom: { value: this.mips[0].texture },
        uBloom: { value: 0.7 },
        uGrain: { value: opts.low ? 0.016 : 0.02 },
        uVignette: { value: 0.46 },
        uExposure: { value: 1 },
        uTime: { value: 0 },
        uZoom: { value: { x: 0.5, y: 0.5, z: 0 } },
      },
      blending: NoBlending,
    });
    this.quad = new Mesh(geo, this.final);
    this.quad.frustumCulled = false;
  }

  warm() {
    const m0 = this.mips[0];
    return prelinkPasses(this.renderer, this.quad, this.cam, [
      [this.prefilter, m0],
      [this.down, m0],
      [this.up, m0],
      [this.final, null],
    ]);
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

    const u = this.final.uniforms;
    u.uTime.value = f.time;
    u.uBloom.value = f.bloom;
    u.uExposure.value = f.exposure;
    u.uZoom.value.x = f.zoom[0];
    u.uZoom.value.y = f.zoom[1];
    u.uZoom.value.z = f.zoom[2];
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
