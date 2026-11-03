import React, { useEffect, useMemo, useState } from "react";
import {
  streamMeta,
  typeMeta,
  STREAM_ORDER,
  type Stream,
  type TeachingMaterial,
} from "../../data/teaching";
import { getStats, type Stat } from "../../lib/teachingApi";

// Styles for this island live in src/styles/teaching.css. Streams are plain
// filters and neutral badges: the only colour on the page is the Teaching tab.

type SortKey = "newest" | "views" | "downloads" | "rating";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "views", label: "Most viewed" },
  { key: "downloads", label: "Most downloaded" },
  { key: "rating", label: "Top rated" },
];

// A little over the card's width on a phone, so it takes the copy the opening
// has already loaded and not a second, smaller one.
const CARD_SIZES = "(min-width: 1024px) 720px, (min-width: 640px) 50vw, 112vw";

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function cover(c: string) {
  return {
    avif: c.replace(/\.(png|jpe?g)$/i, ".avif"),
    webp: c.replace(/\.(png|jpe?g)$/i, ".webp"),
  };
}

export default function TeachingBrowser({
  entries,
  covers = {},
}: {
  entries: TeachingMaterial[];
  // The smaller copies of each cover that exist, worked out at build time.
  covers?: Record<string, { avifSet?: string; webpSet?: string }>;
}) {
  const [stream, setStream] = useState<Stream | "all">("all");
  // Until the filter is first used the cards arrive with the scroll (data-depth).
  const [filtered, setFiltered] = useState(false);
  const pick = (s: Stream | "all") => {
    setStream(s);
    setFiltered(true);
  };
  const [sort, setSort] = useState<SortKey>("newest");
  const [stats, setStats] = useState<Record<string, Stat> | null>(null);

  useEffect(() => {
    let alive = true;
    getStats().then((s) => alive && setStats(s));
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => {
    const list = entries.filter((m) => stream === "all" || m.stream === stream);
    const stat = (slug: string) => stats?.[slug];
    const byNewest = (a: TeachingMaterial, b: TeachingMaterial) =>
      b.addedAt.localeCompare(a.addedAt);
    return [...list].sort((a, b) => {
      if (sort === "newest") return byNewest(a, b);
      const k = sort; // views | downloads | rating
      const av = sort === "rating" ? stat(a.slug)?.ratingAvg ?? 0 : (stat(a.slug) as any)?.[k] ?? 0;
      const bv = sort === "rating" ? stat(b.slug)?.ratingAvg ?? 0 : (stat(b.slug) as any)?.[k] ?? 0;
      return bv - av || byNewest(a, b);
    });
  }, [entries, stream, sort, stats]);

  const streamsWithContent = useMemo(
    () => new Set(entries.map((m) => m.stream)),
    [entries],
  );

  return (
    <div>
      <div className="tb-bar" data-depth>
        <div className="tb-filter lg" role="group" aria-label="Filter by discipline">
          <Chip active={stream === "all"} onClick={() => pick("all")}>
            All
          </Chip>
          {STREAM_ORDER.map((s) => (
            <Chip
              key={s}
              active={stream === s}
              quiet={!streamsWithContent.has(s)}
              onClick={() => pick(s)}
              title={streamMeta[s].label}
            >
              {streamMeta[s].acronym}
            </Chip>
          ))}
        </div>
        <label className="tb-sort">
          <span className="t-meta">Sort</span>
          <span className="relative inline-flex">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="tb-sort-select lg"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <svg className="tb-sort-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="tb-empty inset">
          <span className="tb-empty-dot" aria-hidden="true" />
          <p className="t-small">
            More {stream === "all" ? "" : streamMeta[stream as Stream].acronym + " "}material is on the way.
          </p>
        </div>
      ) : (
        <div className={`tb-grid${filtered ? " is-filtered" : ""}`} data-ts-cards data-n={visible.length}>
          {visible.map((m, i) => {
            const c = cover(m.cover);
            const s = stats?.[m.slug];
            const meta = streamMeta[m.stream];
            const tm = typeMeta[m.type];
            const size =
              m.type === "pdf" && m.pages
                ? `${m.pages} pages`
                : m.type === "video" && m.durationMin
                  ? `${m.durationMin} min`
                  : "";
            return (
              // Keyed by the filter too, so a change of filter brings them in again.
              <a
                key={`${stream}:${m.slug}`}
                href={`/teaching/${m.slug}`}
                className="surface tb-card"
                data-slug={m.slug}
                data-depth
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="surface-media tb-cover">
                  <picture>
                    <source srcSet={covers[m.slug]?.avifSet ?? c.avif} sizes={CARD_SIZES} type="image/avif" />
                    <source srcSet={covers[m.slug]?.webpSet ?? c.webp} sizes={CARD_SIZES} type="image/webp" />
                    <img src={c.webp} alt={m.title} width={1344} height={768} loading="lazy" decoding="async" />
                  </picture>
                </div>
                <div className="surface-pad tb-body">
                  <div className="tb-badges">
                    <span className="badge">{tm.label}</span>
                    <span className="badge" title={meta.label}>{meta.acronym}</span>
                    {size && <span className="t-meta">{size}</span>}
                  </div>
                  <h2 className="t-h3 tb-title">{m.title}</h2>
                  <p className="t-small tb-desc">{m.description}</p>
                  <div className="tb-foot">
                    <span className="t-meta">
                      {s
                        ? [
                            `${fmt(s.views)} views`,
                            `${fmt(s.downloads)} downloads`,
                            s.ratingCount > 0 ? `${s.ratingAvg.toFixed(1)} of 5` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : null}
                    </span>
                    <span className="tlink">
                      Read it
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14m0 0-6-6m6 6-6 6" />
                      </svg>
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  quiet,
  onClick,
  title,
  children,
}: {
  active: boolean;
  quiet?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`chip no-lift${active ? " is-on" : ""}${quiet ? " is-quiet" : ""}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
