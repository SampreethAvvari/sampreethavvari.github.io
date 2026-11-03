// The words live in the world. Each stop's panel is ordinary HTML laid out
// flat at the size of the screen, then anchored in 3D in front of the camera's
// resting pose for that stop. At rest it sits exactly on the screen, crisp and
// untransformed. When the camera moves away the panel stays behind in space
// and slides off in true perspective, so type gets out of the way of the
// subject instead of fading on top of it.

import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from "three";
import { DEG, clamp } from "./util";
import type { Pose } from "./shots";

export interface PanelDef {
  el: HTMLElement;
  stop: number;
  /** World distance the panel is anchored at. Closer panels slide away faster. */
  depth: number;
}

const toCss = new Matrix4();
const fromCss = new Matrix4();
const view = new Matrix4();
const anchor = new Matrix4();
const out = new Matrix4();
const t1 = new Matrix4();
const roll = new Quaternion();
const qq = new Quaternion();
const dirv = new Vector3();
const cam = new Vector3();
const scaleV = new Vector3();

function poseMatrix(p: Pose, m: Matrix4) {
  // Same construction as the camera: look along, then roll.
  t1.lookAt(p.p, p.l, p.up);
  qq.setFromRotationMatrix(t1);
  dirv.set(0, 0, -1).applyQuaternion(qq);
  roll.setFromAxisAngle(dirv, p.r * DEG);
  qq.premultiply(roll);
  m.compose(p.p, qq, scaleV.set(1, 1, 1));
}

export function mountPanels(layer: HTMLElement, defs: PanelDef[], stopPose: (i: number, o: Pose) => Pose, newPose: () => Pose) {
  const poses = defs.map((d) => stopPose(d.stop, newPose()));
  const state = defs.map(() => ({ rest: false, op: -1 }));
  let vh = 0;
  let lastF = 0;
  const measure = () => {
    vh = layer.clientHeight;
  };
  measure();
  return {
    measure,
    refreshPoses() {
      defs.forEach((d, i) => stopPose(d.stop, poses[i]));
    },
    update(camera: PerspectiveCamera, q: number, flying: boolean, active: number) {
      const F = (vh / 2) / Math.tan((camera.fov * DEG) / 2);
      if (Math.abs(F - lastF) > 0.5) {
        layer.style.perspective = `${F.toFixed(1)}px`;
        lastF = F;
      }
      defs.forEach((d, i) => {
        const s = state[i];
        const away = Math.abs(q - d.stop);
        const live = !flying && away < 0.86;
        const op = flying ? 0 : clamp(1 - (away - 0.07) / 0.3);
        if (Math.abs(op - s.op) > 0.004) {
          d.el.style.opacity = op.toFixed(3);
          s.op = op;
        }
        const isActive = active === d.stop && !flying && away < 0.5;
        d.el.classList.toggle("is-active", isActive);
        if (!live) return;
        if (away < 0.004) {
          if (!s.rest) {
            d.el.style.transform = "none";
            s.rest = true;
          }
          return;
        }
        s.rest = false;
        const Fs = (vh / 2) / Math.tan((poses[i].f * DEG) / 2);
        const k = d.depth / Fs;
        poseMatrix(poses[i], anchor);
        // Panel pixels to the anchor's local frame, into the world, then
        // through the camera into CSS space.
        fromCss.makeScale(k, -k, k);
        fromCss.setPosition(0, 0, -d.depth);
        view.copy(camera.matrixWorld).invert();
        toCss.makeScale(1 / k, -1 / k, 1 / k);
        toCss.setPosition(0, 0, F);
        out.copy(toCss).multiply(view).multiply(anchor).multiply(fromCss);
        // Behind the lens: nothing to show.
        const e = out.elements;
        cam.set(e[12], e[13], e[14]);
        if (cam.z > F - 2) {
          d.el.style.opacity = "0";
          s.op = 0;
          return;
        }
        d.el.style.transform = `matrix3d(${e.map((x) => x.toFixed(6)).join(",")})`;
      });
    },
  };
}
export type Panels = ReturnType<typeof mountPanels>;
