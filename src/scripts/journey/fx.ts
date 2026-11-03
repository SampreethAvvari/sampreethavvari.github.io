// Small shared effects: a batch of camera facing glow points drawn in one
// call, and the blending settings every additive material uses.

import {
  BufferAttribute,
  CustomBlending,
  AddEquation,
  OneFactor,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  type Material,
} from "three";

/** Additive blending that keeps HDR values, so bloom can pick them up. */
export function additive<T extends Material>(m: T): T {
  m.transparent = true;
  m.depthWrite = false;
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendSrc = OneFactor;
  m.blendDst = OneFactor;
  return m;
}

const GLOW_VS = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aCol; // rgb, intensity
attribute float aSize;
uniform float uFade;
varying vec2 vUv;
varying vec3 vCol;
void main() {
  vUv = position.xy;
  vCol = aCol.rgb * aCol.a * uFade;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  mv.xy += position.xy * aSize;
  gl_Position = projectionMatrix * mv;
  if (aCol.a <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const GLOW_FS = /* glsl */ `
varying vec2 vUv;
varying vec3 vCol;
void main() {
  float d = length(vUv);
  float a = exp(-d * d * 9.0) * 0.9 + exp(-d * 28.0) * 1.4;
  a *= smoothstep(1.0, 0.7, d);
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

/**
 * Camera facing glow points. Positions are in the mesh's local space, so a
 * batch can ride on the ship or sit in a set piece. Set an intensity of 0 to
 * hide a point without touching the draw call.
 */
export class GlowBatch {
  readonly mesh: Mesh;
  readonly pos: Float32Array;
  readonly col: Float32Array;
  readonly size: Float32Array;
  private readonly aPos: InstancedBufferAttribute;
  private readonly aCol: InstancedBufferAttribute;
  private readonly aSize: InstancedBufferAttribute;
  readonly material: ShaderMaterial;
  count = 0;

  constructor(max: number, fade?: { value: number }) {
    const g = new InstancedBufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.aPos = new InstancedBufferAttribute(this.pos, 3);
    this.aCol = new InstancedBufferAttribute(this.col, 4);
    this.aSize = new InstancedBufferAttribute(this.size, 1);
    this.aCol.setUsage(35048); // DynamicDrawUsage
    g.setAttribute("aPos", this.aPos);
    g.setAttribute("aCol", this.aCol);
    g.setAttribute("aSize", this.aSize);
    g.instanceCount = 0;
    this.material = additive(
      new ShaderMaterial({
        vertexShader: GLOW_VS,
        fragmentShader: GLOW_FS,
        uniforms: { uFade: fade ?? { value: 1 } },
        side: DoubleSide,
      }),
    );
    this.mesh = new Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  add(x: number, y: number, z: number, size: number, r: number, g: number, b: number, intensity = 1) {
    const i = this.count++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.size[i] = size;
    this.col[i * 4] = r;
    this.col[i * 4 + 1] = g;
    this.col[i * 4 + 2] = b;
    this.col[i * 4 + 3] = intensity;
    (this.mesh.geometry as InstancedBufferGeometry).instanceCount = this.count;
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aCol.needsUpdate = true;
    return i;
  }

  setIntensity(i: number, v: number) {
    this.col[i * 4 + 3] = v;
  }

  setColor(i: number, r: number, g: number, b: number) {
    this.col[i * 4] = r;
    this.col[i * 4 + 1] = g;
    this.col[i * 4 + 2] = b;
  }

  setPos(i: number, x: number, y: number, z: number) {
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.aPos.needsUpdate = true;
  }

  setSize(i: number, s: number) {
    this.size[i] = s;
    this.aSize.needsUpdate = true;
  }

  /** Push colour and intensity changes to the GPU once per frame. */
  commit() {
    this.aCol.needsUpdate = true;
  }
}
