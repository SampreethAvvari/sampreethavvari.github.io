import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import Modal from "react-modal";

// The search dialog. Loaded only the first time someone opens search, so the
// index and the dialog library stay out of every page's first load.
export default function SearchModal({ items, open, onClose }: any) {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    Modal.setAppElement("body");
  }, []);

  // Build the index once per items array, not on every keystroke render.
  const fuse = useMemo(() => new Fuse(items ?? [], { keys: ["title", "description"] }), [items]);

  const query = (q: string) => {
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSelected(0);
    setSearchResults(fuse.search(q));
  };

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => (s < searchResults.length - 1 ? s + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => (s > 0 ? s - 1 : searchResults.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const hit = searchResults[selected];
        if (hit) window.location.href = hit.item.url;
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  });

  return (
    <Modal
      isOpen={open}
      onRequestClose={onClose}
      contentLabel="Search"
      className="search-modal"
      overlayClassName="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-filter backdrop-blur-[6px] z-[90]"
    >
      <div className="relative">
        <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-dk-text/40">
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
              <a href={result.item.url} className="block px-3 py-2.5" onClick={onClose}>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium text-[0.9375rem] text-dk-text">{result.item.title}</span>
                  {result.item.type && (
                    <span className="badge shrink-0" data-tone={result.item.type === "post" ? "writing" : "home"}>
                      {result.item.type === "post" ? "Post" : "Page"}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-dk-text/55 line-clamp-1">{result.item.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
