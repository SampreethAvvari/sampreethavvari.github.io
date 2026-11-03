// A day in the sky of 45 services. Every service the post lists is one star, in
// the post's own nine groups. Scrub through a weekday and the stars wake when
// the post says they do: the 2 AM checks, the 6 AM burst, the 6:20, 6:30 and
// 6:45 follow ups, the 5 PM summary, and the ones that run all day. The rest
// wait until a person or an event calls them.
//
// Times and wording come from the post. Nothing here adds a claim: a service
// the post gives no time for is only marked with what the post does say.
//
// Sound hooks:
//   post:figure { id: "day-sky", action: "fire:<service>" | "play" | "pause" | "day:<name>" }
//   post:hover { kind: "service", id: "<service>", note }  note is the group, 0 to 8

import type { Figure } from "./index";
import { clamp, emit, h, isPhone, whileVisible } from "../util";
import { fig, frame, segmented } from "./parts";

type Day = "monday" | "wednesday" | "other";
type Svc = {
  id: string;
  name: string;
  group: number;
  when: string;
  /** Minutes after midnight when it fires. */
  at?: number[];
  /** Runs all day (or in a window) at this rhythm. */
  every?: "minute" | "five" | "ten" | "hour";
  window?: [number, number];
  warm?: boolean;
  day?: Day;
  /** Lit softly for a stretch the post names without a time. */
  soft?: [number, number];
  x: number;
  y: number;
};

const GROUPS = [
  "Patient forms and surveys",
  "The shared core",
  "Estimator and planner",
  "Launchpad",
  "Marketing data",
  "Coaching",
  "The lab",
  "Money and operations",
  "Websites",
];
const LABEL_AT: Array<[number, number]> = [
  [0.15, 0.255], [0.5, 0.2], [0.85, 0.2],
  [0.13, 0.565], [0.5, 0.685], [0.875, 0.565],
  [0.15, 0.962], [0.5, 0.962], [0.86, 0.962],
];

const m = (h: number, min = 0) => h * 60 + min;

