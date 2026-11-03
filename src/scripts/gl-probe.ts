// Can this browser run the 3D at all? Asking means making a whole WebGL context,
// which stops the page for a moment and counts against the browser's limit, so
// it is asked once a visit and the context is handed straight back.

let known: boolean | null = null;

export function hasWebGL2(): boolean {
  if (known !== null) return known;
  try {
    if (sessionStorage.getItem("gl2") === "1") return (known = true);
  } catch {
    /* private window: ask */
  }
  try {
    const g = document.createElement("canvas").getContext("webgl2");
    g?.getExtension("WEBGL_lose_context")?.loseContext();
    known = !!g;
  } catch {
    known = false;
  }
  if (known) {
    try {
      sessionStorage.setItem("gl2", "1");
    } catch {
      /* it is only a shortcut */
    }
  }
  return known;
}
