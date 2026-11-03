// The wall labels for the score: one per tab, read from the "i" beside the
// sound toggle. Plain sentences, the way a gallery label reads.
import type { MovementId } from "./ids";

export const SUITE = "Breath to Orbit";

export interface Placard {
  number: string;
  title: string;
  subtitle: string;
  lines: string[];
}

export const PLACARDS: Record<MovementId, Placard> = {
  home: {
    number: "Overture",
    title: "The Long Flight",
    subtitle: "Nine worlds, each with its own instruments · a landing under a red eclipse, one touch",
    lines: [
      "A ship crosses nine worlds, one for each chapter, and every scroll is a jump to the next. Each world sounds like itself: ignition, glass that counts, machines, four voices, felt piano.",
      "The music runs at 85.7 beats a minute, so each 1.4 second jump is exactly two beats: a swell, a tape stop, a breath of silence, then the new world lands on the downbeat.",
      "The landing comes down through a red eclipse on low strings and a heartbeat, and touches down eight beats later.",
      "On the planet the explorer steps out under a violet galaxy: footsteps, suit servos, a wind that sings in the key.",
      "The helmet comes off. You hear it from inside first, muffled, until the seal breaks and the world opens wide with the theme at its fullest.",
      "Four notes, D A G E, have followed you since launch. When the hand touches the sapling they come to rest on a warm D major chord, and a shimmer stays.",
    ],
  },
  projects: {
    number: "Movement I",
    title: "Fire and Hands",
    subtitle: "Struck wood and stone, plucked gut strings, a low drone · close, earthy, steady",
    lines: [
      "Before anything else, people made tools for each other. These projects are tools too, used every day at a dental practice.",
      "The drum is wood and stone struck by hand, a little uneven on purpose, the way hands are.",
      "A plucked string plays a short motif that starts rough and gets one note closer to right on every pass.",
      "A Dorian: a minor key with a raised sixth that keeps it hopeful.",
      "The room is small and close, like a cave lit by a fire. The low drone in the middle never stops.",
      "Click anything and you strike a stone, tuned to the chord that is playing.",
    ],
  },
  architecture: {
    number: "Movement II",
    title: "The Machine, Drawn First",
    subtitle: "Glass tones, a seven beat arpeggio, echoes between fixed points · precise, cool, open",
    lines: [
      "Every machine was a drawing first. This movement is the drawing.",
      "The chords are stacked in fourths, an even geometry with nothing sweet added, and they slide from shape to shape.",
      "A glass line traces each chord in sevens (two, two, three), so it never lands the same way twice in a row.",
      "Each phrase sits at a fixed point around you, like a box on a diagram, and an echo carries it across the room the way a request travels between services.",
      "Focus a system and it gets its own short motif, drawn from its name. Busy traffic fills the gaps with soft glass.",
      "On headphones you can follow the line from point to point.",
    ],
  },
  work: {
    number: "Movement III",
    title: "Four Crafts, One Line",
    subtitle: "Marimba, nylon string, FM bell, a learning voice · four corners, one melody",
    lines: [
      "Four kinds of work: AI engineering, forward deployed engineering, machine learning, software engineering.",
      "Each has an instrument and a corner of the room: marimba for software, nylon string for forward deployed, a bell for AI, a voice for machine learning.",
      "No single instrument plays the melody. It is split note by note between the four, so the line turns around your head.",
      "The machine learning voice changes its tone every bar, one step closer to a target, like a model training.",
      "F major with added ninths, warm and unhurried.",
      "It only sounds like one line because the four parts listen to each other.",
    ],
  },
  writing: {
    number: "Movement IV",
    title: "First Signals",
    subtitle: "Felt piano, a distant two note signal, the air of a quiet room · patient, like reading at night",
    lines: [
      "Writing began as marks that carried a thought to someone who was not in the room.",
      "The piano speaks in sentences. It rises, falls, ends on a comma or a full stop, then leaves a breath of silence.",
      "Far behind you, two notes repeat every few bars, like a light across water.",
      "G major moving through E minor, C and D, the plainest progression there is, chosen for that.",
      "In the sky of posts each star is a glass chime, so tracing a constellation plays its melody, and every constellation has a chord of its own.",
      "These are case studies. The music asks you to take your time.",
    ],
  },
  film: {
    number: "Movement V",
    title: "Night Fire",
    subtitle: "Bowed low strings, a heartbeat, a far bell, low drums · dark, red, close",
    lines: [
      "The oldest stories were told at night around a fire, and most of them were about danger.",
      "The bass walks down C, B flat, A flat, G, the lament line that has carried grief in music for four hundred years.",
      "A second string leans on semitones, and the middle section slips to D flat, the note that makes a scene feel wrong.",
      "A heartbeat sits underneath at 52 beats a minute. Scroll and it quickens.",
      "The hall is long and dark. High sounds are absorbed, so everything feels close and far at once.",
      "When a clip plays with its own sound, the score steps back and waits.",
    ],
  },
  mind: {
    number: "Movement VI",
    title: "Leaving the Ground",
    subtitle: "Bells as stars, a wide choir, an endless rising shimmer · weightless, very wide, slow",
    lines: [
      "This page is a map of everything built, so the music leaves the ground.",
      "Each bell is a star. It appears somewhere around you, above or behind, rings and fades.",
      "Now and then a tone glides from one star to another while it travels between them, drawing the line.",
      "B Lydian, the brightest mode. Its raised fourth never quite settles, which is how open space feels.",
      "Underneath, a shimmer rises forever without getting higher, an old trick of the ear.",
      "The room has no walls and no echo, only a long bloom. Headphones give the sky its depth.",
    ],
  },
  teaching: {
    number: "Movement VII",
    title: "Memory, Handed On",
    subtitle: "Celesta, music box, a low choir · call and response, small and warm",
    lines: [
      "The last movement looks back. What we learn is only kept by handing it on.",
      "A celesta on the left plays a short phrase. A music box on the right answers, almost the same.",
      "Sometimes the answer has a wrong note, and the next time it is put right. That is what learning sounds like.",
      "Then the two play together, a third apart.",
      "In the closing bars the roles turn: the student leads and the teacher answers.",
      "E flat major in a small warm room. Before each lesson a phrase plays backwards, like a memory rewinding.",
    ],
  },
};

