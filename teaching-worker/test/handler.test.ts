import { describe, test, expect, vi, afterEach } from "vitest";
import { handleRequest, sendFeedbackEmail, type Env } from "../src/handler";

const ORIGIN = "https://sampreethavvari.github.io";

// --- Fake D1 -------------------------------------------------------------
// A tiny in-memory simulation of the exact statements the handler issues.
// We do NOT run real SQLite — we match on SQL substrings and mutate plain JS
// state keyed by slug, which is enough to assert increments and aggregates.
interface MaterialRow { slug: string; views: number; downloads: number }
interface ReviewRow { slug: string; rating: number; feedback: string }

class FakeDB {
  materials = new Map<string, MaterialRow>();
  reviews: ReviewRow[] = [];

  private material(slug: string): MaterialRow {
    let row = this.materials.get(slug);
    if (!row) {
      row = { slug, views: 0, downloads: 0 };
      this.materials.set(slug, row);
    }
    return row;
  }

  private aggFor(slug: string) {
    const m = this.materials.get(slug);
    const reviews = this.reviews.filter((r) => r.slug === slug);
    const ratingCount = reviews.length;
    const ratingAvg =
      ratingCount === 0
        ? 0
        : Math.round((reviews.reduce((s, r) => s + r.rating, 0) / ratingCount) * 100) / 100;
    return {
      slug,
      views: m?.views ?? 0,
      downloads: m?.downloads ?? 0,
      ratingAvg,
      ratingCount,
    };
  }

  prepare(sql: string) {
    const db = this;
    let args: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) {
        args = a;
        return stmt;
      },
      async run() {
        if (sql.includes("views = views + 1")) {
          db.material(String(args[0])).views += 1;
        } else if (sql.includes("downloads = downloads + 1")) {
          db.material(String(args[0])).downloads += 1;
        } else if (sql.includes("INSERT INTO reviews")) {
          db.reviews.push({
            slug: String(args[0]),
            rating: Number(args[1]),
            feedback: String(args[2]),
          });
        }
        return { success: true };
      },
      async first<T>() {
        // Single-slug aggregate query.
        if (sql.includes("AVG(rating)") && sql.includes("WHERE m.slug = ?")) {
          if (!db.materials.has(String(args[0]))) return null as unknown as T;
          return db.aggFor(String(args[0])) as unknown as T;
        }
        return null as unknown as T;
      },
      async all<T>() {
        // All-materials aggregate query (no WHERE on m.slug).
        if (sql.includes("AVG(rating)") && !sql.includes("WHERE m.slug = ?")) {
          const results = [...db.materials.keys()].map((slug) => db.aggFor(slug));
          return { results: results as unknown as T[], success: true };
        }
        return { results: [] as T[], success: true };
      },
    };
    return stmt;
  }
}

function makeEnv(overrides: Partial<Env> & { db?: FakeDB } = {}): Env {
  const db = overrides.db ?? new FakeDB();
  return {
    TEACHING_DB: db as unknown as D1Database,
    ALLOWED_ORIGINS: "https://sampreethavvari.github.io,http://localhost:4321",
    FEEDBACK_TO: "spa9659@nyu.edu",
    RESEND_API_KEY: "test-resend-key",
    ...overrides,
  };
}

