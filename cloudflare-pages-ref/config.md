# Configuration, Environment, and Operations

---

## `wrangler.toml`

Optional for pure static sites. Required once you add Functions or need per-environment bindings.
Once `pages_build_output_dir` is set, this file becomes the source of truth — the corresponding dashboard fields are locked.

Minimum version: **wrangler ≥ 3.45.0**

### Minimal (static site, no Functions)

```toml
name                   = "kubern-co"
pages_build_output_dir = "."
compatibility_date     = "2026-05-17"
```

### Full Structure

```toml
name                   = "kubern-co"
pages_build_output_dir = "."
compatibility_date     = "2026-05-17"
compatibility_flags    = ["nodejs_compat"]
send_metrics           = false          # opt out of Wrangler telemetry
upload_source_maps     = true           # readable stack traces in deployment tail

# ── Plaintext vars (non-sensitive only) ────────────────────────────────────
[vars]
ENVIRONMENT = "production"
SITE_URL    = "https://kubernco.com"
FROM_EMAIL  = "hello@kubernco.com"
TO_EMAIL    = "hudson@kubernco.com"

# ── KV (contact form storage, cache) ──────────────────────────────────────
[[kv_namespaces]]
binding = "SUBMISSIONS"
id      = "<production-kv-namespace-id>"

# ── D1 (if needed) ─────────────────────────────────────────────────────────
[[d1_databases]]
binding       = "DB"
database_name = "kubern-co-db"
database_id   = "<database-id>"

# ── Analytics Engine ───────────────────────────────────────────────────────
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "site_events"

# ══ Preview overrides ══════════════════════════════════════════════════════
[env.preview]
[env.preview.vars]
ENVIRONMENT = "preview"
SITE_URL    = "https://kubern-co.pages.dev"

[[env.preview.kv_namespaces]]
binding = "SUBMISSIONS"
id      = "<preview-kv-namespace-id>"

# ══ Production overrides ═══════════════════════════════════════════════════
[env.production]
[env.production.vars]
ENVIRONMENT = "production"
SITE_URL    = "https://kubernco.com"

[[env.production.kv_namespaces]]
binding = "SUBMISSIONS"
id      = "<production-kv-namespace-id>"
```

### Key Fields

| Field | Notes |
|---|---|
| `name` | Must match your Pages project name in the dashboard |
| `pages_build_output_dir` | Required — tells Wrangler this is a Pages project |
| `compatibility_date` | Set to today on creation; update intentionally |
| `compatibility_flags` | Array; `["nodejs_compat"]` enables Node.js built-in APIs |
| `send_metrics` | Set `false` to opt out of Wrangler usage telemetry |
| `upload_source_maps` | Set `true` for readable stack traces in `deployment tail` |

**Only `preview` and `production` are valid environment names** in Pages — unlike Workers, you cannot define arbitrary envs.

**Bindings are not inherited between environments.** If you declare `[[kv_namespaces]]` at the top level and also define `[env.production]`, you must re-declare KV under `[env.production]` or it won't be available there.

---

## Environment Variables

### Plaintext Vars

Non-sensitive config only. Set in `wrangler.toml` `[vars]` or via the dashboard.
Accessed in Functions via `context.env.VAR_NAME`.

With `nodejs_compat`, also available as `process.env.VAR_NAME`.

### Secrets

API keys, tokens, passwords. **Never in `wrangler.toml` or source control.**

```bash
# Add / update a secret (interactive prompt — value never hits shell history)
wrangler pages secret put RESEND_API_KEY --project-name=kubern-co

# Bulk upload from .dev.vars
wrangler pages secret bulk .dev.vars --project-name=kubern-co

# List (names only — values never shown)
wrangler pages secret list --project-name=kubern-co

# Delete
wrangler pages secret delete RESEND_API_KEY --project-name=kubern-co
```

Secrets default to the **production** environment. Set preview-specific secrets via the dashboard toggle.

### Local Development — `.dev.vars`

```bash
# .dev.vars — never commit this file
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ENVIRONMENT=development
```

Add to `.gitignore`:
```
.dev.vars
.dev.vars.*
```

`wrangler pages dev` reads `.dev.vars` automatically. If `.dev.vars` exists, `.env` is ignored — use one format per project.

---

## Compatibility Dates and Flags

The `compatibility_date` gates which runtime changes are active. Cloudflare never breaks projects with older dates — older dates are supported indefinitely.

**Set to the current date** when creating a new project. Update intentionally when you want new runtime behaviors — test on a preview branch first.

### `nodejs_compat` Flag

Enables Node.js built-in APIs (`node:fs`, `node:path`, `node:crypto`, `node:http`, etc.) without bundling polyfills.

```toml
compatibility_flags = ["nodejs_compat"]
```

With `compatibility_date` ≥ `2024-09-23`, `nodejs_compat_v2` auto-activates (more polyfills, larger bundle). Suppress with `["nodejs_compat", "no_nodejs_compat_v2"]` if you want smaller bundles.

