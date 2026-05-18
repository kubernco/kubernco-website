# Pages Functions

Server-side logic that deploys with your static site. Lives in `functions/` at the project root.
Compiled into a Worker at deploy time. File path = URL route.

---

## Directory Structure

```
functions/
  _middleware.ts          → runs on every request site-wide
  index.ts                → handles /
  api/
    _middleware.ts        → runs on all /api/* requests
    contact.ts            → POST /api/contact
    event.ts              → POST /api/event
  [slug].ts               → dynamic single-segment: /anything
  [[...path]].ts          → catch-all: /a/b/c/d
```

### Route Specificity

More specific wins. For `/users/special`:
1. `functions/users/special.ts` — wins
2. `functions/users/[user].ts` — fallback
3. `functions/users/[[catchall]].ts` — last resort

### Limit Function Invocations

Create `_routes.json` in your output directory to prevent Functions from running on static paths (keeps free-tier request count low):

```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": ["/css/*", "/js/*", "/fonts/*", "/images/*", "/assets/*"]
}
```

Requests not in `include` serve static files for free, not counted toward the 100K/day limit.

---

## Function Syntax

### HTTP Method Handlers

```typescript
// functions/api/contact.ts

// Method-specific (preferred)
export const onRequestGet: PagesFunction<Env> = async (context) => { ... };
export const onRequestPost: PagesFunction<Env> = async (context) => { ... };

// Catch-all for any method
export const onRequest: PagesFunction<Env> = async (context) => { ... };
```

### The Context Object

| Property | Type | Use |
|---|---|---|
| `context.request` | `Request` | Standard Web API Request |
| `context.env` | `Env` | All vars, secrets, and bindings |
| `context.params` | `Record<string, string\|string[]>` | Dynamic route values |
| `context.data` | `Record<string, unknown>` | Pass data between middleware |
| `context.next()` | `Promise<Response>` | Call next middleware or static asset server |
| `context.waitUntil(p)` | `void` | Fire-and-forget (analytics, logging) |
| `context.passThroughOnException()` | `void` | Fall through on unhandled error |

### Access Static Assets from a Function

```typescript
export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  url.pathname = "/index.html";
  return context.env.ASSETS.fetch(url.toString());
};
```

---

## TypeScript Setup

```bash
npm install --save-dev @cloudflare/workers-types

# Generate typed Env interface from wrangler.toml
npx wrangler types --path='./functions/env.d.ts'
```

`tsconfig.json` for the `functions/` directory:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "lib": ["esnext"],
    "types": ["./env.d.ts"]
  }
}
```

If you have a root `tsconfig.json`, add `"exclude": ["functions"]` to avoid conflicts.

---

## Bindings

All declared in `wrangler.toml`, accessed via `context.env.BINDING_NAME`.

### KV Namespace

```toml
[[kv_namespaces]]
binding = "SUBMISSIONS"
id = "<namespace-id>"
```

```typescript
await context.env.SUBMISSIONS.put("key", JSON.stringify(data), { expirationTtl: 7776000 }); // 90 days
const value = await context.env.SUBMISSIONS.get("key");
await context.env.SUBMISSIONS.delete("key");
const list = await context.env.SUBMISSIONS.list({ prefix: "submission:" });
```

### D1 Database

```toml
[[d1_databases]]
binding = "DB"
database_name = "kubern-co-db"
database_id = "<database-id>"
```

```typescript
// Always use prepared statements for user input
const row = await context.env.DB.prepare(
  "SELECT * FROM contacts WHERE email = ?"
).bind(email).first();

