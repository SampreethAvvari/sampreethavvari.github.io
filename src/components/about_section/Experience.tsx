import React from "react";
import { info } from "../../data/info";

interface ExperienceProps {
  experience: (typeof info)["about"]["experience"];
}

export default function Experience(props: ExperienceProps) {
  const { experience: experience } = props;

  return experience.length == 0 ? (
    <div></div>
  ) : (
    <div className="flex flex-col space-y-4 lg:w-1/2 mx-4">
      <h1 className="text-3xl font-bold">Experience</h1>
      {experience.map((exp, index) => (
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
                {exp.highlights.map((item) => (
                  <li key={item}>{item}</li>
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

          {index !== experience.length - 1 && (
            <div className="absolute top-3.5 left-[0.655rem] h-full w-1 bg-secondary dark:bg-dk-secondary hover:bg-accent dark:hover:bg-dk-accent -z-10"></div>
          )}
        </div>
      ))}
    </div>
  );
}
