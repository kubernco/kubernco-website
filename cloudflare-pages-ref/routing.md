# Routing, Headers, and Domains

Both `_redirects` and `_headers` are plain text files with no extension.
Place them in the **build output directory** (repo root for this project).
Cloudflare strips them from the file tree — they are never served as downloadable assets.

---

## `_redirects`

### Syntax

```
[source]  [destination]  [status?]
```

One rule per line. Separate fields with whitespace. Comments start with `#`.
Default status if omitted: `302`.

### Status Codes

| Code | Type | Notes |
|---|---|---|
| `301` | Permanent | Cached by browsers |
| `302` | Temporary | Default when omitted |
| `307` | Temporary | Preserves HTTP method |
| `308` | Permanent | Preserves HTTP method |
| `200` | Proxy / rewrite | Serves destination content at source URL — relative paths only, no external domains |

### Wildcards and Placeholders

```
# Splat — greedy, one per rule, captured as :splat
/blog/*          /articles/:splat          301

# Named placeholder — matches one path segment (not / or .)
/users/:id/profile   /profiles/:id         301
```

### Precedence

- Rules evaluated **top to bottom** — first match wins
- Static rules (no wildcards) before dynamic rules
- `_redirects` fires before `_headers`; if a redirect matches, headers rules are skipped

### Limits

| Type | Limit |
|---|---|
| Static rules | 2,000 |
| Dynamic rules (wildcards/placeholders) | 100 |
| Total | 2,100 |
| Characters per line | 1,000 |

Exceeding 2,100 rules → use Cloudflare Bulk Redirects (account-level, dashboard).

### Production `_redirects`

```
# ── Exact renames ──────────────────────────────────────────────────────────
/home                      /                                  301
/about-us                  /about                             301

# ── Canonicalize www → apex (or reverse — pick one) ───────────────────────
https://www.kubernco.com/* https://kubernco.com/:splat        301

# ── Catch-all (SPA fallback — only if using a JS router) ──────────────────
# Leave this out for a multi-page static site with real HTML files
# /*                       /index.html                        200
```

---

## `_headers`

### Syntax

```
[url-pattern]
  Header-Name: value
  Another-Header: value
```

Pattern line: not indented. Header lines: indented with at least one space or tab.

### URL Pattern Forms

```
/secure/page                # exact path
/static/*                   # wildcard
https://kubern-co.pages.dev/*       # absolute URL
https://:project.pages.dev/*        # all pages.dev subdomains
```

### Remove a Header

Prepend with `! ` to remove a header set by a prior rule or Cloudflare default:

```
/*.jpg
  ! Content-Security-Policy
```

### Limits: 100 rules, 2,000 chars per line

Headers do NOT apply to Pages Functions responses — only static assets.

---

### Production `_headers` for This Project

```
# ── Prevent indexing of pages.dev and preview URLs ────────────────────────
https://:project.pages.dev/*
  X-Robots-Tag: noindex

https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex

# ── HTML: never cache in browser ──────────────────────────────────────────
/*.html
  Cache-Control: no-cache, no-store, must-revalidate

/
  Cache-Control: no-cache, no-store, must-revalidate

# ── Fingerprinted CSS/JS: cache forever ───────────────────────────────────
# Only use immutable if filenames include a content hash
/css/*
  Cache-Control: public, max-age=31536000, immutable

/js/*
  Cache-Control: public, max-age=31536000, immutable

# ── Self-hosted fonts: cache forever + CORS ───────────────────────────────
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *

# ── Images: 7-day cache (no immutable — may change without hash) ──────────
/images/*
  Cache-Control: public, max-age=604800

/assets/*
  Cache-Control: public, max-age=604800

# ── Security headers: applied globally ────────────────────────────────────
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
```

**CSP adjustment if loading Inter from Google Fonts:**

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
```

**CSP adjustment if using Cloudflare Web Analytics:**

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests
```

---

## Caching Strategy

| Asset type | `Cache-Control` | Notes |
|---|---|---|
| HTML | `no-cache, no-store, must-revalidate` | Always revalidate — ensures updated HTML is immediate |
| CSS/JS (hashed filenames) | `public, max-age=31536000, immutable` | Never changes at this URL; browser skips revalidation entirely |
| Fonts | `public, max-age=31536000, immutable` | Same — fonts never change |
| Images (no hash) | `public, max-age=604800` | 7 days; omit `immutable` since file may be replaced |
| SVG assets | `public, max-age=604800` | 7 days |

**Cloudflare CDN**: automatically invalidates its edge cache on each new deployment. The `no-cache` on HTML is primarily for the browser's local cache, not Cloudflare's.

**`immutable` matters**: without it, even `max-age=31536000` triggers a conditional `If-None-Match` revalidation request on reload. With `immutable`, the browser serves from disk with zero network activity until TTL expires.

---

## Custom Domains

### Cloudflare-Managed DNS (Recommended)

When the domain is already a Cloudflare zone on the same account:

1. Workers & Pages → project → **Custom domains** tab
2. **Set up a domain** → enter `kubernco.com` or `www.kubernco.com`
3. Cloudflare auto-creates the DNS record and provisions SSL

> Do NOT manually add a CNAME before completing this flow — causes 522 errors.

### External DNS (subdomain only)

For `www.kubernco.com` when DNS is managed elsewhere (Route 53, Namecheap, etc.):

1. Complete the dashboard **Set up a domain** flow first
2. Then in your external DNS provider:

```
Type:  CNAME
Name:  www
Value: kubern-co.pages.dev
TTL:   3600
```

Apex domains (`kubernco.com`) **require Cloudflare DNS** — CNAME flattening is a Cloudflare-specific feature that makes apex CNAMEs work.

### Both Apex and www

Add both as separate custom domains, then canonicalize with `_redirects`:

```
# Canonicalize to apex (or flip to www — pick one direction)
https://www.kubernco.com/*  https://kubernco.com/:splat  301
```

SSL is automatically provisioned and renewed for all custom domains.

---

## `pages.dev` Subdomain

The `kubern-co.pages.dev` subdomain cannot be renamed or disabled natively.
To prevent public access to it while keeping the custom domain public:

**Option A — Bulk Redirect (code-free):**
Account-level rule: `kubern-co.pages.dev/*` → `https://kubernco.com/$1` (301)

**Option B — Middleware (requires Functions):**

```js
// functions/_middleware.js
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (url.hostname.endsWith('.pages.dev')) {
    return Response.redirect(`https://kubernco.com${url.pathname}${url.search}`, 301);
  }
  return next();
}
```

**Option C — Cloudflare Access:** Apply an Access policy to `*.kubern-co.pages.dev` requiring login, while adding a Bypass policy to `kubernco.com`.

---

## Preview Deployments

### URL Formats

| Type | URL |
|---|---|
| Production | `kubern-co.pages.dev` (or custom domain) |
| Commit hash | `abc123def.kubern-co.pages.dev` |
| Branch alias | `feat-new-nav.kubern-co.pages.dev` |

All preview URLs auto-receive `X-Robots-Tag: noindex`.

### Disable Previews Entirely

Settings → Builds & deployments → Preview deployments → **None**.

### Selective Branch Builds

Settings → Builds & deployments → **Configure preview deployments** → Custom branches:

```
# Only conventionally-named branches
Include: feat/*, fix/*, chore/*

# Skip dependabot
Include: *
Exclude: dependabot/*
```

Excludes are evaluated before includes.
