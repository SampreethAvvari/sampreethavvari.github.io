import type { Architecture } from "../types";
import svg from "../svg/magic-hour.svg?raw";

// Sources: the public repo SampreethAvvari/previz at its newest ref (paths
// below are relative to it), and the portfolio git stats for dates and times.
const arch: Architecture = {
  slug: "magic-hour",
  rank: 160,
  status: "preview",
  statusNote: "Demo day build, not running now",
  name: "Magic Hour",
  project: "Magic Hour",
  kind: "system",
  disciplines: ["aie", "sde"],
  post: "/posts/magic-hour",
  headline: "Storyboards that keep each face the same.",
  tail: "Every frame carries its score.",
  lede:
    "A filmmaker asks for a shot, and one FastAPI service pulls the character's frozen card and reference sheet from an in memory story bible and sends them to Nano Banana. A referee crops the face out of the new frame, embeds it and scores it against the sheet, and the frame is saved with that score on it.",
  titleBlock: [
    ["System", "Magic Hour"],
    ["Revision", "unversioned"],
    ["Live since", "Jul 25, 2026, demo day"],
    ["Runs on", "Cloud Run, Vertex AI"],
    ["Region", "us-central1"],
    ["Clock", "11:06 to 15:30"],
    ["Checked", "Face 0.35, voice 0.62"],
    ["Deploy", "Smoke test first"],
    ["Scale", "1 sheet : every frame"],
    ["Drawn by", "S. Avvari"],
  ],
  readouts: [
    { value: "30", unit: "s", label: "a frame from Nano Banana, on a Vertex project shared with every team in the room" },
    { value: "60", unit: "renders", label: "per story at most, counted on the server so a loop bug cannot spend the budget" },
    { value: "170", unit: "min", label: "from the first commit at 11:06 to live on Cloud Run at 13:56" },
    { value: "0.48", label: "cosine between two different people's sheets on whole frames, which is why the referee crops the face first" },
  ],
  svg,
  views: [
    { id: "one-shot", label: "One shot, refereed", focus: ["studio", "app", "nanobanana", "referee", "embed", "frames"], note: "Nano Banana draws the frame from the locked sheet, then the referee crops the face, embeds it and scores it." },
    { id: "continuity", label: "The continuity layer", focus: ["app", "bible", "graph", "pack"], note: "Cards are compiled once and stored. The pack injects them verbatim, with what each character knows by this scene." },
    { id: "words-first", label: "Words before pictures", focus: ["studio", "app", "pack", "gemini"], note: "Gemini Pro plans the shot list in text from the pack before any image is paid for." },
    { id: "offline", label: "Network unplugged", focus: ["nanobanana", "referee", "frames"], note: "Every frame is written to disk, and the committed demo set loads with no model call at all." },
  ],
  parts: {
    filmmaker: {
      kind: "People",
      owner: "outside",
      what: "The writer or director. They import a screenplay as a PDF or pasted text, answer the character interview, and ask for shots, retakes and small tweaks like more rain.",
      source: "backend/app/api/board.py:346",
    },
    studio: {
      kind: "My app",
      owner: "mine",
      what: "The studio shell, served by the same process, one tab per tool. Every generating call streams events in one envelope, so the client has a single parser. A Trace tab shows the exact context each model call received.",
      source: "backend/app/sse.py:102",
    },
    app: {
      kind: "My service",
      owner: "mine",
      what: "One FastAPI process on Cloud Run, held at one warm instance because the story lives in its memory. Each tab is one router, mounted inside a try/except so a half finished tab cannot stop the boot.",
      fails: "A new revision deploys with no traffic, gets a smoke test on its own tagged URL, and only then takes traffic. If the smoke fails, the previous revision keeps serving.",
      source: "scripts/deploy.sh:113",
    },
    gemini: {
      kind: "Vertex AI",
      owner: "managed",
      what: "Gemini 2.5 Pro compiles each Voice Card once and plans shot lists. Gemini 2.5 Flash compiles Identity Cards, speaks each character's lines with thinking off, and finds the face box for the referee.",
      source: "backend/app/voice.py:29",
    },
    nanobanana: {
      kind: "Vertex AI",
      owner: "managed",
      what: "gemini-2.5-flash-image. Each frame gets the style preset, every present character's card text verbatim, their reference sheets and the previous frame of the scene. About 30 seconds a frame.",
      fails: "On a 429 it waits 2, 4 and 8 seconds and tries again. After the fourth try the shot is marked failed and the rest of the scene keeps going.",
      source: "backend/app/consistency.py:140",
    },
    referee: {
      kind: "My module",
      owner: "mine",
      what: "Crops the face from the new frame, embeds the crop and takes the cosine against the same crop from the reference sheet. Below 0.35 the shot is redrawn once with a stronger instruction, then flagged.",
      fails: "No face in the frame, or no sheet for the character: the frame shows no score instead of a number.",
      source: "backend/app/consistency.py:343",
    },
    embed: {
      kind: "Vertex AI",
      owner: "managed",
      what: "multimodalembedding@001 for face crops, called over REST because the SDK sends it the wrong shape. text-embedding-005 for dialogue lines and bible chunks.",
      fails: "If text embeddings fail, chunks stay searchable by token overlap, so retrieval gets worse instead of breaking.",
      source: "backend/app/consistency.py:300",
    },
    bible: {
      kind: "My store",
      owner: "mine",
      what: "Characters, scenes, shots and their compiled cards, kept in memory and shaped like the planned Postgres schema. A card is written once per canon version and reused word for word. Agents only propose facts, and a person promotes them to canon.",
      source: "backend/app/store.py:183",
    },
    pack: {
      kind: "My module",
      owner: "mine",
      what: "build_pack assembles the context for model calls: the style card, the story spine, each character's cards with what they know by this scene, and search hits. Every slot has a budget, and style and cast are never dropped.",
      source: "backend/app/bible.py:310",
    },
    graph: {
      kind: "My module",
      owner: "mine",
      what: "Typed, scene stamped edges such as knows, lying_to and owes. horizon() returns what a character knows as of a scene, following implies edges, so nobody mentions a fact they have not learned.",
      source: "backend/app/graph.py:224",
    },
    frames: {
      kind: "My cache",
      owner: "mine",
      what: "Every frame is written to disk and served back to the board, with its score stored on the shot. Frames for the demo story are committed to the repo, so the board loads with no model call.",
      source: "backend/app/images.py:53",
    },
  },
  breaks: [
    { title: "Vertex answers 429", body: "The lab project was shared with every team in the room, so backoff is built in: 2, 4 and 8 seconds, then the shot is marked failed.", source: "backend/app/consistency.py:140" },
    { title: "A face drifts", body: "The shot is redrawn once with a stronger instruction. If it still scores under 0.35, it is flagged on the board instead of retried again.", source: "backend/app/consistency.py:362" },
    { title: "A tab fails to import", body: "The API mounts inside a try/except, so the app still boots, serves its screens and reports the error on its health check.", source: "backend/app/main.py:64" },
  ],
  tuned: [
    { title: "Crop before you embed", body: "Whole frame embeddings scored two different people's sheets at 0.48. A Gemini face box crop first leaves the identity signal.", source: "backend/app/consistency.py:257" },
    { title: "Thinking where it pays", body: "Voice Cards are compiled once on Gemini 2.5 Pro, which always reasons. Lines are spoken on Flash with thinking off, because a character does not deliberate before speaking.", source: "backend/app/voice.py:29" },
    { title: "Search in numpy", body: "About 50 chunks, so a full cosine scan in numpy, fused with token overlap by reciprocal rank so names and sluglines still match.", source: "backend/app/bible.py:142" },
  ],
  guards: [
    { title: "A hard render cap", body: "60 renders per story, counted on the server before each one, so a loop bug cannot spend the budget.", source: "backend/app/api/board.py:38" },
    { title: "Canon needs a person", body: "The Archivist only proposes facts, with its reasoning attached. Nothing becomes canon until someone promotes it.", source: "backend/app/extract.py:7" },
    { title: "The voice bar", body: "A line must score 0.62 against its character's fingerprint, set between the best impostor line at 0.613 and the worst real one at 0.647.", source: "backend/app/voice.py:46" },
  ],
  // The lab project's billing is not in the portfolio billing export.
  cost: null,
  live: {
    mode: "event",
    label: "A shot request",
    everySeconds: 14,
    path: ["filmmaker", "studio", "app", "pack", "bible", "pack", "app", "nanobanana", "referee", "embed", "referee", "frames"],
    source: "a filmmaker asks the Board tab to render a shot",
  },
};

export default arch;
