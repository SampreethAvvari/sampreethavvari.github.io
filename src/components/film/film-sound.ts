// A film's own sound under the reel. It plays only while the site's sound
// is on (the visitor chose it), fades in under the picture, crossfades with
// the cut between films, and asks the site's score to step back while it
// plays: a `sound:duck` event on window with { amount, reason: "film" }, and
// { amount: 0 } once the film is quiet again.
//
// Volume is faded on the media element. Phones that do not let a page set
// the volume (iPhone) start and stop the sound without the fade.

const LEVEL = 0.9; // how loud the film plays
const DUCK = 0.75; // how far the score steps back under it

export const soundIsOn = () => document.documentElement.dataset.sound === "on";

export class FilmSound {
  private els = new Map<number, HTMLAudioElement>();
  private fades = new Map<HTMLMediaElement, number>();
  private current = -1;
  private ducked = false;

  constructor(private urls: Array<string | undefined>) {}

  has(i: number) {
    return !!this.urls[i];
  }

  private el(i: number) {
    let a = this.els.get(i);
    const url = this.urls[i];
    if (!a && url) {
      a = new Audio();
      a.loop = true;
      a.preload = "auto";
      a.volume = 0;
      a.src = url;
      this.els.set(i, a);
    }
    return a;
  }

  private duck(amount: number) {
    const on = amount > 0;
    if (on === this.ducked) return;
    this.ducked = on;
    window.dispatchEvent(new CustomEvent("sound:duck", { detail: on ? { amount, reason: "film" } : { amount: 0, reason: "film" } }));
  }

  private fade(a: HTMLMediaElement, to: number, ms: number, after?: () => void) {
    cancelAnimationFrame(this.fades.get(a) ?? 0);
    const from = a.volume;
    if (ms <= 0) {
      a.volume = to;
      after?.();
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / ms));
      a.volume = Math.max(0, Math.min(1, from + (to - from) * p));
      if (p < 1) this.fades.set(a, requestAnimationFrame(step));
      else after?.();
    };
    this.fades.set(a, requestAnimationFrame(step));
  }

  /** Make film `i` the one that sounds (if sound is on), fading over `ms`. */
  to(i: number, ms = 700) {
    for (const [k, a] of this.els) {
      if (k === i) continue;
      if (!a.paused) this.fade(a, 0, ms, () => a.pause());
    }
    this.current = i;
    const a = soundIsOn() ? this.el(i) : undefined;
    if (!a) {
      // Nothing to play: let the score come back once the old film is gone.
      window.setTimeout(() => {
        if (this.current === i && !this.playing()) this.duck(0);
      }, ms);
      return;
    }
    this.duck(DUCK);
    a.play().then(
      () => this.fade(a, LEVEL, ms),
      () => this.duck(this.playing() ? DUCK : 0),
    );
  }

  private playing() {
    for (const a of this.els.values()) if (!a.paused) return true;
    return false;
  }

  /** Quiet every film, then hand the room back to the score. */
  stop(ms = 500) {
    if (!this.playing()) {
      this.duck(0);
      return;
    }
    let left = 0;
    for (const a of this.els.values()) {
      if (a.paused) continue;
      left++;
      this.fade(a, 0, ms, () => {
        a.pause();
        if (--left === 0) this.duck(0);
      });
    }
  }

  /** Follow the site's switch: start the current film's sound or stop it. */
  sync(active: boolean) {
    if (active && soundIsOn() && this.current >= 0) this.to(this.current, 900);
    else this.stop(400);
  }

  destroy() {
    for (const id of this.fades.values()) cancelAnimationFrame(id);
    for (const a of this.els.values()) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    this.els.clear();
    this.duck(0);
  }
}
