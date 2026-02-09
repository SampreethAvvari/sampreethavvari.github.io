import React from "react";
import { info } from "../../data/info";

interface SkillsProps {
  skills: (typeof info)["about"]["skills"];
}

export default function Skills(props: SkillsProps) {
  const { skills } = props;

  return skills.length === 0 ? (
    <div></div>
  ) : (
    <div className="flex flex-col space-y-4 lg:w-1/2 mx-4">
      <h1 className="text-3xl font-bold">Skills</h1>
      {skills.map((group, index) => (
        <div className="flex flex-col space-y-2" key={index}>
          <h2 className="text-xl font-semibold">{group.label}</h2>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <span
                key={item}
                className="px-3 py-1 text-sm rounded-full bg-secondary/10 text-secondary dark:text-dk-secondary dark:bg-dk-secondary/10 transition-transform duration-200 hover:scale-105"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
