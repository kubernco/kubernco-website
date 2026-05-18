# Cloudflare Pages — Reference

Single source of truth for building and deploying the Kubern Co website on Cloudflare Pages.
This project is a **vanilla HTML/CSS/JS static site** — no framework, no bundler, no build step.

---

## Index

| File | Covers |
|---|---|
| `README.md` (this file) | Quick start, CLI commands, project structure, gotchas |
| `routing.md` | `_redirects`, `_headers`, custom domains, caching, SPA vs static |
| `functions.md` | Pages Functions, bindings, middleware, contact form pattern |
| `config.md` | `wrangler.toml`, env vars, secrets, compatibility dates, limits, rollbacks |

---

## Quick Start

```bash
# 1. Install / authenticate
npm install -g wrangler        # or use npx wrangler everywhere
wrangler login                 # opens browser OAuth

# 2. Create project (one-time)
wrangler pages project create kubern-co --production-branch main

# 3. Local dev
wrangler pages dev .           # serves at http://localhost:8788

# 4. Deploy to production
wrangler pages deploy . --project-name=kubern-co --branch=main

# 5. Deploy preview
wrangler pages deploy . --project-name=kubern-co --branch=feat/some-thing
# → https://feat-some-thing.kubern-co.pages.dev
```

With `wrangler.toml` present (see `config.md`), steps 3–5 simplify to:

```bash
wrangler pages dev
wrangler pages deploy --branch=main
```

---

## Wrangler CLI — Core Commands

### Authentication

```bash
wrangler login                         # interactive browser OAuth
wrangler whoami                        # verify current account
wrangler auth token                    # print current token
wrangler logout

# CI/CD — set env vars instead of login
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."
```

Create a CI token at: Dashboard → Profile → API Tokens → **Edit Cloudflare Workers** template.

### Development

```bash
wrangler pages dev .                   # serve current dir at :8788
wrangler pages dev ./dist              # serve specific dir
wrangler pages dev --port 3000         # custom port
wrangler pages dev --local-protocol=https
```

`_headers` and `_redirects` are honored locally. Press `b` to open browser, `x` to quit.

### Deployment

```bash
wrangler pages deploy .                        # uses wrangler.toml for project name
wrangler pages deploy . --project-name=my-site
wrangler pages deploy . --branch=main          # → production
wrangler pages deploy . --branch=feat/x        # → preview URL
wrangler pages deploy . --skip-caching         # force re-upload all files
wrangler pages deploy . --commit-message="..."
```

`--branch` auto-detected from git if omitted.

### Project management

```bash
wrangler pages project list
wrangler pages project create <name> --production-branch main
wrangler pages project delete <name> --yes

wrangler pages deployment list --project-name=<name>
wrangler pages deployment list --project-name=<name> --environment=production
wrangler pages deployment tail --project-name=<name>   # live log stream
wrangler pages deployment delete <ID> --project-name=<name>

wrangler pages download config <name>   # download current config as wrangler.toml
```

---

## Static Site Project Structure

```
kubern-co/                    ← repo root = build output dir
├── index.html
├── about.html
├── contact.html
├── 404.html                  ← REQUIRED for static mode (see Gotchas)
├── css/
│   └── styles.css
├── fonts/
│   ├── CormorantUpright-SemiBold.ttf
│   └── EBGaramond-VariableFont_wght.ttf
├── js/
│   └── main.js
├── images/
├── assets/                   ← SVG marks, wordmark, etc.
├── _headers                  ← HTTP headers config (see routing.md)
├── _redirects                ← URL redirects (see routing.md)
├── functions/                ← Pages Functions (see functions.md)
│   ├── _middleware.ts
│   └── api/
│       └── contact.ts
├── wrangler.toml             ← deployment config (see config.md)
└── .dev.vars                 ← local secrets — NEVER COMMIT
```

---

## How Pages Serves Static Files

Route resolution order for a request:

1. `/about` → looks for `/about.html` → serves it
2. `/about.html` → **308 permanent redirect** to `/about` (extension stripping — cannot disable)
3. `/about/` → looks for `/about/index.html` → serves it, redirects to `/about`
4. No match + `404.html` exists → serves `404.html` with HTTP 404
5. No match + **no `404.html`** → SPA mode, serves `index.html` with HTTP 200 for all paths

Default `Cache-Control` on all static assets: `public, max-age=0, must-revalidate`
Override with `_headers` for fonts and CSS (see `routing.md`).

---

## Font Loading

Font files served from Pages work without extra config. Reference them with absolute paths:

```css
@font-face {
  font-family: 'Cormorant Upright';
  src: url('/fonts/CormorantUpright-SemiBold.ttf') format('truetype');
  font-weight: 600;
  font-display: swap;
}
```

Cloudflare serves static assets with `Access-Control-Allow-Origin: *` by default.
Add `Cache-Control: public, max-age=31536000, immutable` via `_headers` (see `routing.md`).

---

## Git Integration Setup (Dashboard)

For auto-deploy on push — one-time setup in the dashboard:

1. Workers & Pages → Create application → Pages → **Connect to Git**
2. Authorize the **Cloudflare Workers & Pages GitHub App** (scope to specific repos)
3. Select repo, click **Begin setup**
4. Configure:

| Field | Value for this project |
|---|---|
| Production branch | `main` |
| Build command | *(leave blank)* |
| Build output directory | `/` |
| Root directory | `/` |

5. Every push to `main` → production deploy
6. Every push to other branches → preview URL

**Skip a deploy** by including `[CF-Pages-Skip]` in the commit message.

> **Warning:** Once created as a Git-integrated project, it cannot switch to Direct Upload. And vice versa.

---

## Preview Deployments

| URL type | Format | Updates |
|---|---|---|
| Hash (permanent) | `abc123def.kubern-co.pages.dev` | Never |
| Branch alias | `feat-thing.kubern-co.pages.dev` | On each push to that branch |

Branch alias: lowercased, `/` and special chars → `-`.
All preview URLs auto-receive `X-Robots-Tag: noindex`.

---

## Key Gotchas

| Gotcha | Detail |
|---|---|
| **No `404.html` = SPA mode** | Without a root `404.html`, all unmatched paths return `index.html` with 200. Always include one for a multi-page site. |
| **Extension stripping** | `/about.html` permanently 308-redirects to `/about`. Cannot be disabled. |
| **Direct upload ≠ Git** | Cannot switch between the two after project creation. |
| **`pages_build_output_dir` takes over** | Once set in `wrangler.toml`, dashboard fields it controls are locked. |
| **`_headers`/`_redirects` don't apply to Functions** | Both files only affect static asset responses, not Pages Functions responses. |
| **First proxy rule only** | Only the first `200`-status (proxy) rule in `_redirects` is applied. |
| **Free tier: 20K file limit** | Counts every file including fonts, images. Run `find . -type f | wc -l` before first deploy. |
| **Free tier: 100K req/day shared** | Functions invocations only — static asset serving is always free and unlimited. |
| **Fork PRs get no preview** | Preview URLs only created for branches within the same repo, not forks. |
| **Wrangler minimum version** | `wrangler.toml` Pages support requires wrangler ≥ 3.45.0 |
| **Rollback is dashboard-only** | No `wrangler` CLI command for rollback — use the dashboard Deployments tab. |
