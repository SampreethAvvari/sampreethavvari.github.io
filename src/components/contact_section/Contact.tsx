import { info } from "../../data/info";

interface ContactProps {
  contact: (typeof info)["contact"];
  className?: string;
}

// The contact line at the end of every post: one plain sentence with the
// links underlined in ink. Rendered on the server, so it ships no script.
export default function Contact({ contact, className = "" }: ContactProps) {
  return (
    <p className={className}>
      Working on something like this? Email me at{" "}
      <a className="ilink" href={`mailto:${contact.email}`}>
        {contact.email}
      </a>
      , or find me on{" "}
      <a className="ilink" href={contact.linkedin} target="_blank" rel="noreferrer">
        LinkedIn
      </a>{" "}
      and{" "}
      <a className="ilink" href={contact.github} target="_blank" rel="noreferrer">
        GitHub
      </a>
      .
    </p>
  );
}
