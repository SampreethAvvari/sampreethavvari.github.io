// New York time for the observatory's clocks. Every schedule in the
// drawings is written in New York time, so the countdowns and the day
// replay read the visitor's clock through this zone.

const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const fmtCache = new Map<string, Intl.DateTimeFormat>();
const partsFmt = (tz: string) => {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmtCache.set(tz, f);
  }
  return f;
};

/** Weekday (1 Monday .. 7 Sunday) and second of the day in `tz`. */
export function zoned(ms: number, tz = "America/New_York") {
  const p: Record<string, string> = {};
  for (const x of partsFmt(tz).formatToParts(new Date(ms))) p[x.type] = x.value;
  return { wd: WD[p.weekday] || 1, sod: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second) };
}

export type Schedule = {
  mode: "interval" | "daily" | "event";
  every: number; // seconds
  window: number[]; // [from, to) hours
  at: string; // "06:00"
  days: number[];
};

export function readSchedule(el: HTMLElement): Schedule {
  return {
    mode: (el.dataset.mode || "event") as Schedule["mode"],
    every: Number(el.dataset.every) || 60,
    window: (el.dataset.window || "").split(",").filter(Boolean).map(Number),
    at: el.dataset.at || "",
    days: (el.dataset.days || "").split(",").filter(Boolean).map(Number),
  };
}

const inWindow = (s: Schedule, sod: number) => s.window.length < 2 || (sod / 3600 >= s.window[0] && sod / 3600 < s.window[1]);
const dayOk = (s: Schedule, wd: number) => !s.days.length || s.days.includes(wd);

/** The next run strictly after `from` (ms), on the real clock. */
export function nextRun(s: Schedule, from: number): number {
  if (s.mode === "daily") {
    const [h = 0, m = 0] = s.at.split(":").map(Number);
    const { sod } = zoned(from);
    let delta = h * 3600 + m * 60 - sod;
    if (delta <= 0) delta += 86400;
    let t = Math.floor(from / 1000) * 1000 + delta * 1000;
    for (let i = 0; i < 8 && !dayOk(s, zoned(t).wd); i++) t += 86400000;
    return t;
  }
  if (s.mode === "event") return from + s.every * 1000;
  const every = s.every * 1000;
  let t = Math.ceil((from + 1) / every) * every;
  for (let i = 0; i < 20000; i++) {
    const z = zoned(t);
    if (inWindow(s, z.sod) && dayOk(s, z.wd)) break;
    t += every;
  }
  return t;
}

export function asleep(s: Schedule, now: number): boolean {
  return s.mode === "interval" && s.window.length === 2 && !inWindow(s, zoned(now).sod);
}

/** Runs of a schedule with a second of the day in (a, b], on weekday `wd`. */
export function runsBetween(s: Schedule, a: number, b: number, wd: number): number {
  if (b <= a || s.mode === "event" || !dayOk(s, wd)) return 0;
  if (s.mode === "daily") {
    const [h = 0, m = 0] = s.at.split(":").map(Number);
    const t = h * 3600 + m * 60;
    return t > a && t <= b ? 1 : 0;
  }
  const lo = s.window.length === 2 ? s.window[0] * 3600 : 0;
  const hi = s.window.length === 2 ? s.window[1] * 3600 : 86400;
  // Runs sit on multiples of `every`, inside [lo, hi).
  const from = Math.max(a, lo - 1e-6);
  const to = Math.min(b, hi - 1e-6);
  if (to <= from) return 0;
  return Math.max(0, Math.floor(to / s.every) - Math.floor(from / s.every));
}

export function span(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 100) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
}

export const clockText = (sod: number) => {
  const h = Math.floor(sod / 3600) % 24;
  const m = Math.floor((sod % 3600) / 60);
  const ap = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${ap}`;
};
