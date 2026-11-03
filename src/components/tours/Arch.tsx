import type { CSSProperties } from "react";
import "./tours.css";

/** Architecture as numbered lanes, left to right: honest boxes, no fake complexity.
 *  They light in order as the section comes up, and go dark again on the way back. */
export default function Arch({ lanes }: { lanes: { lane: string; items: string[] }[] }) {
  return (
    <ol className="ar" style={{ "--n": lanes.length } as CSSProperties}>
      {lanes.map((l, i) => (
        <li key={l.lane} className="surface ar-lane" style={{ "--i": i } as CSSProperties}>
          <div className="ar-head">
            <span className="ar-num" aria-hidden="true">
              {i + 1}
            </span>
            <h3 className="t-h4">{l.lane}</h3>
          </div>
          <ul className="ar-items">
            {l.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
