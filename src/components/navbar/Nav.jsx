import { useEffect, useState } from "react";
import ToggleDarkMode from "../ToggleDarkMode";
import Search from "../search/Search";
import Hamburger from "./Hamburger";
import { info } from "../../data/info";

export default function Nav({ searchItems }) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  const navLinks = [
    { name: "Home", href: "/#home", icon: "fas fa-home", match: "home" },
    { name: "Projects", href: "/projects", icon: "fas fa-code", match: "projects" },
    { name: "Filmmaking", href: "/filmmaking", icon: "fas fa-clapperboard", match: "filmmaking" },
    { name: "Blog", href: "/posts", icon: "fas fa-pen-nib", match: "posts" },
    { name: "Contact", href: "/#contact", icon: "fas fa-envelope", match: "contact" },
  ];

  const extractInitials = (name) => {
    const names = name.split(" ");
    let initials = "";
    names.forEach((name) => {
      initials += name.charAt(0);
    });
    return initials;
  };

  const [activeMatch, setActiveMatch] = useState("home");

  useEffect(() => {
    const resolveMatch = () => {
      const path = window.location.pathname || "/";
      if (path === "/" || path === "") return "home";
      const segment = path.replace("/", "").split("/")[0];
      return segment || "home";
    };

    setActiveMatch(resolveMatch());
  }, []);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-primary/75 dark:bg-dk-primary/70 backdrop-blur-xl backdrop-saturate-150 border-b border-text/5 dark:border-dk-text/10">
        <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20 h-14 lg:h-16 flex items-center gap-4">
          {/* Brand */}
          <a className="font-semibold text-lg lg:text-xl tracking-tight text-text dark:text-dk-text shrink-0" href="/#home">
            <span className="text-secondary dark:text-dk-secondary">
              {"</" + extractInitials(info.name) + ">"}
            </span>
            <span className="hidden md:inline-block ml-2 text-text/60 dark:text-dk-text/60 font-normal">
              {info.name}
            </span>
          </a>

          {/* Desktop nav (links centered, actions right) */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <ul className="inline-flex items-center gap-1 text-sm font-medium text-text/70 dark:text-dk-text/70">
              {navLinks.map((link, index) => {
                const isActive = activeMatch === link.match;
                return (
                <li key={index}>
                  <a
                    href={link.href}
                    className={`no-lift inline-flex items-center gap-2 px-4 py-2 rounded-full transition ${
                      isActive
                        ? "text-text dark:text-dk-text bg-text/[0.06] dark:bg-dk-text/[0.08]"
                        : "hover:text-text dark:hover:text-dk-text hover:bg-text/[0.04] dark:hover:bg-dk-text/[0.05]"
                    }`}
                    aria-label={link.name}
                    title={link.name}
                  >
                    <i className={`${link.icon} text-base`} aria-hidden="true"></i>
                    <span>{link.name}</span>
                  </a>
                </li>
              )})}
            </ul>
          </div>

          {/* Right-side actions */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <Search items={searchItems} />
            <ToggleDarkMode />
            <a
              href={info.cv}
              download
              className="no-lift ml-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-text text-primary dark:bg-dk-text dark:text-dk-primary text-sm font-semibold hover:opacity-85 transition"
            >
              <i className="fas fa-download text-xs" aria-hidden="true"></i>
              Resume
            </a>
          </div>

          {/* Mobile right cluster */}
          <div className="flex lg:hidden ml-auto items-center gap-2">
            <a
              href={info.cv}
              download
              className="no-lift inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-text text-primary dark:bg-dk-text dark:text-dk-primary text-xs font-semibold"
            >
              <i className="fas fa-download text-[0.65rem]" aria-hidden="true"></i>
              Resume
            </a>
            <ToggleDarkMode />
            <Search items={searchItems} />
            <Hamburger
              onClick={() => setIsNavOpen(!isNavOpen)}
              isNavOpen={isNavOpen}
            />
          </div>
        </div>
        {/* Mobile nav sheet — Apple-style full-width panel */}
        {isNavOpen && (
          <div className="lg:hidden bg-primary/95 dark:bg-dk-primary/95 backdrop-blur-xl border-b border-text/10 dark:border-dk-text/15 shadow-lg">
            <ul className="w-full divide-y divide-text/5 dark:divide-dk-text/10 px-4 sm:px-6">
              {navLinks.map((link, index) => {
                const isActive = activeMatch === link.match;
                return (
                  <li key={index}>
                    <a
                      href={link.href}
                      onClick={() => setIsNavOpen(false)}
                      aria-label={link.name}
                      title={link.name}
                      className={`flex items-center gap-3 w-full py-3.5 text-base font-semibold transition-colors ${
                        isActive
                          ? "text-secondary dark:text-dk-secondary bg-text/[0.06] dark:bg-dk-text/[0.08] -mx-4 sm:-mx-6 px-4 sm:px-6"
                          : "text-text/60 dark:text-dk-text/60 hover:text-text dark:hover:text-dk-text"
                      }`}
                    >
                      <i className={`${link.icon} w-5 text-center shrink-0`} aria-hidden="true"></i>
                      <span>{link.name}</span>
                    </a>
                  </li>
                );
              })}
              <li className="py-3.5 flex flex-row items-center gap-4 border-t border-text/10 dark:border-dk-text/15">
                <ToggleDarkMode />
                <Search items={searchItems} />
              </li>
            </ul>
          </div>
        )}
      </nav>
      {isNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsNavOpen(false)}
        ></div>
      )}
    </>
  );
}
