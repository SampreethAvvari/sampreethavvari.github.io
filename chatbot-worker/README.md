# sampreeth-chatbot (Cloudflare Worker)

A tiny Cloudflare Worker that proxies the portfolio chat widget to **Llama 3.1 8B Instant on Groq** (open-source model, free tier, no per-request cost). The full site context is baked into `src/context.ts` so there's no vector store, no embeddings, no database.

## Architecture

```
Browser (ChatWidget)
        │  POST /chat  {messages: [...]}
        ▼
Cloudflare Worker (this repo)
        │  baked-in SITE_CONTEXT as system prompt
        │  Authorization: Bearer GROQ_API_KEY
        ▼
api.groq.com/openai/v1/chat/completions   (Llama 3.1 8B Instant)
        │
        ▼
Worker returns {reply: "..."}  with CORS for github.io
```

## One-time setup

1. **Make a free Groq account.** https://console.groq.com — register, then create an API key. Free tier covers ~14,400 chat requests/day, more than enough for a portfolio.
2. **Make a free Cloudflare account.** https://dash.cloudflare.com/sign-up — no credit card needed for Workers free tier (100k req/day).
3. **Install Wrangler** (the Cloudflare Workers CLI) and log in:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
4. From this directory, install local deps and put the Groq key into the worker's secret store:
   ```bash
   cd chatbot-worker
   npm install
   wrangler secret put GROQ_API_KEY
   # paste the Groq key when prompted, hit Enter
   ```

## Deploy

```bash
npm run deploy
```

Wrangler prints the worker URL, looking like:
```
https://sampreeth-chatbot.<your-subdomain>.workers.dev
```

## Point the site at the worker

The chat widget reads its endpoint from an Astro public env var. Set it before building the site so the URL is baked into the static bundle:

```bash
# in the repo root (one level up)
echo "PUBLIC_CHAT_ENDPOINT=https://sampreeth-chatbot.<your-subdomain>.workers.dev/chat" >> .env
npm run build
```

Or for GitHub Pages builds, set `PUBLIC_CHAT_ENDPOINT` as a repository variable / Action secret and reference it in `.github/workflows/deploy.yml`:

```yaml
- name: Build
  run: npm run build
  env:
    PUBLIC_CHAT_ENDPOINT: ${{ vars.PUBLIC_CHAT_ENDPOINT }}
```

## Update the context

When you ship a new project or post, update `src/context.ts` and re-deploy. ~5-10 KB of context is the sweet spot for an 8B model — keep summaries tight.

## Running tests

```bash
npm test
```

The handler is a pure async function (no Workers-specific globals), so the tests run in plain Vitest. Nine tests cover CORS preflight, method handling, body validation, the Groq call shape, and upstream failure paths. Pass before deploying.

## Local development

```bash
echo "GROQ_API_KEY=sk-..." > .dev.vars
npm run dev
```

`wrangler dev` runs the worker locally with `.dev.vars` injected. Point a local Astro dev server at `http://localhost:8787/chat` via `PUBLIC_CHAT_ENDPOINT` to test end-to-end.

## Costs (current)

- Groq Llama 3.1 8B Instant: **free** up to 14,400 req/day
- Cloudflare Workers: **free** up to 100,000 req/day
- Run rate at portfolio volume: **$0/month**
