// Links to other posts and drawings show a small card on hover or keyboard
// focus: the art, the title and one line, from data the page already has. A
// tap on a touch screen just follows the link.
//
// Sound hook: post:hover { kind: "link", id, note }

import { emit, h, isTouch, noteOf } from "./util";

type LinkData = { t: string; d: string; img?: string; k?: string };

export function mountLinkCards(signal: AbortSignal): void | (() => void) {
  const prose = document.getElementById("post-prose-body");
  const raw = document.getElementById("pfx-data")?.textContent;
  if (!prose || !raw || isTouch()) return;
  let data: Record<string, LinkData>;
  try {
    data = JSON.parse(raw).links || {};
  } catch {
    return;
  }

  const card = h("div", "pfx-link");
  card.setAttribute("aria-hidden", "true");
  const media = h("div", "pfx-link-art");
  const pic = h("picture");
  const src = h("source");
  src.type = "image/avif";
  const img = h("img");
  img.alt = "";
  img.decoding = "async";
  pic.append(src, img);
  media.append(pic);
  const kind = h("p", "pfx-link-kind");
  const title = h("p", "pfx-link-title");
  const line = h("p", "pfx-link-line");
  const body = h("div", "pfx-link-body");
  body.append(kind, title, line);
  card.append(media, body);
  document.body.append(card);

  let showT = 0;
  let hideT = 0;
  let current: HTMLAnchorElement | null = null;

  // The small pictures are fetched when the browser is idle, so a card never
  // opens on an empty frame.
  const warm = () => {
    if (signal.aborted) return;
    Object.values(data).forEach((d) => {
      if (d.img) new Image().src = `${d.img.replace(/\.(png|jpe?g|webp|avif)$/i, "")}.avif`;
    });
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 2500 });
  else window.setTimeout(warm, 800);

  const keyOf = (a: HTMLAnchorElement) => {
    const p = a.getAttribute("href") || "";
    return p.replace(/#.*$/, "").replace(/\/$/, "");
  };

  const place = (a: HTMLAnchorElement, x: number | null) => {
    const rects = Array.from(a.getClientRects());
    const r = (x !== null && rects.find((c) => x >= c.left - 2 && x <= c.right + 2)) || rects[0] || a.getBoundingClientRect();
    const w = card.offsetWidth;
    const ch = card.offsetHeight;
    const left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    const above = r.top - ch - 12 > 64;
    const top = above ? r.top - ch - 12 : r.bottom + 12;
    card.style.transform = `translate3d(${left.toFixed(0)}px, ${top.toFixed(0)}px, 0)`;
    card.dataset.side = above ? "above" : "below";
  };

  const show = (a: HTMLAnchorElement, x: number | null) => {
    const key = keyOf(a);
    const d = data[key];
    if (!d) return;
    clearTimeout(hideT);
    clearTimeout(showT);
    showT = window.setTimeout(() => {
      current = a;
      title.textContent = d.t;
      line.textContent = d.d;
      kind.textContent = d.k || "";
      if (d.img) {
        const base = d.img.replace(/\.(png|jpe?g|webp|avif)$/i, "");
        src.srcset = `${base}.avif`;
        img.src = `${base}.webp`;
        media.hidden = false;
      } else {
        media.hidden = true;
      }
      place(a, x);
      card.classList.add("is-on");
      emit("post:hover", { kind: "link", id: key, note: noteOf(key) });
    }, 110);
  };
  const hide = () => {
    clearTimeout(showT);
    clearTimeout(hideT);
    hideT = window.setTimeout(() => {
      current = null;
      card.classList.remove("is-on");
    }, 90);
  };

  prose.addEventListener(
    "pointerover",
    (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='/']");
      if (!a || a === current) return;
      show(a, (e as PointerEvent).clientX);
    },
    { passive: true, signal },
  );
  prose.addEventListener(
    "pointerout",
    (e) => {
      const a = (e.target as HTMLElement).closest("a");
      if (a && !a.contains(e.relatedTarget as Node)) hide();
    },
    { passive: true, signal },
  );
  prose.addEventListener(
    "focusin",
    (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='/']");
      if (a?.matches(":focus-visible")) show(a, null);
    },
    { signal },
  );
  prose.addEventListener("focusout", hide, { signal });
  addEventListener("scroll", () => current && hide(), { passive: true, signal });

  return () => {
    clearTimeout(showT);
    clearTimeout(hideT);
    card.remove();
  };
}
