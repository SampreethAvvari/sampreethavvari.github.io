// Client for the sampreeth-teaching Cloudflare Worker. Every call is fail-open:
// if PUBLIC_TEACHING_API is unset or the request fails, it returns null and the
// UI degrades gracefully (counts show "—", downloads still work).
const API = import.meta.env.PUBLIC_TEACHING_API as string | undefined;

export type Stat = {
  views: number;
  downloads: number;
  ratingAvg: number;
  ratingCount: number;
};

async function post(path: string, body: object): Promise<any | null> {
  if (!API) return null;
  try {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function getStats(): Promise<Record<string, Stat> | null> {
  if (!API) return null;
  try {
    const r = await fetch(`${API}/stats`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function getStat(slug: string): Promise<Stat | null> {
  if (!API) return null;
  try {
    const r = await fetch(`${API}/stats?slug=${encodeURIComponent(slug)}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export const postView = (slug: string) => post("/view", { slug });
export const postDownload = (slug: string) => post("/download", { slug });
export const postReview = (slug: string, rating: number, feedback: string) =>
  post("/review", { slug, rating, feedback }) as Promise<{
    downloads: number;
    ratingAvg: number;
    ratingCount: number;
  } | null>;

export const isConfigured = !!API;
