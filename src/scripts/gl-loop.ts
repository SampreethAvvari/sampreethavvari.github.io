// A loop count for fragment shaders that keeps a loop a loop on Windows.
//
// Behind WebGL on Windows sits Microsoft's shader compiler, through ANGLE. Given a
// loop with a fixed count it writes out every turn, each with its noise calls laid
// in full, and then optimises the lot: the Work world's nebula, 4 KB of source, took
// four seconds to link, with a blank world waiting on it. Given a count it cannot
// read ahead, it writes one loop, and the same nebula links in a fifth of a second.
//
// So on Windows the count gets a term the compiler cannot see through and that is
// never anything but zero, since a fragment's depth never passes 1. It draws exactly
// the same picture. Everywhere else the plain number goes through, and those shaders
// are the same text they always were.
//
// Fragment shaders only (gl_FragCoord), and only loops with no texture lookups or
// fwidth inside: a count that varies by pixel rules those out.

const WINDOWS = typeof navigator !== "undefined" && /Windows/.test(navigator.userAgent);

export const loopCount = (n: number | string): string => (WINDOWS ? `(${n} + int(gl_FragCoord.z > 2.0))` : String(n));
