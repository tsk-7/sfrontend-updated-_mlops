import { proxySleepApi } from "@/lib/sleep-api";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const suffix = path.map(encodeURIComponent).join("/");
  const query = new URL(request.url).search;
  const endpoint = `/api/sleep-records/${suffix}${query}`;
  const method = request.method;

  if (method === "GET" || method === "DELETE") {
    return proxySleepApi(endpoint, { method });
  }

  if (method === "PUT") {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    return proxySleepApi(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return Response.json({ error: "Method not allowed." }, { status: 405 });
}

export const GET = forward;
export const PUT = forward;
export const DELETE = forward;
