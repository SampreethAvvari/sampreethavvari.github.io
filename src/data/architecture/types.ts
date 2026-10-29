// The shape of one architecture page. See index.ts for how pages are found.

export type Fact = { title: string; body: string; source?: string };

export type Part = {
  /** What kind of thing it is, in a word or two. */
  kind: string;
  /** Who runs it. "mine" glows in the tab colour; "managed" and "outside" stay quiet. */
  owner: "mine" | "managed" | "outside" | "planned";
  what: string;
  /** What happens when this part is slow or down. */
  fails?: string;
  source?: string;
};

export type Readout = {
  value: string;
  unit?: string;
  label: string;
  /** Optional micro chart: daily counts for a sparkline, or a 0..1 share for a ring. */
  spark?: number[];
  ring?: number;
};

export type Architecture = {
  slug: string;
  /** Order on the site: lower comes first in Next system and on the map. */
  rank: number;
  /** "live" unless set. "preview" for a system still on sample data. */
  status?: "live" | "preview";
  /** What the status chip says, like "Preview on sample data". */
  statusNote?: string;
  name: string;
  /** The project this drawing belongs to. A project can have several drawings
   * (the app, a shared service it owns, a pipeline), grouped on /architecture. */
  project: string;
  /** "system" is a whole app; "service" is one shared service many apps call. */
  kind: "system" | "service";
  /** Which kinds of work it shows, for the filters. aie, fde, mle, sde. */
  disciplines: Array<"aie" | "fde" | "mle" | "sde">;
  post: string;
  headline: string;
  tail: string;
  lede: string;
  titleBlock: Array<[string, string]>;
  readouts: Readout[];
  svg: string;
  views: Array<{ id: string; label: string; focus: string[]; note: string }>;
  parts: Record<string, Part>;
  breaks: Fact[];
  tuned: Fact[];
  guards: Fact[];
  cost: {
    total: string;
    period: string;
    method: string;
    parts: Array<{ label: string; usd: number }>;
  } | null;
  /** What makes the drawing move. Every page has one. */
  live: Live;
};

/**
 * The drawing's one moving thing, always true to the real system.
 * - interval: a real schedule that repeats, like a sync every minute. A
 *   countdown runs to the next run; at zero a pulse travels `path`.
 *   `window` limits it to active hours, like a poller that sleeps at night.
 * - daily: a real job at a fixed time. The countdown runs to the next one.
 * - event: nothing on a clock; it wakes when something happens (a form is
 *   sent, a call ends). A button traces one such request along `path`.
 * Times are in `tz`, New York unless set. It is only a clock in the
 * visitor's browser and never calls the real system.
 */
export type Live = {
  mode: "interval" | "daily" | "event";
  /** "Next sync", "Next grading run", "Trace a new lead". */
  label: string;
  /** Part ids in order; the pulse runs along the paths between neighbours. */
  path: string[];
  everySeconds?: number;
  /** Active hours [from, to) for an interval, 24 hour clock. */
  window?: [number, number];
  /** Daily run time, "06:00". */
  at?: string;
  /** Days it runs, 1 Monday to 7 Sunday. Every day unless set. */
  days?: number[];
  tz?: string;
  /** The real trigger, shown on hover: a scheduler job or the event. */
  source?: string;
};
