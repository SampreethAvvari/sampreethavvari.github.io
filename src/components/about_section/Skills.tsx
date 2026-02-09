import React from "react";
import { info } from "../../data/info";

interface SkillsProps {
  skills: (typeof info)["about"]["skills"];
}

export default function Skills(props: SkillsProps) {
  const { skills } = props;

  const mlItems = new Set([
    "MCP",
    "PostgreSQL",
    "Postgres",
    "FastAPI",
    "Prometheus",
    "Grafana",
  ]);

  const colorForItem = (label: string, item: string) => {
    if (mlItems.has(item)) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-300";
    }
    if (label === "ML and Data" || label === "Specialization") {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-300";
    }
    if (
      label === "Languages" ||
      label === "Frameworks and Platforms" ||
      label === "Databases" ||
      label === "Tools"
    ) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
    }
    return "bg-secondary/10 text-secondary dark:text-dk-secondary dark:bg-dk-secondary/10";
  };

  return skills.length === 0 ? (
    <div></div>
  ) : (
    <div className="flex flex-col space-y-4 w-full mx-4 lg:mx-0">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Skills</h1>
          <div className="mt-4 space-y-6">
            {skills.map((group, index) => (
              <div className="flex flex-col space-y-2" key={index}>
                <h2 className="text-xl font-semibold">{group.label}</h2>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className={`px-3 py-1 text-sm rounded-full transition-transform duration-200 hover:scale-105 ${colorForItem(
                        group.label,
                        item
                      )}`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:flex flex-col items-start justify-center self-stretch">
          <div className="text-sm text-text dark:text-dk-text flex flex-col gap-3">
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              Software
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              ML
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
