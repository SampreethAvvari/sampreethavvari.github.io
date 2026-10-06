import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getStat,
  postView,
  postDownload,
  postReview,
  type Stat,
} from "../../lib/teachingApi";

// Styles for this island live in src/pages/teaching/[slug].astro. The review
// gate is a modal, so it is glass (navigation layer) and is portalled to
// <body> so no stacking context on the page can sit above it.

export default function MaterialActions({
  slug,
  file,
  title,
}: {
  slug: string;
  file?: string;
  title: string;
}) {
  const [stat, setStat] = useState<Stat | null>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const reviewed = useRef(false);

  useEffect(() => {
    reviewed.current =
      typeof localStorage !== "undefined" && localStorage.getItem("tr:" + slug) === "1";
    getStat(slug).then((s) => s && setStat(s));
    try {
      if (sessionStorage.getItem("tv:" + slug) !== "1") {
        sessionStorage.setItem("tv:" + slug, "1");
        postView(slug).then((s) => s && setStat((p) => ({ ...(p ?? blank()), ...s })));
      }
    } catch {
      /* storage blocked, still fine */
    }
  }, [slug]);

  function triggerDownload() {
    if (!file) return;
    const a = document.createElement("a");
    a.href = file;
    a.download = file.split("/").pop() || `${slug}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function onDownloadClick() {
    if (!file) return;
    if (reviewed.current) {
      postDownload(slug).then((s) => s && setStat((p) => ({ ...(p ?? blank()), ...s })));
      triggerDownload();
      return;
    }
    setOpen(true);
  }

  async function submitReview() {
    if (rating < 1 || !feedback.trim() || busy) return;
    setBusy(true);
    const res = await postReview(slug, rating, feedback.trim());
    try {
      localStorage.setItem("tr:" + slug, "1");
    } catch {}
    reviewed.current = true;
    if (res) setStat((p) => ({ ...(p ?? blank()), downloads: res.downloads, ratingAvg: res.ratingAvg, ratingCount: res.ratingCount }));
    setBusy(false);
    setOpen(false);
    triggerDownload();
  }

  const statLine = stat
    ? [
        `${stat.views} views`,
        `${stat.downloads} downloads`,
        stat.ratingCount > 0
          ? `${stat.ratingAvg.toFixed(1)} of 5 from ${stat.ratingCount} rating${stat.ratingCount === 1 ? "" : "s"}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const modal = open ? (
    <div className="tm-modal" role="dialog" aria-modal="true" aria-labelledby="tm-modal-title">
      <div className="tm-modal-backdrop" onClick={() => !busy && setOpen(false)} />
      <div className="tm-modal-card lg lg-thick">
        <button type="button" className="tm-modal-x no-lift" aria-label="Close" onClick={() => !busy && setOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="t-meta">One quick thing</p>
        <h2 id="tm-modal-title" className="t-h3 tm-modal-title">Rate “{title}” to download</h2>
        <p className="t-small tm-modal-sub">
          Your feedback comes straight to me and shapes what I write next. It stays private and never appears on the site.
        </p>

        <div className="tm-stars" role="radiogroup" aria-label="Rating out of 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`tm-star no-lift${(hover || rating) >= n ? " is-on" : ""}`}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z" />
              </svg>
            </button>
          ))}
        </div>

        <textarea
          className="tm-textarea"
          placeholder="What was useful? What would you want next? (required)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
        />

        <button
          type="button"
          className="btn btn-primary tm-submit"
          disabled={rating < 1 || !feedback.trim() || busy}
          onClick={submitReview}
        >
          {busy ? "Sending…" : "Submit and download"}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="tm-actions">
      {file && (
        <div className="tm-actions-btns">
          <button type="button" className="btn btn-primary" onClick={onDownloadClick}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3m0 12-4-4m4 4 4-4M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
            </svg>
            Download PDF
          </button>
          <a className="btn btn-glass" href={file} target="_blank" rel="noopener">
            Open in a new tab
            <svg className="arrow-ur" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7m0 0H8m9 0v9" />
            </svg>
          </a>
        </div>
      )}

      {statLine && <p className="t-meta tm-stats">{statLine}</p>}

      {modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </div>
  );
}

function blank(): Stat {
  return { views: 0, downloads: 0, ratingAvg: 0, ratingCount: 0 };
}
