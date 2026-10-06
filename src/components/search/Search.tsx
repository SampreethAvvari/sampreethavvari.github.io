import { lazy, Suspense, useState } from "react";

// The search button ships with the nav; the dialog, its index and the dialog
// library load the first time it is opened (or hovered, so it is ready).
const loadModal = () => import("./SearchModal");
const SearchModal = lazy(loadModal);

export default function Search({ items }: any) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const show = () => {
    setMounted(true);
    setOpen(true);
  };

  return (
    <div className="self-center">
      <button
        className="nav-icon"
        onClick={show}
        onPointerEnter={loadModal}
        onFocus={loadModal}
        aria-label="Search"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
      {mounted && (
        <Suspense fallback={null}>
          <SearchModal items={items} open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
