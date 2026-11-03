// Numbers in the text brighten when the reader reaches them. Only the colour
// changes, with a short glow that fades: the characters, the lines and the
// layout stay exactly as they were. Dates and clock times stay quiet, since
// they are not what a post is claiming.

const MONTH = /(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+$/;

const UNIT =
  "percent|percentage|hours?|minutes?|seconds?|days?|weeks?|months?|years?|services?|projects?|calls?|runs?|rows?|boards?|studies|scans?|patients?|leads?|tries|times|GiB|GB|MB|KB|ms|million|billion|tokens?|pairs?|users?|ratings?|tweets?|passages?|fields?|parameters?|epochs?|documents?|emails?|checks?|failures?|words?";

// Money, percents, numbers with separators or decimals, and a plain number
// followed by what it counts.
const NUM = new RegExp(
  `\\$\\d[\\d,]*(?:\\.\\d+)?|(?<![\\w.,])\\d[\\d,]*(?:\\.\\d+)?\\s?%|(?<![\\w.,])\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?(?![\\w.])|(?<![\\w.,])\\d+\\.\\d+(?![\\w.])|(?<![\\w.,])\\d+(?=\\s(?:${UNIT})\\b)`,
  "g",
);

export function mountNumbers(signal: AbortSignal): void | (() => void) {
  const prose = document.getElementById("post-prose-body");
  if (!prose) return;

  const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || !n.nodeValue || !/\d/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
      if (p.closest("pre, code, a, h1, h2, h3, h4, .egg, .pfx-fig, script, style, kbd")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);

  const spans: HTMLElement[] = [];
  for (const node of texts) {
    const s = node.nodeValue || "";
    NUM.lastIndex = 0;
    let m: RegExpExecArray | null;
    let at = 0;
    let frag: DocumentFragment | null = null;
    while ((m = NUM.exec(s))) {
      const before = s.slice(0, m.index);
      // Not "October 28", not "6:30", not "2026".
      if (MONTH.test(before)) continue;
      if (/\d:$/.test(before) || s[m.index + m[0].length] === ":") continue;
      frag ??= document.createDocumentFragment();
      if (m.index > at) frag.append(s.slice(at, m.index));
      const span = document.createElement("span");
      span.className = "pfx-num";
      span.textContent = m[0];
      frag.append(span);
      spans.push(span);
      at = m.index + m[0].length;
    }
    if (frag) {
      if (at < s.length) frag.append(s.slice(at));
      node.replaceWith(frag);
    }
  }
  if (!spans.length) return;

  // Lit once, as it comes up to the reading line. It stays bright, so a
  // reader scrolling back sees what they have already passed.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-lit");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -30% 0px" },
  );
  spans.forEach((sp) => io.observe(sp));
  signal.addEventListener("abort", () => io.disconnect());
  return () => io.disconnect();
}
