// The finishing pass: the scene renders into a linear HDR target, a small
// bloom chain blurs what is brighter than white, and one last shader adds
// the colour split of a fast move, tone mapping, vignette and grain. The
// canvas stays transparent where nothing is drawn, so the site's own sky
// shows through and the page sits in the same space as every other tab.

import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoBlending,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type Scene,
  type Texture,
  type TextureDataType,
  type WebGLRenderer,
} from "three";

const FS_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FS = /* glsl */ `
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
  s = min(s, vec3(24.0));
  float b = max(s.r, max(s.g, s.b));
  float k = smoothstep(uThreshold, uThreshold + 0.7, b);
  gl_FragColor = vec4(s * k, 1.0);
}`;

const DOWN_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const UP_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tNext;
uniform vec2 uTexel;
uniform float uMix;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb * 2.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(texture2D(tNext, vUv).rgb + (c / 12.0) * uMix, 1.0);
}`;

const BLUR_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tSrc, vUv) * 0.227;
  c += (texture2D(tSrc, vUv + uDir * 1.38) + texture2D(tSrc, vUv - uDir * 1.38)) * 0.316;
  c += (texture2D(tSrc, vUv + uDir * 3.23) + texture2D(tSrc, vUv - uDir * 3.23)) * 0.07;
  gl_FragColor = c;
}`;

