// Getting a 3D world ready without ever holding up the page. Three things stop
// the main thread when a world starts or first shows something: asking the GPU
// about a shader that is still linking, building everything in one go, and the
// first draw of each object (its buffers, textures and state). So shaders link
// in the background and are only used once they are done, the building gives way
// between steps, and hidden things are drawn once ahead of time, one at a time,
// into a single unseen pixel.

import { Texture, TextureLoader, WebGLRenderTarget, type Camera, type Light, type Mesh, type Object3D, type ShaderMaterial, type WebGLRenderer } from "three";

/**
 * A picture as a texture, decoded away from the page's thread. A browser that
 * cannot do that gets the ordinary loader, which decodes when it first draws.
 */
export async function decodedTexture(url: string): Promise<Texture> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const bmp = await createImageBitmap(await res.blob(), { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" });
    const tex = new Texture(bmp);
    tex.flipY = false;
    tex.needsUpdate = true;
    return tex;
  } catch {
    return new TextureLoader().loadAsync(url);
  }
}

/** Let the page have a turn: input, scrolling and frames go first. */
export function breathe(): Promise<void> {
  return new Promise((done) => setTimeout(done, 0));
}

/** Reading back a shader's logs waits on the GPU for each one, so only a development build asks. */
export function quietShaderChecks(renderer: WebGLRenderer) {
  if (!import.meta.env.DEV) renderer.debug.checkShaderErrors = false;
}

/**
 * Link an object's shaders for the target it will draw to, in the background.
 * Resolves when they are ready. It keeps asking without ever making the GPU
 * answer at once, and copes with the world being taken down while it waits.
 */
export function prelink(renderer: WebGLRenderer, object: Object3D, camera: Camera, target: WebGLRenderTarget | null): Promise<void> {
  const was = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  const waiting = renderer.compile(object, camera);
  renderer.setRenderTarget(was);
  const t0 = performance.now();
  return new Promise((done) => {
    const check = () => {
      for (const m of waiting) {
        const p = (renderer.properties.get(m) as { currentProgram?: { isReady(): boolean } }).currentProgram;
        if (!p || p.isReady()) waiting.delete(m);
      }
      // A driver that never says it is ready gets used anyway.
      if (!waiting.size || performance.now() - t0 > 12000) done();
      else setTimeout(check, 16);
    };
    check();
  });
}

/** The same for full screen passes: one mesh, its material swapped per pass. */
export function prelinkPasses(renderer: WebGLRenderer, quad: Mesh, camera: Camera, passes: [ShaderMaterial, WebGLRenderTarget | null][]): Promise<unknown> {
  const keep = quad.material;
  const waits = passes.map(([m, target]) => {
    quad.material = m;
    return prelink(renderer, quad, camera, target);
  });
  quad.material = keep;
  return Promise.all(waits);
}

const idle = (cb: () => void, ms = 300): (() => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
  if (w.requestIdleCallback) {
    const h = w.requestIdleCallback(cb, { timeout: ms });
    return () => w.cancelIdleCallback?.(h);
  }
  const h = window.setTimeout(cb, 40);
  return () => clearTimeout(h);
};

const WARM_LAYER = 31;

/**
 * Draw each of these once into one unseen pixel, one per quiet moment, so the
 * first time the story shows them nothing has to upload or set up. Call the
 * result to stop. The camera can be anywhere: nothing is culled here.
 */
export function warmAhead(renderer: WebGLRenderer, scene: Object3D, camera: Camera, jobs: Object3D[], textures: Texture[] = []): () => void {
  let stopped = false;
  let next = 0;
  let cancel: (() => void) | null = null;
  const pixel = new WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false });
  const lights: Light[] = [];
  scene.traverse((o) => {
    if ((o as Light).isLight) lights.push(o as Light);
  });

  const drawOne = (job: Object3D) => {
    const raised: Object3D[] = [];
    const shown: Object3D[] = [];
    const unculled: Object3D[] = [];
    for (let p = job.parent; p; p = p.parent) {
      if (!p.visible) {
        p.visible = true;
        raised.push(p);
      }
    }
    job.traverse((o) => {
      if (!o.visible) {
        o.visible = true;
        shown.push(o);
      }
      if (o.frustumCulled) {
        o.frustumCulled = false;
        unculled.push(o);
      }
      o.layers.enable(WARM_LAYER);
    });
    for (const l of lights) l.layers.enable(WARM_LAYER);
    const mask = camera.layers.mask;
    camera.layers.set(WARM_LAYER);
    const shadow = renderer.shadowMap.autoUpdate;
    const pending = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    const was = renderer.getRenderTarget();
    renderer.setRenderTarget(pixel);
    renderer.render(scene, camera);
    renderer.setRenderTarget(was);
    renderer.shadowMap.autoUpdate = shadow;
    renderer.shadowMap.needsUpdate = pending;
    camera.layers.mask = mask;
    for (const l of lights) l.layers.disable(WARM_LAYER);
    job.traverse((o) => o.layers.disable(WARM_LAYER));
    for (const o of unculled) o.frustumCulled = true;
    for (const o of shown) o.visible = false;
    for (const o of raised) o.visible = false;
  };

  const step = () => {
    cancel = null;
    if (stopped) return;
    const job = jobs[next++];
    const tex = job ? null : textures[next - 1 - jobs.length];
    if (!job && !tex) {
      pixel.dispose();
      return;
    }
    try {
      if (job) drawOne(job);
      else if (tex) renderer.initTexture(tex);
    } catch {
      /* it will set up when it is first shown instead */
    }
    cancel = idle(step);
  };
  cancel = idle(step, 600);
  return () => {
    stopped = true;
    cancel?.();
    pixel.dispose();
  };
}