function postRequest(path: string, payload: unknown, init: RequestInit = {}): Request {
  return new Request(`https://worker.example.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(init.headers ?? {}) },
    body: JSON.stringify(payload),
    ...init,
  });
}

function getRequest(path: string): Request {
  return new Request(`https://worker.example.com${path}`, {
    method: "GET",
    headers: { Origin: ORIGIN },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("teaching handler — counters", () => {
  test("/view increments views and returns the new count", async () => {
    const env = makeEnv();
    const slug = "lecture-1";

    let res = await handleRequest(postRequest("/view", { slug }), env);
    expect(res.status).toBe(200);
    let body = (await res.json()) as { views: number; downloads: number };
    expect(body.views).toBe(1);
    expect(body.downloads).toBe(0);

    res = await handleRequest(postRequest("/view", { slug }), env);
    body = (await res.json()) as { views: number; downloads: number };
    expect(body.views).toBe(2);
  });

  test("/download increments downloads", async () => {
    const env = makeEnv();
    const slug = "syllabus";

    let res = await handleRequest(postRequest("/download", { slug }), env);
    expect(res.status).toBe(200);
    let body = (await res.json()) as { downloads: number };
    expect(body.downloads).toBe(1);

    res = await handleRequest(postRequest("/download", { slug }), env);
    body = (await res.json()) as { downloads: number };
    expect(body.downloads).toBe(2);
  });

  test("/view with a missing slug returns 400", async () => {
    const env = makeEnv();
    const res = await handleRequest(postRequest("/view", { foo: "bar" }), env);
    expect(res.status).toBe(400);
  });
});

describe("teaching handler — reviews", () => {
  test("/review with rating 0 returns 400", async () => {
    const env = makeEnv();
    const res = await handleRequest(
      postRequest("/review", { slug: "x", rating: 0, feedback: "ok" }),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/rating/i);
  });

  test("/review with rating 6 returns 400", async () => {
    const env = makeEnv();
    const res = await handleRequest(
      postRequest("/review", { slug: "x", rating: 6, feedback: "ok" }),
      env,
    );
    expect(res.status).toBe(400);
  });

  test("/review with empty feedback returns 400", async () => {
    const env = makeEnv();
    const res = await handleRequest(
      postRequest("/review", { slug: "x", rating: 4, feedback: "   " }),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/feedback/i);
  });

  test("/review valid inserts review, increments downloads, returns aggregates, emails", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const db = new FakeDB();
    const env = makeEnv({ db });
    const slug = "great-notes";

    const res = await handleRequest(
      postRequest("/review", { slug, rating: 5, feedback: "Loved it!" }),
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      downloads: number;
      ratingAvg: number;
      ratingCount: number;
    };
    expect(body.downloads).toBe(1); // review implies one download
    expect(body.ratingAvg).toBe(5);
    expect(body.ratingCount).toBe(1);

    // Review actually persisted.
    expect(db.reviews).toHaveLength(1);
    expect(db.reviews[0]).toMatchObject({ slug, rating: 5, feedback: "Loved it!" });

    // Resend was called exactly once with the right endpoint + auth.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [resendUrl, resendInit] = fetchMock.mock.calls[0];
    expect(resendUrl).toBe("https://api.resend.com/emails");
    expect((resendInit!.headers as Record<string, string>).Authorization).toContain("test-resend-key");
  });

  test("/review averages ratings across multiple reviews", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const env = makeEnv();
    const slug = "mixed";

    await handleRequest(postRequest("/review", { slug, rating: 4, feedback: "good" }), env);
    const res = await handleRequest(
      postRequest("/review", { slug, rating: 5, feedback: "great" }),
      env,
    );
    const body = (await res.json()) as { ratingAvg: number; ratingCount: number };
    expect(body.ratingCount).toBe(2);
    expect(body.ratingAvg).toBe(4.5);
  });

  test("/review still returns 200 when the Resend fetch throws (email non-fatal)", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("resend down");
    });
    vi.stubGlobal("fetch", fetchMock);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const db = new FakeDB();
    const env = makeEnv({ db });
    const slug = "resilient";

    const res = await handleRequest(
      postRequest("/review", { slug, rating: 3, feedback: "fine" }),
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ratingCount: number };
    expect(body.ratingCount).toBe(1);
    // The review was still saved despite the email failing.
    expect(db.reviews).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled();
  });

  test("sendFeedbackEmail is skipped (no fetch) when RESEND_API_KEY is absent", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const env = makeEnv({ RESEND_API_KEY: undefined });
    await sendFeedbackEmail(env, { slug: "x", rating: 5, feedback: "hi" });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("teaching handler — stats", () => {
  test("/stats?slug= returns aggregates for a known slug", async () => {
    const env = makeEnv();
    const slug = "popular";

    await handleRequest(postRequest("/view", { slug }), env);
    await handleRequest(postRequest("/view", { slug }), env);
    await handleRequest(postRequest("/download", { slug }), env);

    const res = await handleRequest(getRequest(`/stats?slug=${slug}`), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      views: number;
      downloads: number;
      ratingAvg: number;
      ratingCount: number;
    };
    expect(body.views).toBe(2);
    expect(body.downloads).toBe(1);
    expect(body.ratingAvg).toBe(0);
    expect(body.ratingCount).toBe(0);
  });

  test("/stats?slug= for an unknown slug returns zeros", async () => {
    const env = makeEnv();
    const res = await handleRequest(getRequest("/stats?slug=does-not-exist"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      views: number;
      downloads: number;
      ratingAvg: number;
      ratingCount: number;
    };
    expect(body).toEqual({ views: 0, downloads: 0, ratingAvg: 0, ratingCount: 0 });
  });

  test("/stats (no slug) returns an object keyed by slug for all materials", async () => {
    const env = makeEnv();

    await handleRequest(postRequest("/view", { slug: "a" }), env);
    await handleRequest(postRequest("/download", { slug: "b" }), env);

    const res = await handleRequest(getRequest("/stats"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<
      string,
      { views: number; downloads: number; ratingAvg: number; ratingCount: number }
    >;
    expect(Object.keys(body).sort()).toEqual(["a", "b"]);
    expect(body.a.views).toBe(1);
    expect(body.b.downloads).toBe(1);
  });
});

describe("teaching handler — plumbing", () => {
  test("OPTIONS preflight returns 204 with CORS headers for an allowed origin", async () => {
    const req = new Request("https://worker.example.com/view", {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    const res = await handleRequest(req, makeEnv());

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Headers")?.toLowerCase()).toContain("content-type");
  });

  test("OPTIONS preflight from a disallowed origin omits the allow header", async () => {
    const req = new Request("https://worker.example.com/view", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example.com", "Access-Control-Request-Method": "POST" },
    });

    const res = await handleRequest(req, makeEnv());

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("unknown route returns 404 JSON with CORS headers", async () => {
    const env = makeEnv();
    const res = await handleRequest(postRequest("/nope", { slug: "x" }), env);
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  test("POST with non-JSON body returns 400", async () => {
    const env = makeEnv();
    const req = new Request("https://worker.example.com/view", {
      method: "POST",
      headers: { "Content-Type": "text/plain", Origin: ORIGIN },
      body: "not json",
    });
    const res = await handleRequest(req, env);
    expect(res.status).toBe(400);
  });

  test("responses carry the Access-Control-Allow-Origin for the allowed caller", async () => {
    const env = makeEnv();
    const res = await handleRequest(postRequest("/view", { slug: "x" }), env);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });
});
