// Holds the frame rate on a machine that cannot draw every pixel in time, and
// gives the pixels back as soon as it can. Every 3D page feeds it its frame
// times and tells it how to change the pixel scale.
//
// It only ever trades pixels when pixels are the cost. After stepping down it
// checks that frames really got faster; if they did not (the script is the slow
// part, or the screen itself is held at 30 by a power saving mode) it goes back
// up and stops trying, because a softer picture would buy nothing. A step is
// applied while the page is moving when it can be, where a small change of
// sharpness does not show.

export type GovernorOptions = {
  /** The scales it may use, best first: [1, 0.85, 0.72]. */
  steps: number[];
  apply: (scale: number, index: number) => void;
  /** Slower than this on average is too slow (ms). */
  slowMs?: number;
  /** Faster than this on average leaves room to climb back (ms). */
  fastMs?: number;
};

type Mode = "watch" | "checkDown" | "checkUp";

// A screen held at 30 frames a second looks like an overloaded one until a step
// down changes nothing. Once seen, that holds for every page of the visit.
let heldAt30 = false;
// Once fewer pixels have bought nothing, this machine's limit is probably not
// its pixels: later pages wait much longer before they try again.
let boughtNothing = false;

export class Governor {
  private readonly steps: number[];
  private readonly apply: (scale: number, index: number) => void;
  private readonly slowMs: number;
  private readonly fastMs: number;
  private idx = 0;
  private avg = 0;
  private slowT = 0;
  private fastT = 0;
  private waited = 0;
  private mode: Mode = "watch";
  private modeT = 0;
  private before = 0;
  private from = 0;
  private sum = 0;
  private count = 0;
  private climbAfter = 9000;
  private locked = false;

  constructor(o: GovernorOptions) {
    this.steps = o.steps;
    this.apply = o.apply;
    this.slowMs = o.slowMs ?? 27;
    this.fastMs = o.fastMs ?? 19;
  }

  get scale() {
    return this.steps[this.idx];
  }

  /** After a gap in drawing (a hidden tab, a page coming back on screen): start the averages over. */
  reset() {
    this.avg = 0;
    this.slowT = 0;
    this.fastT = 0;
    this.modeT = 0;
    this.sum = 0;
    this.count = 0;
  }

  private set(i: number) {
    this.idx = i;
    this.apply(this.steps[i], i);
    this.modeT = 0;
    this.sum = 0;
    this.count = 0;
  }

  /** One frame took dtMs. `moving` says the page is in motion, the best moment for a step. */
  frame(dtMs: number, moving = false) {
    // A stall this long says nothing about the pixels: a page load, a shader, a tab switch.
    if (dtMs > 220 || dtMs <= 0) {
      this.slowT = 0;
      this.fastT = 0;
      return;
    }
    this.avg = this.avg ? this.avg + (dtMs - this.avg) * 0.06 : dtMs;
    this.modeT += dtMs;

    if (this.mode !== "watch") {
      // The first frames after a step include the reallocation, so they do not count.
      if (this.modeT > 350) {
        this.sum += dtMs;
        this.count++;
      }
      if (this.modeT < 2500 || !this.count) return;
      const now = this.sum / this.count;
      if (this.mode === "checkDown") {
        // A real gain, not the scene getting lighter for a moment.
        if (now > this.before * 0.87) {
          // No faster yet. Frames land on whole screen refreshes, so one step may not show: try the next.
          if (this.idx < this.steps.length - 1) {
            this.set(this.idx + 1);
            return;
          }
          // No faster with the fewest pixels: they were not the cost.
          if (this.from === 0 && Math.abs(this.before - 33.3) < 1.5) heldAt30 = true;
          boughtNothing = true;
          this.locked = true;
          this.set(this.from);
        }
      } else if (now > this.slowMs && this.idx < this.steps.length - 1) {
        // The climb was too much. Back down, and wait longer before the next try.
        this.climbAfter = Math.min(60000, this.climbAfter * 2);
        this.set(this.idx + 1);
      }
      this.mode = "watch";
      this.slowT = 0;
      this.fastT = 0;
      return;
    }

    if (this.avg > this.slowMs) {
      this.slowT += dtMs;
      this.fastT = 0;
    } else {
      this.slowT = Math.max(0, this.slowT - dtMs * 0.5);
      this.fastT = this.avg < this.fastMs ? this.fastT + dtMs : 0;
    }

    if (this.avg > this.slowMs && this.slowT > (boughtNothing ? 9000 : 2400) && this.idx < this.steps.length - 1 && !this.locked && !(heldAt30 && Math.abs(this.avg - 33.3) < 1.5)) {
      this.waited += dtMs;
      if (!moving && this.waited < 1500) return;
      this.waited = 0;
      this.before = this.avg;
      this.from = this.idx;
      this.slowT = 0;
      this.mode = "checkDown";
      this.set(this.idx + 1);
    } else if (this.fastT > this.climbAfter && this.idx > 0 && moving) {
      this.fastT = 0;
      this.mode = "checkUp";
      this.set(this.idx - 1);
    }
  }
}