const SERVICES: Svc[] = [
  // Patient forms and surveys
  { id: "public-forms", name: "Public forms", group: 0, when: "One instance stays warm", warm: true, x: 0.045, y: 0.1 },
  { id: "forms-dashboard", name: "Forms dashboard", group: 0, when: "When staff sign in", x: 0.1, y: 0.19 },
  { id: "delivery-worker", name: "Delivery worker", group: 0, when: "A sweep runs every minute", every: "minute", x: 0.155, y: 0.075 },
  { id: "nightly-checks", name: "Nightly checks", group: 0, when: "At 2 AM", at: [m(2)], x: 0.215, y: 0.18 },
  { id: "patient-surveys", name: "Patient surveys", group: 0, when: "When a patient fills one in", x: 0.27, y: 0.08 },
  // The shared core
  { id: "denticon-sync", name: "Denticon sync", group: 1, when: "One instance stays warm · a worker every ten minutes · a 4 AM poll", warm: true, every: "ten", at: [m(4)], x: 0.43, y: 0.135 },
  { id: "cdf", name: "CDF dashboard and registry", group: 1, when: "When a person or an app calls it", x: 0.5, y: 0.045 },
  { id: "pdf-renderer", name: "PDF renderer", group: 1, when: "An hourly sweep behind its queue", every: "hour", x: 0.57, y: 0.135 },
  // Estimator and planner
  { id: "estimator", name: "Treatment estimator", group: 2, when: "When a coordinator opens it", x: 0.78, y: 0.14 },
  { id: "planner", name: "Capacity planner", group: 2, when: "Reads the book every minute · a 7 AM email", every: "minute", at: [m(7)], x: 0.92, y: 0.07 },
  // Launchpad
  { id: "launchpad", name: "Launchpad", group: 3, when: "When someone opens it", x: 0.06, y: 0.41 },
  { id: "relay", name: "Request relay", group: 3, when: "When an app files a request", x: 0.2, y: 0.5 },
  // Marketing data: nine pulls in a tight cluster, the rest around them
  { id: "pull-callrail", name: "CallRail pull", group: 4, when: "At 6 AM", at: [m(6)], x: 0.465, y: 0.345 },
  { id: "pull-meta-ads", name: "Meta ads pull", group: 4, when: "At 6 AM", at: [m(6)], x: 0.5, y: 0.33 },
  { id: "pull-meta-organic", name: "Meta organic pull", group: 4, when: "At 6 AM", at: [m(6)], x: 0.535, y: 0.345 },
  { id: "pull-microsoft", name: "Microsoft Ads pull", group: 4, when: "At 6 AM", at: [m(6)], x: 0.46, y: 0.4 },
  { id: "pull-tapclicks", name: "TapClicks pull", group: 4, when: "At 6 AM", at: [m(6)], x: 0.5, y: 0.39 },
  { id: "pull-monday", name: "Monday pull", group: 4, when: "At 6 AM", at: [m(6)], x: 0.54, y: 0.4 },
  { id: "pull-ga4", name: "GA4 pull", group: 4, when: "At 6 AM", at: [m(6)], x: 0.47, y: 0.455 },
  { id: "pull-search-console", name: "Search Console pull", group: 4, when: "At 6 AM", at: [m(6)], x: 0.505, y: 0.45 },
  { id: "pull-business-profile", name: "Business Profile pull", group: 4, when: "At 6 AM", at: [m(6)], x: 0.535, y: 0.46 },
  { id: "ads-transfer", name: "Google Ads transfer", group: 4, when: "A managed transfer, daily", x: 0.375, y: 0.32 },
  { id: "monday-backup", name: "Monday backup", group: 4, when: "Wednesdays at 7 AM", at: [m(7)], day: "wednesday", x: 0.34, y: 0.45 },
  { id: "view-rebuild", name: "View rebuild", group: 4, when: "At 6:20", at: [m(6, 20)], x: 0.405, y: 0.575 },
  { id: "morning-email", name: "Morning email", group: 4, when: "At 6:30", at: [m(6, 30)], x: 0.5, y: 0.62 },
  { id: "health-check", name: "Health check", group: 4, when: "At 6:45", at: [m(6, 45)], x: 0.595, y: 0.575 },
  { id: "question-quiz", name: "Question quiz", group: 4, when: "Mondays at 8 AM", at: [m(8)], day: "monday", x: 0.66, y: 0.45 },
  { id: "data-connector", name: "Data connector", group: 4, when: "When staff ask Claude", x: 0.625, y: 0.32 },
  { id: "status-page", name: "Status page", group: 4, when: "When someone opens it", x: 0.5, y: 0.265 },
  // Coaching
  { id: "doc-coach", name: "Doc Coach", group: 5, when: "Zoom's webhook wakes it", x: 0.8, y: 0.385 },
  { id: "npc-poller", name: "NPC call poller", group: 5, when: "Every five minutes in the work day", every: "five", window: [m(6), m(18)], x: 0.905, y: 0.33 },
  { id: "npc-summary", name: "NPC daily summary", group: 5, when: "At 5 PM on weekdays", at: [m(17)], x: 0.955, y: 0.455 },
  { id: "npc-dashboard", name: "NPC Coach dashboard", group: 5, when: "When managers open it", x: 0.85, y: 0.5 },
  // The lab
  { id: "cbct", name: "CBCT validator", group: 6, when: "A storage event wakes it", x: 0.05, y: 0.74 },
  { id: "sftp", name: "SFTP drop box", group: 6, when: "A small always on VM", warm: true, x: 0.125, y: 0.83 },
  { id: "training-job", name: "Training data job", group: 6, when: "At 6 AM", at: [m(6)], x: 0.2, y: 0.72 },
  { id: "review-app", name: "CBCT review app", group: 6, when: "When the testing team uploads a study", x: 0.275, y: 0.83 },
  { id: "portal", name: "Doctor Portal", group: 6, when: "In preview on sample data", x: 0.09, y: 0.91 },
  // Money and operations
  { id: "cowork-ingest", name: "Cowork ingest", group: 7, when: "A scheduler checks it every five minutes", every: "five", x: 0.37, y: 0.8 },
  { id: "cowork", name: "Cowork Dashboard", group: 7, when: "When someone opens it", x: 0.44, y: 0.895 },
  { id: "dsr-pipeline", name: "DSR pipeline", group: 7, when: "Weekday mornings", soft: [m(5), m(9)], x: 0.5, y: 0.78 },
  { id: "dsr-dashboard", name: "DSR dashboard", group: 7, when: "When someone opens it", x: 0.57, y: 0.895 },
  { id: "reconciliation", name: "Reconciliation", group: 7, when: "When staff upload a day's exports", x: 0.63, y: 0.8 },
  // Websites
  { id: "patient-site", name: "Patient website", group: 8, when: "In preview", x: 0.8, y: 0.83 },
  { id: "lab-site", name: "Lab website", group: 8, when: "In preview", x: 0.92, y: 0.9 },
];

