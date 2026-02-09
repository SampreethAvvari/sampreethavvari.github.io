import { info } from "../../data/info";

type FooterVariant = "default" | "filmmaking";

interface FooterBarProps {
  variant?: FooterVariant;
}

export default function FooterBar({ variant = "default" }: FooterBarProps) {
  const defaultLinks = [
    {
      icon: "fas fa-envelope",
      href: `mailto:${info.contact.email}`,
      label: "Email",
    },
    {
      icon: "fab fa-github",
      href: info.contact.github,
      label: "GitHub",
    },
    {
      icon: "fab fa-linkedin",
      href: info.contact.linkedin,
      label: "LinkedIn",
    },
    {
      icon: "fab fa-instagram",
      href: info.contact.instagram,
      label: "Instagram",
    },
    {
      icon: "fas fa-file-pdf",
      href: info.cv,
      label: "Resume PDF",
      download: true,
    },
  ];

  const filmmakingLinks = [
    {
      icon: "fas fa-envelope",
      href: `mailto:${info.contact.email}`,
      label: "Email",
    },
    {
      icon: "fab fa-instagram",
      href: info.contact.instagram,
      label: "Instagram",
    },
    {
      icon: "fab fa-youtube",
      href: "https://hi.switchy.io/q3Ng",
      label: "Among Monsters Playlist",
    },
    {
      icon: "fab fa-imdb",
      href: "https://hi.switchy.io/q94P",
      label: "IMDb",
    },
  ];

  const socialLinks = variant === "filmmaking" ? filmmakingLinks : defaultLinks;

  return (
    <footer className="mt-12 border-t border-secondary/20 dark:border-dk-secondary/20">
      <div className="container mx-auto px-4 py-6 flex flex-wrap justify-center gap-6 text-2xl text-secondary dark:text-dk-secondary">
        {socialLinks.map((link) =>
          link.disabled ? (
            <span
              key={link.label}
              aria-label={link.label}
              className="opacity-50 cursor-default"
            >
              <i className={link.icon}></i>
            </span>
          ) : (
            <a
              key={link.label}
              href={link.href}
              target={link.download ? undefined : "_blank"}
              rel={link.download ? undefined : "noreferrer"}
              aria-label={link.label}
              download={link.download}
              className="hover:text-accent dark:hover:text-dk-accent transition"
            >
              <i className={link.icon}></i>
            </a>
          )
        )}
      </div>
    </footer>
  );
}
