interface Env {
  SUBMISSIONS: KVNamespace;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  TO_EMAIL: string;
}

interface ContactPayload {
  name: string;
  organization: string;
  email: string;
  message?: string;
}

function clean(s: unknown, max = 2000): string {
  return typeof s === "string" ? s.trim().slice(0, max) : "";
}

function validate(d: ContactPayload): string | null {
  if (!d.name || d.name.length < 2) return "Name is required";
  if (!d.organization || d.organization.length < 2) return "Organization is required";
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return "Valid email required";
  return null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: Record<string, unknown>;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: ContactPayload = {
    name: clean(body.name, 200),
    organization: clean(body.organization, 200),
    email: clean(body.email, 320).toLowerCase(),
    message: clean(body.message, 4000),
  };

  const err = validate(data);
  if (err) return Response.json({ error: err }, { status: 400 });

  const id = `submission:${Date.now()}:${crypto.randomUUID()}`;
  await context.env.SUBMISSIONS.put(
    id,
    JSON.stringify({
      ...data,
      receivedAt: new Date().toISOString(),
      ip: context.request.headers.get("cf-connecting-ip") ?? null,
      country: context.request.headers.get("cf-ipcountry") ?? null,
    }),
    { expirationTtl: 7776000 } // 90 days
  );

  if (context.env.RESEND_API_KEY) {
    context.waitUntil(sendEmail(context.env, data));
  }

  return Response.json({ ok: true });
};

async function sendEmail(env: Env, data: ContactPayload) {
  const html = [
    `<p><strong>Name:</strong> ${esc(data.name)}</p>`,
    `<p><strong>Organization:</strong> ${esc(data.organization)}</p>`,
    `<p><strong>Email:</strong> ${esc(data.email)}</p>`,
    data.message
      ? `<p><strong>Message:</strong><br>${esc(data.message).replace(/\n/g, "<br>")}</p>`
      : "",
  ].join("");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: env.TO_EMAIL,
      reply_to: data.email,
      subject: `Kubern Co — Contact from ${data.name} (${data.organization})`,
      html,
    }),
  });
  if (!res.ok) console.error("Resend error:", await res.text());
}
