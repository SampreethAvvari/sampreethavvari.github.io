import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Tour } from "../../data/tours/types";
import MockScreen from "./MockScreen";
import "./tours.css";

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Guided step through. The step list is a glass segmented control (a column
 * on wide screens, a row of numbers on phones); the mock screen is solid.
 * Arrow keys move between steps once the list has focus.
 */
export default function TourPlayer({ tour }: { tour: Tour }) {
  const [i, setI] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = useRef<HTMLDivElement | null>(null);
  const n = tour.steps.length;
  const step = tour.steps[i];
  const id = (part: string, j?: number) => `tp-${tour.slug}-${part}${j == null ? "" : `-${j}`}`;

  const go = (j: number, opts: { focus?: boolean; reveal?: boolean } = {}) => {
    const next = Math.max(0, Math.min(n - 1, j));
    setI(next);
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

  return (
    <div className="tp">
      <div
        className="lg tp-steps"
        role="tablist"
        aria-label={`${tour.name} steps`}
        aria-orientation="vertical"
        onKeyDown={onKey}
      >
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
              className={`tp-step ${on ? "is-on" : ""}`}
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
        <div className="tp-screen" key={i}>
          <MockScreen screen={step.screen} />
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
            <span key={j} className={`tp-seg ${j <= i ? "is-done" : ""}`} />
          ))}
        </div>
        <div className="tp-nav">
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
