# Mise

**Mise** is a calm meal planner that ties a recipe box, a weekly meal plan, and a grocery list together. It runs on Cloudflare Workers and uses a GitHub repository as its database — no separate database, no vendor lock-in, and every change is a commit you can inspect or restore.

> Plan the week. Shop once. Cook well.

## What it does

- **A week you can see** — a Monday-to-Sunday board with breakfast, lunch, dinner and snack slots. Move between weeks, jump back to today with one click.
- **A recipe box with memory** — search by title, ingredient or tag; filter by tags; sort by recency, title or cooking time. Recipes support tags, servings, prep/cook times, notes and a source image.
- **Scale at the stove** — open a recipe and scale servings up or down; quantities recalculate with tidy fractions (`1 1/2 cups`, not `1.4999`).
- **One grocery list that builds itself** — generate a list from any week’s planned meals. Ingredients merge across recipes (normalized names and unit aliases), group by aisle, and keep checked items and manual additions when you regenerate.
- **Print or copy** — clean print styles for the shopping list and recipes, plus a plain-text copy for your notes app.
- **Bring your own data** — Mise creates a private `meal-planner-data` repository for you on first run, or connects to one you already have. You can also edit the JSON files by hand.
- **Demo mode** — explore the whole app with seeded in-memory data, without a GitHub OAuth app.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Cloudflare Workers (static assets + Worker API) |
| API | [Hono](https://hono.dev) + [Zod](https://zod.dev) validation |
| UI | React 19, React Router 7, TypeScript, Vite |
| Icons | lucide-react + a local GitHub mark |
| Storage | JSON files in a user-owned GitHub repository |
| Styling | Hand-written CSS with warm light/dark themes; no external fonts or CDNs |

## Quick start (demo mode)

Requires **Node.js 22+** and npm.

```bash
git clone <your-repo-url> mise
cd mise
npm ci

cp .dev.vars.example .dev.vars
# Edit .dev.vars: keep DEMO_MODE=true and set a real SESSION_SECRET:
#   openssl rand -base64 48

npm run dev
```

Open <http://localhost:5173>. Vite serves the UI and proxies `/api` to `wrangler dev` on port 8787. The demo seeds a dozen recipes, the current week’s plan and a matching grocery list into memory. Changes persist until the Worker restarts.

Prefer a single process? `npm run build && npm run dev:worker` serves the built app and API together at <http://localhost:8787>.

## Production setup

### 1. Create a GitHub OAuth app

Create an OAuth app at **GitHub → Settings → Developer settings → OAuth Apps**. You need the `repo` scope to create private data repositories and write files.

- **Homepage URL:** `https://<your-worker-host>`
- **Authorization callback URL:** `https://<your-worker-host>/api/auth/callback`

`<your-worker-host>` is your `*.workers.dev` hostname, or a custom domain you attach later. Both URLs must match the deployed origin, or GitHub will reject the callback. You can override the callback with `OAUTH_REDIRECT_URL` if needed.

### 2. Configure the Worker

Copy the repository to your Cloudflare account and set secrets:

```bash
npx wrangler login
npx wrangler secret put SESSION_SECRET        # openssl rand -base64 48
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

`wrangler.jsonc` already sets `DEMO_MODE` to `"false"`. Build and deploy:

```bash
npm run deploy
```

For CI, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. The manual **Deploy** workflow runs the build and `wrangler deploy` for you.

### 3. Sign in and create your data repository

Visit the deployment, continue with GitHub, then either:

- **Create new** — Mise creates a private repository named `<you>/meal-planner-data`, seeds it with starter recipes, this week’s plan and a grocery list, and documents the format in its README.
- **Connect existing** — enter `owner/repository` for any repo you can push to. An empty repo is fine; the Recipes page can load the starter box later.

Every save is a single commit to that repository.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Yes | Encrypts the session cookie. At least 24 characters; use 32+ random bytes. Rotating it signs everyone out. |
| `GITHUB_CLIENT_ID` | Yes (non-demo) | GitHub OAuth app client ID. |
| `GITHUB_CLIENT_SECRET` | Yes (non-demo) | GitHub OAuth app client secret. |
| `DEMO_MODE` | No | `true` or `1` runs entirely in memory with a demo user. Default `false`. |
| `GITHUB_OAUTH_SCOPE` | No | OAuth scope. Default `repo`. |
| `OAUTH_REDIRECT_URL` | No | Override the callback URL, e.g. behind a custom domain or proxy. |
| `DATA_REPO` | No | Pin every user to a repo (`owner/name` or a bare name under their account). Useful for a personal single-user deployment. |
| `GITHUB_DATA_BRANCH` | No | Branch to read and write. Default `main`. |

Locally, put these in `.dev.vars` (git-ignored). In production, use `wrangler secret put` for anything sensitive and `wrangler.jsonc` `vars` for non-secret flags.

## Data format

Three versioned JSON files live in the data repository:

```text
data/recipes.json   { "version": 1, "recipes": [ ... ] }
data/plans.json     { "version": 1, "plans":   [ ... ] }
data/lists.json     { "version": 1, "lists":   [ ... ] }
```

A recipe:

```json
{
  "id": "r_miso_salmon",
  "title": "Miso Butter Salmon",
  "description": "Caramelized miso butter salmon with blistered bok choy.",
  "servings": 4,
  "prepMinutes": 10,
  "cookMinutes": 15,
  "tags": ["dinner", "quick"],
  "ingredients": [
    { "id": "i1", "name": "Salmon fillets", "quantity": 4, "unit": "fillet", "category": "seafood" },
    { "id": "i2", "name": "White miso paste", "quantity": 2, "unit": "tbsp", "category": "pantry" }
  ],
  "steps": ["Heat the oven to 220°C (425°F).", "Roast for 12–15 minutes."],
  "createdAt": "2026-10-26T10:00:00.000Z",
  "updatedAt": "2026-10-26T10:00:00.000Z"
}
```

A plan is identified by its Monday (`weekStart`); meals reference recipe IDs and a serving count. A grocery list stores normalized keys (`name|unit`) so items merge predictably, plus `checked`, `source` (`plan` or `manual`) and the recipe IDs that contributed to each line.

The Worker validates every save with Zod: IDs are restricted to safe characters, dates must be real calendar dates, meal dates must fall inside their plan week, duplicate IDs are rejected, and deleting a recipe still used by a plan is blocked. Hand-edited files are validated on the next load; malformed files return a clear `DATA_CORRUPT` error rather than silently dropping data.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server + `wrangler dev` together. |
| `npm run dev:web` | Frontend only (expects the API on port 8787). |
| `npm run dev:worker` | Worker + built assets on <http://127.0.0.1:8787>. |
| `npm run typecheck` | TypeScript for both the app and the Worker. |
| `npm test` | Vitest unit tests (domain logic, validation, session crypto). |
| `npm run build` | Typecheck, then build the SPA into `dist/`. |
| `npm run preview` | Build and serve via `wrangler dev`. |
| `npm run smoke` | End-to-end API smoke test against a running demo Worker. |
| `npm run deploy` | Build and deploy with Wrangler. |

The smoke test expects a running Worker:

```bash
npm run dev:worker       # terminal 1
npm run smoke            # terminal 2
# or: MISE_URL=https://mise.example npm run smoke
```

## Project structure

```text
worker/               Cloudflare Worker (Hono)
  index.ts            API routes, error mapping, SPA fallback
  auth.ts             GitHub OAuth login/callback/logout
  session.ts          AES-GCM cookie sessions + OAuth state
  github.ts           GitHub REST client (repos, contents, user)
  store.ts            GitHub + in-memory data stores, file cache
  repo.ts             Create/connect/seed data repositories
  validate.ts         Zod schemas and normalizers
  seed.ts             Starter recipes, plan, list and repo README
shared/               Pure domain logic shared by API and UI
  types.ts            Data and API contracts
  dates.ts            Local-calendar date helpers
  units.ts            Unit aliases, plural normalization, formatting
  grocery.ts          Aggregation, merging, grouping, export
  plans.ts            Meal/plan helpers
src/                  React app
  pages/              Week, Recipes, Recipe detail, Grocery, Settings, Login
  components/         App shell, boards, dialogs, forms, UI primitives
  state/              App data/sync, theme, toasts
  styles/             CSS partials (tokens, layout, responsive, print)
public/               Static assets, security headers, PWA manifest
test/                 Vitest suites
scripts/smoke.mjs     End-to-end API smoke test
```

## How saving works

The UI applies changes optimistically, then sends the full dataset with the last known Git blob SHA. The Worker validates it and writes a commit through the GitHub Contents API. Saves are serialized in the browser, so rapid edits queue instead of racing. A SHA conflict (for example, editing the same file in GitHub while the app is open) surfaces an error and refreshes the dataset rather than overwriting someone else’s work.

GitHub’s file reads are cached in the Worker isolate for a few seconds to stay well inside API rate limits; writes invalidate that cache. Demo mode uses a module-level in-memory store and has no GitHub dependency.

## Security notes

- The GitHub token is encrypted with **AES-256-GCM** (key derived from `SESSION_SECRET`) and stored in an **HttpOnly, SameSite=Lax** cookie. It is never exposed to client JavaScript.
- Every mutating API request requires the `X-Mise-CSRF: 1` header. Cross-origin requests cannot set it without a preflight, which the API does not answer, and the SameSite cookie provides a second layer.
- OAuth uses a random `state` value in a short-lived HttpOnly cookie and a timing-safe comparison in the callback.
- `public/_headers` sets a strict Content-Security-Policy (no external scripts, fonts or frames), `nosniff`, `X-Frame-Options: DENY`, a referrer policy and a restrictive permissions policy.
- Recipe images must be `http(s)` URLs; the CSP allows images from `https:` but no scripts from remote origins.
- Data remains in the user’s GitHub account. Mise has no database, analytics or third-party services.

## Deployment notes

- Static assets live in `dist/` and are served with `not_found_handling: single-page-application`. Only `/api/*` runs the Worker first, so assets are served straight from Cloudflare’s edge.
- `/assets/*` is cached immutably; `index.html` is always revalidated.
- To use a custom domain, declare it under `routes` in `wrangler.jsonc` with `"custom_domain": true` (or add it in the dashboard), remove any placeholder DNS record for that hostname first, then update the OAuth app’s homepage and callback URLs to the custom domain.
- Rotate `SESSION_SECRET` if it leaks — this invalidates all sessions but touches no user data.
- `DEMO_MODE=true` should never be enabled on a public deployment; it shows shared in-memory data to every visitor.

## Troubleshooting sign-in

`GET /api/health` reports two flags:

```json
{ "ok": true, "demo": false, "authConfigured": true, "sessionConfigured": true }
```

- `authConfigured: false` → `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are missing on the Worker serving this hostname.
- `sessionConfigured: false` → `SESSION_SECRET` is missing or shorter than 24 characters, so sessions cannot be created and the callback fails with “We could not finish signing you in.”

Wrangler writes secrets to **one account at a time**. `wrangler.jsonc` pins both `name` and `account_id`, so a deploy can no longer create a new Worker by accident. If `wrangler whoami` shows a different account, `wrangler deploy` will fail loudly instead of silently updating an unused Worker. Check the result:

```bash
npx wrangler whoami                 # should report the account in wrangler.jsonc
npx wrangler secret list            # GITHUB_CLIENT_SECRET, SESSION_SECRET
curl -s https://<your-host>/api/health
```

Plain-text variables added in the dashboard are **replaced** by `vars` in `wrangler.jsonc` on the next deploy, so keep every non-secret binding in the config file. Only `GITHUB_CLIENT_SECRET` and `SESSION_SECRET` live in Cloudflare as secrets.

Failures in the OAuth callback are logged with a `[mise] GitHub sign-in failed` prefix and surfaced as a specific `?error=` code (`session_secret`, `github_failed`, `exchange_failed`, `invalid_state`), which `wrangler tail` will show while you retry the flow.

## License

MIT — see [LICENSE](./LICENSE).
