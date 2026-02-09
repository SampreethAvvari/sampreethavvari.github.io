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
    <div className="flex flex-col justify-center items-center h-full space-y-12">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-20 items-start justify-center">
        <div className="flex-1 flex flex-col gap-10">
          <div className="flex flex-col space-y-4 w-full reveal" data-reveal>
            <h1 className="text-4xl font-bold">About me</h1>
            <p className="text-2xl font-normal text-justify">{info.about.description}</p>
          </div>
          <div className="w-full flex justify-center reveal" data-reveal>
            <Education education={about.education} />
          </div>
        </div>
        <div className="flex-1 flex justify-center reveal" data-reveal>
          <Skills skills={about.skills} />
        </div>
      </div>
      <div className="w-full flex justify-center reveal" data-reveal>
        <Experience experience={about.experience} />
      </div>
    </div>
  );
}
