// Distance fields for the Resume world, away from the page's main thread.
import { fieldFromPixels } from "./field-math";

type Job = { id: number; pixels: Uint8ClampedArray; w: number; h: number; spread: number };

const scope = self as unknown as {
  postMessage: (m: unknown, transfer: Transferable[]) => void;
  onmessage: ((e: MessageEvent<Job>) => void) | null;
};

scope.onmessage = (e) => {
  const { id, pixels, w, h, spread } = e.data;
  const data = fieldFromPixels(pixels, w, h, spread);
  scope.postMessage({ id, data }, [data.buffer]);
};
