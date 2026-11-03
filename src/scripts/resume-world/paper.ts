// The printed page. Everything on the sheets is drawn from the same data the
// HTML shows, with a 2D canvas, once.
//
// A page is a list of pieces and slips placed in page units (1400 by 1812,
// a US letter sheet). The same draw calls paint the whole page, and paint
// each piece again at a larger scale into an atlas, so a line that lifts off
// the page can grow and stay sharp.
//
// Colour channels hold print, not colour:
//   R  how much light the ink lets back (1 paper, 0 black)
//   G  foil: 0 where the print is reflective stamped foil, 1 elsewhere
//   B  unused, left at 1
// Every mark is drawn with "multiply" on a white page.

import type { WorldData } from "./types";

export const PAGE_W = 1400;
export const PAGE_H = 1812;
export const PAGE_RATIO = PAGE_H / PAGE_W;

export type Rect = { x: number; y: number; w: number; h: number };
export type Group = "head" | "experience" | "skills" | "education";

export type Piece = {
  id: string;
  group: Group;
  /** Where it goes: a role or education id, or "" to fly past the camera. */
  dest: string;
  /** Position among pieces that share a destination. */
  slot: number;
  rect: Rect;
  /** Scale in the atlas, 0 when it never needs more than the page. */
  hi: number;
  draw: (c: CanvasRenderingContext2D, sheet: number) => void;
};

export type Slip = {
  id: string;
  text: string;
  group: number;
  label: boolean;
  rect: Rect;
};

export type Layout = {
  pieces: Piece[];
  slips: Slip[];
  /** Page rectangles of the sections, for the hover zones on the page. */
  zones: Record<"experience" | "skills" | "education", Rect>;
};

const FACE = 'Inter, "Inter Fallback", Arial, sans-serif';
const font = (weight: number, size: number) => `${weight} ${size}px ${FACE}`;
const INK = (level: number) => `rgb(${level},255,255)`;
const FOIL = "rgb(26,0,255)";

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string; fontKerning?: string };