### Key Flag Reference

| Flag | Effect |
|---|---|
| `nodejs_compat` | Node.js built-in APIs |
| `no_nodejs_compat_v2` | Suppress v2 polyfills for smaller bundles |
| `assets_navigation_prefers_asset_serving` | Static assets served for navigation requests, reducing billable Function invocations (default after 2025-04-01) |

---

## Free Tier Limits

| Resource | Free | Pro |
|---|---|---|
| Builds/month | 500 | 5,000 |
| Concurrent builds | 1 | 5 |
| Build timeout | 20 min | 20 min |
| Files per deployment | 20,000 | 100,000 |
| Max file size | 25 MiB | 25 MiB |
| Custom domains | 100 | 250 |
| Bandwidth | Unlimited | Unlimited |
| Static asset requests | Unlimited (free) | Unlimited (free) |
| Functions invocations/day | 100K (shared with Workers) | Varies by Workers plan |
| `_headers` rules | 100 | 100 |
| Redirect rules | 2,100 | 2,100 |

**Free tier gotchas:**

- **100K Functions req/day is shared** across all Pages Functions and Workers on the account — one project can exhaust quota for all others. Resets at midnight UTC. Static serving never counts.
- **1 concurrent build** — simultaneous pushes to multiple branches queue.
- **500 builds/month ≈ 16/day** — a branch-per-PR workflow can burn through this quickly.
- **20K file limit** — check before first deploy: `find . -type f | grep -v '.git' | wc -l`
- **No SLA on free tier** — production-critical workloads should be on Pro+.

---

## Analytics

Cloudflare Web Analytics is cookieless, collects no personal data (no IPs, no user IDs), and does not require a consent banner in most jurisdictions.

**Enable:** Workers & Pages → project → **Metrics tab** → Enable Web Analytics

On the next deployment, Cloudflare injects the JS beacon automatically into valid HTML pages. No code changes needed.

**Note:** As of October 2025, free domains have Web Analytics enabled by default. Check new projects — it may already be on.

**CSP adjustment required** (see `routing.md` for the full CSP with analytics).

**Limitations:** Client-side only, no event tracking, no funnels, short data delay, 6-month retention.

---

## Build Caching

Cloudflare caches package manager caches and framework build artifacts between deployments.

**Per-project limit:** 10 GB. Cache entries expire 7 days after last read.

The first build after enabling caching writes the cache — the second build is the first to benefit.

**Clear build cache:** Workers & Pages → project → Settings → Build → Build cache → **Clear Cache**

**Skip cache for one deploy:**

```bash
wrangler pages deploy . --project-name=kubern-co --skip-caching
```

---

## Rollbacks

Rollback is **dashboard-only** — no CLI command exists.

1. Workers & Pages → project → **Deployments** tab
2. All deployments → find target → **three-dot menu** → **Rollback to this deployment**
3. Production URL switches instantly — no rebuild triggered

**Constraints:**
- Only successfully completed production deployments are valid rollback targets
- Preview deployments cannot be used as rollback targets
- You can roll forward again (to a newer deployment) after rolling back

**CLI workaround** (triggers a new build, not an instant switch):

```bash
wrangler pages deploy . --project-name=kubern-co --branch=main --commit-message="revert: rollback to v1.2.3"
```

---

## Deployment Management CLI

```bash
# List deployments
wrangler pages deployment list --project-name=kubern-co
wrangler pages deployment list --project-name=kubern-co --environment=production --json

# Live log streaming
wrangler pages deployment tail --project-name=kubern-co
wrangler pages deployment tail --project-name=kubern-co --status error
wrangler pages deployment tail --project-name=kubern-co --method POST
wrangler pages deployment tail --project-name=kubern-co --search "resend"
wrangler pages deployment tail --project-name=kubern-co --ip self

# Delete a deployment
wrangler pages deployment delete <DEPLOYMENT_ID> --project-name=kubern-co
```

Log streaming is real-time only — logs are not persisted. Enable `upload_source_maps = true` in `wrangler.toml` for readable stack traces in tail output.

---

## Pre-Launch Checklist (Free Tier)

```
[ ] compatibility_date set to a recent date
[ ] nodejs_compat in compatibility_flags if using Node.js built-ins
[ ] .dev.vars in .gitignore
[ ] All secrets set via `wrangler pages secret put` — nothing sensitive in wrangler.toml
[ ] upload_source_maps = true for readable stack traces
[ ] File count under 20,000: find . -type f | grep -v '.git' | wc -l
[ ] Build completes under 20 minutes
[ ] 404.html exists at repo root (prevents SPA mode on multi-page site)
[ ] _routes.json scopes Functions to /api/* only (protects free-tier invocation limit)
[ ] Web Analytics: decide to keep or disable (on by default for free domains since Oct 2025)
[ ] Custom domain added and SSL provisioned
[ ] www → apex (or apex → www) redirect in _redirects
[ ] pages.dev → custom domain redirect in middleware or Bulk Redirects
```
