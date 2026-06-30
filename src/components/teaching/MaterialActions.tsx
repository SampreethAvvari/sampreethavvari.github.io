import React, { useEffect, useRef, useState } from "react";
import {
  getStat,
  postView,
  postDownload,
  postReview,
  type Stat,
} from "../../lib/teachingApi";

const fmt = (n: number | undefined) => (n == null ? "—" : String(n));

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
      /* storage blocked — still fine */
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

  return (
    <div className="teach-actions">
      <div className="teach-actions-stats">
        <span title="Views"><i className="fas fa-eye" /> {fmt(stat?.views)} views</span>
        <span title="Downloads"><i className="fas fa-download" /> {fmt(stat?.downloads)} downloads</span>
        {stat && stat.ratingCount > 0 && (
          <span title="Average rating"><i className="fas fa-star" /> {stat.ratingAvg.toFixed(1)} ({stat.ratingCount})</span>
        )}
      </div>

      {file && (
        <button type="button" className="teach-dl-btn no-lift" onClick={onDownloadClick}>
          <i className="fas fa-download" /> Download PDF
        </button>
      )}

      {open && (
        <div className="teach-modal" role="dialog" aria-modal="true" aria-label="Leave a quick review to download">
          <div className="teach-modal-backdrop" onClick={() => !busy && setOpen(false)} />
          <div className="teach-modal-card">
            <button type="button" className="teach-modal-x no-lift" aria-label="Close" onClick={() => !busy && setOpen(false)}>
              <i className="fas fa-xmark" />
            </button>
            <p className="teach-modal-eyebrow">One quick thing</p>
            <h3 className="teach-modal-title">Rate “{title}” to download</h3>
            <p className="teach-modal-sub">Your feedback comes straight to me and shapes what I write next. It's private — never shown on the site.</p>

            <div className="teach-stars" role="radiogroup" aria-label="Rating out of 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="teach-star no-lift"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  aria-pressed={rating === n}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                >
                  <i className="fas fa-star" style={{ color: (hover || rating) >= n ? "#f5a524" : undefined }} />
                </button>
              ))}
            </div>

            <textarea
              className="teach-textarea"
              placeholder="What was useful? What would you want next? (required)"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />

            <button
              type="button"
              className="teach-submit no-lift"
              disabled={rating < 1 || !feedback.trim() || busy}
              onClick={submitReview}
            >
              {busy ? "Sending…" : "Submit & download"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function blank(): Stat {
  return { views: 0, downloads: 0, ratingAvg: 0, ratingCount: 0 };
}
