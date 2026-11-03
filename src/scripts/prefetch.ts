// Fetch the next page a moment before it is asked for, so moving between tabs
// feels instant. Written here instead of the router's prefetch because that one
// takes every link it sees, so resting on a PDF link pulled in the whole PDF.
//
// Only pages, and only where a pointer can rest on a link. A touch screen gets
// nothing ahead of the tap: a finger scrolling a list lands on links it never
// meant, and on a phone those bytes are the visitor's. Save-Data and 2g turn it
// off altogether.
//
// Run once a visit, on the document, so it also sees links that islands add.

const FILE = /\.(pdf|png|jpe?g|webp|avif|gif|svg|xml|txt|zip|json|mp3|mp4|webm)$/i;
const REST_MS = 90; // long enough that a pointer passing over a list does nothing

type Connection = { saveData?: boolean; effectiveType?: string };

const asked = new Set<string>();

function careful(): boolean {
  const c = (navigator as Navigator & { connection?: Connection }).connection;
  return !navigator.onLine || !!c?.saveData || /2g/.test(c?.effectiveType ?? "");
}

/** The address of the page behind a link, or null when it should not be fetched. */
function pageOf(target: EventTarget | null): string | null {
  const a = (target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || !a.href || a.hasAttribute("download") || a.dataset.astroReload !== undefined) return null;
  if (a.target && a.target !== "_self") return null;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || FILE.test(u.pathname)) return null;
  if (u.pathname.replace(/\/$/, "") === location.pathname.replace(/\/$/, "") && u.search === location.search) return null;
  return withSlash(u.pathname) + u.search;
}

/** Pages live at /name/. Asking for that directly saves the host's redirect. */
export function withSlash(path: string): string {
  return path.endsWith("/") || /\.[a-z0-9]+$/i.test(path) ? path : `${path}/`;
}

function fetchPage(url: string) {
  if (asked.has(url) || careful()) return;
  asked.add(url);
  fetch(url, { priority: "low" } as RequestInit)
    .then((res) => res.text())
    .catch(() => asked.delete(url));
}

let armed = false;
let waiting = 0;

export function mountPrefetch() {
  if (armed) return;
  armed = true;

  // Moving through the router: the same saved redirect as above.
  document.addEventListener("astro:before-preparation", (e) => {
    const ev = e as Event & { to: URL };
    const path = withSlash(ev.to.pathname);
    if (path !== ev.to.pathname) ev.to = new URL(path + ev.to.search + ev.to.hash, ev.to);
  });

  if (!matchMedia("(hover: hover)").matches) return;
  const onRest = (e: Event) => {
    clearTimeout(waiting);
    const url = pageOf(e.target);
    if (url) waiting = window.setTimeout(() => fetchPage(url), REST_MS);
  };
  const onLeave = () => clearTimeout(waiting);
  document.addEventListener("mouseover", onRest, { passive: true });
  document.addEventListener("mouseout", onLeave, { passive: true });
  document.addEventListener("focusin", onRest, { passive: true });
  document.addEventListener("focusout", onLeave, { passive: true });
}
