import { useId, useState } from "react";
import { info } from "../../data/info";
import { LazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/blur.css";

interface ProjectCardProps {
  project: (typeof info)["projects"][number];
}

export default function ProjectCard(props: ProjectCardProps) {
  const { project } = props;
  const hasLink = Boolean(project.link);
  const hasDetails = Boolean(
    project.details?.summary || project.details?.highlights?.length
  );
  const imageStyle =
    "imageStyle" in project && typeof project.imageStyle === "string"
      ? project.imageStyle
      : "";
  const imagePosition = imageStyle
    ? imageStyle.replace("object-position:", "").replace(";", "").trim()
    : undefined;
  const [isOpen, setIsOpen] = useState(false);
  const detailsId = useId();

  return (
    <div className="flex flex-col bg-primary dark:bg-dk-primary rounded-lg shadow-sm dark:shadow-dk-secondary border border-secondary/30 dark:border-dk-secondary/30 transform transition duration-500 hover:scale-105">
      <div className="flex-shrink-0">
        <LazyLoadImage
          className="h-52 w-full object-cover"
          style={imagePosition ? { objectPosition: imagePosition } : undefined}
          src={project.img_path}
          alt={project.img_alt}
          width="100%"
          effect="blur"
        />
      </div>
      <div className="flex-1 bg-primary dark:bg-dk-primary p-6 flex flex-col justify-between">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium text-text dark:text-dk-text line-clamp-2 min-h-[2.5rem]">
              {project.title}
            </p>
            {hasLink && (
              <a
                href={project.link}
                target="_blank"
                rel="noreferrer"
                aria-label={`${project.title} GitHub`}
                className="text-secondary dark:text-dk-secondary hover:text-accent dark:hover:text-dk-accent transition"
              >
                <i className="fab fa-github text-xl"></i>
              </a>
            )}
          </div>
          <p className="text-xl font-semibold text-gray-900 mt-2 line-clamp-2 min-h-[3.5rem]">
            {project.description}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900">{project.date}</p>
          {hasDetails && (
            <button
              type="button"
              className="text-sm font-semibold text-secondary dark:text-dk-secondary hover:text-accent dark:hover:text-dk-accent inline-flex items-center gap-2"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-expanded={isOpen}
              aria-controls={detailsId}
            >
              {isOpen ? "Hide details" : "View details"}
              <i className={`fas fa-chevron-${isOpen ? "up" : "down"}`}></i>
            </button>
          )}
        </div>

        {hasDetails && (
          <div
            id={detailsId}
            aria-hidden={!isOpen}
            className={`mt-4 space-y-3 text-sm text-text dark:text-dk-text overflow-hidden transition-all duration-700 ease-out ${
              isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            {project.details?.summary && (
              <p className="leading-relaxed line-clamp-2 min-h-[3rem]">
                {project.details.summary}
              </p>
            )}
            {project.details?.highlights?.length ? (
              <ul className="list-disc pl-5 space-y-1">
                {project.details.highlights.map((item) => (
                  <li key={item} className="line-clamp-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {project.tech.map((tech) => (
                <span
                  className="text-accent dark:text-dk-accent text-xs font-semibold"
                  key={tech}
                >
                  #{tech}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
