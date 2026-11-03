// Star shapes for a post's constellation, the same real constellations the
// Writing sky uses, so a tag keeps the look it has there. Plain data, read by
// the page at build time.

export type Shape = { pts: Array<[number, number]>; edges: Array<[number, number]>; aspect: number };

export const SHAPES: Record<string, Shape> = {
  scorpius: {
    aspect: 0.95,
    pts: [[0.1, 0.08], [0.18, 0.2], [0.04, 0.3], [0.26, 0.3], [0.34, 0.38], [0.4, 0.47], [0.43, 0.57], [0.45, 0.67], [0.48, 0.77], [0.54, 0.85], [0.62, 0.91], [0.72, 0.93], [0.8, 0.88], [0.86, 0.8], [0.82, 0.71], [0.22, 0.09]],
    edges: [[0, 1], [2, 1], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [15, 3]],
  },
  orion: {
    aspect: 0.8,
    pts: [[0.2, 0.12], [0.78, 0.18], [0.42, 0.5], [0.5, 0.52], [0.58, 0.54], [0.26, 0.95], [0.8, 0.9], [0.5, 0.0], [0.5, 0.7], [0.94, 0.32]],
    edges: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [7, 1], [3, 8], [1, 9]],
  },
  dipper: {
    aspect: 1.7,
    pts: [[0.92, 0.28], [0.88, 0.66], [0.58, 0.72], [0.54, 0.4], [0.37, 0.28], [0.2, 0.2], [0.03, 0.32]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  cygnus: {
    aspect: 1.0,
    pts: [[0.5, 0.0], [0.5, 0.38], [0.5, 1.0], [0.06, 0.22], [0.94, 0.5], [0.5, 0.68]],
    edges: [[0, 1], [1, 5], [5, 2], [3, 1], [1, 4]],
  },
  cassiopeia: {
    aspect: 1.7,
    pts: [[0.0, 0.3], [0.25, 0.82], [0.5, 0.42], [0.75, 0.92], [1.0, 0.22]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  crux: {
    aspect: 0.8,
    pts: [[0.5, 0.0], [0.5, 1.0], [0.1, 0.42], [0.9, 0.56]],
    edges: [[0, 1], [2, 3]],
  },
  lyra: {
    aspect: 0.75,
    pts: [[0.18, 0.0], [0.4, 0.32], [0.78, 0.42], [0.64, 0.94], [0.28, 0.82]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]],
  },
  triangulum: {
    aspect: 1.25,
    pts: [[0.0, 0.78], [0.55, 0.0], [1.0, 0.64]],
    edges: [[0, 1], [1, 2], [2, 0]],
  },
  pair: { aspect: 1.4, pts: [[0.1, 0.7], [0.9, 0.3]], edges: [[0, 1]] },
  single: { aspect: 1, pts: [[0.5, 0.5]], edges: [] },
};

export function shapeFor(n: number): Shape {
  if (n >= 11) return SHAPES.scorpius;
  if (n >= 8) return SHAPES.orion;
  if (n === 7) return SHAPES.dipper;
  if (n === 6) return SHAPES.cygnus;
  if (n === 5) return SHAPES.cassiopeia;
  if (n === 4) return SHAPES.crux;
  if (n === 3) return SHAPES.triangulum;
  if (n === 2) return SHAPES.pair;
  return SHAPES.single;
}

export const hash01 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};
