// Where each page's low end lives. The deep layer (deep.ts) never stops; these
// are the settings it moves between, one for each tab and one for each world or
// stop inside a tab, so a page has a floor of its own and a neighbour never
// feels the same underfoot.
//
// Levels are dB at the output before the master fader, and -90 is off.

export interface Place {
  /** The true sub: a sine on the chord's bass note, 30 to 58 Hz. */
  sub: number;
  /** A second sine, at ratio above the first: 1.004 beats slowly, 1.333 is a low fourth. */
  sub2: number;
  ratio: number;
  /** Noise in a slowly moving low pass. */
  rumble: number;
  rumbleLo: number;
  rumbleHi: number;
  rumbleRate: number;
  /** The mid bass with harmonics, an octave or two above the sub. */
  growl: number;
  oct: number;
  cut: number;
  q: number;
  /** Share of odd harmonics in the growl: 0 is round, 1 is a square machine edge. */
  odd: number;
  det: number;
  /** A slow swell of the whole bed. */
  swell: number;
  swellRate: number;
  /** The harmonic path, so the bed reads on small speakers. */
  harm: number;
  /** How far the harmonics travel between the ears. The lows stay centred. */
  orbit: number;
  /** Beats in the bar where the bed pumps, how deep, how fast it falls back. */
  pulse: number[] | null;
  pulseDepth: number;
  pulseDecay: number;
  /** MIDI range of the root. */
  lo: number;
  hi: number;
  /** Seconds to slide to a new root. */
  glide: number;
  /** The long dark hall's return. */
  hall: number;
  /** How hard the visitor's touches and the page's arrivals land: 1 is full. */
  weight: number;
  /** What passes by when the world moves: a wave, a band of air in Hz, a level. */
  pass: [string, number, number];
}

const BASE: Place = {
  sub: -23, sub2: -90, ratio: 2,
  rumble: -40, rumbleLo: 34, rumbleHi: 70, rumbleRate: 0.05,
  growl: -35, oct: 1, cut: 170, q: 0.8, odd: 0, det: 6,
  swell: 0.14, swellRate: 0.06,
  harm: -40, orbit: 0.2,
  pulse: null, pulseDepth: 0, pulseDecay: 0.3,
  lo: 23, hi: 34, glide: 0.8,
  hall: -8, weight: 1,
  pass: ["organ", 900, -20],
};
const P = (o: Partial<Place>, from: Place = BASE): Place => ({ ...from, ...o });

// ---- the tabs ----------------------------------------------------------------

