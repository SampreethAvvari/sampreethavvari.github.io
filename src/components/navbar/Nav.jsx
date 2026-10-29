import { useEffect, useState } from "react";
import Search from "../search/Search";

// One colour per tab. The coloured icon beside each label is the legend for
// the whole site: the same colour marks that tab's page, its kicker and links.
const TABS = [
  { name: "Projects", href: "/projects", match: "projects", tone: "projects", hint: "Things I built" },
  { name: "Architecture", href: "/architecture", match: "architecture", tone: "architecture", hint: "How each system is built" },
  { name: "Work", href: "/work", match: "work", tone: "work", hint: "Four kinds of work" },
  { name: "Film", href: "/filmmaking", match: "filmmaking", tone: "film", hint: "Among Monsters and more" },
  { name: "Writing", href: "/posts", match: "posts", tone: "writing", hint: "How they were built" },
  { name: "Mind", href: "/mind", match: "mind", tone: "mind", hint: "A map of everything" },
];

// One line icon per tab, drawn in the tab's colour. On scroll the bar becomes
// a small island of just these icons.
const ICONS = {
  projects: "m8 7-5 5 5 5m8-10 5 5-5 5",
  work: "M12 3 3 8l9 5 9-5-9-5Zm-9 10 9 5 9-5",
  filmmaking: "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  posts: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z",
  architecture: "M3 4h6v5H3zM15 4h6v5h-6zM9 15h6v5H9zM6 9v3h12V9M12 12v3",
  mind: "M12 5a1.6 1.6 0 1 0 .01 0M5 17a1.6 1.6 0 1 0 .01 0M19 17a1.6 1.6 0 1 0 .01 0M11 6.4 6.4 15M13 6.4 17.6 15M6.8 16.4h10.4",
  resume: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h4",
};

function TabIcon({ name }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg className="nav-icon-glyph" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Pages that belong to a tab without being its index.
const ALIAS = { gallery: "filmmaking", demos: "projects", teaching: "posts" };

// The resume link comes in as a prop: importing the whole site data file here
// would ship all of it to the browser with the nav.
export default function Nav({ searchItems, cv = "/resume" }) {
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


  return (
    <>
      {open && <div className="nav-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <header className={`nav ${condensed ? "nav-condensed" : ""}`}>
        <div className="wrap">
          <div className="nav-bar">
            <div className="nav-glass lg" aria-hidden="true" suppressHydrationWarning />

            <a className="nav-brand" href="/" aria-label="Sampreeth Avvari, home">
              <img
                className="nav-mark"
                src="/logo-sa.webp"
                alt=""
                width="168"
                height="132"
                decoding="async"
                fetchpriority="high"
              />
              <span className="nav-name">Sampreeth Avvari</span>
            </a>



            <nav className="nav-tabs" aria-label="Primary">
              {TABS.map((t) => (
                <a
                  key={t.match}
                  href={t.href}
                  data-tone={t.tone}
                  className={`nav-tab ${active === t.match ? "is-active lg-pill" : ""}`}
                  aria-current={active === t.match ? "page" : undefined}
                  title={t.name}
                  data-astro-prefetch="viewport"
                >
                  <TabIcon name={t.match} />
                  <span className="nav-label">{t.name}</span>
                </a>
              ))}
            </nav>

            <div className="nav-actions">
              <Search items={searchItems} />
              <a href={cv} className="btn btn-primary btn-sm nav-resume" title="Resume">
                <TabIcon name="resume" />
                <span className="nav-label">Resume</span>
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
                  <TabIcon name={t.match} />
                  {t.name}
                  <span className="t-meta">{t.hint}</span>
                </a>
              ))}
              <hr />
              <a href="/demos">Live demos</a>
              <a href="/gallery">Gallery</a>
              <a href="/#contact">Contact</a>
              <a href={cv}>Resume</a>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
