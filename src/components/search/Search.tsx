import Fuse from "fuse.js";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "react-modal";

export default function Search({ items }: any) {
  const [search, setSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    Modal.setAppElement("body");
  }, []);

  // Build the index once per items array, not on every keystroke render.
  const fuse = useMemo(
    () =>
      new Fuse(items ?? [], {
        keys: ["title", "description"],
      }),
    [items],
  );

  const query = (query: string) => {
    if (!query || query === "") {
      setSearchResults([]);
      return;
    }
    setSelected(0);
    setSearchResults(fuse.search(query));
  };

  // handle keyboard navigation
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (!search) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setSearch(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (selected < searchResults.length - 1) {
          setSelected(selected + 1);
        } else {
          setSelected(0);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selected > 0) {
          setSelected(selected - 1);
        } else {
          setSelected(searchResults.length - 1);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (searchResults[selected]) {
          window.location = searchResults[selected].item.url;
        }
      }
    };

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  });

  return (
    <div className="self-center">
      <button
        className="gdock-iconbtn"
        onClick={() => setSearch(true)}
        aria-label="Search"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>

      <Modal
        isOpen={search}
        onRequestClose={() => setSearch(false)}
        contentLabel="Search"
        className="search-modal"
        overlayClassName="fixed top-0 left-0 right-0 bottom-0 bg-black/30 backdrop-filter backdrop-blur-sm z-[90]"
      >
        <div className="relative">
          <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-text/40 dark:text-dk-text/40">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            type="search"
            id="default-search"
            className="search-input"
            placeholder="Search pages and posts"
            autoFocus
            aria-label="Input search query"
            onChange={(e) => query(e.target.value)}
          />
        </div>
        <div className="mt-3 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            {searchResults.map((result: any, index: number) => (
              <li
                key={`${result.item.title}-${result.item.url}`}
                className={`search-row ${selected === index ? "search-row-active" : ""}`}
                onMouseEnter={() => setSelected(index)}
              >
                <a
                  href={result.item.url}
                  className="block px-3 py-2.5"
                  onClick={() => setSearch(false)}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-text dark:text-dk-text">
                      {result.item.title}
                    </span>
                    {result.item.type && (
                      <span className="text-[0.6rem] uppercase tracking-[0.16em] text-secondary/70 dark:text-dk-secondary/70 shrink-0">
                        {result.item.type}
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-text/55 dark:text-dk-text/55 line-clamp-1">
                    {result.item.description}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
}
