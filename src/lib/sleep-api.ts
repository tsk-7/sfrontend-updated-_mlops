const REQUEST_TIMEOUT_MS = 55_000;

export async function proxySleepApi(
  endpoint: string,
  init: RequestInit = {},
): Promise<Response> {
  const baseUrl = process.env.SLEEP_API_BASE_URL?.replace(/\/+$/, "");

  if (!baseUrl) {
    return Response.json(
      { error: "Sleep API is not configured. Set SLEEP_API_BASE_URL on the server." },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(`${baseUrl}${endpoint}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (upstream.status === 204) return new Response(null, { status: 204 });
    const responseText = await upstream.text();
    let payload: unknown;

    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = { message: responseText || "The sleep service returned an empty response." };
    }

    return Response.json(payload, { status: upstream.status });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return Response.json(
        { error: "The sleep service took too long to respond. Render may still be waking; please try again." },
        { status: 504 },
      );
    }

    return Response.json(
      { error: "Could not reach the sleep service. It may be waking; please try again shortly." },
      { status: 502 },
    );
  }
}