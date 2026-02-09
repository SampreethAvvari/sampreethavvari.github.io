import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL =
  Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SB_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_CHAT_MODEL = Deno.env.get("GEMINI_CHAT_MODEL") ?? "gemini-2.0-flash";
const GEMINI_EMBEDDING_MODEL =
  Deno.env.get("GEMINI_EMBEDDING_MODEL") ?? "gemini-embedding-001";
const GEMINI_EMBEDDING_DIM = Number(Deno.env.get("GEMINI_EMBEDDING_DIM") ?? "3072");

const systemPrompt = `You are a friendly, witty assistant for Sampreeth Avvari's website.
You only answer questions about Sampreeth: his resume, projects, filmmaking, or background.
Keep answers concise, helpful, and low on jargon. If the question isn't about him, say you can only answer about Sampreeth.`;

const embedQuery = async (text: string) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: GEMINI_EMBEDDING_DIM,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding error: ${err}`);
  }

  const data = await res.json();
  return data.embedding?.values ?? data.embedding?.embedding?.values;
};

const fetchContext = async (embedding: number[]) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_chatbot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query_embedding: embedding, match_count: 6 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase match error: ${err}`);
  }

  return await res.json();
};

const generateAnswer = async (context: string, question: string) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\nContext:\n${context}\n\nUser question: ${question}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 512,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini generate error: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const message = body?.message ?? body?.messages?.[body.messages.length - 1]?.content ?? "";

    if (!message) {
      return new Response(JSON.stringify({ reply: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embedding = await embedQuery(message);
    const matches = await fetchContext(embedding ?? []);
    const context = matches
      .map((match: { content: string }) => match.content)
      .join("\n---\n");

    const reply = await generateAnswer(context, message);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ reply: "Sorry, I hit an error." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
