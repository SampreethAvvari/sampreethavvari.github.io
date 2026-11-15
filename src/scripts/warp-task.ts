// What the site's loader waits for before it opens a page (WarpLoader).
//
// Besides the page's own HTML, stylesheets and pictures, a page's scripts can
// hand the loader work it should wait for: a 3D world being built, its shaders
// linking, the film frames coming down. The loader shows how far all of it has
// got as a percent and opens only when every task is done (or a long time
// limit passes). A task started while no loader is up does nothing, so the
// same code can run at any time.
//
//   const t = warpTask(3);      // weight: its share of the percent
//   t.progress(0.4);            // how far it has got, 0..1 (optional)
//   t.done();                   // finished, or given up: either way
//
//   warpWait(promise, 2);       // the same for a promise, settled either way

export interface WarpTask {
  progress(f: number): void;
  done(): void;
}

const NONE: WarpTask = { progress() {}, done() {} };

export function warpTask(weight = 1): WarpTask {
  const w = window as Window & { __warpTask?: (weight: number) => WarpTask };
  return w.__warpTask?.(weight) ?? NONE;
}

export function warpWait<T>(p: Promise<T>, weight = 1): Promise<T> {
  const t = warpTask(weight);
  p.then(
    () => t.done(),
    () => t.done(),
  );
  return p;
}
