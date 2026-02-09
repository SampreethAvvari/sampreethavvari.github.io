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
    <div className="flex flex-col justify-center items-center h-full space-y-10">
      <div className="flex flex-col space-y-4 w-full lg:w-1/2 mx-4 reveal" data-reveal>
        <h1 className="text-4xl font-bold">About me</h1>
        <p className="text-2xl font-normal">{info.about.description}</p>
      </div>
      <div className="w-full flex justify-center reveal" data-reveal>
        <Education education={about.education} />
      </div>
      <div className="w-full flex justify-center reveal" data-reveal>
        <Skills skills={about.skills} />
      </div>
      <div className="w-full flex justify-center reveal" data-reveal>
        <Experience experience={about.experience} />
      </div>
    </div>
  );
}
