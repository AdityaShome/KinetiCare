import { NextRequest, NextResponse } from "next/server";

type DoctorDecision = "denied" | "bed_rest" | "revisit" | "accepted_hospital";

type VerificationPayload = {
  patientId?: string;
  doctorName?: string;
  clinicName?: string;
  disease?: string;
  nextProcedure?: string;
  doctorDecision?: DoctorDecision;
  prescriptionImage?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VerificationPayload;

    if (!body.doctorName || !body.clinicName || !body.disease || !body.nextProcedure || !body.doctorDecision) {
      return NextResponse.json(
        { error: "Missing doctor verification fields" },
        { status: 400 },
      );
    }

    const eligible = body.doctorDecision === "accepted_hospital";

    return NextResponse.json({
      status: eligible ? "eligible" : "not_eligible",
      eligible,
      doctor_decision: body.doctorDecision,
      summary:
        body.doctorDecision === "accepted_hospital"
          ? "Local doctor approved hospital escalation. Patient is eligible for hospital admission."
          : body.doctorDecision === "revisit"
            ? "Local doctor requested a revisit before hospital eligibility can be granted."
            : body.doctorDecision === "bed_rest"
              ? "Local doctor advised bed rest and observation instead of hospital escalation."
              : "Local doctor denied escalation based on current clinical presentation.",
      reference_id: `LDV-${Date.now().toString().slice(-8)}`,
      uploaded_prescription: Boolean(body.prescriptionImage),
      next_procedure: body.nextProcedure,
      disease: body.disease,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: "local_doctor_verification_failed",
        message,
      },
      { status: 500 },
    );
  }
}
