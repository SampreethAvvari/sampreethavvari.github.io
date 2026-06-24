import { SITE_CONTEXT } from "./context";

// Cloudflare Workers AI binding. The `Ai` type comes from
// @cloudflare/workers-types but we keep a minimal shape here so the
// handler stays portable / testable without pulling Workers globals in.
export interface AiRunOptions {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

// Workers AI returns different response shapes per model family. The legacy
// text-generation models (Llama 3.1, etc.) use { response: string }, while
// newer ones (Gemma 4, gpt-oss) use the OpenAI-compatible
// { choices: [{ message: { content } }] }. We read whichever is present so a
// model swap can never silently produce an empty reply again.
export interface AiResult {
  response?: string | { content?: string };
  choices?: Array<{ message?: { content?: string }; text?: string }>;
}
export interface AiBinding {
  run(model: string, options: AiRunOptions): Promise<AiResult>;
}

export function extractReply(result: AiResult | null | undefined): string {
  if (!result) return "";
  if (typeof result.response === "string") return result.response.trim();
  if (
    result.response &&
    typeof result.response === "object" &&
    typeof result.response.content === "string"
  ) {
    return result.response.content.trim();
  }
  const choice = result.choices?.[0];
  if (choice?.message?.content) return String(choice.message.content).trim();
  if (typeof choice?.text === "string") return choice.text.trim();
  return "";
}

export interface Env {
  AI: AiBinding;
  AI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Llama 3.3 70B Instruct (fp8, fast) on Cloudflare Workers AI: free under the
// 10K-neurons/day allowance, no separate API key, runs in the same worker
// process via the AI binding. A plain (non-reasoning) instruct model that
// answers directly; Gemma 4's reasoning mode left substantive replies empty.
// Replaced the Llama 3.1 8B slug Cloudflare deprecated on 2026-05-30.
const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Canned refusal returned instantly for off-topic questions — no answer
// model call, no tokens wasted.
export const OFF_TOPIC_REPLY =
  "I'm only here to answer questions about Sampreeth — ask me anything about his projects, work, or films.";

const CLASSIFIER_SYSTEM_PROMPT =
  "You are a topic classifier for Sampreeth Avvari's portfolio assistant. " +
  "Decide if the user's LATEST message should be answered. " +
  "Reply with EXACTLY one word: YES or NO. " +
  "Reply YES if it is about Sampreeth Avvari (his work, engineering projects, research, filmmaking, background, education, skills, contact) " +
  "OR a contextual follow-up in that conversation (e.g. 'tell me more', 'what about his films'). " +
  "His projects include Enterprise Search (RAG), Consultation QA / Doc Coach, the CBCT Scan Validator, the Treatment Estimator, the Cowork Dashboard, Accounting Automation, Reconciliation, NPC Coach, the Centralized Diagnostic Filter (CDF), and JobPilot; " +
  "a message naming any of these, or an acronym like CDF, NPC, or RAG, is about Sampreeth, so reply YES. " +
  "Reply NO only if it is clearly unrelated to Sampreeth: general knowledge, trivia, math, coding help, news, weather, definitions, or other people. " +
  "When unsure, answer YES.";

/**
 * Lightweight YES/NO gate: asks the model whether the latest user turn is
 * about Sampreeth. Returns true (allow) on any ambiguity or error — the
 * hardened system prompt in the answer call is the backstop for edge cases.
 */
async function isAboutSampreeth(
  env: Env,
  model: string,
  recentMessages: ChatMessage[],
): Promise<boolean> {
  // Send the last ≤4 user/assistant turns so follow-ups are judged in context.
  const contextMessages = recentMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-4)
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
        ...contextMessages,
      ],
      temperature: 0,
      max_tokens: 3,
    });

    const raw = extractReply(result).toUpperCase();
    if (raw === "") return true;            // fail-open on empty
    if (raw.includes("YES")) return true;   // YES anywhere → allow
    if (/\bNO\b/.test(raw)) return false;   // standalone NO → refuse
    return true;                            // anything else → fail-open (allow)
  } catch {
    return true;                    // classifier error → fail open
  }
}

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

  const model = env.AI_MODEL || DEFAULT_MODEL;

  // --- Deterministic topic gate -------------------------------------------
  // Run the lightweight classifier BEFORE the answer model. Fail-open so a
  // classifier hiccup never blocks a legitimate question.
  const onTopic = await isAboutSampreeth(env, model, messages);
  if (!onTopic) {
    return jsonResponse({ reply: OFF_TOPIC_REPLY }, 200, origin, env);
  }
  // ------------------------------------------------------------------------

  const aiPayload: AiRunOptions = {
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

  let result: AiResult;
  try {
    result = await env.AI.run(model, aiPayload);
  } catch {
    return jsonResponse(
      { error: "Upstream chat service unreachable" },
      502,
      origin,
      env,
    );
  }

  const reply = extractReply(result);
  if (!reply) {
    return jsonResponse({ error: "Upstream returned an empty reply" }, 502, origin, env);
  }

  return jsonResponse({ reply }, 200, origin, env);
}
