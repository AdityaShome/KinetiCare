import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const startLat = req.nextUrl.searchParams.get("startLat");
  const startLng = req.nextUrl.searchParams.get("startLng");
  const endLat   = req.nextUrl.searchParams.get("endLat");
  const endLng   = req.nextUrl.searchParams.get("endLng");

  if (!startLat || !startLng || !endLat || !endLng) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  // OSRM public demo server — free, no API key needed
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "KinetiCare-HealthApp/1.0" },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Routing failed" }, { status: 500 });
  }
}
