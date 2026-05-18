interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  // Note: pages.dev → kubernco.com redirect intentionally disabled until the
  // custom domain is pointed at Cloudflare. Re-enable once kubernco.com resolves.

  let response: Response;
  try {
    response = await context.next();
  } catch (err) {
    console.error("Unhandled error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  const headers = new Headers(response.headers);
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
