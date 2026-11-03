// The filmography. One list feeds the filmmaking page, each film's own page
// and the structured data search engines read, so they never disagree.
//
// Only facts the site already states live here. A film with no synopsis has
// none; its page shows the year, the status and my credits and stops there.
// Credits read the way the film credits me: Sampreeth Sharma.

import fs from "node:fs";
import path from "node:path";
import { canonicalImageList } from "../utils/optimizedImage";

export type Person = {
  name: string;
  role: string;
  /** A real headshot in public/Crew Photos. Without one the page shows initials. */
  photo?: string;
  imageStyle?: string;
  instagram?: string;
};

export type CreditGroup = { label: string; people: Person[] };
export type Still = { src: string; alt: string };

/**
 * The film's place in the reel at the top of /filmmaking.
 *
 * A clip: files under public/films/<slug>/ (reel-1080.mp4, reel-720.mp4 for
 * phones, poster.jpg, and audio.m4a for the film's own sound). Until a clip
 * exists, a film shows its own stills instead (each entry names one of its
 * stills by any part of the filename, shown in that order), or, with no
 * stills either, a designed title card. Dropping reel-1080.mp4 into the
 * folder is enough to switch to the clip; the other files are picked up
 * the same way when they are there. The category is the film's form when
 * the site states it, and the plain word "Film" when it does not.
 */
export type VideoReel = { category: string; mp4: string; mp4Phone?: string; poster: string; audio?: string };
export type StillsReel = { category: string; stills: string[] };
/** No footage yet: the reel shows a designed title card until a clip arrives. */
export type CardReel = { category: string; card: true };

export type Film = {
  slug: string;
  title: string;
  /** Missing while a film is still in development. */
  year?: string;
  /**
   * upcoming: not out yet.
   * dated: the slate gives a year and nothing more, so the page shows only that.
   */
  status: "upcoming" | "dated";
  /** A short line on where the film stands, in the site's own words. */
  statusNote?: string;
  /** My credits on the film, in the order the slate lists them. */
  roles: string[];
  genre?: string;
  shot?: { place: string; when: string };
  logline?: string;
  /** What I did on it, in my own words, where the site has them. */
  work?: string;
  poster?: { src: string; image: string; alt: string };
  stills?: { dir: string; alt: (file: string, index: number) => string; letterboxed?: boolean };
  links?: { imdb?: string; screenplay?: string; playlist?: string };
  credits?: CreditGroup[];
  reel?: VideoReel | StillsReel | CardReel;
};

