// What the page hands the 3D world: the same data the HTML shows.

export type SheetData = { id: string; acronym: string; name: string; file: string; blurb: string };
export type RoleItem = { name: string; href: string; text: string };
export type RoleData = { id: string; title: string; org: string; date: string; logo: string; items: RoleItem[] };
export type EduData = { id: string; title: string; school: string; date: string; gpa: string; logo: string };
export type SkillGroup = { label: string; items: string[] };

export type WorldData = {
  person: { name: string; location: string };
  sheets: SheetData[];
  roles: RoleData[];
  education: EduData[];
  skills: SkillGroup[];
};

/** The stops of the flight, in order. */
export const STOPS = ["sheets", "page", "hybridge", "research", "video", "shure", "skills", "education"] as const;
export type StopId = (typeof STOPS)[number];
