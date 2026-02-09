#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const loadEnv = async () => {
  const envFiles = [path.join(ROOT, ".env"), path.join(ROOT, ".env.local")];
  for (const envPath of envFiles) {
    try {
      const raw = await fs.readFile(envPath, "utf8");
      raw.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const [key, ...rest] = trimmed.split("=");
        if (!key || process.env[key] !== undefined) return;
        process.env[key] = rest.join("=").trim();
      });
    } catch (error) {
      // Ignore missing env files.
    }
  }
};

await loadEnv();

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GEMINI_API_KEY,
  GEMINI_EMBEDDING_MODEL = "gemini-embedding-001",
  GEMINI_EMBEDDING_DIM = "3072",
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  console.error(
    "Missing env vars. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY."
  );
  process.exit(1);
}

const EMBEDDING_DIM = Number(GEMINI_EMBEDDING_DIM);
if (!Number.isFinite(EMBEDDING_DIM) || EMBEDDING_DIM <= 0) {
  console.error("GEMINI_EMBEDDING_DIM must be a positive number (e.g., 3072)");
  process.exit(1);
}

const sourceFiles = [
  "src/data/info.ts",
  "src/pages/index.astro",
  "src/pages/filmmaking.astro",
  "src/pages/projects.astro",
  "src/pages/posts.astro",
];

const postsDir = path.join(ROOT, "src", "pages", "posts");
const extraDir = path.join(ROOT, "data", "chatbot");

const cleanText = (text) => {
  return text
    .replace(/^---[\s\S]*?---/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*(import|export).*$/gm, " ")
    .replace(/[`*_>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const chunkText = (text, maxLen = 1200) => {
  const chunks = [];
  const parts = text.split(/\n{2,}|\.(\s+)/);
  let current = "";
  for (const part of parts) {
    const piece = part.trim();
    if (!piece) continue;
    if ((current + " " + piece).trim().length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = piece;
    } else {
      current = (current + " " + piece).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
};

const readFileSafe = async (relativePath) => {
  const fullPath = path.join(ROOT, relativePath);
  try {
    return await fs.readFile(fullPath, "utf8");
  } catch (error) {
    console.warn(`Skipping ${relativePath}: ${error.message}`);
    return "";
  }
};

const loadSources = async () => {
  const docs = [];

  for (const file of sourceFiles) {
    const raw = await readFileSafe(file);
    if (!raw) continue;
    const cleaned = cleanText(raw);
    chunkText(cleaned).forEach((chunk, idx) => {
      docs.push({
        content: chunk,
        metadata: { source: file, chunk: idx },
      });
    });
  }

  try {
    const postFiles = await fs.readdir(postsDir);
    for (const file of postFiles.filter((name) => name.endsWith(".md"))) {
      const relPath = path.join("src", "pages", "posts", file);
      const raw = await readFileSafe(relPath);
      if (!raw) continue;
      const cleaned = cleanText(raw);
      chunkText(cleaned).forEach((chunk, idx) => {
        docs.push({
          content: chunk,
          metadata: { source: relPath, chunk: idx },
        });
      });
    }
  } catch (error) {
    console.warn("No posts directory found or unable to read posts.");
  }

  try {
    const extraFiles = await fs.readdir(extraDir);
    for (const file of extraFiles.filter((name) => /\.(md|txt)$/i.test(name))) {
      const relPath = path.join("data", "chatbot", file);
      const raw = await readFileSafe(relPath);
      if (!raw) continue;
      const cleaned = cleanText(raw);
      chunkText(cleaned).forEach((chunk, idx) => {
        docs.push({
          content: chunk,
          metadata: { source: relPath, chunk: idx },
        });
      });
    }
  } catch (error) {
    console.warn("No data/chatbot directory found or unable to read extra files.");
  }

  return docs;
};

const embedBatch = async (texts) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`;

  const requests = texts.map((text) => ({
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
    content: {
      parts: [{ text }],
    },
    taskType: "RETRIEVAL_DOCUMENT",
    outputDimensionality: EMBEDDING_DIM,
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini embed error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  if (!data.embeddings) {
    throw new Error("Gemini embed response missing embeddings.");
  }

  return data.embeddings.map((item) => item.values || item.embedding?.values);
};

const insertRows = async (rows) => {
  const url = `${SUPABASE_URL}/rest/v1/chatbot`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase insert error: ${res.status} ${errText}`);
  }
};

const clearTable = async () => {
  const url = `${SUPABASE_URL}/rest/v1/chatbot?id=gt.0`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase delete error: ${res.status} ${errText}`);
  }
};

const run = async () => {
  const appendOnly = process.argv.includes("--append");
  console.log("Loading sources...");
  const docs = await loadSources();
  if (!docs.length) {
    console.error("No documents found to embed.");
    process.exit(1);
  }

  if (!appendOnly) {
    console.log("Clearing existing chatbot rows...");
    await clearTable();
  } else {
    console.log("Append mode: existing chatbot rows will be kept.");
  }

  console.log(`Embedding ${docs.length} chunks...`);

  const batchSize = 4;
  let processed = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch.map((d) => d.content));

    const rows = batch.map((doc, idx) => ({
      content: doc.content,
      metadata: doc.metadata,
      embedding: embeddings[idx],
    }));

    await insertRows(rows);
    processed += batch.length;
    console.log(`Inserted ${processed}/${docs.length} chunks...`);
  }

  console.log("Ingestion complete.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
