import { useEffect, useState } from "react";
import ToggleDarkMode from "../ToggleDarkMode";
import Search from "../search/Search";
import Hamburger from "./Hamburger";
import { info } from "../../data/info";

export default function Nav({ searchItems }) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  const navLinks = [
    { name: "Home", href: "/#home", icon: "fas fa-home" },
    { name: "About", href: "/#about", icon: "fas fa-user" },
    { name: "Projects", href: "/projects", icon: "fas fa-code" },
    { name: "Filmmaking", href: "/filmmaking", icon: "fas fa-clapperboard" },
    { name: "Blog", href: "/posts", icon: "fas fa-pen-nib" },
    { name: "Contact", href: "/#contact", icon: "fas fa-envelope" },
  ];

  const extractInitials = (name) => {
    const names = name.split(" ");
    let initials = "";
    names.forEach((name) => {
      initials += name.charAt(0);
    });
    return initials;
  };

  return (
    <>
      <nav className="container mx-auto top-0 z-50 absolute bg-primary dark:bg-dk-primary">
        <div className="w-full px-6 py-2 flex justify-between items-center">
          <a className="font-bold text-2xl lg:text-4xl" href="/#">
            <span className="text-secondary dark:text-dk-secondary">
              {"</" + extractInitials(info.name) + ">"}
            </span>
          </a>

          {/* Button for CV download */}
          <a
            href={info.cv}
            download
            className="px-4 py-2 border-2 rounded text-secondary dark:text-dk-secondary border-secondary dark:border-dk-secondary hover:bg-secondary dark:hover:bg-dk-secondary hover:text-primary dark:hover:text-primary cursor-pointer"
          >
            <i className="fas fa-download mr-2"></i>
            <span className="hidden lg:inline-block font-medium">
              Download Resume
            </span>
            <span className="lg:hidden font-medium">Resume</span>
          </a>

          <div className="inline-flex lg:hidden text-secondary dark:text-dk-secondary">
            <Hamburger
              onClick={() => setIsNavOpen(!isNavOpen)}
              isNavOpen={isNavOpen}
            />
          </div>
          <div className="hidden lg:block">
            <ul className="inline-flex text-secondary dark:text-dk-secondary text-2xl font-normal">
              {navLinks.map((link, index) => (
                <li
                  key={index}
                  className="p-4 hover:text-accent dark:hover:text-dk-accent"
                >
                  <a
                    href={link.href}
                    className="relative group inline-flex items-center justify-center"
                    aria-label={link.name}
                    title={link.name}
                  >
                    <i className={link.icon}></i>
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-secondary dark:text-dk-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                      {link.name}
                    </span>
                  </a>
                </li>
              ))}
              <li className="px-4 flex">
                <ToggleDarkMode />
              </li>
              <li className="px-4 flex">
                <Search items={searchItems} />
              </li>
            </ul>
          </div>
        </div>
        <div
          className={
            !isNavOpen
              ? "hidden"
              : "" +
                " h-full flex flex-col items-center text-center lg:hidden dark:text-tertiary"
          }
        >
          <ul className="w-full text-secondary dark:text-dk-secondary text-xl font-semibold">
            {navLinks.map((link, index) => (
              <li key={index} className="p-4">
                <a
                  href={link.href}
                  onClick={() => setIsNavOpen(false)}
                  className="relative group inline-flex items-center justify-center"
                  aria-label={link.name}
                  title={link.name}
                >
                  <i className={link.icon}></i>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-secondary dark:text-dk-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                    {link.name}
                  </span>
                </a>
              </li>
            ))}
            <li className="p-4 flex flex-row items-center justify-evenly">
              <ToggleDarkMode />
              <Search items={searchItems} />
            </li>
          </ul>
        </div>
      </nav>
      {isNavOpen && (
        <div
          className="fixed inset-0 blur-3xl bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsNavOpen(false)}
        ></div>
      )}
    </>
  );
}
