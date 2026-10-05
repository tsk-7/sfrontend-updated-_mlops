import { proxySleepApi } from "@/lib/sleep-api";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const suffix = path.map(encodeURIComponent).join("/");
  const query = new URL(request.url).search;
  return proxySleepApi(`/api/sleep-analysis/${suffix}${query}`);
}
