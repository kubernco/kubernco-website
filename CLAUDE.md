# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

**Kubern Co LLC** — single-page marketing website for an AI-native healthcare marketing consultancy. Target client: hospital marketing directors and L&D program administrators. The site has not been built yet; `kubern-website-brief.md` is the source of truth for design, copy, and section structure.

**Final domain:** `kubernco.com`  
**Cloudflare Pages project name:** `kubern-co`

---

## Stack

Vanilla HTML/CSS/JS static site — no framework, no bundler, no build step. Deployed to Cloudflare Pages via Wrangler. The contact form uses a Pages Function (`functions/api/contact.ts`) backed by KV storage and Resend for email delivery.

---

## Dev Commands

```bash
# Local dev (serves at http://localhost:8788)
wrangler pages dev .

# Deploy to production
wrangler pages deploy . --project-name=kubern-co --branch=main

# Deploy preview
wrangler pages deploy . --project-name=kubern-co --branch=feat/some-thing

# Stream live logs
wrangler pages deployment tail --project-name=kubern-co

# Manage secrets
wrangler pages secret put RESEND_API_KEY --project-name=kubern-co
wrangler pages secret list --project-name=kubern-co
```

Local secrets go in `.dev.vars` (never commit). `wrangler pages dev` reads it automatically.

---

## Expected File Structure

```
/                         ← repo root = Cloudflare Pages build output dir
├── index.html
├── 404.html              ← required; omitting it enables SPA mode (serves index.html for all 404s)
├── css/styles.css
├── js/main.js
├── fonts/                ← self-hosted; reference with absolute paths in CSS
├── images/
├── assets/               ← SVGs, wordmark
├── _headers              ← HTTP headers (caching, CSP, security)
├── _redirects            ← URL redirects (www → apex, /home → /)
├── _routes.json          ← scope Functions to /api/* only (protects free-tier 100K req/day limit)
├── functions/
│   ├── _middleware.ts    ← global error boundary + pages.dev → custom domain redirect
│   └── api/
│       ├── _middleware.ts
│       └── contact.ts    ← POST /api/contact → KV + Resend
├── wrangler.toml
└── .dev.vars             ← NEVER COMMIT
```

---

## Design Spec

From `kubern-website-brief.md`:

- **Single-page scroll-reveal** — sections fade/slide in on scroll. Use AOS or GSAP ScrollTrigger.
- **Hero:** full viewport height, parallax background, intimate mother/newborn image (or texture overlay placeholder). No CTA on hero — let emotion land first.
- **Typography:** editorial serif pair — suggested Playfair Display + Lora (or similar). No Inter, Roboto, or Arial.
- **Color:** soft warm neutrals, deep navy/slate text. No sterile whites or hospital blues.
- **7 sections:** Hero → Problem → The Shift → What We Build → Why Kubern → How It Works → Contact form
- **Contact form fields:** Name, Hospital/Organization, Email, Message (optional). Button: "Start Getting Noticed".
- **Mobile-first** responsive; reflows cleanly at 375px.

Copy is finalized in `kubern-website-brief.md` — use it verbatim.

---

## Contact Form Architecture

HTML form → `fetch POST /api/contact` → `functions/api/contact.ts` → writes to KV (`SUBMISSIONS` binding) + fires `waitUntil` email via Resend API.

`RESEND_API_KEY` is a secret (not in `wrangler.toml`). `FROM_EMAIL` and `TO_EMAIL` are plaintext vars.

Full reference implementation is in `cloudflare-pages-ref/functions.md`.

---

## Key Cloudflare Pages Gotchas

- **No `404.html` = SPA mode** — always include one for a multi-page or clean-URL static site.
- **Extension stripping** — `/about.html` permanently 308-redirects to `/about`. Cannot be disabled.
- **`_headers` and `_redirects` do not apply to Pages Functions responses** — only static assets.
- **Bindings are not inherited between environments** in `wrangler.toml` — declare them under `[env.production]` explicitly.
- **100K Functions req/day** is shared across all Workers/Pages on the account. Use `_routes.json` to exclude static paths from Function invocation.
- **Rollback is dashboard-only** — no CLI command.
- **File limit check before first deploy:** `find . -type f | grep -v '.git' | wc -l` (free tier: 20K max).

Full reference docs in `cloudflare-pages-ref/`.

---

## Assets

Pre-existing in `/assets/`:
- `kubern logo.svg`
- `website astrikx.svg`, `website arrow.svg`
- Hero image candidates: `Mother and Baby Hero Image.jpg`, `hereo header image.jpg`
- Layout reference: `Webpage layout.jpg`
