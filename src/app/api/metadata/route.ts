import { proxySleepApi } from "@/lib/sleep-api";

export const runtime = "nodejs";
export const maxDuration = 60;

export function GET() {
  return proxySleepApi("/metadata");
}