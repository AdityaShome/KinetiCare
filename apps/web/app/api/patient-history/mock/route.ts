import { NextResponse } from "next/server";
import { getMongoDb } from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

// Sample assessments data for demo purposes
const SAMPLE_ASSESSMENTS = [
  {
    patientId: "aditya-shome",
    source: "daily-checkup",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    depression: { depression_score: 0.12, risk_band: "low" },
    ppg: { hr_bpm: 72, sbp: 118, dbp: 78, risk_band: "low" },
    kineticare: { risk_band: "low", session_quality: "good" },
    orchestrator: { overall_risk_band: "low" },
  },
  {
    patientId: "aditya-shome",
    source: "daily-checkup",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    depression: { depression_score: 0.45, risk_band: "medium" },
    ppg: { hr_bpm: 85, sbp: 130, dbp: 85, risk_band: "medium" },
    kineticare: { risk_band: "medium", session_quality: "fair" },
    orchestrator: { overall_risk_band: "medium" },
  },
  {
    patientId: "aditya-shome",
    source: "daily-checkup",
    createdAt: new Date().toISOString(),
    depression: { depression_score: 0.78, risk_band: "high" },
    ppg: { hr_bpm: 95, sbp: 145, dbp: 95, risk_band: "high" },
    kineticare: { risk_band: "high", session_quality: "poor" },
    orchestrator: { overall_risk_band: "high" },
  },
];

export async function GET() {
  try {
    const db = await getMongoDb();
    const coll = db.collection("assessments");
    // Insert sample data if collection is empty
    const count = await coll.countDocuments({ patientId: "aditya-shome" });
    if (count === 0) {
      await coll.insertMany(SAMPLE_ASSESSMENTS.map((a) => ({ ...a, _id: new ObjectId() })));
    }
    const assessments = await coll
      .find({ patientId: "aditya-shome" })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();
    return NextResponse.json({ assessments });
  } catch (err) {
    console.error("[mock patient-history]", err);
    return NextResponse.json({ error: "Failed to generate mock data" }, { status: 500 });
  }
}
