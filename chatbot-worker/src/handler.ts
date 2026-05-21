import { SITE_CONTEXT } from "./context";

export interface Env {
  GROQ_API_KEY: string;
  GROQ_MODEL?: string;
  ALLOWED_ORIGINS?: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const DEFAULT_MODEL = "llama-3.1-8b-instant";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeadersFor(origin, env) });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin, env);
  }

  let payload: { messages?: ChatMessage[] };
  try {
    payload = (await request.json()) as { messages?: ChatMessage[] };
  } catch {
    return jsonResponse({ error: "Body must be JSON" }, 400, origin, env);
  }

  const messages = payload?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(
      { error: "Body must include a non-empty `messages` array" },
      400,
      origin,
      env,
    );
  }

  const lastUserMessage = [...messages].reverse().find((m) => m?.role === "user");
  if (!lastUserMessage) {
    return jsonResponse(
      { error: "messages must contain at least one user turn" },
      400,
      origin,
      env,
    );
  }

  const groqPayload = {
    model: env.GROQ_MODEL || DEFAULT_MODEL,
    messages: [
      { role: "system", content: SITE_CONTEXT },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0.4,
    max_tokens: 512,
  };

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(groqPayload),
    });
  } catch (err) {
    return jsonResponse(
      { error: "Upstream chat service unreachable" },
      502,
      origin,
      env,
    );
  }

  if (!upstream.ok) {
    return jsonResponse(
      { error: `Upstream chat returned ${upstream.status}` },
      502,
      origin,
      env,
    );
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = (await upstream.json()) as typeof data;
  } catch {
    return jsonResponse({ error: "Upstream returned invalid JSON" }, 502, origin, env);
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return jsonResponse({ error: "Upstream returned an empty reply" }, 502, origin, env);
  }

  return jsonResponse({ reply }, 200, origin, env);
}