// Among Monsters stills. Filenames carry the edit's clip numbers
// ("Carl 1_1.90.1"), so the readable part is everything before them.
const stillName = (file: string) =>
  file
    .replace(/\.[^/.]+$/, "")
    .replace(/_[\d.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\bCental\b/, "Central")
    .trim();

const crew = (file: string) => `/Crew%20Photos/${encodeURIComponent(file)}`;

const amCredits: CreditGroup[] = [
  {
    label: "Above the line",
    people: [
      { role: "Director · Writer · Cinematographer · Editor · Background score", name: "Sampreeth Sharma", photo: crew("Sampreeth.JPG"), instagram: "@sampreeth.sharma" },
      { role: "Director of photography", name: "Isaac Chipe", photo: crew("Isaac.jpg"), instagram: "@isaacchipedop" },
      { role: "Co writer", name: "Akash Munji", photo: crew("Akash.jpg"), instagram: "@akumunji" },
    ],
  },
  {
    label: "Cast",
    people: [
      { name: "Sam Velletri", role: "John Reese · Harold Finch", photo: crew("Sam Velletri.jpg"), instagram: "@samvelletri" },
      { name: "Matt Ehrmann", role: "", instagram: "@mattspaceship" },
      { name: "Kendall Hobson", role: "Carl", photo: crew("Kendall.jpeg"), instagram: "@kenny.flair" },
      { name: "Lazaro Clapp", role: "", photo: crew("Lazaro.png"), imageStyle: "object-position: 28% center;", instagram: "@lazaroclapp" },
      { name: "Alex Murray", role: "Sam", photo: crew("Alex.jpeg"), instagram: "@cooldudemurray" },
      { name: "Evan Beskin", role: "Agent David", photo: crew("Evan.png"), imageStyle: "object-position: 65% 60%; transform: scale(1.12);" },
      { name: "Asli Mumtas", role: "Grace", photo: crew("Asli.png"), imageStyle: "object-position: 70% center;", instagram: "@asliimumtas" },
      { name: "Tom Velletri", role: "Faith", photo: crew("Tom Velletri.jpeg"), imageStyle: "object-position: 30% center; transform: scale(1.05);", instagram: "@tomvelletri" },
      { name: "Jordyn Andrea", role: "Sarah", photo: crew("Jordyn.jpeg"), imageStyle: "transform: scale(1.05);", instagram: "@jordyn.andrea" },
      { name: "Luke Johnson", role: "Marcus", photo: crew("Luke.jpeg"), instagram: "@lukeabjohnson" },
      { name: "Riyaan Jiwani", role: "Max", photo: crew("Max.jpeg"), instagram: "@riyaan.jiwani" },
      { name: "Dylan Redford", role: "Unnamed FBI agent", instagram: "@dylanredford" },
    ],
  },
  {
    label: "Songs",
    people: [
      { name: "Sai Charan Thota", role: "PRO-JECT 53", instagram: "@charan_af" },
      { name: "Eknath Sravanam", role: "PRO-JECT 53", instagram: "@eknath_sravanam" },
    ],
  },
];

// The slate, newest first, in the order the page has always listed it.
export const films: Film[] = [
  {
    slug: "among-monsters",
    title: "Among Monsters",
    year: "2026",
    status: "upcoming",
    statusNote: "Premiering in NYC",
    roles: ["Director", "Writer", "Cinematographer", "Editor", "Background score"],
    genre: "Independent crime drama",
    shot: { place: "New York City", when: "2024 and 2025" },
    logline:
      "A criminal trapped in a coward's body sets out to take revenge at any cost. Guns and drugs don't save people. The question isn't whether he breaks, it's how long he can keep going before the chaos finishes him.",
    work:
      "I wrote, directed, shot, edited and scored it. We filmed across New York City in 2024 and 2025, in real living rooms and motel parking lots and the kind of streets the script kept asking for. Premieres in NYC in 2026.",
    poster: {
      src: "/among-monsters-poster.jpg",
      image: "/among-monsters-poster.webp",
      alt: "Among Monsters poster with the full credits",
    },
    stills: { dir: "", alt: (file) => `Among Monsters still, ${stillName(file)}` },
    reel: { category: "Feature", stills: ["Climax", "Dumb", "Heroine 1", "Kevin_", "Central Park_"] },
    links: {
      imdb: "https://www.imdb.com/title/tt39700295/",
      screenplay: "/among-monsters-screenplay.pdf",
      playlist: "https://www.youtube.com/@DudeStrong",
    },
    credits: amCredits,
  },
  { slug: "l-immigrata", title: "L'immigrata", year: "2026", status: "dated", roles: ["Assistant Director", "Editor"], reel: { category: "Short", card: true } },
  { slug: "office-plant", title: "Office Plant", year: "2026", status: "dated", roles: ["Assistant Director", "Editor"], reel: { category: "Short", card: true } },
  { slug: "extraordinary-lives", title: "Extraordinary Lives", status: "upcoming", statusNote: "In development", roles: ["Director", "Writer"] },
  { slug: "pupa", title: "Pupa", status: "upcoming", statusNote: "In development", roles: ["Writer"] },
  { slug: "solstice", title: "Solstice", year: "2025", status: "dated", roles: ["Editor"] },
  {
    slug: "swechcha",
    title: "Swechcha",
    year: "2024",
    status: "dated",
    roles: ["Editor"],
    work: "A short film I edited and color graded in 2024.",
    // Screen grabs with the letterbox baked in.
    stills: { dir: "Swechcha", alt: (_file, i) => `Swechcha still ${i + 1}`, letterboxed: true },
    reel: { category: "Short", stills: ["1.35.07", "1.30.28", "1.29.54", "1.31.05", "1.30.48"] },
  },
  { slug: "tiger-man", title: "Tiger Man", year: "2022", status: "dated", roles: ["Director", "Writer", "Editor"], reel: { category: "Short", card: true } },
  { slug: "strangers", title: "Strangers", year: "2019", status: "dated", roles: ["Cinematographer", "Music"], reel: { category: "Short", card: true } },
];

// The same films seen by the job I did on each.
export const crafts: Array<{ title: string; image?: string; films: string[] }> = [
  { title: "Director", image: "/Creative%20Roles/Director.jpg", films: ["Extraordinary Lives", "Among Monsters", "Tiger Man"] },
  { title: "Writer", image: "/Creative%20Roles/Write.jpg", films: ["Extraordinary Lives", "Pupa", "Among Monsters", "Tiger Man"] },
  {
    title: "Editor",
    image: "/Creative%20Roles/Editor.jpg",
    films: ["Among Monsters", "L'immigrata", "Office Plant", "Solstice", "Swechcha", "Tiger Man"],
  },
  { title: "Cinematographer", image: "/Creative%20Roles/Cinematographer.jpg", films: ["Among Monsters", "Strangers"] },
  { title: "Music and background score", image: "/Creative%20Roles/Music.jpg", films: ["Among Monsters", "Strangers"] },
  { title: "Assistant Director", films: ["L'immigrata", "Office Plant"] },
];

export const photographyUrl = "https://www.instagram.com/on.my.earth/";

export const filmPath = (slug: string) => `/filmmaking/${slug}`;
export const filmBySlug = (slug: string) => films.find((f) => f.slug === slug);
export const filmByTitle = (title: string) => films.find((f) => f.title === title);

/** The year, or "Soon" for a film still in development. */
export const yearLabel = (f: Film) => f.year ?? "Soon";
export const statusLabel = (f: Film) =>
  f.status === "upcoming" ? "Upcoming" : (f.year ?? "");
export const rolesLine = (f: Film) => f.roles.join(" · ");

const ROLE_PROSE: Record<string, string> = { Music: "composer", "Background score": "background score composer" };
const listProse = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
/** "director, writer and editor" */
export const rolesProse = (f: Film) => listProse(f.roles.map((r) => ROLE_PROSE[r] ?? r.toLowerCase()));

/** A search description built only from the facts above, kept near the length search results show. */
export function filmDescription(f: Film, stillCount = 0) {
  const named = `${f.title}${f.year ? ` (${f.year})` : ""}`;
  const head = f.genre
    ? `${named}, an ${f.genre.toLowerCase()}${f.shot ? ` shot in ${f.shot.place} in ${f.shot.when}` : ""}.`
    : `${named}, a film on Sampreeth Avvari's slate.`;
  const credit = f.genre ? ` Sampreeth Avvari's credits, as Sampreeth Sharma: ${rolesProse(f)}.` : ` Credits: ${rolesProse(f)}.`;
  const status = f.statusNote ? ` ${f.statusNote}${f.status === "upcoming" && f.year ? ` in ${f.year}` : ""}.` : "";
  const extras = [stillCount ? `${stillCount} stills` : "", f.credits ? "the cast and key crew" : ""].filter(Boolean);
  const tail = extras.length ? ` ${listProse(extras).replace(/^./, (c) => c.toUpperCase())}.` : "";
  let text = head + credit;
  for (const part of [status, tail]) if ((text + part).length <= 200) text += part;
  return text;
}

/** The film's stills from public/Photo Gallery, read at build time. */
export function filmStills(f: Film): Still[] {
  if (!f.stills) return [];
  const dir = path.join(process.cwd(), "public", "Photo Gallery", f.stills.dir);
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((file) => /\.(png|jpe?g|webp|gif|avif)$/i.test(file));
  } catch {
    return [];
  }
  const urlDir = ["/Photo%20Gallery", f.stills.dir && encodeURIComponent(f.stills.dir)].filter(Boolean).join("/");
  return canonicalImageList(files)
    .sort((a, b) => a.localeCompare(b))
    .map((file, i) => ({ src: `${urlDir}/${encodeURIComponent(file)}`, alt: f.stills!.alt(file, i) }));
}

