interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  // Redirect pages.dev preview hostname to the custom domain for production
  if (url.hostname.endsWith(".pages.dev") && !url.hostname.startsWith("preview.")) {
    const target = `https://kubernco.com${url.pathname}${url.search}`;
    return Response.redirect(target, 301);
  }

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
