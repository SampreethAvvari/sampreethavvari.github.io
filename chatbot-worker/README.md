# sampreeth-chatbot (Cloudflare Worker + Workers AI)

A tiny Cloudflare Worker that powers the portfolio chat widget using **Llama 3.1 8B Instruct on Cloudflare Workers AI** (open-source model, free tier, zero external API keys). The full site context is baked into `src/context.ts` so there's no vector store, no embeddings, no database.

## Architecture

```
Browser (ChatWidget)
        │  POST /chat  {messages: [...]}
        ▼
Cloudflare Worker (this repo)
        │  baked-in SITE_CONTEXT as system prompt
        │  env.AI.run("@cf/meta/llama-3.1-8b-instruct", ...)
        ▼
Cloudflare Workers AI (Llama 3.1 8B, runs in CF's GPU pool)
        │
        ▼
Worker returns {reply: "..."}  with CORS for github.io
```

No external services. The model runs inside the same Cloudflare account as the worker. One account, no API keys.

## Why Workers AI (vs Groq / HF / OpenAI)

- **Free.** 10,000 neurons/day on the Workers Free plan. A chat reply from Llama 3.1 8B costs roughly 5–30 neurons depending on length, so this comfortably covers a portfolio chatbot.
- **No second account, no API key to rotate.** The `AI` binding is provisioned automatically when you deploy.
- **Open-source model.** Llama 3.1 8B Instruct, weights from Meta, served by Cloudflare's infra.
- **Latency.** First token in ~300–600ms; full reply in 1–3s for the kinds of answers this chatbot gives.

If you want a smaller/faster model, swap `AI_MODEL` in `wrangler.toml` to `@cf/meta/llama-3.2-3b-instruct` (or `@cf/meta/llama-3.2-1b-instruct` for the tiniest). All free under the same allowance.

## One-time setup

1. **Make a free Cloudflare account.** https://dash.cloudflare.com/sign-up — no credit card needed for Workers free tier (100k req/day + 10k AI neurons/day).
2. **Install Wrangler** (the Cloudflare Workers CLI) and log in:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
   `wrangler login` opens a browser tab — approve, then the CLI is authenticated.
3. From this directory install local deps:
   ```bash
   cd chatbot-worker
   npm install
   ```

That's it. No `wrangler secret put` step, no API keys to paste.

## Deploy

```bash
npm run deploy
```

Wrangler prints the worker URL on success:

```
https://sampreeth-chatbot.<your-subdomain>.workers.dev
```

The chat endpoint lives at `<that-url>/chat`. Save the URL for the next step.

## Point the site at the worker

The chat widget reads its endpoint from a public Astro env var. Set `PUBLIC_CHAT_ENDPOINT` as a repository **variable** (Settings → Secrets and variables → Actions → Variables) in `SampreethAvvari/sampreethavvari.github.io`:

```
PUBLIC_CHAT_ENDPOINT = https://sampreeth-chatbot.<your-subdomain>.workers.dev/chat
```

Then update `.github/workflows/deploy.yml` so the build step picks it up:

```yaml
- name: Build
  run: npm run build
  env:
    PUBLIC_CHAT_ENDPOINT: ${{ vars.PUBLIC_CHAT_ENDPOINT }}
```

For a local-only test, drop a `.env` in the site root with the same line and run `npm run dev`.

## Update the context

When a new project or post ships, edit `src/context.ts` and `npm run deploy` again. ~5–10 KB of context is the sweet spot for an 8B model — keep summaries tight.

## Running tests

```bash
npm test
```

Nine Vitest cases cover CORS preflight, method handling, body validation, the AI-binding call shape (model name + Sampreeth system prompt), and upstream failure paths. The tests mock the `AI` binding directly so they run in plain Vitest without `wrangler dev`. Pass before deploying.

## Local development

```bash
npm run dev
```

`wrangler dev` runs the worker on `http://localhost:8787`. The AI binding works locally too — it proxies to Cloudflare's real Workers AI endpoint while developing. No `.dev.vars` needed.

To wire a local Astro dev server at it: `PUBLIC_CHAT_ENDPOINT=http://localhost:8787/chat npm run dev` (from the site root).

## Costs (current)

- Cloudflare Workers: **free** up to 100,000 req/day
- Workers AI: **free** up to 10,000 neurons/day (≈ several thousand chatbot replies/day)
- Run rate at portfolio volume: **$0/month**