const HOME = P({ sub: -18.5, rumble: -31, rumbleRate: 0.04, growl: -30, cut: 140, swell: 0.2, swellRate: 0.04, harm: -36, orbit: 0.35, glide: 1.5, hall: -3, pass: ["bowed", 700, -17] });
// orbiting: the bed swells and turns, and the harmonics go round the head
const PROJECTS = P({ sub: -20, rumble: -38, growl: -31, cut: 220, q: 1.2, swell: 0.28, swellRate: 0.11, harm: -36, orbit: 0.85, glide: 0.9, hall: -6, pass: ["warm", 1100, -18] });
// a drawing: exact, cold, a low fourth, every move quick and clean
const ARCHITECTURE = P({ sub: -18.5, sub2: -29, ratio: 4 / 3, rumble: -52, growl: -36, cut: 160, q: 1.4, odd: 0.2, swell: 0.08, swellRate: 0.09, harm: -38, orbit: 0.45, pulse: [0, 1, 2], pulseDepth: 0.22, pulseDecay: 0.22, glide: 0.25, hall: -9, pass: ["glass", 2000, -21] });
// a machine hall: a square edge, a mains flutter in the rumble, a pump on the beat
const WORK = P({ sub: -15, rumble: -28, rumbleRate: 0.6, rumbleHi: 95, growl: -25, cut: 240, q: 1.8, odd: 0.75, det: 4, swell: 0.06, swellRate: 0.13, harm: -39, orbit: 0.3, pulse: [0, 1, 2, 3], pulseDepth: 0.5, pulseDecay: 0.2, glide: 0.2, hall: -6, pass: ["organ", 1400, -17] });
// the night air around a page: soft, slow, very little
const WRITING = P({ sub: -20.5, rumble: -41, rumbleRate: 0.03, growl: -33, cut: 125, swell: 0.26, swellRate: 0.06, harm: -37, orbit: 0.15, glide: 1.3, hall: -11, weight: 0.75, pass: ["air", 1700, -24] });
// a dark theatre: pressure, far thunder, a pulse that comes from the heartbeat
const FILM = P({ sub: -18, rumble: -28, rumbleLo: 26, rumbleHi: 58, rumbleRate: 0.03, growl: -33, cut: 110, q: 1.1, swell: 0.16, swellRate: 0.035, harm: -38, orbit: 0.1, glide: 1.6, hall: -3, pass: ["bowed", 500, -19] });
// very calm: two sines beating, nothing that pulls the eye off the map
const MIND = P({ sub: -24.5, sub2: -32, ratio: 1.004, rumble: -46, rumbleRate: 0.02, growl: -42, cut: 120, swell: 0.18, swellRate: 0.03, harm: -42, orbit: 0.6, glide: 3, hall: -7, weight: 0.5, pass: ["air", 2200, -28] });
// a small warm room: round, wooden, no pressure
const TEACHING = P({ sub: -19.5, rumble: -50, growl: -31, cut: 210, q: 0.7, swell: 0.1, swellRate: 0.05, harm: -37, orbit: 0.1, pulse: [0, 2], pulseDepth: 0.2, pulseDecay: 0.5, glide: 0.6, hall: -18, weight: 0.7, pass: ["warm", 1200, -24] });
// a cold white room: a thin clean low tone with the silver bar's ratio over it
const RESUME = P({ sub: -21.5, sub2: -34, ratio: 2.76, rumble: -50, growl: -44, cut: 300, q: 2.6, swell: 0.1, swellRate: 0.04, harm: -41, orbit: 0.25, glide: 2.5, hall: -8, weight: 0.65, pass: ["glass", 2600, -23] });
// a model running: tight and clocked, the bed ticks over on the eighths
const DEMOS = P({ sub: -17.5, rumble: -46, growl: -27, cut: 340, q: 2, odd: 0.5, det: 3, swell: 0.05, swellRate: 0.2, harm: -38, orbit: 0.4, pulse: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], pulseDepth: 0.42, pulseDecay: 0.13, glide: 0.15, hall: -14, weight: 0.8, pass: ["reed", 1500, -21] });

export const PLACES: Record<string, Place> = {
  home: HOME, projects: PROJECTS, architecture: ARCHITECTURE, work: WORK, writing: WRITING,
  film: FILM, mind: MIND, teaching: TEACHING, resume: RESUME, demos: DEMOS,
};

// ---- home: one for each of the nine worlds --------------------------------------

