import { useEffect, useState } from "react";
import Search from "../search/Search";
import { info } from "../../data/info";

// One colour per tab. The dot beside each label is the legend for the whole
// site: the same colour marks that tab's page, its kicker and its links.
const TABS = [
  { name: "Projects", href: "/projects", match: "projects", tone: "projects", hint: "Things I built" },
  { name: "Work", href: "/work", match: "work", tone: "work", hint: "Four kinds of work" },
  { name: "Writing", href: "/posts", match: "posts", tone: "writing", hint: "How they were built" },
  { name: "Film", href: "/filmmaking", match: "filmmaking", tone: "film", hint: "Among Monsters and more" },
  { name: "Teaching", href: "/teaching", match: "teaching", tone: "teaching", hint: "Course materials" },
  { name: "Mind", href: "/mind", match: "mind", tone: "mind", hint: "A map of everything" },
];

// Pages that belong to a tab without being its index.
const ALIAS = { gallery: "filmmaking" };

export default function Nav({ searchItems }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const seg = (window.location.pathname || "/").split("/").filter(Boolean)[0] || "";
    setActive(ALIAS[seg] || seg);
  }, []);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const here = TABS.find((t) => t.match === active);

  return (
    <>
      {open && <div className="nav-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <header className={`nav ${condensed ? "nav-condensed" : ""}`}>
        <div className="wrap">
          <div className="nav-bar">
            <div className="nav-glass lg" aria-hidden="true" />

            <a className="nav-brand" href="/" aria-label="Sampreeth Avvari, home">
              <span className="nav-mono">SA</span>
              <span className="nav-name">Sampreeth Avvari</span>
            </a>

            {here && (
              <span className="nav-here" data-tone={here.tone}>
                <i className="nav-dot" aria-hidden="true" />
                {here.name}
              </span>
            )}

            <nav className="nav-tabs" aria-label="Primary">
              {TABS.map((t) => (
                <a
                  key={t.match}
                  href={t.href}
                  data-tone={t.tone}
                  className={`nav-tab ${active === t.match ? "is-active lg-pill" : ""}`}
                  aria-current={active === t.match ? "page" : undefined}
                >
                  <i className="nav-dot" aria-hidden="true" />
                  {t.name}
                </a>
              ))}
            </nav>

            <div className="nav-actions">
              <Search items={searchItems} />
              <a href={info.cv} className="btn btn-primary btn-sm nav-resume">
                Resume
              </a>
              <button
                type="button"
                className="nav-icon nav-menu-btn"
                onClick={() => setOpen(!open)}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 8h16M4 16h16" />}
                </svg>
              </button>
            </div>
          </div>

          {open && (
            <div className="nav-sheet lg lg-thick" role="dialog" aria-label="Menu">
              <a href="/" className={active === "" ? "is-active" : ""}>
                Home
              </a>
              {TABS.map((t) => (
                <a
                  key={t.match}
                  href={t.href}
                  data-tone={t.tone}
                  className={active === t.match ? "is-active" : ""}
                >
                  <i className="nav-dot" aria-hidden="true" />
                  {t.name}
                  <span className="t-meta">{t.hint}</span>
                </a>
              ))}
              <hr />
              <a href="/gallery">Gallery</a>
              <a href="/#contact">Contact</a>
              <a href={info.cv}>Resume</a>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