// Lines within each group, as pairs of ids, drawn like the Writing sky.
const LINES: Array<[string, string]> = [
  ["public-forms", "forms-dashboard"], ["forms-dashboard", "delivery-worker"], ["delivery-worker", "nightly-checks"], ["nightly-checks", "patient-surveys"],
  ["denticon-sync", "cdf"], ["cdf", "pdf-renderer"], ["pdf-renderer", "denticon-sync"],
  ["estimator", "planner"],
  ["launchpad", "relay"],
  ["ads-transfer", "status-page"], ["status-page", "data-connector"], ["data-connector", "question-quiz"], ["question-quiz", "health-check"],
  ["health-check", "morning-email"], ["morning-email", "view-rebuild"], ["view-rebuild", "monday-backup"], ["monday-backup", "ads-transfer"],
  ["doc-coach", "npc-poller"], ["npc-poller", "npc-summary"], ["doc-coach", "npc-dashboard"],
  ["cbct", "sftp"], ["sftp", "training-job"], ["training-job", "review-app"], ["sftp", "portal"],
  ["cowork-ingest", "cowork"], ["cowork", "dsr-pipeline"], ["dsr-pipeline", "dsr-dashboard"], ["dsr-dashboard", "reconciliation"],
  ["patient-site", "lab-site"],
];

const WINDOW = 12; // minutes a fired job stays lit

const clock = (t: number) => {
  const mins = ((Math.round(t) % 1440) + 1440) % 1440;
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  const ap = hh < 12 ? "AM" : "PM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
};

