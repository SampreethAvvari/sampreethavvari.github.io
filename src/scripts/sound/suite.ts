// The suite: every movement, loaded together the first time sound is turned
// on (one small module), so moving between tabs never waits on the network.
import { Studio } from "./studio";
import type { Movement } from "./movement";
import { Home } from "./movements/home";
import { Projects } from "./movements/projects";
import { Architecture } from "./movements/architecture";
import { Work } from "./movements/work";
import { Writing } from "./movements/writing";
import { Film } from "./movements/film";
import { Mind } from "./movements/mind";
import { Teaching } from "./movements/teaching";
import { Resume } from "./movements/resume";
import { Demos } from "./movements/demos";
import { Touch, type Flight } from "./touch";

export { Studio, Touch };
export type { Movement, Flight };

const MOVEMENTS: Record<string, new (st: Studio, seed?: number) => Movement> = {
  home: Home,
  projects: Projects,
  architecture: Architecture,
  work: Work,
  writing: Writing,
  film: Film,
  mind: Mind,
  teaching: Teaching,
  resume: Resume,
  demos: Demos,
};

export function createMovement(id: string, st: Studio, seed?: number): Movement {
  const M = MOVEMENTS[id] ?? Home;
  return new M(st, seed);
}