/** What the home flight is playing in each world, for the label's "Now" line. */
export const CHAPTER_LINES: string[] = [
  "01 Launch · Ignition: a low rumble opens and an organ's open fifth rises an octave. A breath, a heartbeat.",
  "02 In numbers · Glass pulses count upward, one more each bar, bouncing from ear to ear.",
  "03 The work · Two machines interlock, three beats against four, over a low engine that pumps in eighths.",
  "04 Four ways in · Four instruments at four corners pass one line around your head.",
  "05 Writing · The theme in full on a felt piano, with the air of paper behind it.",
  "06 Landing · Down through the atmosphere under a red eclipse: low strings, a heartbeat, a roar of air, touchdown.",
  "07 The exit · A violet night and a cosmic choir. First footsteps off the ramp.",
  "08 The helmet · Heard from inside, muffled, until the seal breaks and the world opens.",
  "09 Connect · Everything hushes for the touch.",
];

/** The three scenes on the planet, for the "Now" line while they play. */
export const SCENE_LINES: Record<string, string> = {
  exit: "07 The exit · Footsteps off the ramp, the suit's servos, a wind that sings in F sharp and C sharp. Far ahead, the four notes.",
  helmet: "08 The helmet · The seal hisses open, a first breath of open air, and the theme plays at its fullest as the sound opens wide.",
  touch: "09 Connect · The hand meets the sapling on a warm D major ninth; the theme falls home to D, and a shimmer keeps living.",
};