await context.env.DB.prepare(
  "INSERT INTO contacts (email, name, created_at) VALUES (?, ?, ?)"
).bind(email, name, Date.now()).run();
```

### R2 Storage

```toml
[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "kubern-uploads"
```

```typescript
await context.env.UPLOADS.put("file.pdf", fileData, { httpMetadata: { contentType: "application/pdf" } });
const obj = await context.env.UPLOADS.get("file.pdf");
if (!obj) return new Response("Not found", { status: 404 });
return new Response(obj.body);
```

### Analytics Engine

```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "site_events"
```

```typescript
context.waitUntil(
  context.env.ANALYTICS.writeDataPoint({
    blobs: [body.type, body.path, request.headers.get("cf-ipcountry") ?? ""],
    doubles: [1],
    indexes: [body.type],
  })
);
```

---

## Middleware

`_middleware.ts` in any directory runs on all requests in that scope.
Export an array to chain multiple middleware in order.

### Global Error Boundary + Security Headers

```typescript
// functions/_middleware.ts
export async function onRequest(context: EventContext<Env, string, unknown>) {
  let response: Response;
  try {
    response = await context.next();
  } catch (err) {
    console.error("Unhandled error:", err);
    response = Response.json({ error: "Internal server error" }, { status: 500 });
  }

  const headers = new Headers(response.headers);
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

### Chaining Multiple Middleware

```typescript
// functions/api/_middleware.ts
async function cors(context) {
  const res = await context.next();
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "https://kubernco.com");
  return new Response(res.body, { ...res, headers: h });
}

async function requireApiKey(context) {
  if (context.request.headers.get("X-API-Key") !== context.env.API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }
  return context.next();
}

export const onRequest = [cors, requireApiKey];
```

### Pass Data Between Middleware

```typescript
// Middleware
async function attachUser(context) {
  context.data.user = await verifyToken(context.request.headers.get("Authorization"), context.env);
  return context.next();
}

// Function downstream
export const onRequest: PagesFunction<Env> = async (context) => {
  const user = context.data.user;
  return Response.json({ hello: user.name });
};
```

---

## Contact Form Pattern

For the Kubern Co marketing site: HTML form → Pages Function → KV storage + email.

### `wrangler.toml` bindings needed

```toml
[[kv_namespaces]]
binding = "SUBMISSIONS"
id = "<your-kv-namespace-id>"

[vars]
FROM_EMAIL = "hello@kubernco.com"
TO_EMAIL   = "hudson@kubernco.com"
```

Secret (set via CLI, not toml): `RESEND_API_KEY`

### HTML Form

```html
<form id="contact-form">
  <label>Name<input type="text" name="name" required minlength="2" maxlength="100"></label>
  <label>Email<input type="email" name="email" required></label>
  <label>Message<textarea name="message" required minlength="10" maxlength="2000"></textarea></label>
  <button type="submit">Send message</button>
</form>

<script>
  document.getElementById("contact-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await fetch("/api/contact", { method: "POST", body: new FormData(e.target) });
    const data = await res.json();
    // handle data.ok / data.error
  });
</script>
```

### Pages Function

```typescript
// functions/api/contact.ts

interface Env {
  SUBMISSIONS: KVNamespace;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  TO_EMAIL: string;
}

function validate(d: Record<string, string>): string | null {
  if (!d.name || d.name.trim().length < 2) return "Name is required";
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return "Valid email required";
  if (!d.message || d.message.trim().length < 10) return "Message must be at least 10 characters";
  return null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const ct = context.request.headers.get("Content-Type") ?? "";
  if (!ct.includes("multipart/form-data") && !ct.includes("application/x-www-form-urlencoded")) {
    return Response.json({ error: "Unsupported media type" }, { status: 415 });
  }

  const fd = await context.request.formData();
  const data = {
    name:    (fd.get("name")    as string ?? "").trim(),
    email:   (fd.get("email")   as string ?? "").trim().toLowerCase(),
    message: (fd.get("message") as string ?? "").trim(),
  };

  const err = validate(data);
  if (err) return Response.json({ error: err }, { status: 400 });

  const id = `submission:${Date.now()}:${crypto.randomUUID()}`;
  await context.env.SUBMISSIONS.put(id, JSON.stringify({ ...data, receivedAt: new Date().toISOString() }), {
    expirationTtl: 7776000, // 90 days
  });

  context.waitUntil(sendEmail(context.env, data));

  return Response.json({ ok: true });
};

async function sendEmail(env: Env, data: { name: string; email: string; message: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: env.TO_EMAIL,
      reply_to: data.email,
      subject: `Contact: ${data.name}`,
      html: `<p><b>Name:</b> ${esc(data.name)}</p><p><b>Email:</b> ${esc(data.email)}</p><p><b>Message:</b><br>${esc(data.message).replace(/\n/g, "<br>")}</p>`,
    }),
  });
  if (!res.ok) console.error("Resend error:", await res.text());
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
```

---

## Limits

| Resource | Free | Workers Paid |
|---|---|---|
| CPU time per request | 10 ms | 30 s (configurable to 5 min) |
| Memory | 128 MB | 128 MB |
| Subrequests (KV, fetch, etc.) | 50 | 10,000 |
| Script size (compressed) | 3 MB | 10 MB |
| Functions invocations/day | 100K (shared with Workers) | ~10M/month included |

10 ms CPU is wall-clock execution only — I/O (KV reads, `fetch` calls) does not count. A simple contact form handler comfortably fits in 10 ms.

Static asset requests are **always free and unlimited** on all plans.

---

## Local Development

```bash
wrangler pages dev .                   # auto-reads wrangler.toml
wrangler pages dev . --kv SUBMISSIONS  # explicit KV binding emulation
wrangler pages dev . --d1 DB           # explicit D1 emulation
```

With `wrangler.toml` bindings declared, `wrangler pages dev` emulates them automatically via Miniflare. State persists in `.wrangler/state/` between runs.

Local secrets go in `.dev.vars` (see `config.md`).

---

## Workers vs Pages Functions

Use Pages Functions when you need a handful of API endpoints attached to your site.
Use a standalone Worker when you need:

- Cron Triggers (scheduled jobs)
- Queue Consumers
- Durable Object class definitions
- Logpush / Tail Workers
- Gradual deployments / rollbacks

For the Kubern Co marketing site, Pages Functions handles everything:

| Need | Solution |
|---|---|
| Contact form | `functions/api/contact.ts` |
| Analytics events | `functions/api/event.ts` + `waitUntil` |
| Global security headers | `functions/_middleware.ts` |
| Redirect `pages.dev` to custom domain | `functions/_middleware.ts` |
