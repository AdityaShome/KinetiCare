import { NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongodb";

export async function GET() {
  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    return NextResponse.json({
      status: "ok",
      service: "web",
      mongo: "connected",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({
      status: "degraded",
      service: "web",
      mongo: "disconnected",
      mongoError: message,
    });
  }
}
