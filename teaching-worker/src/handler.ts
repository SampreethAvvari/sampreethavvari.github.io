export interface Env {
  TEACHING_DB: D1Database;
  ALLOWED_ORIGINS?: string;
  FEEDBACK_TO?: string;
  // RESEND_API_KEY is a Worker SECRET (set via `wrangler secret put RESEND_API_KEY`),
  // not a [vars] entry. Email is skipped when it (or FEEDBACK_TO) is absent.
  RESEND_API_KEY?: string;
}

// Aggregate stats for a single material. Materials with no row read as zeros.
interface Stats {
  views: number;
  downloads: number;
  ratingAvg: number;
  ratingCount: number;
}

// Shared aggregate: views + downloads from `materials`, plus rounded AVG(rating)
// and COUNT(*) from `reviews`, for one slug. COALESCE makes a slug with no
// reviews read as 0/0 rather than NULL.
const AGG_FOR_SLUG_SQL =
  "SELECT m.views, m.downloads, " +
  "COALESCE((SELECT ROUND(AVG(rating),2) FROM reviews r WHERE r.slug=m.slug),0) AS ratingAvg, " +
  "COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.slug=m.slug),0) AS ratingCount " +
  "FROM materials m WHERE m.slug = ?";

const VIEW_UPSERT_SQL =
  "INSERT INTO materials (slug, views) VALUES (?, 1) " +
  "ON CONFLICT(slug) DO UPDATE SET views = views + 1";

const DOWNLOAD_UPSERT_SQL =
  "INSERT INTO materials (slug, downloads) VALUES (?, 1) " +
  "ON CONFLICT(slug) DO UPDATE SET downloads = downloads + 1";

const INSERT_REVIEW_SQL =
  "INSERT INTO reviews (slug, rating, feedback) VALUES (?, ?, ?)";

function parseAllowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeadersFor(origin: string | null, env: Env): Record<string, string> {
  const allowed = parseAllowedOrigins(env);
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  origin: string | null,
  env: Env,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeadersFor(origin, env),
    },
  });
}

function zeroStats(): Stats {
  return { views: 0, downloads: 0, ratingAvg: 0, ratingCount: 0 };
}

function rowToStats(row: Record<string, unknown> | null | undefined): Stats {
  if (!row) return zeroStats();
  return {
    views: Number(row.views ?? 0),
    downloads: Number(row.downloads ?? 0),
    ratingAvg: Number(row.ratingAvg ?? 0),
    ratingCount: Number(row.ratingCount ?? 0),
  };
}

// Read the full aggregate row for one slug. Returns zeros when no material row
// exists yet (so /stats?slug=X is always safe to call).
async function aggregateForSlug(env: Env, slug: string): Promise<Stats> {
  const row = await env.TEACHING_DB.prepare(AGG_FOR_SLUG_SQL)
    .bind(slug)
    .first<Record<string, unknown>>();
  return rowToStats(row);
}

/**
 * Send the feedback email via Resend. No-ops silently when the API key or
 * destination is not configured. Calls `globalThis.fetch` so tests can stub it.
 * Errors propagate to the caller, which wraps this in try/catch so an email
 * failure can never fail the request.
 */
export async function sendFeedbackEmail(
  env: Env,
  { slug, rating, feedback }: { slug: string; rating: number; feedback: string },
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.FEEDBACK_TO) return; // not configured -> skip
  await globalThis.fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Teaching <onboarding@resend.dev>",
      to: env.FEEDBACK_TO,
      subject: `New feedback: ${slug} (${rating}★)`,
      text: `Material: ${slug}\nRating: ${rating}/5\n\nFeedback:\n${feedback}\n`,
    }),
  });
}

async function handleView(slug: string, env: Env, origin: string | null): Promise<Response> {
  await env.TEACHING_DB.prepare(VIEW_UPSERT_SQL).bind(slug).run();
  const stats = await aggregateForSlug(env, slug);
  return jsonResponse({ views: stats.views, downloads: stats.downloads }, 200, origin, env);
}

async function handleDownload(slug: string, env: Env, origin: string | null): Promise<Response> {
  await env.TEACHING_DB.prepare(DOWNLOAD_UPSERT_SQL).bind(slug).run();
  const stats = await aggregateForSlug(env, slug);
  return jsonResponse({ downloads: stats.downloads }, 200, origin, env);
}

async function handleReview(
  body: Record<string, unknown>,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const rating = body.rating;
  const feedbackRaw = typeof body.feedback === "string" ? body.feedback : "";
  const feedback = feedbackRaw.trim();

  if (!slug) {
    return jsonResponse({ error: "slug is required" }, 400, origin, env);
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return jsonResponse({ error: "rating must be an integer between 1 and 5" }, 400, origin, env);
  }
  if (!feedback) {
    return jsonResponse({ error: "feedback is required" }, 400, origin, env);
  }

  // Persist the review, then count the read as a download (a review implies use).
  await env.TEACHING_DB.prepare(INSERT_REVIEW_SQL).bind(slug, rating, feedback).run();
  await env.TEACHING_DB.prepare(DOWNLOAD_UPSERT_SQL).bind(slug).run();

  const stats = await aggregateForSlug(env, slug);

  // Email is best-effort: a Resend failure is logged but MUST NOT fail the request.
  try {
    await sendFeedbackEmail(env, { slug, rating, feedback });
  } catch (err) {
    console.error("sendFeedbackEmail failed", err);
  }

  return jsonResponse(
    { downloads: stats.downloads, ratingAvg: stats.ratingAvg, ratingCount: stats.ratingCount },
    200,
    origin,
    env,
  );
}

// GET /stats?slug=X → one aggregate; GET /stats → every material keyed by slug.
async function handleStats(
  url: URL,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const slug = url.searchParams.get("slug");

  if (slug) {
    const stats = await aggregateForSlug(env, slug);
    return jsonResponse(stats, 200, origin, env);
  }

  // All materials. Single query: per-material counters plus review aggregates.
  const ALL_SQL =
    "SELECT m.slug, m.views, m.downloads, " +
    "COALESCE((SELECT ROUND(AVG(rating),2) FROM reviews r WHERE r.slug=m.slug),0) AS ratingAvg, " +
    "COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.slug=m.slug),0) AS ratingCount " +
    "FROM materials m";

  const result = await env.TEACHING_DB.prepare(ALL_SQL).all<Record<string, unknown>>();
  const rows = result?.results ?? [];

  const out: Record<string, Stats> = {};
  for (const row of rows) {
    const rowSlug = String(row.slug);
    out[rowSlug] = rowToStats(row);
  }
  return jsonResponse(out, 200, origin, env);
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeadersFor(origin, env) });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // --- GET routes ---------------------------------------------------------
  if (request.method === "GET") {
    if (path === "/stats") {
      return handleStats(url, env, origin);
    }
    return jsonResponse({ error: "Not found" }, 404, origin, env);
  }

  // --- POST routes --------------------------------------------------------
  if (request.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Body must be JSON" }, 400, origin, env);
    }

    if (path === "/view" || path === "/download") {
      const slug = typeof body.slug === "string" ? body.slug.trim() : "";
      if (!slug) {
        return jsonResponse({ error: "slug is required" }, 400, origin, env);
      }
      return path === "/view"
        ? handleView(slug, env, origin)
        : handleDownload(slug, env, origin);
    }

    if (path === "/review") {
      return handleReview(body, env, origin);
    }

    return jsonResponse({ error: "Not found" }, 404, origin, env);
  }

  return jsonResponse({ error: "Method not allowed" }, 405, origin, env);
}
