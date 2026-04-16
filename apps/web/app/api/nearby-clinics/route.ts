import { NextRequest, NextResponse } from "next/server";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

async function fetchOverpass(endpoint: string, query: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const body = new URLSearchParams({ data: query });
    return await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "KinetiCare-HealthApp/1.0 (clinic-nearby-search)",
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  const radius = req.nextUrl.searchParams.get("radius") ?? "5000";

  if (!lat || !lng) return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 });

  const overpassQuery = `
    [out:json][timeout:30];
    (
      node["amenity"~"hospital|clinic|doctors|pharmacy|health_centre"](around:${radius},${lat},${lng});
      way["amenity"~"hospital|clinic|doctors|pharmacy|health_centre"](around:${radius},${lat},${lng});
      node["healthcare"~"hospital|clinic|doctor|pharmacy"](around:${radius},${lat},${lng});
    );
    out center 80;
  `;

  let lastError = "Unknown upstream error";

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchOverpass(endpoint, overpassQuery);
      if (!res.ok) {
        lastError = `${endpoint} returned ${res.status}`;
        continue;
      }

      const data = await res.json();
      if (Array.isArray(data?.elements)) {
        return NextResponse.json(data);
      }

      lastError = `${endpoint} returned malformed JSON`;
    } catch (err) {
      lastError = err instanceof Error ? `${endpoint} failed: ${err.message}` : `${endpoint} failed`;
    }
  }

  return NextResponse.json(
    {
      error: "Clinic provider is temporarily unavailable",
      details: lastError,
      elements: [],
    },
    { status: 503 },
  );
}