const FINAL_FS = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uChroma;
uniform float uExposure;
uniform float uTime;
uniform float uGrain;
uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 film(vec3 x) {
  // a soft shoulder and deep blacks
  x *= 0.92;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);
  vec4 s = texture2D(tScene, vUv);
  vec3 col = s.rgb;
  if (uChroma > 0.001) {
    vec2 off = c * uChroma * (0.012 + r2 * 0.05);
    col.r = texture2D(tScene, vUv + off).r;
    col.b = texture2D(tScene, vUv - off).b;
  }
  vec3 bl = texture2D(tBloom, vUv).rgb * uBloom;
  col += bl;
  col *= uExposure;
  col *= 1.0 - r2 * 0.42;
  col = film(col);
  col = pow(col, vec3(1.0 / 2.2));
  float top = max(col.r, max(col.g, col.b));
  float a = clamp(max(s.a, top), 0.0, 1.0);
  col += (hash(gl_FragCoord.xy + uTime * 61.0) - 0.5) * uGrain * a;
  gl_FragColor = vec4(clamp(col, 0.0, a + 0.02), a);
}`;

export class Finish {
  scene: WebGLRenderTarget;
  behind: WebGLRenderTarget;
  private behindB: WebGLRenderTarget;
  private bright: WebGLRenderTarget;
  private downs: WebGLRenderTarget[] = [];
  private ups: WebGLRenderTarget[] = [];
  private mesh: Mesh;
  private geo: BufferGeometry;
  private cam = new Camera();
  private mBright: ShaderMaterial;
  private mDown: ShaderMaterial;
  private mUp: ShaderMaterial;
  private mBlur: ShaderMaterial;
  private mFinal: ShaderMaterial;
  private type: TextureDataType;
  private size = new Vector2(1, 1);

  constructor(private r: WebGLRenderer, private opts: { levels: number; samples: number }) {
    const hdr = r.extensions.has("EXT_color_buffer_float") || r.extensions.has("EXT_color_buffer_half_float");
    this.type = hdr ? HalfFloatType : UnsignedByteType;
    this.geo = new BufferGeometry();
    this.geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mat = (fs: string, uniforms: Record<string, { value: unknown }>) =>
      new ShaderMaterial({ vertexShader: FS_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, blending: NoBlending });
    this.mBright = mat(BRIGHT_FS, { tSrc: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: 1.0 } });
    this.mDown = mat(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new Vector2() } });
    this.mUp = mat(UP_FS, { tSrc: { value: null }, tNext: { value: null }, uTexel: { value: new Vector2() }, uMix: { value: 1 } });
    this.mBlur = mat(BLUR_FS, { tSrc: { value: null }, uDir: { value: new Vector2() } });
    this.mFinal = mat(FINAL_FS, {
      tScene: { value: null },
      tBloom: { value: null },
      uBloom: { value: 0.5 },
      uChroma: { value: 0 },
      uExposure: { value: 1 },
      uTime: { value: 0 },
      uGrain: { value: 0.012 },
      uRes: { value: new Vector2() },
    });
    this.mesh = new Mesh(this.geo, this.mBright);
    this.mesh.frustumCulled = false;
    const opt = { type: this.type, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false };
    this.scene = new WebGLRenderTarget(4, 4, { ...opt, depthBuffer: true, samples: opts.samples });
    this.behind = new WebGLRenderTarget(4, 4, { ...opt, depthBuffer: true });
    this.behindB = new WebGLRenderTarget(4, 4, opt);
    this.bright = new WebGLRenderTarget(4, 4, opt);
    for (let i = 0; i < opts.levels; i++) {
      this.downs.push(new WebGLRenderTarget(4, 4, opt));
      this.ups.push(new WebGLRenderTarget(4, 4, opt));
    }
  }

  setSize(w: number, h: number) {
    this.size.set(w, h);
    this.scene.setSize(w, h);
    this.behind.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
    this.behindB.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2));
    let bw = Math.max(2, w >> 1);
    let bh = Math.max(2, h >> 1);
    this.bright.setSize(bw, bh);
    for (let i = 0; i < this.downs.length; i++) {
      bw = Math.max(2, bw >> 1);
      bh = Math.max(2, bh >> 1);
      this.downs[i].setSize(bw, bh);
      this.ups[i].setSize(bw, bh);
    }
    (this.mFinal.uniforms.uRes.value as Vector2).set(w, h);
  }

  private blit(mat: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.mesh.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.mesh, this.cam);
  }

  /** Soften what was just drawn into the behind buffer. */
  blurBehind() {
    const w = this.behind.width;
    const h = this.behind.height;
    const u = this.mBlur.uniforms;
    for (const k of [1, 2.2]) {
      u.tSrc.value = this.behind.texture;
      (u.uDir.value as Vector2).set(k / w, 0);
      this.blit(this.mBlur, this.behindB);
      u.tSrc.value = this.behindB.texture;
      (u.uDir.value as Vector2).set(0, k / h);
      this.blit(this.mBlur, this.behind);
    }
  }

  get behindTexture(): Texture {
    return this.behind.texture;
  }

  beginScene(scene: Scene, camera: Camera) {
    this.r.setRenderTarget(this.scene);
    this.r.clear();
    this.r.render(scene, camera);
  }

  finish(o: { bloom: number; chroma: number; exposure: number; time: number }) {
    const ub = this.mBright.uniforms;
    ub.tSrc.value = this.scene.texture;
    (ub.uTexel.value as Vector2).set(1 / this.scene.width, 1 / this.scene.height);
    this.blit(this.mBright, this.bright);

    let src = this.bright;
    const ud = this.mDown.uniforms;
    for (const d of this.downs) {
      ud.tSrc.value = src.texture;
      (ud.uTexel.value as Vector2).set(1 / src.width, 1 / src.height);
      this.blit(this.mDown, d);
      src = d;
    }
    const uu = this.mUp.uniforms;
    let up = this.downs[this.downs.length - 1];
    for (let i = this.downs.length - 2; i >= 0; i--) {
      uu.tSrc.value = up.texture;
      uu.tNext.value = this.downs[i].texture;
      uu.uMix.value = 0.85;
      (uu.uTexel.value as Vector2).set(1 / up.width, 1 / up.height);
      this.blit(this.mUp, this.ups[i]);
      up = this.ups[i];
    }

    const u = this.mFinal.uniforms;
    u.tScene.value = this.scene.texture;
    u.tBloom.value = up.texture;
    u.uBloom.value = o.bloom;
    u.uChroma.value = o.chroma;
    u.uExposure.value = o.exposure;
    u.uTime.value = o.time % 100;
    this.blit(this.mFinal, null);
  }

  dispose() {
    [this.scene, this.behind, this.behindB, this.bright, ...this.downs, ...this.ups].forEach((t) => t.dispose());
    [this.mBright, this.mDown, this.mUp, this.mBlur, this.mFinal].forEach((m) => m.dispose());
    this.geo.dispose();
  }
}
