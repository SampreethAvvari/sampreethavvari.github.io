import { describe, test, expect, vi, afterEach } from "vitest";
import { handleRequest, type AiBinding, type AiRunOptions, type Env } from "../src/handler";

const ORIGIN = "https://sampreethavvari.github.io";

function makeEnv(overrides: Partial<Env> & { ai?: AiBinding } = {}): Env {
  const ai: AiBinding =
    overrides.ai ?? {
      run: vi.fn(async () => ({ response: "ok" })),
    };
  return {
    AI: ai,
    AI_MODEL: "@cf/meta/llama-3.1-8b-instruct",
    ALLOWED_ORIGINS: "https://sampreethavvari.github.io,http://localhost:4321",
    ...overrides,
  };
}

function makeRequest(init: RequestInit = {}): Request {
  return new Request("https://worker.example.com/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(init.headers ?? {}) },
    ...init,
  });
}

function aiReturning(reply: string): AiBinding {
  return { run: vi.fn(async () => ({ response: reply })) };
}

function aiThrowing(): AiBinding {
  return {
    run: vi.fn(async () => {
      throw new Error("upstream blew up");
    }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handler — basic plumbing", () => {
  test("OPTIONS preflight returns 204 with CORS headers for an allowed origin", async () => {
    const req = new Request("https://worker.example.com/chat", {
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
    expect(res.headers.get("Access-Control-Allow-Headers")?.toLowerCase()).toContain("content-type");
  });

  test("OPTIONS preflight from a disallowed origin omits the allow header", async () => {
    const req = new Request("https://worker.example.com/chat", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    const res = await handleRequest(req, makeEnv());

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("GET on /chat returns 405", async () => {
    const req = new Request("https://worker.example.com/chat", {
      method: "GET",
      headers: { Origin: ORIGIN },
    });

    const res = await handleRequest(req, makeEnv());

    expect(res.status).toBe(405);
  });

  test("POST with a missing messages field returns 400", async () => {
    const req = makeRequest({ body: JSON.stringify({ foo: "bar" }) });

    const res = await handleRequest(req, makeEnv());

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/messages/i);
  });

  test("POST with non-JSON body returns 400", async () => {
    const req = makeRequest({ body: "not json at all", headers: { "Content-Type": "text/plain" } });

    const res = await handleRequest(req, makeEnv());

    expect(res.status).toBe(400);
  });
});

describe("handler — Workers AI integration", () => {
  test("returns the model reply on a happy-path POST", async () => {
    const env = makeEnv({ ai: aiReturning("Sampreeth is an AI Engineer at Hybridge Implants.") });

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "Who is Sampreeth?" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { reply: string };
    expect(body.reply).toBe("Sampreeth is an AI Engineer at Hybridge Implants.");
  });

  test("env.AI.run receives the configured Llama model and a Sampreeth system prompt", async () => {
    let captured: { model: string; options: AiRunOptions } | undefined;
    const ai: AiBinding = {
      run: vi.fn(async (model: string, options: AiRunOptions) => {
        captured = { model, options };
        return { response: "ok" };
      }),
    };

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "Tell me about CBCT validator" }],
      }),
    });

    await handleRequest(req, makeEnv({ ai }));

    expect(captured?.model).toBe("@cf/meta/llama-3.1-8b-instruct");
    const systemMsg = captured!.options.messages.find((m) => m.role === "system");
    expect(systemMsg).toBeTruthy();
    expect(systemMsg!.content.toLowerCase()).toContain("sampreeth");
  });

  test("AI binding throwing returns 502 with a clean error body", async () => {
    const env = makeEnv({ ai: aiThrowing() });

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "anything" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/upstream|chat/i);
  });

  test("empty model response returns 502", async () => {
    const env = makeEnv({ ai: aiReturning("   ") });

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(502);
  });

  test("response carries the Access-Control-Allow-Origin for the allowed caller", async () => {
    const env = makeEnv({ ai: aiReturning("hello") });

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  test("system prompt enforces Sampreeth-only scope and refuses general questions", async () => {
    let captured: { model: string; options: AiRunOptions } | undefined;
    const ai: AiBinding = {
      run: vi.fn(async (model: string, options: AiRunOptions) => {
        captured = { model, options };
        return { response: "ok" };
      }),
    };

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "What is the capital of France?" }],
      }),
    });

    await handleRequest(req, makeEnv({ ai }));

    const systemMsg = captured!.options.messages.find((m) => m.role === "system");
    expect(systemMsg).toBeTruthy();
    // Must declare it only answers about Sampreeth
    expect(systemMsg!.content).toMatch(/only answer questions about sampreeth/i);
    // Must explicitly forbid answering out-of-scope questions
    expect(systemMsg!.content).toMatch(/must not answer/i);
    // Must instruct a decline with an invite back to Sampreeth topics
    expect(systemMsg!.content).toMatch(/just decline/i);
  });
});
