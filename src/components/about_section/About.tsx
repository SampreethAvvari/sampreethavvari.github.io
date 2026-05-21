import React from "react";
import { info } from "../../data/info";
import Education from "./Education";
import Experience from "./Experience";
import Skills from "./Skills";

interface AboutProps {
  about: (typeof info)["about"];
}

export default function About(props: AboutProps) {
  const { about } = props;

  return (
    <div className="flex flex-col items-stretch h-full space-y-16 w-full">
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-7 flex flex-col gap-10">
          <div className="flex flex-col space-y-4 w-full reveal" data-reveal>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">About me</h1>
            <p className="text-xl lg:text-2xl font-normal leading-relaxed">
              {info.about.description}
            </p>
          </div>
          <div className="w-full reveal" data-reveal>
            <Education education={about.education} />
          </div>
        </div>
        <div className="lg:col-span-5 reveal" data-reveal>
          <Skills skills={about.skills} />
        </div>
      </div>
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-7 reveal" data-reveal>
          <Experience items={about.experience} />
        </div>
        <div className="lg:col-span-5 reveal" data-reveal>
          <Experience items={about.research} title="Research" />
        </div>
      </div>
    </div>
  );
}
