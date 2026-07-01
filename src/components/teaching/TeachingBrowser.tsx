import React, { useEffect, useMemo, useState } from "react";
import {
  streamMeta,
  typeMeta,
  STREAM_ORDER,
  type Stream,
  type TeachingMaterial,
} from "../../data/teaching";
import { getStats, type Stat } from "../../lib/teachingApi";

type SortKey = "newest" | "views" | "downloads" | "rating";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "views", label: "Most viewed" },
  { key: "downloads", label: "Most downloaded" },
  { key: "rating", label: "Top rated" },
];

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function cover(c: string) {
  return {
    avif: c.replace(/\.(png|jpe?g)$/i, ".avif"),
    webp: c.replace(/\.(png|jpe?g)$/i, ".webp"),
  };
}

export default function TeachingBrowser({
  entries,
}: {
  entries: TeachingMaterial[];
}) {
  const [stream, setStream] = useState<Stream | "all">("all");
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
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-9">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter by stream">
          <Chip active={stream === "all"} accent="#8b8b90" onClick={() => setStream("all")}>
            All
          </Chip>
          {STREAM_ORDER.map((s) => (
            <Chip
              key={s}
              active={stream === s}
              accent={streamMeta[s].accent}
              dimmed={!streamsWithContent.has(s)}
              onClick={() => setStream(s)}
              title={streamMeta[s].label}
            >
              {streamMeta[s].acronym}
            </Chip>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-text/60 dark:text-dk-text/60">
          <span className="font-medium">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border border-text/15 dark:border-dk-text/15 bg-transparent px-3 py-1.5 text-sm font-semibold text-text dark:text-dk-text focus:outline-none focus:ring-2 focus:ring-secondary/40"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key} className="bg-primary dark:bg-dk-primary">
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="teach-empty">
          <span className="teach-empty-dot" aria-hidden="true" />
          <p className="text-sm font-medium text-text/55 dark:text-dk-text/55">
            More {stream === "all" ? "" : streamMeta[stream as Stream].acronym + " "}material coming soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((m) => {
            const c = cover(m.cover);
            const s = stats?.[m.slug];
            const meta = streamMeta[m.stream];
            const tm = typeMeta[m.type];
            return (
              <a
                key={m.slug}
                href={`/teaching/${m.slug}`}
                className="teach-card group no-lift"
                style={{ ["--pa" as any]: meta.accent }}
              >
                <div className="teach-card-cover">
                  <picture>
                    <source srcSet={c.avif} type="image/avif" />
                    <source srcSet={c.webp} type="image/webp" />
                    <img src={c.webp} alt={m.title} loading="lazy" decoding="async" className="teach-card-img" />
                  </picture>
                  <span className="teach-badge">
                    <i className={tm.icon} aria-hidden="true" /> {tm.label}
                  </span>
                </div>
                <div className="teach-card-body">
                  <p className="teach-card-stream">
                    <span className="teach-dot" aria-hidden="true" /> {meta.acronym}
                  </p>
                  <h3 className="teach-card-title">{m.title}</h3>
                  <p className="teach-card-desc">{m.description}</p>
                  {s && (
                    <div className="teach-card-stats">
                      <span title="Views"><i className="fas fa-eye" /> {fmt(s.views)}</span>
                      <span title="Downloads"><i className="fas fa-download" /> {fmt(s.downloads)}</span>
                      {s.ratingCount > 0 && (
                        <span title="Average rating"><i className="fas fa-star" /> {s.ratingAvg.toFixed(1)}</span>
                      )}
                    </div>
                  )}
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
  accent,
  dimmed,
  onClick,
  title,
  children,
}: {
  active: boolean;
  accent: string;
  dimmed?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`teach-chip no-lift ${active ? "teach-chip-active" : ""} ${dimmed ? "teach-chip-dim" : ""}`}
      style={{ ["--pa" as any]: accent }}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
