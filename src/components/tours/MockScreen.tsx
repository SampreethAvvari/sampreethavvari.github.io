import type { Screen } from "../../data/tours/types";
import "./tours.css";

type Tone = "good" | "bad" | "warn" | "dim" | undefined;

// Status inside a mock app keeps its meaning (green ok, amber check, red
// wrong). Anything without a status uses the Projects blue.
const toneClass = (t: Tone) => (t ? `ms-${t}` : "");

const screenTitle = (screen: Screen) =>
  "title" in screen ? screen.title : screen.kind === "search" ? "Search" : screen.kind === "chat" ? "Agent" : screen.kind === "upload" ? "Upload" : "Demo";

/** One mock screen state. Pure presentation; every value is synthetic. */
export default function MockScreen({ screen }: { screen: Screen }) {
  const title = screenTitle(screen);
  return (
    <figure className="surface ms" aria-label={`Mock screen: ${title}`}>
      <figcaption className="ms-chrome">
        <span className="ms-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="ms-title">{title}</span>
        <span className="badge ms-synth">Synthetic data</span>
      </figcaption>

      <div className="ms-body">
        {screen.kind === "table" && (
          <div className="ms-scroll">
            <table className="ms-table">
              <thead>
                <tr>
                  {screen.headers.map((h, i) => (
                    <th key={`${h}-${i}`} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {screen.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>
                        {typeof cell === "string" ? (
                          <span className={j === 0 ? "ms-lead" : undefined}>{cell}</span>
                        ) : (
                          <span className={`ms-strong ${toneClass(cell.tone)}`}>{cell.text}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {screen.kind === "report" && (
          <div className="ms-stack">
            {screen.subtitle && <p className="ms-sub">{screen.subtitle}</p>}
            {screen.sections.map((s) => (
              <div key={s.name} className={`ms-block ${s.score == null && s.tone ? `ms-edge ms-edge-${s.tone}` : ""}`}>
                <div className="ms-row">
                  <span className="ms-name">{s.name}</span>
                  {s.score != null && (
                    <span className={`ms-score ${toneClass(s.tone)}`}>
                      {s.score}
                      {s.max ? `/${s.max}` : ""}
                    </span>
                  )}
                </div>
                {s.score != null && s.max != null && (
                  <div className="ms-track">
                    <span
                      className={`ms-fill ${toneClass(s.tone)}`}
                      style={{ width: `${(s.score / s.max) * 100}%` }}
                    />
                  </div>
                )}
                <p className="ms-note">{s.note}</p>
              </div>
            ))}
          </div>
        )}

        {screen.kind === "search" && (
          <div className="ms-stack">
            <div className="ms-query">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 21l-4.3-4.3M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
              </svg>
              <span>{screen.query}</span>
            </div>
            <div className="ms-answer">{screen.answer}</div>
            <div className="ms-cites">
              {screen.citations.map((c, i) => (
                <div key={i} className="ms-cite">
                  <div className="ms-cite-doc">{c.doc}</div>
                  <div className="ms-cite-snip">{c.snippet}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen.kind === "upload" && (
          <div className="ms-stack">
            <div className="ms-drop">
              <div className="ms-name">{screen.filename}</div>
              <div className="ms-sub">{screen.stage}</div>
              <div className="ms-track ms-track-lg">
                <span className="ms-fill" style={{ width: `${screen.progress}%` }} />
              </div>
            </div>
            {screen.verdict && (
              <div className="ms-block">
                <div className={`ms-verdict ${toneClass(screen.verdict.tone)}`}>{screen.verdict.label}</div>
                <div className="ms-pairs">
                  {screen.verdict.details.map((d) => (
                    <div key={d.name} className="ms-pair">
                      <span>{d.name}</span>
                      <span className={`ms-strong ${toneClass(d.tone)}`}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {screen.kind === "cards" && (
          <div className="ms-cards">
            {screen.cards.map((c) => (
              <div key={c.name} className={`ms-card ${c.highlight ? "is-hi" : ""}`}>
                <div className="ms-row">
                  <span className="ms-name">{c.name}</span>
                  {c.badge && <span className={`badge ${c.highlight ? "badge-tone" : ""}`}>{c.badge}</span>}
                </div>
                <ul className="ms-lines">
                  {c.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {screen.kind === "bars" && (
          <div className="ms-stack ms-bars">
            {screen.bars.map((b) => (
              <div key={b.label}>
                <div className="ms-row ms-bar-head">
                  <span>{b.label}</span>
                  <span className={`ms-strong ${toneClass(b.tone)}`}>
                    {b.value.toLocaleString("en-US")}
                    {screen.unit ?? ""}
                  </span>
                </div>
                <div className="ms-track">
                  <span
                    className={`ms-fill ${toneClass(b.tone)}`}
                    style={{ width: `${Math.min(100, (b.value / b.max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {screen.kind === "terminal" && (
          <div className="ms-term">
            {screen.lines.map((l, i) =>
              l.startsWith("$") ? (
                <div key={i} className="ms-term-cmd">
                  <span className="ms-term-sign">$</span>
                  {l.slice(1)}
                </div>
              ) : (
                <div key={i}>{l}</div>
              ),
            )}
          </div>
        )}

        {screen.kind === "chat" && (
          <div className="ms-stack ms-chat">
            {screen.messages.map((m, i) => (
              <div key={i} className={`ms-msg ms-msg-${m.from}`}>
                <div className="ms-bubble">{m.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