export const HOME_WORLDS: Place[] = [
  // launch: ignition, the rumble wide open
  P({ sub: -18, rumble: -25, rumbleLo: 30, rumbleHi: 90, rumbleRate: 0.09, growl: -30, cut: 130, glide: 2 }, HOME),
  // proof: cold and thin, a small tick on the eighths
  P({ sub: -21, rumble: -46, growl: -34, cut: 320, q: 2.2, odd: 0.3, swell: 0.1, swellRate: 0.25, harm: -41, orbit: 0.7, pulse: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], pulseDepth: 0.22, pulseDecay: 0.12, glide: 0.5, hall: -8 }, HOME),
  // machines: an engine, square and pumping
  P({ sub: -17, rumble: -33, rumbleRate: 0.5, growl: -24, cut: 270, q: 1.7, odd: 0.8, det: 3, swell: 0.05, harm: -38, orbit: 0.25, pulse: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], pulseDepth: 0.6, pulseDecay: 0.14, glide: 0.25, hall: -7 }, HOME),
  // four ways in: the growl an octave higher, walking on the beat
  P({ sub: -20, rumble: -44, growl: -28, oct: 2, cut: 430, q: 1.1, odd: 0.1, harm: -36, orbit: 0.8, pulse: [0, 1, 2, 3], pulseDepth: 0.3, pulseDecay: 0.32, glide: 0.4, hall: -7 }, HOME),
  // writing: warm and close, almost only the sub
  P({ sub: -22, rumble: -46, growl: -33, cut: 120, swell: 0.26, swellRate: 0.05, harm: -42, orbit: 0.1, glide: 1.4, hall: -10 }, HOME),
  // the landing: the heaviest floor on the site
  P({ sub: -17, rumble: -25, rumbleLo: 26, rumbleHi: 80, rumbleRate: 0.07, growl: -27, cut: 160, q: 1.3, harm: -34, orbit: 0.1, glide: 2.2, hall: -2 }, HOME),
  // the exit: wind in the low end, the growl gone far back
  P({ sub: -21, rumble: -31, rumbleLo: 40, rumbleHi: 125, rumbleRate: 0.13, growl: -41, cut: 130, harm: -42, orbit: 0.5, glide: 2, hall: -3 }, HOME),
  // the helmet: cold and thin, a sub and nothing on top of it
  P({ sub: -24, sub2: -30, ratio: 1.005, rumble: -38, growl: -48, harm: -47, orbit: 0.2, glide: 2.5, hall: -2 }, HOME),
  // the night: nearly nothing, so the touch has somewhere to go
  P({ sub: -31, rumble: -45, rumbleRate: 0.02, growl: -70, harm: -52, orbit: 0, glide: 3, hall: -2 }, HOME),
];

// ---- projects: one for each world -----------------------------------------------

export const PROJECT_WORLDS: Place[] = [
  // the system: firelight, a flicker in the rumble
  P({ rumble: -30, rumbleRate: 0.32, growl: -30, cut: 190 }, PROJECTS),
  // mirror: glass, two sines an octave apart that swap ears
  P({ sub: -26, sub2: -31, ratio: 2, growl: -46, rumble: -48, swell: 0.4, swellRate: 0.2, harm: -41, orbit: 1 }, PROJECTS),
  // ring: a slow machine going round
  P({ growl: -28, odd: 0.6, cut: 250, q: 1.9, pulse: [0, 1, 2, 3], pulseDepth: 0.45, pulseDecay: 0.26, swellRate: 0.09, orbit: 1 }, PROJECTS),
  // listener: warm, a hand on a drum, under two voices
  P({ sub: -24, growl: -35, cut: 180, q: 0.8, pulse: [0, 2], pulseDepth: 0.26, pulseDecay: 0.4, orbit: 0.3 }, PROJECTS),
  // disk: the pull of something huge
  P({ sub: -17, rumble: -26, rumbleLo: 26, rumbleHi: 62, rumbleRate: 0.04, growl: -28, cut: 115, q: 1.3, swell: 0.22, swellRate: 0.05, harm: -34, orbit: 0.2, glide: 3, hall: -2 }, PROJECTS),
  // geode: a thin sub and a twelfth above it, all light
  P({ sub: -28, sub2: -33, ratio: 3, growl: -50, rumble: -52, swell: 0.3, swellRate: 0.3, harm: -44, orbit: 0.95, glide: 0.5, hall: -3 }, PROJECTS),
  // arch: the growl sweeps up and over
  P({ growl: -30, cut: 260, q: 1.5, swell: 0.4, swellRate: 0.17, orbit: 1, glide: 0.8 }, PROJECTS),
  // nets: quick and caught, the bed ticking on every step of the line
  P({ sub: -25, growl: -32, cut: 360, q: 1.7, odd: 0.3, pulse: [0, 0.67, 1.33, 2, 2.67, 3.33], pulseDepth: 0.4, pulseDecay: 0.12, glide: 0.3 }, PROJECTS),
  // comet: all rush, wide open at the top of the rumble
  P({ sub: -24, rumble: -26, rumbleLo: 44, rumbleHi: 150, rumbleRate: 0.2, growl: -40, orbit: 1, glide: 1.6, hall: -2 }, PROJECTS),
  // the belt: slow, rocky, a long way apart
  P({ sub: -23, rumble: -35, rumbleRate: 0.08, growl: -38, cut: 130, swell: 0.12, swellRate: 0.04, orbit: 0.5, glide: 2 }, PROJECTS),
];

