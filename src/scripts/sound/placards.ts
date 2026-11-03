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
    subtitle: "Nine worlds, each with its own instruments · a landing at sunset, a night sky, one touch",
    lines: [
      "A ship crosses nine worlds, one for each chapter, and every scroll is a jump to the next. Each world sounds like itself: ignition, glass that counts, machines, four voices, felt piano.",
      "Each jump takes 1.4 seconds: a swell, a tape stop, a breath of silence, then the new world lands on the downbeat, in its own key and at its own pace.",
      "The landing comes down at sunset on low strings and a heartbeat, with the engine burning until it touches down.",
      "From there the sky falls to full night, and the music gets sparser and colder with it. The explorer walks down a metal ramp onto sand, in soft steps, while a wind sings in the key.",
      "The helmet comes off. You hear it from inside first, muffled, until the seal breaks and thin, cold air opens up.",
      "Four notes, D A G E, have followed you since launch. Under the Milky Way almost nothing plays, so when the hand touches the sapling, the D major chord is the one warm moment.",
    ],
  },
  projects: {
    number: "Movement I",
    title: "Fire and Hands",
    subtitle: "Struck wood and stone, plucked strings, glass, and one colour for each world · a star system, toured",
    lines: [
      "Before anything else, people made tools for each other. These projects are tools too, built for a dental practice.",
      "The system is the home key: a low drone like a fire, wood and stone struck by hand, and a plucked motif that gets one note closer to right on every pass.",
      "Each world has its own key and pace. Mirror answers every glass note with its reflection in the other ear. Ring turns slowly around you. Listener is two voices over a drum.",
      "Disk is a deep bowed pull. Geode breaks one chord across the room. Arch sweeps over 32 stones, up and over. Nets catches sparks on a climbing line. Comet has a long rushing tail.",
      "Flying between worlds, the rhythm holds and the new chord slides into tune, then lands on arrival. The belt at the end is sparse and rocky.",
      "Scroll inside a world and a swell of its chord follows your speed. Touch a part or a body and it answers with one note.",
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
    subtitle: "Marimba, nylon string, FM bell, a learning voice · a ring station, four bays, the years coming forward",
    lines: [
      "Four kinds of work, each with an instrument: a bell for AI, a nylon string for forward deployed, a voice for machine learning, a marimba for software.",
      "On the ring, one melody is split note by note between them, so the line turns around your head and only exists when they play together.",
      "Each bay gives one instrument the lead. The reading room streams bells, the dock runs out a string, the scanner turns two rings, the keel runs a wave. Its doors open and seal when you reach them.",
      "The machine learning voice changes its tone every bar, one step closer to a target, like a model training.",
      "The trail starts at 2017 with one bell in the dark. Every year forward has its own harmony and adds a player.",
      "Now is the home key, F major, with everyone playing. Turn the ring and you hear it turn, and it stops when you stop.",
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
  resume: {
    number: "Interlude",
    title: "Paper and Metal",
    subtitle: "Struck silver bars, drifting paper, a thin cold chord · monochrome, weightless, quiet",
    lines: [
      "A resume is the plainest thing anyone writes, so this is the plainest music on the site.",
      "It stays on the white keys of the piano, C major and its neighbours, with no colour added.",
      "The metal is a thin silver bar. The paper is soft air that flutters and turns.",
      "Each stop has its own chord, and the page comes apart in a flutter as the camera flies to the next one.",
      "Find a sheet and it drifts. Pick it and it snaps. Turn it and it rustles over in zero gravity.",
      "Sweep across the skills and they flutter like loose slips.",
    ],
  },
  demos: {
    number: "Interlude",
    title: "The Working Model",
    subtitle: "A clocked bass, soft keys, one line that climbs a step at a time · tight, dry, running",
    lines: [
      "A demo is a model running in front of you, so the music runs too.",
      "F sharp minor on a steady clock, in a small dry room, with a bass that ticks over on the eighths.",
      "Each step of a demo moves the line up one note and lands on the floor.",
      "Touch anything and it answers with a key of the current chord.",
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
  "06 Landing · Down through the atmosphere at sunset: low strings, a heartbeat, a roar of air, touchdown.",
  "07 The exit · The last of the sun and a high choir. Soft steps down a metal ramp, then sand.",
  "08 The helmet · Heard from inside, muffled, until the seal breaks. Dusk, thinner and colder.",
  "09 Connect · Full night and almost nothing, until the touch.",
];

/** The three scenes on the planet, for the "Now" line while they play. */
export const SCENE_LINES: Record<string, string> = {
  exit: "07 The exit · Six soft steps on the metal ramp, four on the sand, and one of the four notes on each step on the sand. A wind sings in F sharp and C sharp.",
  helmet: "08 The helmet · The seal hisses open, the sound opens wide, and a first breath of cold air. The four notes come from a long way off.",
  touch: "09 Connect · Under the Milky Way the chord has had no third, until the hand meets the sapling on a warm D major ninth. The theme falls home to D.",
};
