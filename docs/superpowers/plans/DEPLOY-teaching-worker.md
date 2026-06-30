# Deploying the Teaching backend (Cloudflare Worker + D1)

The site (Phase A) is live without this — counts show "—" and downloads work
(the review gate is fail-open). These steps turn on real view/download counts
and the private feedback email. Run them under your Cloudflare account.

## 1. Create the D1 database
```bash
cd teaching-worker
npm install
npx wrangler login            # opens Cloudflare auth in the browser
npx wrangler d1 create sampreeth-teaching
```
Copy the printed `database_id` into `teaching-worker/wrangler.toml`, replacing
`PLACEHOLDER-set-after-wrangler-d1-create`.

## 2. Apply the schema (local + remote)
```bash
npx wrangler d1 execute sampreeth-teaching --file=./schema.sql            # local
npx wrangler d1 execute sampreeth-teaching --file=./schema.sql --remote   # production
```

## 3. Set the feedback-email secret (Resend)
- Create a free account at resend.com → API Keys → create one.
```bash
npx wrangler secret put RESEND_API_KEY     # paste the key when prompted
```
- It sends from the shared `onboarding@resend.dev` to `spa9659@nyu.edu` out of
  the box. For best deliverability later, verify a domain in Resend and change
  the `from` address in `teaching-worker/src/handler.ts` (`sendFeedbackEmail`).
- If you skip this step, reviews still save and downloads still work — only the
  email is skipped.

## 4. Deploy the worker
```bash
npx wrangler deploy
```
Note the deployed URL, e.g. `https://sampreeth-teaching.<subdomain>.workers.dev`.

## 5. Point the site at it
Set a GitHub **repository variable** (Settings → Secrets and variables →
Actions → Variables) named `PUBLIC_TEACHING_API` to the worker URL. The next
deploy (any push to `main`, or re-run the Deploy workflow) will inline it, and
counts + the review/email go live. For local dev, add it to a `.env`:
```
PUBLIC_TEACHING_API=https://sampreeth-teaching.<subdomain>.workers.dev
```

## Notes
- `ALLOWED_ORIGINS` in `wrangler.toml` already includes
  `https://sampreethavvari.github.io` + localhost, so CORS works in prod + dev.
- Endpoints: `POST /view`, `POST /download`, `POST /review`, `GET /stats`
  (and `GET /stats?slug=`). Tests: `cd teaching-worker && npm test` (18 passing).
- To inspect feedback directly:
  `npx wrangler d1 execute sampreeth-teaching --remote --command "SELECT * FROM reviews ORDER BY id DESC LIMIT 20"`.
