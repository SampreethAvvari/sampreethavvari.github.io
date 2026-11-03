// Where an element sits by layout alone. When a page arrives every block flies
// in, scaled and moved by an animation, and getBoundingClientRect reports that
// moment: anything measured then and kept would stay wrong. Offsets ignore
// transforms, so this gives the place the element comes to rest in.

export function layoutBox(el: HTMLElement, within: Element | null = null) {
  let left = 0;
  let top = 0;
  let n: HTMLElement | null = el;
  while (n && n !== within) {
    left += n.offsetLeft;
    top += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { left, top, width: el.offsetWidth, height: el.offsetHeight };
}
