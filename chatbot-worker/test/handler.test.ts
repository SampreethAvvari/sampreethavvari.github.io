import { describe, test, expect, vi, afterEach } from "vitest";
import { handleRequest, type AiBinding, type AiRunOptions, type Env, OFF_TOPIC_REPLY } from "../src/handler";

const ORIGIN = "https://sampreethavvari.github.io";

function makeEnv(overrides: Partial<Env> & { ai?: AiBinding } = {}): Env {
  const ai: AiBinding =
    overrides.ai ?? {
      // Default mock: call 1 (classifier) → YES, call 2 (answer) → "ok"
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

/**
 * Build an AiBinding where the first call (classifier) returns `classifierReply`
 * and every subsequent call (answer model) returns `answerReply`.
 */
function aiWithGate(classifierReply: string, answerReply: string): AiBinding {
  let callCount = 0;
  return {
    run: vi.fn(async () => {
      callCount += 1;
      return { response: callCount === 1 ? classifierReply : answerReply };
    }),
  };
}

/**
 * Simple helper for tests that just want a happy-path answer: classifier
 * returns "YES", answer model returns the given reply.
 */
function aiReturning(reply: string): AiBinding {
  return aiWithGate("YES", reply);
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
    const calls: Array<{ model: string; options: AiRunOptions }> = [];
    const ai: AiBinding = {
      run: vi.fn(async (model: string, options: AiRunOptions) => {
        calls.push({ model, options });
        // Call 1: classifier → return YES; Call 2: answer → return ok
        return { response: calls.length === 1 ? "YES" : "ok" };
      }),
    };

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "Tell me about CBCT validator" }],
      }),
    });

    await handleRequest(req, makeEnv({ ai }));

    // There are now two run() calls: [0] classifier, [1] answer.
    // Inspect the ANSWER call (index 1) — it carries the full SITE_CONTEXT.
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const answerCall = calls.find((c) =>
      c.options.messages.some(
        (m) => m.role === "system" && m.content.toLowerCase().includes("hybridge"),
      ),
    );
    expect(answerCall).toBeTruthy();
    expect(answerCall!.model).toBe("@cf/meta/llama-3.1-8b-instruct");
    const systemMsg = answerCall!.options.messages.find((m) => m.role === "system");
    expect(systemMsg).toBeTruthy();
    expect(systemMsg!.content.toLowerCase()).toContain("sampreeth");
  });

  test("AI binding throwing returns 502 with a clean error body", async () => {
    // aiThrowing() throws on both calls. The classifier will fail-open (true)
    // and proceed; the answer call then throws → 502.
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
    // aiReturning("   ") → classifier gets "   " (trims to "" → fail-open),
    // answer call also gets "   " → empty reply → 502.
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
    const calls: Array<{ model: string; options: AiRunOptions }> = [];
    const ai: AiBinding = {
      run: vi.fn(async (model: string, options: AiRunOptions) => {
        calls.push({ model, options });
        return { response: calls.length === 1 ? "YES" : "ok" };
      }),
    };

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "What is the capital of France?" }],
      }),
    });

    await handleRequest(req, makeEnv({ ai }));

    // Find the answer call by its big SITE_CONTEXT system message.
    const answerCall = calls.find((c) =>
      c.options.messages.some(
        (m) => m.role === "system" && m.content.toLowerCase().includes("hybridge"),
      ),
    );
    expect(answerCall).toBeTruthy();
    const systemMsg = answerCall!.options.messages.find((m) => m.role === "system");
    expect(systemMsg).toBeTruthy();
    // Must declare it only answers about Sampreeth
    expect(systemMsg!.content).toMatch(/only answer questions about sampreeth/i);
    // Must explicitly forbid answering out-of-scope questions
    expect(systemMsg!.content).toMatch(/must not answer/i);
    // Must instruct a decline with an invite back to Sampreeth topics
    expect(systemMsg!.content).toMatch(/just decline/i);
  });
});

describe("handler — topic gate", () => {
  test("off-topic question is refused without calling the answer model", async () => {
    // Classifier returns "NO" → should immediately return the canned refusal.
    let callCount = 0;
    const ai: AiBinding = {
      run: vi.fn(async () => {
        callCount += 1;
        return { response: "NO" };
      }),
    };
    const env = makeEnv({ ai });

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "What is the capital of France?" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { reply: string };
    expect(body.reply).toBe(OFF_TOPIC_REPLY);
    // Only the classifier was called — answer model must NOT have been invoked.
    expect(ai.run).toHaveBeenCalledTimes(1);
  });

  test("on-topic question proceeds to the answer model", async () => {
    const ai = aiWithGate("YES", "Sampreeth directed Resonance in 2023.");
    const env = makeEnv({ ai });

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "What films has Sampreeth made?" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { reply: string };
    expect(body.reply).toBe("Sampreeth directed Resonance in 2023.");
    // Both the classifier and the answer model were called.
    expect(ai.run).toHaveBeenCalledTimes(2);
  });

  test("classifier returns 'NO' → off-topic refusal, answer model NOT called", async () => {
    const ai = aiWithGate("NO", "should not be returned");
    const env = makeEnv({ ai });

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "What is the capital of France?" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { reply: string };
    expect(body.reply).toBe(OFF_TOPIC_REPLY);
    // Only the classifier was called — answer model must NOT have been invoked.
    expect(ai.run).toHaveBeenCalledTimes(1);
  });

  test("classifier returns a word containing 'no' as substring (e.g. 'Now') → treated as on-topic", async () => {
    // Regression guard: "Now", "Unknown", "NOPE" etc. contain "NO" as a substring
    // but must NOT trigger the refusal. Only a standalone \bNO\b should refuse.
    const ai = aiWithGate("Now", "Sampreeth directed Resonance in 2023.");
    const env = makeEnv({ ai });

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "What films has Sampreeth made?" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { reply: string };
    // Must return the answer — NOT the canned refusal.
    expect(body.reply).toBe("Sampreeth directed Resonance in 2023.");
    expect(body.reply).not.toBe(OFF_TOPIC_REPLY);
    // Both classifier AND answer model were called (fail-open → two calls).
    expect(ai.run).toHaveBeenCalledTimes(2);
  });

  test("classifier failure fails open — answer model still called and its reply returned", async () => {
    // First call (classifier) throws; second call (answer) returns a reply.
    let callCount = 0;
    const ai: AiBinding = {
      run: vi.fn(async () => {
        callCount += 1;
        if (callCount === 1) throw new Error("classifier blew up");
        return { response: "Sampreeth studied at NYU." };
      }),
    };
    const env = makeEnv({ ai });

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "Where did Sampreeth study?" }],
      }),
    });

    const res = await handleRequest(req, env);

    // Fail-open: despite classifier error, answer is returned normally.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reply: string };
    expect(body.reply).toBe("Sampreeth studied at NYU.");
    // The canned refusal must NOT have been sent.
    expect(body.reply).not.toBe(OFF_TOPIC_REPLY);
  });
});
