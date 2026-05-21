import React from "react";
import { info } from "../../data/info";

type TimelineItem =
  | (typeof info)["about"]["experience"][number]
  | (typeof info)["about"]["research"][number];

interface ExperienceProps {
  items: TimelineItem[];
  title?: string;
}

// Render an inline [text](url) markdown link as a real anchor, leaving the
// rest of the string alone. Used so experience highlights can link out to
// blog posts without changing the highlight data shape.
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`lnk-${key++}`}
        href={match[2]}
        className="underline decoration-secondary/40 dark:decoration-dk-secondary/40 hover:text-accent dark:hover:text-dk-accent transition"
      >
        {match[1]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

export default function Experience(props: ExperienceProps) {
  const { items, title = "Experience" } = props;

  return items.length == 0 ? (
    <div></div>
  ) : (
    <div className="flex flex-col space-y-4 w-full mx-4 lg:mx-0">
      <h1 className="text-3xl font-bold">{title}</h1>
      {items.map((exp, index) => (
        <div
          className="flex flex-col space-y-2 relative transition-transform duration-200 hover:scale-[1.02]"
          key={index}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-briefcase text-2xl text-secondary dark:text-dk-secondary dark:hover:text-dk-accent hover:text-accent z-10"></i>
              <h2 className="text-xl font-semibold">{exp.title}</h2>
            </div>
            {exp.logo && (
              <img
                src={exp.logo}
                alt={`${exp.location} logo`}
                className={`w-auto max-w-[160px] object-contain ${exp.logoClass ?? "h-8"}`}
                loading="lazy"
              />
            )}
          </div>
          <div className="relative left-10 w-full">
            <p className="text-xl font-normal">{exp.date}</p>
            <p className="text-xl font-normal">{exp.location}</p>
            {exp.highlights?.length ? (
              <ul className="text-base lg:text-lg font-normal list-disc pl-6 space-y-1 leading-relaxed text-text dark:text-white">
                {exp.highlights.map((item, idx) => (
                  <li key={idx}>{renderInlineMarkdown(item)}</li>
                ))}
              </ul>
            ) : exp.description?.includes("Project 1:") ? (
              <ul className="text-base lg:text-lg font-normal list-disc pl-6 space-y-1 leading-relaxed text-text dark:text-white">
                {exp.description
                  .split("Project ")
                  .filter((item) => item.trim())
                  .map((item, idx) => {
                    const text = `Project ${item}`.trim();
                    return (
                      <li key={idx}>{text}</li>
                    );
                  })}
              </ul>
            ) : (
              <p className="text-base lg:text-lg font-normal leading-relaxed">
                {exp.description}
              </p>
            )}
          </div>

          {index !== items.length - 1 && (
            <div className="absolute top-3.5 left-[0.655rem] h-full w-1 bg-secondary dark:bg-dk-secondary hover:bg-accent dark:hover:bg-dk-accent -z-10"></div>
          )}
        </div>
      ))}
    </div>
  );
}
