/** One mock screen state shown during a tour step. */
export type Screen =
  | { kind: "table"; title: string; headers: string[]; rows: (string | { text: string; tone: "good" | "bad" | "warn" | "dim" })[][] }
  | { kind: "report"; title: string; subtitle?: string; sections: { name: string; score?: number; max?: number; tone?: "good" | "bad" | "warn"; note: string }[] }
  | { kind: "search"; query: string; answer: string; citations: { doc: string; snippet: string }[] }
  | { kind: "upload"; filename: string; stage: string; progress: number; verdict?: { label: string; tone: "good" | "bad" | "warn"; details: { name: string; value: string; tone?: "good" | "bad" | "warn" }[] } }
  | { kind: "cards"; title: string; cards: { name: string; lines: string[]; highlight?: boolean; badge?: string }[] }
  | { kind: "bars"; title: string; unit?: string; bars: { label: string; value: number; max: number; tone?: "good" | "bad" | "warn" }[] }
  | { kind: "terminal"; title: string; lines: string[] }
  | { kind: "chat"; messages: { from: "user" | "agent"; text: string }[] };

export type TourStep = {
  title: string;
  body: string;
  screen: Screen;
};

export type Tour = {
  slug: string;
  name: string;
  /** The second, gray line of the page title. It finishes the thought. */
  tail: string;
  kicker: string;
  /** Kept from the original tours site. The portfolio colours every demo
   *  with the Projects tab's blue instead, so these are not rendered. */
  accent: string;
  accentRgb: string;
  /** The case study on the portfolio this demo belongs to. */
  post?: string;
  /** Cover art in /public, shown on the demos index. */
  cover?: string;
  pitch: string;
  problem: string;
  metrics: { label: string; value: string; sub?: string }[];
  concepts: string[];
  stack: string[];
  steps: TourStep[];
  architecture: { lane: string; items: string[] }[];
  outcome: string;
  links?: { label: string; url: string }[];
};
