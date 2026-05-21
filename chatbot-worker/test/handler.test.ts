import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { handleRequest } from "../src/handler";

const env = {
  GROQ_API_KEY: "test-key",
  GROQ_MODEL: "llama-3.1-8b-instant",
  ALLOWED_ORIGINS: "https://sampreethavvari.github.io,http://localhost:4321",
};

const ORIGIN = "https://sampreethavvari.github.io";

function makeRequest(init: RequestInit = {}): Request {
  return new Request("https://worker.example.com/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(init.headers ?? {}) },
    ...init,
  });
}

function mockGroq(reply: string) {
  globalThis.fetch = vi.fn(async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: reply } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  ) as unknown as typeof fetch;
}

function mockGroqError(status: number, body: string) {
  globalThis.fetch = vi.fn(async () =>
    new Response(body, { status, headers: { "Content-Type": "application/json" } }),
  ) as unknown as typeof fetch;
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

    const res = await handleRequest(req, env);

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

    const res = await handleRequest(req, env);

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("GET on /chat returns 405", async () => {
    const req = new Request("https://worker.example.com/chat", {
      method: "GET",
      headers: { Origin: ORIGIN },
    });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(405);
  });

  test("POST with a missing messages field returns 400", async () => {
    const req = makeRequest({ body: JSON.stringify({ foo: "bar" }) });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/messages/i);
  });

  test("POST with non-JSON body returns 400", async () => {
    const req = makeRequest({ body: "not json at all", headers: { "Content-Type": "text/plain" } });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(400);
  });
});

describe("handler — Groq integration", () => {
  test("returns the Groq reply on a happy-path POST", async () => {
    mockGroq("Sampreeth is an AI Engineer at Hybridge Implants.");

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

  test("call to Groq includes a system prompt with Sampreeth context", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      captured = { url: String(url), init };
      return new Response(
        JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "Tell me about CBCT validator" }],
      }),
    });

    await handleRequest(req, env);

    expect(captured?.url).toContain("api.groq.com");
    const payload = JSON.parse(captured!.init.body as string);
    expect(payload.model).toBe("llama-3.1-8b-instant");

    const systemMsg = payload.messages.find((m: any) => m.role === "system");
    expect(systemMsg).toBeTruthy();
    expect(systemMsg.content.toLowerCase()).toContain("sampreeth");
  });

  test("Groq upstream failure returns 502 with a clean error body", async () => {
    mockGroqError(500, "internal error");

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "anything" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/upstream|groq|chat/i);
  });

  test("response carries the Access-Control-Allow-Origin for the allowed caller", async () => {
    mockGroq("hello");

    const req = makeRequest({
      body: JSON.stringify({
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    const res = await handleRequest(req, env);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });
});
