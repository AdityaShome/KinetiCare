import { NextRequest, NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongodb";

const SAMPLE_ASSESSMENTS = [
  {
    patientId: "aditya-shome",
    source: "daily-checkup",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    depression: { depression_score: 0.12, risk_band: "low" },
    ppg: { hr_bpm: 72, sbp: 118, dbp: 78, risk_band: "low" },
    kineticare: { risk_band: "low", session_quality: "good" },
    orchestrator: { overall_risk_band: "low" },
  },
  {
    patientId: "aditya-shome",
    source: "daily-checkup",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    depression: { depression_score: 0.28, risk_band: "low" },
    ppg: { hr_bpm: 78, sbp: 122, dbp: 80, risk_band: "low" },
    kineticare: { risk_band: "low", session_quality: "good" },
    orchestrator: { overall_risk_band: "low" },
  },
  {
    patientId: "aditya-shome",
    source: "daily-checkup",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    depression: { depression_score: 0.51, risk_band: "medium" },
    ppg: { hr_bpm: 88, sbp: 134, dbp: 87, risk_band: "medium" },
    kineticare: { risk_band: "medium", session_quality: "fair" },
    orchestrator: { overall_risk_band: "medium" },
  },
  {
    patientId: "aditya-shome",
    source: "daily-checkup",
    createdAt: new Date().toISOString(),
    depression: { depression_score: 0.74, risk_band: "high" },
    ppg: { hr_bpm: 97, sbp: 148, dbp: 96, risk_band: "high" },
    kineticare: { risk_band: "high", session_quality: "poor" },
    orchestrator: { overall_risk_band: "high" },
  },
];

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId")?.trim() ?? "aditya-shome";
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "30"), 1), 500);
  const days = Math.max(Number(req.nextUrl.searchParams.get("days") ?? "90"), 1);

  try {
    const db = await getMongoDb();
    const coll = db.collection("assessments");

    // Seed demo data if collection is empty for this patient
    const count = await coll.countDocuments({ patientId: "aditya-shome" });
    if (count === 0) {
      await coll.insertMany(SAMPLE_ASSESSMENTS);
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const assessments = await coll
      .find({ patientId, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({ patientId, since, assessments });
  } catch (error) {
    console.error("[patient-history] MongoDB error:", error);
    // Return seeded sample data so the dashboard always renders something useful
    return NextResponse.json({
      patientId,
      since: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      assessments: SAMPLE_ASSESSMENTS.filter((a) => a.patientId === patientId),
      warning: "MongoDB unreachable — showing demo data",
    });
  }
}
