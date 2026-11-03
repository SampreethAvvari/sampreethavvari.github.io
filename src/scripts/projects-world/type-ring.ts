// The page title, set in Inter and laid flat on the plane of the system like a
// marking on a runway: stretched toward the star so it reads straight from the
// camera's first position, and bent along a real orbit. Worlds cross over it.
// Drag the system and it turns with everything else.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  ShaderMaterial,
} from "three";
import { smooth, type Shared } from "./toolkit";

export function buildTypeRing(shared: Shared, lines: string[], fontFamily: string, phone: boolean) {
  const group = new Group();
  const size = shared.low ? 1024 : 2048;
  const cv = document.createElement("canvas");
  cv.width = size * 2;
  cv.height = size / 2;
  const tex = new CanvasTexture(cv);
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 16;
  const uFade = { value: 0 };
  const uReady = { value: 0 };

  const paint = () => {
    const g = cv.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#fff";
    g.textBaseline = "middle";
    g.textAlign = "center";
    const text = lines.join(" ");
    let fs = cv.height * 0.86;
    g.font = `300 ${fs}px ${fontFamily}`;
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${-0.035 * fs}px`;
    const w = g.measureText(text).width;
    const maxW = cv.width * 0.97;
    if (w > maxW) {
      fs *= maxW / w;
      g.font = `300 ${fs}px ${fontFamily}`;
      (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${-0.035 * fs}px`;
    }
    g.fillText(text, cv.width / 2, cv.height * 0.52);
    tex.needsUpdate = true;
    uReady.value = 1;
  };
  // the font may still be on its way
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.load) {
    fonts.load(`300 200px ${fontFamily}`).then(paint, paint);
  } else paint();

  // a sector of an annulus on the near side of the star
  const segs = 96;
  const pos = new Float32Array((segs + 1) * 2 * 3);
  const uv = new Float32Array((segs + 1) * 2 * 2);
  const idx: number[] = [];
  const mid = Math.PI * 0.5; // toward the camera's first position
  const sweep = phone ? 1.5 : 0.98;
  const R0 = phone ? 250 : 236; // edge nearest the star
  const R1 = phone ? 540 : 500;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const a = mid + (0.5 - u) * sweep;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    pos.set([cs * R1, 0, sn * R1, cs * R0, 0, sn * R0], i * 6);
    uv.set([u, 0, u, 1], i * 4);
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("uv", new BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: { tMap: { value: tex }, uFade, uReady, uTime: shared.time },
    vertexShader: /* glsl */ `
varying vec2 vUv; varying vec3 vP;
void main() { vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
uniform sampler2D tMap; uniform float uFade; uniform float uReady; uniform float uTime;
varying vec2 vUv; varying vec3 vP;
void main() {
  float a = texture2D(tMap, vUv).a;
  // lit by the star: brightest on the edge that faces it
  float d = length(vP.xz);
  float lit = mix(1.0, 0.5, smoothstep(250.0, 520.0, d));
  vec3 c = mix(vec3(0.95, 1.03, 1.26), vec3(0.62, 0.78, 1.1), smoothstep(250.0, 520.0, d));
  // a slow sheen runs along the letters
  float sheen = exp(-pow(fract(vUv.x - uTime * 0.03) * 8.0 - 4.0, 2.0));
  gl_FragColor = vec4(c * lit * (0.8 + sheen * 0.32) * a * uFade * uReady, 1.0);
}`,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  group.add(mesh);

  return {
    group,
    update(overview: number, _t: number) {
      uFade.value = smooth(0.55, 1, overview);
      mesh.visible = uFade.value > 0.002;
    },
    dispose() {
      tex.dispose();
    },
  };
}
