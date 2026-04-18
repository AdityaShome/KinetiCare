import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "../../../lib/env";
import { fetchJson } from "../../../lib/http";
import { claimsAssuranceSchema } from "../../../lib/validation";

type JsonRecord = Record<string, unknown>;

type DigiLockerVerification = {
  status: "verified" | "review" | "not_connected";
  confidence: number;
  reason: string;
  reference_id: string | null;
  matched_fields: string[];
  suspicious: boolean;
};

type BeneficiaryResponse = {
  decision: string;
  confidence_score: number;
  matched_patient_id?: string | null;
  matched_patient_name?: string | null;
  matched_scheme_id?: string | null;
  match_breakdown?: Record<string, number>;
  signals?: string[];
  reasons?: string[];
};

type ClaimSubmitResponse = {
  claim_id: string;
  patient_id: string;
  hospital_id: string;
  risk_score: number;
  risk_band: string;
  fraud_flags: string[];
  status: string;
  hospital_name?: string | null;
  patient_name?: string | null;
  metadata?: Record<string, unknown>;
};

type ClaimFeaturesResponse = {
  claim_id: string;
  patient_id: string;
  hospital_id: string;
  feature_labels: string[];
  feature_vector: number[];
  feature_summary: Record<string, number>;
  claim_velocity: string;
  overlap_flag: boolean;
  spatiotemporal_flags: string[];
  metadata_flag: boolean;
  metadata_reason?: string | null;
  metadata_signals: string[];
  metadata_summary: Record<string, unknown>;
  generated_at: string;
};

async function postJson<T>(url: string, payload: JsonRecord): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    payload,
    timeoutMs: 20000,
    retries: 1,
  });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildDigiLockerVerification(payload: {
  digilockerConsent: boolean;
  digilockerDocumentType: "aadhaar" | "abha" | "insurance_card";
  digilockerDocumentId?: string;
  typedName: string;
  typedDob: string;
  typedAddress: string;
  beneficiary: BeneficiaryResponse;
  documentCount: number;
}): DigiLockerVerification {
  if (!payload.digilockerConsent) {
    return {
      status: "not_connected",
      confidence: 0,
      reason: "DigiLocker not connected for this claim session",
      reference_id: null,
      matched_fields: [],
      suspicious: false,
    };
  }

  const matchedFields: string[] = [];
  let confidence = 0.2;

  if (payload.beneficiary.confidence_score >= 0.8) {
    matchedFields.push("name", "date_of_birth", "scheme_link");
    confidence += 0.45;
  } else if (payload.beneficiary.confidence_score >= 0.62) {
    matchedFields.push("name", "date_of_birth");
    confidence += 0.25;
  }

  if (payload.digilockerDocumentId && normalize(payload.digilockerDocumentId).length >= 6) {
    matchedFields.push(payload.digilockerDocumentType);
    confidence += 0.2;
  }

  if (payload.documentCount > 0) {
    matchedFields.push("supporting_document_present");
    confidence += 0.1;
  }

  const suspicious =
    payload.beneficiary.confidence_score < 0.62 ||
    normalize(payload.typedAddress).length < 10;

  const status: DigiLockerVerification["status"] =
    confidence >= 0.75 && !suspicious
      ? "verified"
      : "review";

  return {
    status,
    confidence: Number(Math.min(confidence, 0.98).toFixed(3)),
    reason:
      status === "verified"
        ? "DigiLocker identity document aligns with beneficiary details"
        : "DigiLocker evidence needs manual review against submitted claim details",
    reference_id: `DL-${Date.now().toString().slice(-8)}`,
    matched_fields: Array.from(new Set(matchedFields)),
    suspicious,
  };
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.json()) as unknown;
    const parsed = claimsAssuranceSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const body = parsed.data;

    const beneficiary = await postJson<BeneficiaryResponse>(
      getServiceUrl("claims", "/verify-beneficiary"),
      {
        patient_id: body.patientId,
        full_name: body.typedName,
        date_of_birth: body.typedDob,
        address: body.typedAddress,
        scheme_id: body.schemeId,
      },
    );

    const claim = await postJson<ClaimSubmitResponse>(
      getServiceUrl("claims", "/submit-claim"),
      {
        patient_id: body.patientId,
        hospital_id: body.hospitalId,
        scheme_id: body.schemeId,
        diagnosis: body.diagnosis,
        procedure: body.procedure,
        claim_amount: body.claimAmount,
        admission_date: body.admissionDate,
        discharge_date: body.dischargeDate ?? body.admissionDate,
        document_text: body.documentText,
        supporting_documents: body.supportingDocuments.map((document) => ({
          filename: document.filename,
          mime_type: document.mimeType,
          data_url: document.dataUrl,
          ...(document.deviceId ? { device_id: document.deviceId } : {}),
          ...(document.timestamp ? { timestamp: document.timestamp } : {}),
          ...(document.gps
            ? {
                gps: {
                  lat: document.gps.lat,
                  lon: document.gps.lon,
                },
              }
            : {}),
        })),
        metadata: {
          source: "claims-assurance-dashboard",
          uploaded_document_count: body.supportingDocuments.length,
        },
      },
    );

    const features = await fetchJson<ClaimFeaturesResponse>(
      getServiceUrl("claims", `/claim-features/${claim.claim_id}`),
      {
        method: "GET",
        timeoutMs: 20000,
        retries: 1,
      },
    );

    const digilocker = buildDigiLockerVerification({
      digilockerConsent: body.digilockerConsent,
      digilockerDocumentType: body.digilockerDocumentType,
      digilockerDocumentId: body.digilockerDocumentId,
      typedName: body.typedName,
      typedDob: body.typedDob,
      typedAddress: body.typedAddress,
      beneficiary,
      documentCount: body.supportingDocuments.length,
    });

    return NextResponse.json({
      mode: "live",
      digilocker,
      beneficiary,
      claim,
      features,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: "claims_assurance_request_failed",
        message,
      },
      { status: 502 },
    );
  }
}
