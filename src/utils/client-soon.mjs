// client:soon, for the islands on every page (the nav, the chat, back to top).
//
// React goes to the back of the queue: an island wakes once the page's own scripts
// have run and the browser has a moment, or at the latest a second and a half after
// that, so a busy 3D scene can never starve it. Its links work before then, being
// real links. A press on one of its buttons wakes it at once, and the press is passed
// on when it is awake, so nothing a visitor taps is ever lost.
export default (load, _options, el) => {
  let awake = false;
  let press = null;

  const wake = async () => {
    if (awake) return;
    awake = true;
    el.removeEventListener("click", onPress, true);
    const hydrate = await load();
    await hydrate();
    press?.click();
  };

  function onPress(e) {
    const button = e.target.closest?.("button");
    if (!button) return; // a link goes where it goes, with or without React
    e.preventDefault();
    e.stopPropagation();
    press = button;
    wake();
  }
  el.addEventListener("click", onPress, true);

  const soon = () => {
    if ("requestIdleCallback" in window) requestIdleCallback(wake, { timeout: 1500 });
    else setTimeout(wake, 300);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", soon, { once: true });
  else soon();
};
