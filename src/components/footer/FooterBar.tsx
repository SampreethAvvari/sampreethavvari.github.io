import { info } from "../../data/info";

type FooterVariant = "default" | "filmmaking" | "minimal";

interface FooterBarProps {
  variant?: FooterVariant;
}

const TABS = [
  { name: "Projects", href: "/projects", tone: "projects" },
  { name: "Work", href: "/work", tone: "work" },
  { name: "Writing", href: "/posts", tone: "writing" },
  { name: "Film", href: "/filmmaking", tone: "film" },
  { name: "Teaching", href: "/teaching", tone: "teaching" },
  { name: "Mind", href: "/mind", tone: "mind" },
];

export default function FooterBar({ variant = "default" }: FooterBarProps) {
  // Full screen pages (the /mind map) keep the screen to themselves.
  if (variant === "minimal") return null;

  const elsewhere =
    variant === "filmmaking"
      ? [
          { label: "Instagram", href: info.contact.instagram },
          { label: "Among Monsters playlist", href: "https://hi.switchy.io/q3Ng" },
          { label: "IMDb", href: "https://hi.switchy.io/q94P" },
          { label: "Email", href: `mailto:${info.contact.email}` },
        ]
      : [
          { label: "LinkedIn", href: info.contact.linkedin },
          { label: "GitHub", href: info.contact.github },
          { label: "Instagram", href: info.contact.instagram },
          { label: "Resume", href: info.cv },
        ];

  return (
    <footer className="site-foot">
      <div className="wrap">
        <div className="site-foot-grid">
          <div>
            <p className="t-h3">Sampreeth Avvari</p>
            <p className="t-small mt-2 max-w-sm">
              AI engineer in New York. I build the systems a dental implant
              practice runs on, and I make films.
            </p>
            <a
              href={`mailto:${info.contact.email}`}
              className="btn btn-glass btn-sm mt-5"
            >
              {info.contact.email}
            </a>
          </div>
          <div>
            <h2>On this site</h2>
            <ul>
              {TABS.map((t) => (
                <li key={t.href}>
                  <a href={t.href} className="foot-link" data-tone={t.tone}>
                    <i className="nav-dot" aria-hidden="true" />
                    {t.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Elsewhere</h2>
            <ul>
              {elsewhere.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="foot-link"
                    target={l.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel="noreferrer"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="site-foot-base">
          <p className="t-meta">© {new Date().getFullYear()} Sampreeth Avvari</p>
          <p className="t-meta">
            Visits are counted with Cloudflare Web Analytics. No cookies, no ads, no tracking across sites.
          </p>
        </div>
      </div>
    </footer>
  );
}