// ---- work: one for each stop ---------------------------------------------------

export const WORK_STOPS: Place[] = [
  // the hub
  WORK,
  // the reading room: quieter, the edge taken off
  P({ sub: -24, growl: -36, odd: 0.2, cut: 420, q: 1, pulse: [0, 2], pulseDepth: 0.2, rumble: -48, orbit: 0.7, hall: -9 }, WORK),
  // the dock: open air, one long heavy pull at a time
  P({ sub: -20, rumble: -30, rumbleRate: 0.1, growl: -30, odd: 0.4, cut: 180, pulse: [0], pulseDepth: 0.55, pulseDecay: 0.7, glide: 0.8, hall: -3 }, WORK),
  // the scanner: three against four in the bed
  P({ sub: -24, growl: -30, cut: 310, q: 2.2, odd: 0.6, pulse: [0, 0.75, 1.5, 2.25, 3, 3.75], pulseDepth: 0.45, pulseDecay: 0.12, orbit: 1 }, WORK),
  // the keel: the lowest and hardest on the ring
  P({ sub: -18, rumble: -28, rumbleLo: 28, rumbleHi: 70, growl: -25, cut: 170, q: 1.5, odd: 0.9, pulse: [0, 1, 2, 3], pulseDepth: 0.7, pulseDecay: 0.24, harm: -37 }, WORK),
  // the whole ring: everything far off and turning
  P({ sub: -22, growl: -35, cut: 200, odd: 0.4, pulse: null, pulseDepth: 0, rumble: -32, rumbleRate: 0.15, swell: 0.2, swellRate: 0.1, orbit: 0.8, hall: -2, glide: 1.2 }, WORK),
  // 2017: one bell in the dark, almost nothing under it
  P({ sub: -29, growl: -60, rumble: -50, rumbleRate: 0.02, pulse: null, pulseDepth: 0, harm: -50, orbit: 0, glide: 2, hall: -3 }, WORK),
  // 2021: a first low tone, clean
  P({ sub: -27, growl: -42, odd: 0.1, cut: 200, rumble: -50, pulse: [0, 2], pulseDepth: 0.15, harm: -44, glide: 1 }, WORK),
  // 2023: a gas giant, vast and slow
  P({ sub: -19, rumble: -27, rumbleLo: 26, rumbleHi: 60, rumbleRate: 0.04, growl: -33, odd: 0, cut: 110, pulse: null, pulseDepth: 0, swell: 0.25, swellRate: 0.04, harm: -38, orbit: 0.2, glide: 2.4, hall: -2 }, WORK),
  // 2024, the lens: a clear bright octave, opening
  P({ sub: -24, sub2: -30, ratio: 2, growl: -36, odd: 0.1, cut: 480, q: 0.8, rumble: -46, pulse: [0, 1, 2, 3], pulseDepth: 0.2, orbit: 0.6, glide: 0.5 }, WORK),
  // 2024, the pair: two bodies beating against each other
  P({ sub: -22, sub2: -27, ratio: 1.012, growl: -30, odd: 0.5, pulse: [0, 1.5, 3], pulseDepth: 0.4, pulseDecay: 0.3, orbit: 1 }, WORK),
  // Now: the full machine
  P({ sub: -18, rumble: -29, growl: -25, cut: 280, odd: 0.7, pulse: [0, 1, 2, 3], pulseDepth: 0.55, harm: -36, hall: -3 }, WORK),
];
