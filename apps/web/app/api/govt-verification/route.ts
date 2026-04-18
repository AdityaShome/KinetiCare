import { NextRequest, NextResponse } from "next/server";

type VerificationRequest = {
  timestamp?: string;
  patient_id?: string;
  models?: {
    depression?: {
      risk_score?: number;
    };
    kineticare?: {
      neurological_risk_index?: number;
      risk_band?: string;
    };
    ppg?: {
      is_valid?: boolean;
      map?: number;
    };
    orchestrator?: {
      overall_risk_band?: string;
    };
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VerificationRequest;
    await sleep(15000);

    const depressionRisk = Number(body.models?.depression?.risk_score ?? 0);
    const neuroRisk = Number(body.models?.kineticare?.neurological_risk_index ?? 0);
    const ppgValid = Boolean(body.models?.ppg?.is_valid ?? true);
    const map = Number(body.models?.ppg?.map ?? 90);
    const orchestratorBand = String(body.models?.orchestrator?.overall_risk_band ?? "low").toLowerCase();

    const denied =
      !ppgValid ||
      depressionRisk >= 0.8 ||
      neuroRisk >= 0.65 ||
      map < 60 ||
      map > 120 ||
      orchestratorBand === "high";

    return NextResponse.json({
      status: denied ? "denied" : "accepted",
      completed_in_seconds: 15,
      reference_id: `GV-${Date.now().toString().slice(-8)}`,
      reason: denied
        ? "Government verification denied due to elevated risk or incomplete physiological validation."
        : "Government verification accepted. Report meets automated screening thresholds.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: "government_verification_failed",
        message,
      },
      { status: 500 },
    );
  }
}
