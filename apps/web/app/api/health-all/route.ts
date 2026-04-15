import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "../../../lib/env";
import { fetchJson } from "../../../lib/http";

const FULL_SERVICES: Record<string, string> = {
  web: getServiceUrl("web", "/api/health"),
  depression: getServiceUrl("depression", "/health"),
  ppg: getServiceUrl("ppg", "/health"),
  orchestrator: getServiceUrl("orchestrator", "/health"),
  kineticare: getServiceUrl("kineticare", "/health"),
  blood: getServiceUrl("blood", "/health"),
  nervous: getServiceUrl("nervous", "/health"),
};
const DEFAULT_SERVICES: Record<string, string> = {
  web: FULL_SERVICES.web,
};

async function check(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const data = await fetchJson<{ status?: string; service?: string }>(url, {
      method: "GET",
      timeoutMs: 1200,
      retries: 0,
    });
    return { ok: true, message: `${data.service ?? "service"}:${data.status ?? "ok"}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unreachable";
    return { ok: false, message: msg };
  }
}

export async function GET(request: NextRequest) {
  const full = request.nextUrl.searchParams.get("full") === "1";
  const services = full ? FULL_SERVICES : DEFAULT_SERVICES;
  const entries = await Promise.all(
    Object.entries(services).map(async ([name, url]) => [name, await check(url)] as const),
  );
  return NextResponse.json(Object.fromEntries(entries));
}