function text(
  c: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  o: { font: string; ink?: string; align?: CanvasTextAlign; track?: number },
) {
  const ctx = c as Ctx;
  ctx.font = o.font;
  ctx.fillStyle = o.ink ?? INK(14);
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${o.track ?? 0}px`;
  ctx.fillText(s, x, y);
}

function wrap(c: CanvasRenderingContext2D, s: string, f: string, max: number): string[] {
  c.font = f;
  const lines: string[] = [];
  let line = "";
  for (const w of s.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (c.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** "Name. Rest of the line" for a highlight that starts with a link. */
export function splitHighlight(h: string): { name: string; href: string; rest: string } {
  const m = h.match(/^\[([^\]]+)\]\(([^)\s]+)\)\.?\s*(.*)$/s);
  if (m) return { name: m[1], href: m[2], rest: m[3] };
  return { name: "", href: "", rest: h };
}

const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1").replace(/`([^`]+)`/g, "$1");

export function layoutPage(m: CanvasRenderingContext2D, d: WorldData, masks: Map<string, HTMLCanvasElement>): Layout {
  const MX = 92;
  const CW = PAGE_W - MX * 2;
  const pieces: Piece[] = [];
  const slips: Slip[] = [];
  const PX = 26; // a piece's paper reaches a little past its words
  let y = 0;

  const rule = (c: CanvasRenderingContext2D, ry: number) => {
    c.fillStyle = INK(170);
    c.fillRect(MX, ry, CW, 2);
  };
  const logo = (c: CanvasRenderingContext2D, src: string, right: number, top: number, h: number) => {
    const img = masks.get(src);
    if (!img) return;
    const w = (img.width / img.height) * h;
    const tinted = document.createElement("canvas");
    tinted.width = img.width;
    tinted.height = img.height;
    const t = tinted.getContext("2d")!;
    t.drawImage(img, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = INK(40);
    t.fillRect(0, 0, img.width, img.height);
    c.drawImage(tinted, right - w, top, w, h);
  };

  // ---- the head of the page: the only part that differs between the four
  const HEAD_H = 232;
  pieces.push({
    id: "head",
    group: "head",
    dest: "",
    slot: 0,
    rect: { x: MX - PX, y: 54, w: CW + PX * 2, h: HEAD_H - 54 },
    hi: 0,
    draw: (c, s) => {
      const sh = d.sheets[s];
      text(c, d.person.name, MX, 124, { font: font(640, 78), ink: FOIL, track: -2.4 });
      text(c, sh.acronym, PAGE_W - MX, 124, { font: font(300, 78), ink: INK(70), align: "right", track: -1.5 });
      text(c, sh.name, MX, 176, { font: font(520, 33), track: -0.5 });
      text(c, d.person.location, PAGE_W - MX, 176, { font: font(420, 23), ink: INK(90), align: "right" });
      text(c, sh.blurb, MX, 212, { font: font(400, 23), ink: INK(90) });
    },
  });
  y = HEAD_H;

  const sectionLabel = (id: Group, label: string) => {
    const top = y;
    pieces.push({
      id: `label-${id}`,
      group: id,
      dest: "",
      slot: 0,
      rect: { x: MX - PX, y: top, w: CW + PX * 2, h: 50 },
      hi: 0,
      draw: (c) => {
        rule(c, top + 4);
        text(c, label, MX, top + 38, { font: font(640, 21), ink: FOIL, track: 0.4 });
      },
    });
    y = top + 50;
  };

  // ---- experience
  const zoneExpTop = y;
  sectionLabel("experience", "Experience");

  const ROLE_FONT = font(610, 31);
  const META = font(420, 21.5);
  const BODY = font(400, 21.5);
  const LH = 28;

  d.roles.forEach((role) => {
    const top = y;
    const HEAD = 72;
    pieces.push({
      id: `${role.id}-head`,
      group: "experience",
      dest: "",
      slot: 0,
      rect: { x: MX - PX, y: top, w: CW + PX * 2, h: HEAD },
      hi: 0,
      draw: (c) => {
        text(c, role.title, MX, top + 32, { font: ROLE_FONT, track: -0.4 });
        text(c, role.org, MX, top + 60, { font: META, ink: INK(80) });
        text(c, role.date, PAGE_W - MX, top + 60, { font: META, ink: INK(80), align: "right" });
        if (role.logo) logo(c, role.logo, PAGE_W - MX, top + 6, 28);
      },
    });
    y = top + HEAD;

    const named = role.items.filter((it) => it.name);
    if (named.length) {
      // Linked work reads as two columns of short lines. Each is its own strip.
      const KEY_H = 44;
      const colW = (CW - 28) / 2;
      named.forEach((it, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const rx = MX + col * (colW + 28);
        const ry = y + row * KEY_H;
        // the strip of paper fits its words
        m.font = font(540, 24);
        const fit = Math.min(colW + 14, m.measureText(it.name).width + 46);
        pieces.push({
          id: `${role.id}-key-${i}`,
          group: "experience",
          dest: role.id,
          slot: i,
          rect: { x: rx - 14, y: ry, w: fit, h: KEY_H - 4 },
          hi: 3.6,
          draw: (c) => {
            text(c, it.name, rx + 10, ry + 28, { font: font(540, 24), track: -0.2 });
          },
        });
      });
      y += Math.ceil(named.length / 2) * KEY_H + 8;
    } else {
      role.items.forEach((it, i) => {
        const lines = wrap(m, plain(it.text), BODY, CW);
        const top2 = y;
        const h = lines.length * LH + 8;
        m.font = BODY;
        const widest = Math.max(...lines.map((ln) => m.measureText(ln).width));
        pieces.push({
          id: `${role.id}-line-${i}`,
          group: "experience",
          dest: role.id,
          slot: i,
          rect: { x: MX - PX, y: top2, w: Math.min(CW + PX * 2, widest + PX * 2), h },
          hi: 2.4,
          draw: (c) => {
            lines.forEach((ln, k) => text(c, ln, MX, top2 + 22 + k * LH, { font: BODY, ink: INK(46) }));
          },
        });
        y += h;
      });
      y += 10;
    }
  });
  const zoneExp: Rect = { x: MX - PX, y: zoneExpTop, w: CW + PX * 2, h: y - zoneExpTop };

  // ---- skills: a label and its words, every word its own slip of paper
  const zoneSkillTop = y;
  sectionLabel("skills", "Skills");
  const LABEL_W = 196;
  const WORD = font(450, 19.5);
  const WORD_H = 28;
  const GAP = 8;
  d.skills.forEach((g, gi) => {
    const top = y;
    m.font = font(600, 19.5);
    const labelW = m.measureText(g.label).width + 18;
    slips.push({
      id: `g${gi}`,
      text: g.label,
      group: gi,
      label: true,
      rect: { x: MX - 9, y: top + 1, w: Math.min(labelW, LABEL_W), h: WORD_H - 2 },
    });
    let x = MX + LABEL_W;
    let row = 0;
    m.font = WORD;
    g.items.forEach((word, wi) => {
      const w = m.measureText(word).width + 18;
      if (x + w > PAGE_W - MX + 9) {
        x = MX + LABEL_W;
        row++;
      }
      slips.push({ id: `g${gi}-w${wi}`, text: word, group: gi, label: false, rect: { x: x - 9, y: top + 1 + row * WORD_H, w, h: WORD_H - 2 } });
      x += w + GAP - 9;
    });
    y = top + (row + 1) * WORD_H + 4;
  });
  y += 10;
  const zoneSkills: Rect = { x: MX - PX, y: zoneSkillTop, w: CW + PX * 2, h: y - zoneSkillTop };

  // ---- education, two blocks side by side
  const zoneEduTop = y;
  sectionLabel("education", "Education");
  const eduW = (CW - 28) / 2;
  const eduTop = y;
  const eduLines = d.education.map((e) => wrap(m, e.title, font(590, 25), eduW - 10));
  const blockH = 28 + Math.max(...eduLines.map((l) => l.length)) * 31 + 56;
  d.education.forEach((e, i) => {
    const ex = MX + i * (eduW + 28);
    const titleLines = eduLines[i];
    pieces.push({
      id: `${e.id}-card`,
      group: "education",
      dest: e.id,
      slot: 0,
      rect: { x: ex - 18, y: eduTop, w: eduW + 18, h: blockH },
      hi: 2.6,
      draw: (c) => {
        titleLines.forEach((ln, k) => text(c, ln, ex, eduTop + 30 + k * 31, { font: font(590, 25), track: -0.25 }));
        const by = eduTop + 30 + titleLines.length * 31;
        text(c, e.school, ex, by + 2, { font: font(420, 20.5), ink: INK(66) });
        text(c, `${e.date}${e.gpa ? ` · GPA ${e.gpa}` : ""}`, ex, by + 30, { font: font(420, 20.5), ink: INK(96) });
      },
    });
  });

  // If the words run long, pull the page together so it always fits.
  const bottom = eduTop + 150;
  const zoneEdu: Rect = { x: MX - PX, y: zoneEduTop, w: CW + PX * 2, h: bottom - zoneEduTop };
  const overflow = bottom + 24 - PAGE_H;
  if (overflow > 0) console.warn(`resume page runs ${Math.ceil(overflow)} units long`);

  return { pieces, slips, zones: { experience: zoneExp, skills: zoneSkills, education: zoneEdu } };
}

function paintSlip(c: CanvasRenderingContext2D, s: Slip) {
  const f = s.label ? font(620, 19.5) : font(450, 19.5);
  text(c, s.text, s.rect.x + 9, s.rect.y + 19.5, { font: f, ink: s.label ? FOIL : INK(30) });
}

function blank(w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(w);
  cv.height = Math.round(h);
  const c = cv.getContext("2d", { alpha: false })!;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = "multiply";
  return { cv, c };
}

/** One whole page, for one of the four sheets. */
export function paintPage(layout: Layout, sheet: number, width: number): HTMLCanvasElement {
  const s = width / PAGE_W;
  const { cv, c } = blank(width, width * PAGE_RATIO);
  c.scale(s, s);
  for (const p of layout.pieces) p.draw(c, sheet);
  for (const sl of layout.slips) paintSlip(c, sl);
  return cv;
}

/** The back of a sheet: its name large, and what it is. */
export function paintBacks(d: WorldData, cellW: number): { canvas: HTMLCanvasElement; rects: [number, number, number, number][] } {
  const cellH = Math.round(cellW * PAGE_RATIO);
  const { cv, c } = blank(cellW * 2, cellH * 2);
  const rects: [number, number, number, number][] = [];
  const u = cellW / 700;
  d.sheets.forEach((sh, i) => {
    const ox = (i % 2) * cellW;
    const oy = Math.floor(i / 2) * cellH;
    rects.push([ox / (cellW * 2), oy / (cellH * 2), 0.5, 0.5]);
    c.save();
    c.translate(ox, oy);
    c.scale(u, u);
    const L = 56;
    text(c, sh.acronym, L - 6, 250, { font: font(640, 214), ink: FOIL, track: -9 });
    c.fillStyle = INK(150);
    c.fillRect(L, 300, 700 - L * 2, 1.5);
    const nameLines = wrap(c, sh.name, font(560, 46), 700 - L * 2);
    let y = 368;
    nameLines.forEach((ln) => {
      text(c, ln, L, y, { font: font(560, 46), track: -1 });
      y += 54;
    });
    y += 8;
    wrap(c, sh.blurb, font(400, 27), 700 - L * 2).forEach((ln) => {
      text(c, ln, L, y, { font: font(400, 27), ink: INK(70) });
      y += 38;
    });
    text(c, d.person.name, L, 842, { font: font(560, 24), ink: INK(40) });
    text(c, "Open PDF", 700 - L, 842, { font: font(560, 24), ink: FOIL, align: "right" });
    c.restore();
  });
  return { canvas: cv, rects };
}

export type AtlasEntry = [number, number, number, number];

/** Pack sharp copies of the pieces that grow. Returns uv rects by piece id. */
export function paintAtlas(layout: Layout, size: number, tall: number): { canvas: HTMLCanvasElement; rects: Map<string, AtlasEntry> } {
  const { cv, c } = blank(size, tall);
  const rects = new Map<string, AtlasEntry>();
  const big = layout.pieces.filter((p) => p.hi > 0).sort((a, b) => b.rect.h * b.hi - a.rect.h * a.hi);
  // Find the largest overall scale that fits, shelf by shelf.
  const place = (k: number) => {
    const spots: { p: Piece; x: number; y: number; s: number }[] = [];
    let x = 2;
    let y = 2;
    let shelf = 0;
    for (const p of big) {
      const s = p.hi * k;
      const w = p.rect.w * s;
      const h = p.rect.h * s;
      if (w + 4 > size) return null;
      if (x + w + 2 > size) {
        x = 2;
        y += shelf + 3;
        shelf = 0;
      }
      if (y + h + 2 > tall) return null;
      spots.push({ p, x, y, s });
      x += w + 3;
      shelf = Math.max(shelf, h);
    }
    return spots;
  };
  let k = 1;
  let spots = place(k);
  while (!spots && k > 0.2) {
    k *= 0.94;
    spots = place(k);
  }
  for (const sp of spots ?? []) {
    const r = sp.p.rect;
    c.save();
    c.translate(sp.x, sp.y);
    c.scale(sp.s, sp.s);
    c.translate(-r.x, -r.y);
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    sp.p.draw(c, 0);
    c.restore();
    rects.set(sp.p.id, [sp.x / size, sp.y / tall, (r.w * sp.s) / size, (r.h * sp.s) / tall]);
  }
  return { canvas: cv, rects };
}

/** Every skill word again, large, for the cloud. */
export function paintWords(layout: Layout, size: number): { canvas: HTMLCanvasElement; rects: Map<string, AtlasEntry> } {
  const { cv, c } = blank(size, size);
  const rects = new Map<string, AtlasEntry>();
  const place = (k: number) => {
    const spots: { sl: Slip; x: number; y: number }[] = [];
    let x = 2;
    let y = 2;
    const h = (layout.slips[0]?.rect.h ?? 26) * k;
    for (const sl of layout.slips) {
      const w = sl.rect.w * k;
      if (x + w + 2 > size) {
        x = 2;
        y += h + 3;
      }
      if (y + h + 2 > size) return null;
      spots.push({ sl, x, y });
      x += w + 3;
    }
    return spots;
  };
  let k = 3.2;
  let spots = place(k);
  while (!spots && k > 0.3) {
    k *= 0.95;
    spots = place(k);
  }
  for (const sp of spots ?? []) {
    const r = sp.sl.rect;
    c.save();
    c.translate(sp.x, sp.y);
    c.scale(k, k);
    c.translate(-r.x, -r.y);
    paintSlip(c, sp.sl);
    c.restore();
    rects.set(sp.sl.id, [sp.x / size, sp.y / size, (r.w * k) / size, (r.h * k) / size]);
  }
  return { canvas: cv, rects };
}