/** Previous and next film in slate order, wrapping at the ends. */
export function neighbours(slug: string) {
  const i = films.findIndex((f) => f.slug === slug);
  const n = films.length;
  return { prev: films[(i - 1 + n) % n], next: films[(i + 1) % n] };
}

/** The reel's running order, the owner's choice. Films not named here
 *  follow in slate order if they gain a reel entry. */
export const REEL_ORDER = ["among-monsters", "swechcha", "l-immigrata", "office-plant", "tiger-man", "strangers"];

/** One screen of the reel, resolved at build time. */
export type ReelItem = {
  slug: string;
  title: string;
  year: string;
  category: string;
  href: string;
  kind: "video" | "stills" | "card";
  /** The image under the media (the first paint, and what shows without
   *  script). A title card has none; it is drawn. */
  poster?: string;
  /** The poster has letterbox bars baked in. */
  posterBoxed: boolean;
  mp4?: string;
  mp4Phone?: string;
  audio?: string;
  /** The stills a stills reel moves through, as WebP for the canvas. */
  frames?: string[];
  /** My credits on it, for the title card's lower bar. */
  roles: string;
};

const PUBLIC_DIR = path.join(process.cwd(), "public");
const onDisk = (url: string) => fs.existsSync(path.join(PUBLIC_DIR, decodeURIComponent(url).replace(/^\//, "")));

/** The films in the reel, in REEL_ORDER. A clip in public/films/<slug>/
 *  wins over stills, and stills win over a title card. */
export function reelItems(): ReelItem[] {
  const items: ReelItem[] = [];
  const order = (slug: string) => {
    const i = REEL_ORDER.indexOf(slug);
    return i < 0 ? REEL_ORDER.length + films.findIndex((f) => f.slug === slug) : i;
  };
  for (const f of [...films].sort((a, b) => order(a.slug) - order(b.slug))) {
    const r = f.reel;
    if (!r) continue;
    const dir = `/films/${f.slug}`;
    const found = (name: string) => (onDisk(`${dir}/${name}`) ? `${dir}/${name}` : undefined);
    const stills = filmStills(f);
    const picked =
      "stills" in r
        ? r.stills.map((key) => stills.find((s) => decodeURIComponent(s.src).includes(key))).filter((s): s is Still => !!s)
        : [];
    const mp4 = ("mp4" in r && r.mp4) || found("reel-1080.mp4");
    const base = {
      slug: f.slug,
      title: f.title,
      year: yearLabel(f),
      category: r.category,
      href: filmPath(f.slug),
      roles: rolesLine(f),
      audio: ("audio" in r && r.audio) || found("audio.m4a"),
    };
    if (mp4) {
      const poster = ("poster" in r && r.poster) || found("poster.jpg") || picked[0]?.src;
      items.push({
        ...base,
        kind: "video",
        poster,
        posterBoxed: !found("poster.jpg") && !!f.stills?.letterboxed,
        mp4,
        mp4Phone: ("mp4Phone" in r && r.mp4Phone) || found("reel-720.mp4"),
      });
    } else if (picked.length) {
      items.push({ ...base, kind: "stills", poster: picked[0].src, posterBoxed: true, frames: picked.map((s) => s.src.replace(/\.avif$/i, ".webp")) });
    } else {
      items.push({ ...base, kind: "card", posterBoxed: false });
    }
  }
  return items;
}
