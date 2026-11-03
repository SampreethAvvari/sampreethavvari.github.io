import { useEffect, useId, useRef, useState } from "react";
import { PLACARDS, CHAPTER_LINES, SCENE_LINES, SUITE } from "./placards";
import { movementFor } from "./ids";

// The "i" beside the sound toggle: a wall label for the music, like the card
// beside a work in a gallery. Hover or keyboard focus shows it on a desktop;
// a click or tap pins it open; Escape or a tap outside closes it. The nav
// survives page changes, so the label follows the tab (and, on the home
// flight, the chapter) through window events.
export default function SoundPlacard({ on }) {
  const [id, setId] = useState("home");
  const [chapter, setChapter] = useState(0);
  const [scene, setScene] = useState("");
  const [peek, setPeek] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrap = useRef(null);
  const btn = useRef(null);
  const card = useRef(null);
  const timer = useRef(0);
  const quiet = useRef(false); // focus coming back after Escape should not reopen it
  const uid = useId();
  const open = peek || pinned;

  useEffect(() => {
    const read = () => setId(movementFor(document.body?.dataset.tone, location.pathname));
    read();
    const onSwap = () => {
      read();
      setChapter(0);
      setScene("");
    };
    const last = CHAPTER_LINES.length - 1;
    const onChapter = (e) => {
      const i = Math.max(0, Math.min(last, Number(e.detail?.index) || 0));
      setChapter(i);
      setScene("");
    };
    const onJump = (e) => {
      const to = Number(e.detail?.to);
      if (Number.isFinite(to)) onChapter({ detail: { index: to } });
    };
    // a scene on the planet: show its moment while it plays
    const onEnding = (e) => {
      const s = e.detail?.scene;
      if (s && SCENE_LINES[s]) setScene(s);
    };
    document.addEventListener("astro:after-swap", onSwap);
    window.addEventListener("journey:chapter", onChapter);
    window.addEventListener("journey:jump", onJump);
    window.addEventListener("journey:ending", onEnding);
    return () => {
      document.removeEventListener("astro:after-swap", onSwap);
      window.removeEventListener("journey:chapter", onChapter);
      window.removeEventListener("journey:jump", onJump);
      window.removeEventListener("journey:ending", onEnding);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      clearTimeout(timer.current);
      setPeek(false);
      setPinned(false);
      quiet.current = true;
      btn.current?.focus();
    };
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) {
        setPeek(false);
        setPinned(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const fine = () => typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches;
  const show = () => {
    clearTimeout(timer.current);
    setPeek(true);
  };
  const hide = (ms) => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPeek(false), ms);
  };

  const p = PLACARDS[id] || PLACARDS.home;
  const cardId = `sound-card${uid}`;
  const titleId = `sound-card-title${uid}`;

  return (
    <div
      ref={wrap}
      className="sound-info"
      onMouseEnter={() => {
        quiet.current = false;
        if (fine()) show();
      }}
      onMouseLeave={() => fine() && hide(180)}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget)) {
          setPeek(false);
          setPinned(false);
        }
      }}
    >
      <button
        ref={btn}
        type="button"
        className={`nav-icon nav-info${open ? " is-open" : ""}`}
        aria-label="About the music on this page"
        aria-expanded={open}
        aria-controls={cardId}
        onFocus={(e) => {
          if (quiet.current) quiet.current = false;
          else if (e.currentTarget.matches(":focus-visible")) show();
        }}
        onClick={(e) => {
          const next = !pinned;
          setPinned(next);
          if (!next) setPeek(false);
          // from the keyboard, take the reader into the label
          if (next && e.detail === 0) requestAnimationFrame(() => card.current?.focus());
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.6v.01" />
        </svg>
      </button>
      <div
        ref={card}
        id={cardId}
        className="sound-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-open={open ? "true" : "false"}
      >
        <p className="sound-card-kicker">
          {SUITE} · {p.number}
        </p>
        <p className="sound-card-title" id={titleId}>
          {p.title}
        </p>
        <p className="sound-card-sub">{p.subtitle}</p>
        {id === "home" && (
          <p className="sound-card-now" aria-live="polite">
            <span>Now</span>
            {scene ? SCENE_LINES[scene] : CHAPTER_LINES[chapter]}
          </p>
        )}
        <ul className="sound-card-lines">
          {p.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="sound-card-foot">
          <span>Spatial sound · best on headphones</span>
          {!on && (
            <button type="button" className="sound-card-play" onClick={() => window.dispatchEvent(new CustomEvent("sound:set", { detail: true }))}>
              Play it
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
