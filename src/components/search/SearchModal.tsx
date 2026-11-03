import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import Modal from "react-modal";
import { navigate } from "astro:transitions/client";

// One copy of the list for the visit. A failed fetch is forgotten, so the next
// time search opens it tries again.
let index: Promise<any[]> | null = null;
const loadIndex = () =>
  (index ??= fetch("/search-index.json")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .catch(() => {
      index = null;
      return [];
    }));

// The search dialog. Loaded only the first time someone opens search, so the
// index and the dialog library stay out of every page's first load.
export default function SearchModal({ open, onClose }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(0);

  // The nav (and this dialog in it) persists across page changes, so the
  // content to hide from screen readers while the dialog is open is read
  // on every render: the <main> of the page showing now.
  const appElement = typeof document !== "undefined" ? document.querySelector("main") ?? document.body : undefined;

  useEffect(() => {
    if (!open) return;
    let live = true;
    loadIndex().then((list) => {
      if (live) setItems(list);
    });
    return () => {
      live = false;
    };
  }, [open]);

  // Build the index once per items array, not on every keystroke render.
  // Close matches only, anywhere in the text, and a hit in the title counts for more.
  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: [
          { name: "title", weight: 2 },
          { name: "description", weight: 1 },
        ],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [items],
  );

  // Worked out from what is typed, so words typed before the list arrives still
  // find their results when it does.
  const searchResults = useMemo(() => (q ? fuse.search(q) : []) as any[], [fuse, q]);

  const query = (next: string) => {
    setSelected(0);
    setQ(next);
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
        // Through the router, so the page changes without a reload and the
        // sound and the rest of the visit carry on.
        if (hit) {
          onClose();
          navigate(hit.item.url);
        }
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
      appElement={appElement}
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
