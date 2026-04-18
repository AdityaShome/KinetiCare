"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Stethoscope, Upload, ShieldCheck, ShieldX } from "lucide-react";

type DoctorDecision = "denied" | "bed_rest" | "revisit" | "accepted_hospital";

type DoctorVerificationResult = {
  status: "eligible" | "not_eligible";
  eligible: boolean;
  doctor_decision: DoctorDecision;
  summary: string;
  reference_id: string;
  uploaded_prescription: boolean;
  next_procedure: string;
  disease: string;
};

export default function LocalDoctorVerificationPage() {
  const [report, setReport] = useState<any>(null);
  const [doctorName, setDoctorName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [disease, setDisease] = useState("");
  const [nextProcedure, setNextProcedure] = useState("");
  const [doctorDecision, setDoctorDecision] = useState<DoctorDecision>("revisit");
  const [prescriptionImage, setPrescriptionImage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DoctorVerificationResult | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("kinetiCare_doctorReviewReport");
    if (!raw) {
      const fallback = localStorage.getItem("kinetiCare_latestReport");
      if (fallback) {
        try {
          setReport(JSON.parse(fallback));
        } catch {}
      }
      return;
    }
    try {
      setReport(JSON.parse(raw));
    } catch {
      setError("Unable to load doctor review report context.");
    }
  }, []);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setPrescriptionImage(await toDataUrl(file));
  }

  async function submitDoctorVerification() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/local-doctor-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: report?.patient_id,
          doctorName,
          clinicName,
          disease,
          nextProcedure,
          doctorDecision,
          prescriptionImage: prescriptionImage || undefined,
        }),
      });

      const data = (await response.json()) as DoctorVerificationResult | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data && typeof data.error === "string" ? data.error : "Doctor verification failed");
      }

      setResult(data as DoctorVerificationResult);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Doctor verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #ecfeff 100%)", padding: "40px 24px", color: "#0f172a", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 24 }}>
        <section style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 24, padding: 28, boxShadow: "0 20px 45px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(8,145,178,0.1)", color: "#0c4a6e", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                <Stethoscope size={14} />
                Local Doctor Verification Project
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.04 }}>Doctor Escalation Review</h1>
              <p style={{ margin: 0, maxWidth: 820, color: "#475569", lineHeight: 1.7 }}>
                Government verification was denied, so this separate doctor review flow lets a local clinician record the disease,
                upload a prescription photo, and decide whether the patient should rest, revisit, remain denied, or be accepted for hospital.
              </p>
            </div>
            <Link href="/patient-report" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.12)", color: "#0f172a", textDecoration: "none", fontWeight: 700 }}>
              <ArrowLeft size={16} />
              Back to Report
            </Link>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 0.95fr) minmax(340px, 1.05fr)", gap: 24 }}>
          <section style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 24, padding: 24, boxShadow: "0 20px 45px rgba(15,23,42,0.06)" }}>
            <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 22 }}>Doctor Review Form</h2>

            <FormField label="Doctor Name">
              <input value={doctorName} onChange={(event) => setDoctorName(event.target.value)} style={inputStyle()} placeholder="Dr. Priya Menon" />
            </FormField>

            <FormField label="Clinic / Hospital">
              <input value={clinicName} onChange={(event) => setClinicName(event.target.value)} style={inputStyle()} placeholder="Community Health Centre" />
            </FormField>

            <FormField label="Disease / Diagnosis">
              <textarea value={disease} onChange={(event) => setDisease(event.target.value)} style={{ ...inputStyle(), minHeight: 96, resize: "vertical" }} placeholder="Viral fever with dehydration risk" />
            </FormField>

            <FormField label="Suggested Next Procedure">
              <textarea value={nextProcedure} onChange={(event) => setNextProcedure(event.target.value)} style={{ ...inputStyle(), minHeight: 96, resize: "vertical" }} placeholder="Monitor vitals, oral fluids, CBC review in 48 hours" />
            </FormField>

            <FormField label="Doctor Decision">
              <select value={doctorDecision} onChange={(event) => setDoctorDecision(event.target.value as DoctorDecision)} style={inputStyle()}>
                <option value="denied">Denied</option>
                <option value="bed_rest">Take Bed Rest</option>
                <option value="revisit">Revisit</option>
                <option value="accepted_hospital">Accepted for Hospital</option>
              </select>
            </FormField>

            <FormField label="Upload Prescription Photo">
              <label style={{ ...uploadStyle(), cursor: "pointer" }}>
                <Upload size={18} />
                <span>{prescriptionImage ? "Prescription image attached" : "Select prescription photo"}</span>
                <input type="file" accept="image/*" onChange={(event) => void onFileChange(event)} style={{ display: "none" }} />
              </label>
            </FormField>

            {error ? (
              <div style={{ marginTop: 14, borderRadius: 14, padding: "12px 14px", background: "rgba(254,242,242,1)", border: "1px solid rgba(220,38,38,0.18)", color: "#991b1b" }}>
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void submitDoctorVerification()}
              disabled={submitting}
              style={{
                marginTop: 18,
                width: "100%",
                border: "none",
                borderRadius: 16,
                padding: "14px 18px",
                background: "linear-gradient(135deg, #0f766e 0%, #0284c7 100%)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 15,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.85 : 1,
              }}
            >
              {submitting ? "Submitting Doctor Verification..." : "Submit Doctor Verification"}
            </button>
          </section>

          <section style={{ display: "grid", gap: 24 }}>
            <article style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 24, padding: 24, boxShadow: "0 20px 45px rgba(15,23,42,0.06)" }}>
              <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 22 }}>Review Context</h2>
              <div style={{ display: "grid", gap: 12 }}>
                <InfoRow label="Patient ID" value={report?.patient_id || "Unavailable"} />
                <InfoRow label="Report Timestamp" value={report?.timestamp ? new Date(report.timestamp).toLocaleString() : "Unavailable"} />
                <InfoRow label="Orchestrator Summary" value={report?.models?.orchestrator?.summary || report?.models?.orchestrator?.analysis || "Unavailable"} />
              </div>
            </article>

            <article style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 24, padding: 24, boxShadow: "0 20px 45px rgba(15,23,42,0.06)" }}>
              <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 22 }}>Eligibility Outcome</h2>

              {result ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    {result.eligible ? <ShieldCheck color="#166534" size={22} /> : <ShieldX color="#991b1b" size={22} />}
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        background: result.eligible ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                        color: result.eligible ? "#166534" : "#991b1b",
                        fontWeight: 800,
                        fontSize: 12,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {result.status === "eligible" ? "Eligible" : "Not Eligible"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    <InfoRow label="Doctor Decision" value={formatDecision(result.doctor_decision)} />
                    <InfoRow label="Reference ID" value={result.reference_id} />
                    <InfoRow label="Disease" value={result.disease} />
                    <InfoRow label="Next Procedure" value={result.next_procedure} />
                    <InfoRow label="Summary" value={result.summary} />
                  </div>
                </>
              ) : (
                <div style={{ color: "#475569", lineHeight: 1.7 }}>
                  The final doctor decision will appear here. If the doctor selects <strong>Accepted for Hospital</strong>,
                  the patient becomes eligible for hospital escalation.
                </div>
              )}
            </article>

            <article style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 24, padding: 24, boxShadow: "0 20px 45px rgba(15,23,42,0.06)" }}>
              <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 22 }}>Doctor Workflow</h2>
              <ol style={{ margin: 0, paddingLeft: 18, color: "#475569", lineHeight: 1.8 }}>
                <li>The patient visits a local doctor after government denial.</li>
                <li>The doctor reviews symptoms and uploads a prescription photo.</li>
                <li>The doctor records the disease and suggested next procedure.</li>
                <li>The doctor chooses one outcome: denied, bed rest, revisit, or accepted for hospital.</li>
                <li>If accepted for hospital, the patient becomes eligible for admission escalation.</li>
              </ol>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", marginBottom: 6, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0c4a6e", fontWeight: 700 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#f8fafc", padding: "12px 14px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0369a1", fontWeight: 800, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: "#0f172a", lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "#fff",
    color: "#0f172a",
    padding: "12px 14px",
    outline: "none",
  };
}

function uploadStyle(): React.CSSProperties {
  return {
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    border: "1px dashed rgba(14,116,144,0.35)",
    background: "rgba(236,254,255,0.8)",
    color: "#0c4a6e",
    padding: "14px 16px",
    fontWeight: 700,
  };
}

function formatDecision(value: DoctorDecision): string {
  if (value === "accepted_hospital") {
    return "Accepted for Hospital";
  }
  if (value === "bed_rest") {
    return "Take Bed Rest";
  }
  if (value === "revisit") {
    return "Revisit";
  }
  return "Denied";
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read image"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}
