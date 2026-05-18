interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "https://kubernco.com",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const res = await context.next();
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "https://kubernco.com");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};
