import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Tour } from "../../data/tours/types";
import MockScreen from "./MockScreen";
import "./tours.css";

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** How long a step stays up when the tour runs by itself: long enough to read it. */
const dwellFor = (body: string) => Math.max(5000, Math.min(16000, 1200 + body.split(/\s+/).length * 310));

/**
 * The tour's console. The steps are a sequencer: a rail of numbered stops (a
 * column on wide screens, a row of numbers on phones) with a light that runs to
 * the current one. The mock screen sits in a bezel and comes up from behind, or
 * from in front when you go back. Arrow keys move between steps once the list
 * has focus, and the round button runs the tour by itself until any other
 * control is used.
 *
 * Sound hook, on window (nothing here plays audio):
 *   demos:step  { index, total }
 */
export default function TourPlayer({ tour }: { tour: Tour }) {
  const [i, setI] = useState(0);
  const [back, setBack] = useState(false);
  const [running, setRunning] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const rail = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const n = tour.steps.length;
  const step = tour.steps[i];
  const id = (part: string, j?: number) => `tp-${tour.slug}-${part}${j == null ? "" : `-${j}`}`;
  const dwell = dwellFor(step.body);
  // Held open at its tallest, so moving between steps never moves the page.
  const longest = tour.steps.reduce((a, s) => (s.body.length > a.length ? s.body : a), "");

  const show = (next: number) => {
    if (next === i) return;
    setBack(next < i);
    setI(next);
    window.dispatchEvent(new CustomEvent("demos:step", { detail: { index: next, total: n } }));
  };

  const go = (j: number, opts: { focus?: boolean; reveal?: boolean } = {}) => {
    const next = Math.max(0, Math.min(n - 1, j));
    setRunning(false);
    show(next);
    if (opts.focus) tabs.current[next]?.focus();
    // From the buttons under the screen, bring the new step's title back
    // into view if it has scrolled off the top (phones, mostly).
    if (opts.reveal && stage.current) {
      const top = stage.current.getBoundingClientRect().top;
      if (top < 80) stage.current.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowDown: i + 1,
      ArrowRight: i + 1,
      ArrowUp: i - 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: n - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    go(keys[e.key], { focus: true });
  };

  // Running by itself: on to the next step when this one has had its time, and
  // stop at the last.
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => {
      if (i >= n - 1) setRunning(false);
      else show(i + 1);
    }, dwell);
    return () => window.clearTimeout(t);
    // show() only reads what is listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, i, dwell, n]);

  const run = () => {
    if (running) {
      setRunning(false);
      return;
    }
    if (i >= n - 1) show(0);
    setRunning(true);
  };

  // The light on the rail runs to the current stop. Measured, because the open
  // step's words change how far down the next stop sits.
  useEffect(() => {
    const place = () => {
      const el = tabs.current[i]?.querySelector<HTMLElement>(".tp-num");
      const box = rail.current;
      if (!el || !box) return;
      const a = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const scale = box.offsetWidth ? b.width / box.offsetWidth : 1;
      box.style.setProperty("--cx", `${((a.left + a.width / 2 - b.left) / scale).toFixed(1)}px`);
      box.style.setProperty("--cy", `${((a.top + a.height / 2 - b.top) / scale).toFixed(1)}px`);
    };
    place();
    const box = rail.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(box);
    return () => ro.disconnect();
  }, [i]);

  return (
    <div className="tp">
      <div
        ref={rail}
        className="lg tp-steps"
        role="tablist"
        aria-label={`${tour.name} steps`}
        aria-orientation="vertical"
        onKeyDown={onKey}
      >
        <span className="tp-track" role="presentation" aria-hidden="true">
          <span className="tp-comet" />
        </span>
        <span className="tp-sizer" role="presentation" aria-hidden="true">
          {tour.steps.map((s, j) => (
            <span key={j} className="tp-sizer-title">
              {s.title}
            </span>
          ))}
          <span className="tp-sizer-body">{longest}</span>
        </span>
        <div className="tp-steps-in" role="presentation">
        {tour.steps.map((s, j) => {
          const on = i === j;
          return (
            <button
              key={j}
              ref={(el) => {
                tabs.current[j] = el;
              }}
              type="button"
              role="tab"
              id={id("tab", j)}
              aria-selected={on}
              aria-controls={id("panel")}
              aria-label={`Step ${j + 1}: ${s.title}`}
              tabIndex={on ? 0 : -1}
              className={`tp-step ${on ? "is-on" : ""} ${j < i ? "is-past" : ""}`}
              onClick={() => go(j)}
            >
              <span className="tp-num" aria-hidden="true">
                {j + 1}
              </span>
              <span className="tp-step-text">
                <span className="tp-step-title">{s.title}</span>
                {on && <span className="tp-step-body">{s.body}</span>}
              </span>
            </button>
          );
        })}
        </div>
      </div>

      <div
        className="tp-stage"
        ref={stage}
        role="tabpanel"
        id={id("panel")}
        aria-labelledby={id("tab", i)}
      >
        <div className="tp-now" aria-live="polite">
          <p className="t-meta">
            Step {i + 1} of {n}
          </p>
          <h3 className="t-h3 tp-now-title">{step.title}</h3>
          <p className="t-body tp-now-body">{step.body}</p>
        </div>
        <div className="tp-bezel" data-tilt="1.4">
          <span className="tp-corner tp-corner-tl" aria-hidden="true" />
          <span className="tp-corner tp-corner-tr" aria-hidden="true" />
          <span className="tp-corner tp-corner-bl" aria-hidden="true" />
          <span className="tp-corner tp-corner-br" aria-hidden="true" />
          <div className={`tp-screen ${back ? "is-back" : ""}`} key={i}>
            <MockScreen screen={step.screen} />
            <span className="tp-scan" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="tp-controls">
        <div
          className="lg tp-progress"
          role="progressbar"
          aria-label="Tour progress"
          aria-valuemin={1}
          aria-valuemax={n}
          aria-valuenow={i + 1}
          aria-valuetext={`Step ${i + 1} of ${n}`}
        >
          {tour.steps.map((_, j) => (
            <span
              key={j}
              className={`tp-seg ${j < i ? "is-done" : ""} ${j === i ? (running ? "is-run" : "is-done") : ""}`}
              style={running && j === i ? ({ "--dwell": `${dwell}ms` } as React.CSSProperties) : undefined}
            />
          ))}
        </div>
        <div className="tp-nav">
          <button
            type="button"
            className={`tp-run ${running ? "is-on" : ""}`}
            aria-pressed={running}
            aria-label={running ? "Pause the tour" : "Run the tour by itself"}
            title={running ? "Pause the tour" : "Run the tour by itself"}
            onClick={run}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              {running ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.4-6.8a.6.6 0 0 0 0-1L8.92 4.7a.6.6 0 0 0-.92.5Z" />}
            </svg>
          </button>
          <span className="t-meta tp-count">
            Step {i + 1} of {n}
          </span>
          {/* The site's liquid glass script styles .btn-glass before this
              island hydrates, so the server and client markup differ on
              purpose here. */}
          <button
            type="button"
            className="btn btn-glass btn-sm"
            suppressHydrationWarning
            disabled={i === 0}
            onClick={() => go(i - 1, { reveal: true })}
          >
            Back
          </button>
          {i < n - 1 ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go(i + 1, { reveal: true })}>
              Next step
              <svg className="arrow-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14m0 0-6-6m6 6-6 6" />
              </svg>
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go(0, { reveal: true })}>
              Start over
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
