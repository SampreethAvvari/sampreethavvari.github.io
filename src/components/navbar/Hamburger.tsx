interface HamburgerProps {
  onClick: () => void;
  isNavOpen: boolean;
}

// Inline SVGs so the dock never waits on the async FontAwesome stylesheet.
export default function Hamburger({ onClick, isNavOpen }: HamburgerProps) {
  return (
    <button
      className="gdock-iconbtn"
      onClick={onClick}
      aria-label={isNavOpen ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={isNavOpen}
    >
      {isNavOpen ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )}
    </button>
  );
}