const render: Figure = ({ root, signal, still }) => {
  const { head } = frame(root, "One weekday, 45 stars", "Drag along the day. A star lights when that service runs.");
  let day: Day = "monday";
  const dayName: Record<Day, string> = { monday: "Monday", wednesday: "Wednesday", other: "Other weekdays" };
  const seg = segmented<Day>(
    "Which weekday",
    [
      { v: "monday", label: "Monday" },
      { v: "wednesday", label: "Wednesday" },
      { v: "other", label: "Other weekdays" },
    ],
    day,
    (v) => {
      day = v;
      fig("day-sky", `day:${v}`);
      buildTicks();
      refresh(true);
    },
    signal,
  );
  head.append(seg.el);

  const legend = h("div", "pfx-day-legend");
  [
    ["warm", "Always on"],
    ["run", "Runs all day"],
    ["fire", "Fires on the clock"],
    ["wait", "Waits to be called"],
  ].forEach(([k, label]) => {
    const it = h("span", "pfx-day-key");
    it.append(h("i", `is-${k}`), h("span", undefined, label));
    legend.append(it);
  });
  head.append(legend);

  const sky = h("div", "pfx-day-sky");
  const bg = h("canvas", "pfx-day-bg");
  const svgNS = "http://www.w3.org/2000/svg";
  const lines = document.createElementNS(svgNS, "svg");
  lines.setAttribute("class", "pfx-day-lines");
  lines.setAttribute("aria-hidden", "true");
  sky.append(bg, lines);
  const byId = new Map(SERVICES.map((s) => [s.id, s]));
  LINES.forEach(([a, b]) => {
    const A = byId.get(a)!;
    const B = byId.get(b)!;
    const l = document.createElementNS(svgNS, "line");
    l.setAttribute("x1", `${A.x * 100}%`);
    l.setAttribute("y1", `${A.y * 100}%`);
    l.setAttribute("x2", `${B.x * 100}%`);
    l.setAttribute("y2", `${B.y * 100}%`);
    lines.append(l);
  });
  GROUPS.forEach((g, i) => {
    const t = h("span", "pfx-day-group", g);
    t.style.left = `${LABEL_AT[i][0] * 100}%`;
    t.style.top = `${LABEL_AT[i][1] * 100}%`;
    sky.append(t);
  });
  const tip = h("div", "pfx-day-tip");
  tip.hidden = true;
  type Lit = { s: Svc; el: HTMLButtonElement; state: string; fired: boolean };
  const stars: Lit[] = SERVICES.map((s) => {
    const el = h("button", "pfx-day-star");
    el.type = "button";
    el.style.left = `${s.x * 100}%`;
    el.style.top = `${s.y * 100}%`;
    el.setAttribute("aria-label", `${s.name}. ${s.when}`);
    el.style.setProperty("--d", `${((s.x * 13.7 + s.y * 7.3) % 1).toFixed(2)}s`);
    el.append(h("i"));
    const show = () => {
      tip.textContent = "";
      tip.append(h("b", undefined, s.name), h("span", undefined, s.when));
      tip.hidden = false;
      const W = sky.clientWidth;
      const H = sky.clientHeight;
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const x = clamp(s.x * W - tw / 2, 6, W - tw - 6);
      const y = s.y * H - th - 14 < 4 ? s.y * H + 14 : s.y * H - th - 14;
      tip.style.transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`;
      emit("post:hover", { kind: "service", id: s.id, note: s.group });
    };
    el.addEventListener("pointerenter", show, { passive: true, signal });
    el.addEventListener("focus", show, { signal });
    el.addEventListener("click", show, { signal });
    el.addEventListener("pointerleave", () => (tip.hidden = true), { passive: true, signal });
    el.addEventListener("blur", () => (tip.hidden = true), { signal });
    sky.append(el);
    return { s, el, state: "", fired: false };
  });
  sky.append(tip);
  root.append(sky);

  // ---- The day --------------------------------------------------------------
  const scrub = h("div", "pfx-day-scrub");
  const play = h("button", "pfx-day-play");
  play.type = "button";
  play.setAttribute("aria-label", "Play the day");
  const playIcon = (on: boolean) => {
    play.innerHTML = on
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.500z"/></svg>';
    play.setAttribute("aria-label", on ? "Pause the day" : "Play the day");
  };
  playIcon(false);
  const track = h("div", "pfx-day-track");
  track.setAttribute("role", "slider");
  track.tabIndex = 0;
  track.setAttribute("aria-label", "Time of day");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "1439");
  const ticks = h("div", "pfx-day-ticks");
  const fill = h("div", "pfx-day-fill");
  const handle = h("div", "pfx-day-handle");
  track.append(fill, ticks, handle);
  const hours = h("div", "pfx-day-hours");
  [
    [0, "Midnight"],
    [6, "6 AM"],
    [12, "Noon"],
    [18, "6 PM"],
  ].forEach(([v, name]) => {
    const t = h("span", "pfx-day-hour", String(name));
    t.style.left = `${((v as number) / 24) * 100}%`;
    hours.append(t);
  });
  const trackWrap = h("div", "pfx-day-trackwrap");
  trackWrap.append(track, hours);
  scrub.append(play, trackWrap);
  root.append(scrub);

  const read = h("div", "pfx-day-read");
  const nowCard = h("div", "pfx-read-c pfx-day-now");
  const nowT = h("div", "pfx-read-v");
  const nowK = h("div", "pfx-read-k");
  nowCard.append(nowT, nowK);
  const fireCard = h("div", "pfx-read-c pfx-day-fire");
  fireCard.setAttribute("aria-live", "polite");
  read.append(nowCard, fireCard);
  root.append(read);

  // ---- Reading the schedule -----------------------------------------------------
  const applies = (s: Svc) => !s.day || s.day === day;
  const firedAt = (s: Svc, t: number) => {
    if (!s.at || !applies(s)) return false;
    return s.at.some((a) => t >= a && t < a + WINDOW);
  };
  const running = (s: Svc, t: number) => {
    if (s.every) {
      if (s.window && (t < s.window[0] || t > s.window[1])) return false;
      return true;
    }
    return false;
  };
  const stateOf = (s: Svc, t: number) => {
    if (firedAt(s, t)) return "fire";
    if (s.soft && t >= s.soft[0] && t <= s.soft[1]) return "soft";
    if (running(s, t)) return `run-${s.every}`;
    if (s.warm) return "warm";
    return "";
  };
  const eventTimes = () => {
    const set = new Set<number>();
    SERVICES.forEach((s) => {
      if (s.at && applies(s)) s.at.forEach((a) => set.add(a));
    });
    return [...set].sort((a, b) => a - b);
  };
  let times: number[] = [];
  function buildTicks() {
    times = eventTimes();
    ticks.textContent = "";
    times.forEach((a) => {
      const k = h("i", "pfx-day-tick");
      k.style.left = `${(a / 1440) * 100}%`;
      ticks.append(k);
    });
  }

  let t = m(5, 40);
  let lastFired = "";
  function refresh(force = false) {
    const pct = (t / 1440) * 100;
    handle.style.left = `${pct}%`;
    fill.style.width = `${pct}%`;
    track.setAttribute("aria-valuenow", String(Math.round(t)));
    track.setAttribute("aria-valuetext", `${clock(t)}, ${dayName[day]}`);
    let awake = 0;
    const firing: Svc[] = [];
    for (const st of stars) {
      const next = stateOf(st.s, t);
      if (next) awake++;
      if (next === "fire") firing.push(st.s);
      if (next !== st.state || force) {
        if (next === "fire" && st.state !== "fire" && !force) fig("day-sky", `fire:${st.s.id}`);
        st.state = next;
        st.el.dataset.state = next;
      }
    }
    nowT.textContent = clock(t);
    nowK.textContent = `${awake} of 45 awake`;
    const key = firing.map((f) => f.id).join("|");
    if (key !== lastFired || force) {
      lastFired = key;
      fireCard.textContent = "";
      if (!firing.length) {
        fireCard.append(h("div", "pfx-read-k", "Nothing scheduled at this minute. The rest wait for a person or an event."));
      } else {
        const pulls = firing.filter((f) => f.id.startsWith("pull-"));
        const others = firing.filter((f) => !f.id.startsWith("pull-"));
        const names = [...(pulls.length ? ["Nine source pulls"] : []), ...others.map((o) => o.name)];
        const row = h("div", "pfx-day-chips");
        names.forEach((n) => row.append(h("span", "pfx-day-chip", n)));
        fireCard.append(row);
      }
    }
  }

  // ---- Dragging, keys, play -----------------------------------------------------
  const fromX = (x: number) => {
    const r = track.getBoundingClientRect();
    const v = clamp((x - r.left) / r.width) * 1439;
    const pxPerMin = r.width / 1440;
    // The nearest job within reach, so a job's minute is easy to land on.
    let best = v;
    let bestD = 7;
    for (const a of times) {
      const d = Math.abs(a - v) * pxPerMin;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  };
  let dragging = false;
  let playing = false;
  const setPlaying = (on: boolean, user = true) => {
    if (on === playing) return;
    playing = on;
    playIcon(on);
    root.classList.toggle("is-playing", on);
    if (user) fig("day-sky", on ? "play" : "pause");
  };
  track.addEventListener(
    "pointerdown",
    (e) => {
      dragging = true;
      setPlaying(false, false);
      autoplay = false;
      track.setPointerCapture(e.pointerId);
      t = fromX(e.clientX);
      refresh();
      e.preventDefault();
    },
    { signal },
  );
  track.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return;
      t = fromX(e.clientX);
      refresh();
    },
    { signal },
  );
  const end = () => (dragging = false);
  track.addEventListener("pointerup", end, { signal });
  track.addEventListener("pointercancel", end, { signal });
  track.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        const next = times.find((a) => a > t);
        t = next ?? times[0];
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        const prev = [...times].reverse().find((a) => a < t);
        t = prev ?? times[times.length - 1];
      } else if (e.key === "Home") {
        t = 0;
      } else if (e.key === "End") {
        t = 1439;
      } else if (e.key === " ") {
        setPlaying(!playing);
      } else return;
      autoplay = false;
      e.preventDefault();
      refresh();
    },
    { signal },
  );
  play.addEventListener(
    "click",
    () => {
      autoplay = false;
      setPlaying(!playing);
    },
    { signal },
  );

  // ---- Backdrop, drawn once a size ------------------------------------------------
  let sizeKey = "";
  const paintBg = () => {
    const W = sky.clientWidth;
    const H = sky.clientHeight;
    const key = `${W}x${H}`;
    if (key === sizeKey) return;
    sizeKey = key;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    bg.width = Math.round(W * dpr);
    bg.height = Math.round(H * dpr);
    const c = bg.getContext("2d");
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    let seed = 19;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < 14; i++) {
      const x = W * (0.1 + rnd() * 0.8);
      const y = H * (0.15 + rnd() * 0.7);
      const r = H * (0.14 + rnd() * 0.22);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(91,141,239,0.055)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < Math.round((W * H) / 1800); i++) {
      c.fillStyle = `rgba(225,232,255,${(0.08 + rnd() * 0.3).toFixed(3)})`;
      const s = rnd() < 0.9 ? 0.7 : 1.2;
      c.fillRect(rnd() * W, rnd() * H, s, s);
    }
  };
  const ro = new ResizeObserver(paintBg);
  ro.observe(sky);
  paintBg();

  buildTicks();
  refresh(true);
  void isPhone;

  // ---- Frames: the day runs; the mornings run slower so they can be seen ----------
  let autoplay = !still;
  let autoEnd = m(6, 52);
  let last = performance.now();
  if (!still) {
    whileVisible(
      sky,
      (now) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (autoplay && !playing && !dragging) setPlaying(true, false);
        if (!playing || dragging) return;
        const busy = t > m(5, 50) && t < m(8, 10);
        t += dt * (busy ? 9 : 80);
        if (autoplay && t >= autoEnd) {
          autoplay = false;
          setPlaying(false, false);
        }
        if (t >= 1440) t = 0;
        refresh();
      },
      signal,
    );
  }
  void autoEnd;
  autoEnd = m(6, 52);

  return () => ro.disconnect();
};

export default render;
