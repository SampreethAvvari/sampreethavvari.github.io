import { DurableObject } from "cloudflare:workers";

// One small object per visitor IP keeps an exact count of their recent
// questions, wherever on Cloudflare each request lands.
export class RateGate extends DurableObject {
  private times: number[] = [];

  async hit(limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    this.times = this.times.filter((t) => now - t < windowMs);
    if (this.times.length >= limit) return false;
    this.times.push(now);
    return true;
  }
}
