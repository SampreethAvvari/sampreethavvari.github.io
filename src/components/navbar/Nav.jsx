import { useEffect, useState } from "react";
import Search from "../search/Search";
import Hamburger from "./Hamburger";
import { info } from "../../data/info";

// Small stroke icons so the dock reads visually, not just as text.
const ICONS = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10Z",
  work: "M12 3 3 8l9 5 9-5-9-5Zm-9 10 9 5 9-5",
  projects: "m8 7-5 5 5 5m8-10 5 5-5 5",
  posts: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z",
  teaching: "M22 10 12 5 2 10l10 5 10-5Zm-16 3v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4",
  filmmaking: "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  contact: "m4 7 8 6 8-6M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
};

function LinkIcon({ match }) {
  const d = ICONS[match];
  if (!d) return null;
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="gdock-link-icon"
    >
      <path d={d} />
    </svg>
  );
}

// Floating glass dock. Sits top right at the top of the page; once you
// scroll it detaches and glides to the top center as a compact dynamic
// island (labels collapse, icons stay). A separate SA glass button sits
// fixed top left as the way home.
export default function Nav({ searchItems }) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [activeMatch, setActiveMatch] = useState("home");
  const [island, setIsland] = useState(false);

  const navLinks = [
    { name: "Home", href: "/#home", match: "home" },
    { name: "Work", href: "/work", match: "work" },
    { name: "Projects", href: "/projects", match: "projects" },
    { name: "Writing", href: "/posts", match: "posts" },
    { name: "Teaching", href: "/teaching", match: "teaching" },
    { name: "Film", href: "/filmmaking", match: "filmmaking" },
    { name: "Contact", href: "/#contact", match: "contact" },
  ];

  const sheetLinks = [
    ...navLinks,
    { name: "Gallery", href: "/gallery", match: "gallery" },
    { name: "Resume", href: info.cv, match: "resume" },
  ];

  useEffect(() => {
    const path = window.location.pathname || "/";
    if (path === "/" || path === "") setActiveMatch("home");
    else setActiveMatch(path.replace("/", "").split("/")[0] || "home");
  }, []);

  useEffect(() => {
    const onScroll = () => setIsland(window.scrollY > 90);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <a className="gdock-sa" href="/#home" aria-label="Home">
        SA
      </a>

      <nav className={`gdock ${island ? "gdock-island" : ""}`} aria-label="Primary">
        <ul className="gdock-links hidden lg:flex">
          {navLinks.map((link) => (
            <li key={link.match}>
              <a
                href={link.href}
                className={`no-lift gdock-link ${activeMatch === link.match ? "gdock-link-active" : ""}`}
                title={link.name}
              >
                <LinkIcon match={link.match} />
                <span className="gdock-label">{link.name}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="gdock-actions">
          <Search items={searchItems} />
          <a href={info.cv} className="no-lift gdock-cta hidden sm:inline-flex">
            Resume
          </a>
          <span className="inline-flex lg:hidden">
            <Hamburger
              onClick={() => setIsNavOpen(!isNavOpen)}
              isNavOpen={isNavOpen}
            />
          </span>
        </div>
      </nav>

      {isNavOpen && (
        <div className="gdock-sheet lg:hidden" role="dialog" aria-label="Navigation">
          <ul>
            {sheetLinks.map((link) => (
              <li key={link.name}>
                <a
                  href={link.href}
                  onClick={() => setIsNavOpen(false)}
                  className={`gdock-sheet-link ${activeMatch === link.match ? "gdock-sheet-link-active" : ""}`}
                >
                  {link.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {isNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsNavOpen(false)}
        ></div>
      )}
    </>
  );
}
