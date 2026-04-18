"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

type Decision = "approved" | "review" | "rejected";
type SchemeId = "AB-ArK" | "Yeshasvini";

type BeneficiaryRecord = {
  id: string;
  fullName: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  schemeId: SchemeId;
};

type UploadedDocument = {
  filename: string;
  mimeType: string;
  dataUrl: string;
  sizeKb: number;
  lastModifiedIso: string;
};

type MetadataDocumentSummary = {
  document: string;
  timestamp?: string | null;
  device_id?: string | null;
  gps?: {
    lat: number;
    lon: number;
  } | null;
  hospital_distance_km?: number;
  camera_make?: string | null;
  camera_model?: string | null;
  has_exif?: boolean;
};

type DashboardResponse = {
  mode: string;
  digilocker: {
    status: "verified" | "review" | "not_connected";
    confidence: number;
    reason: string;
    reference_id?: string | null;
    matched_fields: string[];
    suspicious: boolean;
  };
  beneficiary: {
    decision: Decision;
    confidence_score: number;
    matched_patient_id?: string | null;
    matched_patient_name?: string | null;
    matched_scheme_id?: string | null;
    signals?: string[];
    reasons?: string[];
  };
  claim: {
    claim_id: string;
    risk_score: number;
    risk_band: string;
    fraud_flags: string[];
    status: string;
    hospital_name?: string | null;
    patient_name?: string | null;
  };
  features: {
    feature_labels: string[];
    feature_vector: number[];
    feature_summary: Record<string, number>;
    claim_velocity: string;
    overlap_flag: boolean;
    spatiotemporal_flags: string[];
    metadata_flag: boolean;
    metadata_reason?: string | null;
    metadata_signals: string[];
    metadata_summary: {
      metadata_flag?: boolean;
      reason?: string | null;
      signals?: string[];
      documents?: MetadataDocumentSummary[];
      reused_device_patient_count?: number;
      location_mismatch_distance_km?: number;
    };
  };
};

const MOCK_BENEFICIARIES: BeneficiaryRecord[] = [
  {
    id: "PAT-1001",
    fullName: "Ananya Rao",
    dob: "1985-06-14",
    address: "12 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    schemeId: "AB-ArK",
  },
  {
    id: "PAT-1002",
    fullName: "Suresh Patil",
    dob: "1979-09-23",
    address: "4 Residency Road",
    city: "Mysuru",
    state: "Karnataka",
    schemeId: "Yeshasvini",
  },
  {
    id: "PAT-1003",
    fullName: "Meera Iyer",
    dob: "1991-02-10",
    address: "18 Anna Salai",
    city: "Chennai",
    state: "Tamil Nadu",
    schemeId: "AB-ArK",
  },
];

const HOSPITAL_NAMES: Record<string, string> = {
  "HOSP-2001": "City Care Hospital",
  "HOSP-2002": "Sri Lakshmi Surgical Centre",
  "HOSP-2003": "Metro Public Hospital",
};

const HOSPITAL_QUERIES: Record<string, string> = {
  "HOSP-2001": "City Care Hospital Bengaluru Karnataka",
  "HOSP-2002": "Sri Lakshmi Surgical Centre Mysuru Karnataka",
  "HOSP-2003": "Metro Public Hospital Chennai Tamil Nadu",
};

export default function ClaimsAssurancePage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [selectedPatientId, setSelectedPatientId] = useState("PAT-1001");
  const [hospitalId, setHospitalId] = useState("HOSP-2001");
  const [hospitalQuery, setHospitalQuery] = useState(HOSPITAL_QUERIES["HOSP-2001"]);
  const [admissionDate, setAdmissionDate] = useState("2026-04-17");
  const [claimAmount, setClaimAmount] = useState(24800);
  const [typedName, setTypedName] = useState("Ananya R.");
  const [typedAddress, setTypedAddress] = useState("12 MG Rd, Bengaluru");
  const [typedDob, setTypedDob] = useState("1985-06-14");
  const [digilockerConsent, setDigilockerConsent] = useState(true);
  const [digilockerDocumentType, setDigilockerDocumentType] = useState<"aadhaar" | "abha" | "insurance_card">("aadhaar");
  const [digilockerDocumentId, setDigilockerDocumentId] = useState("AADHAAR-9842");
  const [manualDeviceId, setManualDeviceId] = useState("DEVICE-CLAIMS-DEMO-01");
  const [manualTimestamp, setManualTimestamp] = useState("");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DashboardResponse | null>(null);
  const [hospitalLookupLabel, setHospitalLookupLabel] = useState("Resolving hospital...");
  const [resolvedBackendHospitalName, setResolvedBackendHospitalName] = useState(HOSPITAL_NAMES["HOSP-2001"]);

  const patient = useMemo(
    () => MOCK_BENEFICIARIES.find((p) => p.id === selectedPatientId) ?? MOCK_BENEFICIARIES[0],
    [selectedPatientId],
  );

  const isDark = theme === "dark";
  const palette = {
    pageBg: isDark
      ? "radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.12), transparent 40%), radial-gradient(circle at 80% 10%, rgba(59, 130, 246, 0.14), transparent 35%), linear-gradient(150deg, #061a16 0%, #0c2430 52%, #111827 100%)"
      : "radial-gradient(circle at 15% 15%, rgba(34, 197, 94, 0.15), transparent 35%), radial-gradient(circle at 85% 8%, rgba(56, 189, 248, 0.18), transparent 38%), linear-gradient(160deg, #f8fafc 0%, #ecfeff 52%, #f0fdf4 100%)",
    text: isDark ? "#ecfeff" : "#0f172a",
    titleAccent: isDark ? "#7dd3fc" : "#0369a1",
    subtitle: isDark ? "#a5f3fc" : "#155e75",
    cardBg: isDark ? "rgba(2, 6, 23, 0.58)" : "rgba(255, 255, 255, 0.82)",
    cardBorder: isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(15, 23, 42, 0.12)",
    inputBg: isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.95)",
    inputText: isDark ? "#e2e8f0" : "#0f172a",
    inputBorder: isDark ? "rgba(148, 163, 184, 0.4)" : "rgba(15, 23, 42, 0.22)",
    monoBg: isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(240, 249, 255, 0.9)",
    monoText: isDark ? "#bae6fd" : "#0c4a6e",
    helper: isDark ? "#94a3b8" : "#475569",
    metricInnerBg: isDark ? "rgba(15, 23, 42, 0.62)" : "rgba(248, 250, 252, 0.95)",
  };

  useEffect(() => {
    let cancelled = false;

    async function resolveHospitalLocation() {
      const query = hospitalQuery.trim() || HOSPITAL_NAMES[hospitalId] || hospitalId;
      setHospitalLookupLabel("Resolving hospital...");

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const data = (await response.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
        if (!response.ok || !Array.isArray(data) || data.length === 0) {
          throw new Error("Hospital geocoding returned no match");
        }

        const best = data[0];
        if (cancelled) {
          return;
        }
        setHospitalLookupLabel(best.display_name ?? query);

        const matchedHospitalId =
          Object.entries(HOSPITAL_QUERIES).find(([, knownQuery]) => knownQuery.toLowerCase() === query.toLowerCase())?.[0] ??
          Object.entries(HOSPITAL_NAMES).find(([, knownName]) => knownName.toLowerCase() === query.toLowerCase())?.[0] ??
          hospitalId;

        setHospitalId(matchedHospitalId);
        setResolvedBackendHospitalName(HOSPITAL_NAMES[matchedHospitalId] ?? HOSPITAL_NAMES[hospitalId]);
      } catch {
        if (!cancelled) {
          setHospitalLookupLabel("Hospital location unavailable");
        }
      }
    }

    void resolveHospitalLocation();

    return () => {
      cancelled = true;
    };
  }, [hospitalId, hospitalQuery]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const nextDocuments = await Promise.all(
      files.slice(0, 4).map(async (file) => ({
        filename: file.name,
        mimeType: file.type || "image/jpeg",
        dataUrl: await toDataUrl(file),
        sizeKb: Math.round(file.size / 1024),
        lastModifiedIso: new Date(file.lastModified).toISOString(),
      })),
    );

    setDocuments(nextDocuments);
    setError(null);
  }

  async function handleAnalyze() {
    setSubmitting(true);
    setError(null);

    try {
      const supportingDocuments = documents.map((document) => ({
        filename: document.filename,
        mimeType: document.mimeType,
        dataUrl: document.dataUrl,
        deviceId: manualDeviceId.trim() || undefined,
        timestamp: manualTimestamp.trim() || document.lastModifiedIso,
      }));

      const response = await fetch("/api/claims-assurance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: patient.id,
          hospitalId,
          schemeId: patient.schemeId,
          digilockerConsent,
          digilockerDocumentType,
          digilockerDocumentId: digilockerDocumentId.trim() || undefined,
          claimAmount,
          admissionDate,
          typedName,
          typedDob,
          typedAddress,
          diagnosis: "Claim authenticity review",
          procedure: "Smart document trust screening",
          documentText: [
            `Uploaded ${supportingDocuments.length} image document(s).`,
            `Manual device hint: ${manualDeviceId || "none"}.`,
            `Hospital input name: ${typedName}.`,
          ].join(" "),
          supportingDocuments,
        }),
      });

      const data = (await response.json()) as DashboardResponse | { error?: string; message?: string };
      if (!response.ok) {
        const message = "message" in data && typeof data.message === "string" ? data.message : "Request failed";
        throw new Error(message);
      }

      startTransition(() => {
        setResult(data as DashboardResponse);
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to analyze claim");
    } finally {
      setSubmitting(false);
    }
  }

  const featureSummary = result?.features.feature_summary ?? {};
  const metadataDocuments = result?.features.metadata_summary.documents ?? [];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: palette.pageBg,
        color: palette.text,
        fontFamily: "'Space Grotesk', 'Outfit', system-ui, sans-serif",
        padding: "42px 28px 64px",
      }}
    >
      <section style={{ maxWidth: 1260, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: palette.titleAccent,
              }}
            >
              Claims Assurance Console
            </p>
            <h1
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(2rem, 4.5vw, 3.6rem)",
                lineHeight: 1.06,
                color: isDark ? palette.text : "#0c4a6e",
              }}
            >
              Smart Claim Trust Dashboard
            </h1>
            <p style={{ margin: "12px 0 0", color: palette.subtitle, maxWidth: 820 }}>
              Live client and server workflow. Upload claim images in the browser, forward them through the Next API,
              and inspect real beneficiary, fraud, feature, and EXIF metadata signals from the claims service.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignSelf: "flex-start", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: `1px solid ${isDark ? "rgba(125, 211, 252, 0.45)" : "rgba(3, 105, 161, 0.35)"}`,
                background: isDark ? "rgba(15, 23, 42, 0.5)" : "rgba(255, 255, 255, 0.8)",
                color: isDark ? "#67e8f9" : "#075985",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isDark ? "Switch to Light" : "Switch to Dark"}
            </button>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: `1px solid ${isDark ? "rgba(125, 211, 252, 0.45)" : "rgba(3, 105, 161, 0.35)"}`,
                background: isDark ? "rgba(15, 23, 42, 0.5)" : "rgba(255, 255, 255, 0.8)",
                color: isDark ? "#67e8f9" : "#075985",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {submitting ? "Live API - Submitting" : "Live API - Client + Server"}
            </div>
          </div>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1.05fr) minmax(320px, 1fr)",
            gap: 20,
          }}
        >
          <section
            style={{
              padding: 22,
              borderRadius: 20,
              background: palette.cardBg,
              border: `1px solid ${palette.cardBorder}`,
              boxShadow: isDark
                ? "0 24px 64px rgba(2, 6, 23, 0.45)"
                : "0 20px 48px rgba(2, 132, 199, 0.12)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 14, fontSize: 22, color: palette.text }}>Claim Intake Simulator</h2>

            <Field label="Beneficiary" palette={palette}>
              <select
                value={selectedPatientId}
                onChange={(event) => {
                  const nextPatientId = event.target.value;
                  const nextPatient = MOCK_BENEFICIARIES.find((entry) => entry.id === nextPatientId);
                  setSelectedPatientId(nextPatientId);
                  if (nextPatient) {
                    setTypedName(nextPatient.fullName);
                    setTypedDob(nextPatient.dob);
                    setTypedAddress(`${nextPatient.address}, ${nextPatient.city}`);
                  }
                }}
                style={inputStyle(palette)}
              >
                {MOCK_BENEFICIARIES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.id} - {entry.fullName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Typed Name (hospital input)" palette={palette}>
              <input style={inputStyle(palette)} value={typedName} onChange={(event) => setTypedName(event.target.value)} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Typed DOB" palette={palette}>
                <input style={inputStyle(palette)} value={typedDob} onChange={(event) => setTypedDob(event.target.value)} />
              </Field>
              <Field label="Claim Amount (INR)" palette={palette}>
                <input
                  type="number"
                  style={inputStyle(palette)}
                  value={claimAmount}
                  onChange={(event) => setClaimAmount(Number(event.target.value) || 0)}
                />
              </Field>
            </div>

            <Field label="Typed Address" palette={palette}>
              <input style={inputStyle(palette)} value={typedAddress} onChange={(event) => setTypedAddress(event.target.value)} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Hospital Search" palette={palette}>
                <input
                  list="claims-hospital-suggestions"
                  value={hospitalQuery}
                  onChange={(event) => setHospitalQuery(event.target.value)}
                  style={inputStyle(palette)}
                  placeholder="Search any hospital, clinic, or medical center"
                />
                <datalist id="claims-hospital-suggestions">
                  {Object.values(HOSPITAL_QUERIES).map((query) => (
                    <option key={query} value={query} />
                  ))}
                </datalist>
              </Field>
              <Field label="Admission Date" palette={palette}>
                <input style={inputStyle(palette)} value={admissionDate} onChange={(event) => setAdmissionDate(event.target.value)} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="DigiLocker Document Type" palette={palette}>
                <select
                  value={digilockerDocumentType}
                  onChange={(event) => setDigilockerDocumentType(event.target.value as "aadhaar" | "abha" | "insurance_card")}
                  style={inputStyle(palette)}
                >
                  <option value="aadhaar">Aadhaar</option>
                  <option value="abha">ABHA</option>
                  <option value="insurance_card">Insurance Card</option>
                </select>
              </Field>
              <Field label="DigiLocker Document ID" palette={palette}>
                <input
                  style={inputStyle(palette)}
                  value={digilockerDocumentId}
                  onChange={(event) => setDigilockerDocumentId(event.target.value)}
                  placeholder="DL document reference"
                />
              </Field>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 2,
                marginBottom: 12,
                color: palette.text,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={digilockerConsent}
                onChange={(event) => setDigilockerConsent(event.target.checked)}
              />
              Use DigiLocker verification in claim review
            </label>

            <Field label="Upload Claim Images" palette={palette}>
              <input type="file" accept="image/*" multiple onChange={(event) => void handleFileChange(event)} style={inputStyle(palette)} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Manual Device ID" palette={palette}>
                <input
                  style={inputStyle(palette)}
                  value={manualDeviceId}
                  onChange={(event) => setManualDeviceId(event.target.value)}
                />
              </Field>
              <Field label="Manual Timestamp" palette={palette}>
                <input
                  style={inputStyle(palette)}
                  value={manualTimestamp}
                  onChange={(event) => setManualTimestamp(event.target.value)}
                  placeholder="2026-04-17T10:11:12Z"
                />
              </Field>
            </div>

            <div
              style={{
                marginTop: 12,
                borderRadius: 14,
                border: `1px solid ${palette.cardBorder}`,
                background: palette.metricInnerBg,
                padding: "12px 14px",
                color: palette.helper,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Hospital lookup: {hospitalLookupLabel}
              <br />
              Claims backend anchor: {resolvedBackendHospitalName}
            </div>

            <div style={{ marginTop: 12, color: palette.helper, fontSize: 12, lineHeight: 1.5 }}>
              Upload one or more image documents. The client sends image bytes plus optional device and GPS hints. The
              server route validates the payload, calls beneficiary verification and claim submission, then fetches the
              computed metadata fraud summary from the claims backend.
            </div>

            {documents.length > 0 ? (
              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 14,
                  border: `1px solid ${palette.cardBorder}`,
                  background: palette.metricInnerBg,
                }}
              >
                {documents.map((document) => (
                  <div key={document.filename} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700 }}>{document.filename}</span>
                    <span style={{ color: palette.helper }}>
                      {document.sizeKb} KB - {document.lastModifiedIso.slice(0, 19).replace("T", " ")}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {error ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 14,
                  border: `1px solid ${isDark ? "rgba(248, 113, 113, 0.4)" : "rgba(220, 38, 38, 0.28)"}`,
                  background: isDark ? "rgba(127, 29, 29, 0.24)" : "rgba(254, 242, 242, 0.95)",
                  color: isDark ? "#fecaca" : "#991b1b",
                  padding: "12px 14px",
                }}
              >
                {error}
              </div>
            ) : null}

            <button type="button" onClick={() => void handleAnalyze()} disabled={submitting} style={primaryButtonStyle(isDark)}>
              {submitting ? "Running Trust Analysis..." : "Run Live Claims Analysis"}
            </button>
          </section>

          <section style={{ display: "grid", gap: 14 }}>
            <StatusCard title="DigiLocker Verification" palette={palette}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {result?.digilocker.status === "verified" ? (
                  <span style={okTagStyle(isDark)}>digilocker_verified</span>
                ) : result?.digilocker.status === "review" ? (
                  <span style={warnTagStyle(isDark)}>digilocker_review</span>
                ) : (
                  <span style={infoTagStyle(isDark)}>digilocker_not_connected</span>
                )}
                {result?.digilocker.suspicious ? (
                  <span style={warnTagStyle(isDark)}>digilocker_suspicious</span>
                ) : null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Metric
                  title="Confidence"
                  value={result ? result.digilocker.confidence.toFixed(3) : "Awaiting verification"}
                  helper={result?.digilocker.reason ?? "Server-side DigiLocker verification summary"}
                  palette={palette}
                />
                <Metric
                  title="Reference ID"
                  value={result?.digilocker.reference_id ?? "Not connected"}
                  helper={result?.digilocker.matched_fields?.length ? `Matched: ${result.digilocker.matched_fields.join(", ")}` : "No DigiLocker fields matched yet"}
                  palette={palette}
                />
              </div>
            </StatusCard>

            <StatusCard title="Beneficiary Verification Engine" palette={palette}>
              <DecisionPill decision={result?.beneficiary.decision ?? "review"} />
              <Metric
                title="Confidence Score"
                value={result ? result.beneficiary.confidence_score.toFixed(3) : "Awaiting submission"}
                helper={result?.beneficiary.matched_patient_name ? `Matched: ${result.beneficiary.matched_patient_name}` : "Server-side beneficiary verification"}
                palette={palette}
              />
              <Metric
                title="Signals"
                value={result?.beneficiary.signals?.length ? result.beneficiary.signals.join(", ") : "No live signal set yet"}
                helper={result?.beneficiary.reasons?.[0] ?? "Identity similarity, DOB, address, and scheme checks"}
                palette={palette}
              />
            </StatusCard>

            <StatusCard title="Rule-Based Fraud Engine" palette={palette}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {result?.claim.fraud_flags?.length ? (
                  result.claim.fraud_flags.map((flag) => (
                    <span key={flag} style={warnTagStyle(isDark)}>
                      {flag}
                    </span>
                  ))
                ) : (
                  <span style={okTagStyle(isDark)}>submit a claim to evaluate live fraud rules</span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Metric title="Risk Score" value={result ? result.claim.risk_score.toFixed(3) : "-"} palette={palette} />
                <Metric title="Risk Band" value={result?.claim.risk_band ?? "-"} palette={palette} />
              </div>
            </StatusCard>

            <StatusCard title="Feature Engineering Layer" palette={palette}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(140px, 1fr))", gap: 10 }}>
                <Metric title="Hospital Avg Cost" value={formatCurrency(featureSummary.hospital_avg_claim_cost)} palette={palette} />
                <Metric title="Patient Frequency" value={featureSummary.patient_claim_frequency_30d !== undefined ? `${featureSummary.patient_claim_frequency_30d} claims / 30d` : "-"} palette={palette} />
                <Metric title="Deviation" value={featureSummary.cost_deviation_ratio !== undefined ? `${featureSummary.cost_deviation_ratio.toFixed(2)}x` : "-"} palette={palette} />
                <Metric title="Claim Velocity" value={result?.features.claim_velocity ?? "-"} palette={palette} />
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
                  background: palette.monoBg,
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: `1px solid ${palette.cardBorder}`,
                  color: palette.monoText,
                }}
              >
                Feature Vector: [{result?.features.feature_vector?.join(", ") ?? "pending"}]
              </div>
              {result?.features.spatiotemporal_flags?.length ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {result.features.spatiotemporal_flags.map((flag) => (
                    <span key={flag} style={infoTagStyle(isDark)}>
                      {flag}
                    </span>
                  ))}
                </div>
              ) : null}
            </StatusCard>

            <StatusCard title="Metadata (EXIF) Analysis" palette={palette}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <span style={result?.features.metadata_flag ? warnTagStyle(isDark) : okTagStyle(isDark)}>
                  {result?.features.metadata_flag ? "metadata_flag = true" : "metadata_flag = false"}
                </span>
                {result?.features.metadata_signals?.map((signal) => (
                  <span key={signal} style={infoTagStyle(isDark)}>
                    {signal}
                  </span>
                ))}
              </div>

              <Metric
                title="Primary Reason"
                value={result?.features.metadata_reason ?? "No metadata reason yet"}
                helper="Device reuse and GPS mismatch are evaluated server-side"
                palette={palette}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <Metric
                  title="Reused Device Patients"
                  value={String(result?.features.metadata_summary.reused_device_patient_count ?? 0)}
                  palette={palette}
                />
                <Metric
                  title="GPS Mismatch"
                  value={`${Number(result?.features.metadata_summary.location_mismatch_distance_km ?? 0).toFixed(2)} km`}
                  palette={palette}
                />
              </div>

              {metadataDocuments.length ? (
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {metadataDocuments.map((document) => (
                    <div
                      key={document.document}
                      style={{
                        borderRadius: 14,
                        border: `1px solid ${palette.cardBorder}`,
                        background: palette.metricInnerBg,
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{document.document}</div>
                      <div style={{ marginTop: 6, color: palette.helper, fontSize: 12, lineHeight: 1.6 }}>
                        Timestamp: {document.timestamp ?? "not found"}
                        <br />
                        Device ID: {document.device_id ?? "not found"}
                        <br />
                        GPS: {document.gps ? `${document.gps.lat}, ${document.gps.lon}` : "not found"}
                        <br />
                        Hospital distance: {document.hospital_distance_km ?? 0} km
                        <br />
                        Camera: {[document.camera_make, document.camera_model].filter(Boolean).join(" ") || "unknown"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 12, color: palette.helper, fontSize: 12 }}>
                  Upload an image to inspect extracted timestamps, device identifiers, and GPS coordinates.
                </div>
              )}
            </StatusCard>
          </section>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
  palette,
}: {
  label: string;
  children: React.ReactNode;
  palette: {
    titleAccent: string;
  };
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: "block",
          marginBottom: 6,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: palette.titleAccent,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusCard({
  title,
  children,
  palette,
}: {
  title: string;
  children: React.ReactNode;
  palette: {
    cardBg: string;
    cardBorder: string;
    text: string;
  };
}) {
  return (
    <article
      style={{
        padding: 18,
        borderRadius: 18,
        background: palette.cardBg,
        border: `1px solid ${palette.cardBorder}`,
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: 12,
          fontSize: 18,
          color: palette.text,
        }}
      >
        {title}
      </h3>
      {children}
    </article>
  );
}

function Metric({
  title,
  value,
  helper,
  palette,
}: {
  title: string;
  value: string;
  helper?: string;
  palette: {
    titleAccent: string;
    metricInnerBg: string;
    cardBorder: string;
    helper: string;
  };
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${palette.cardBorder}`,
        background: palette.metricInnerBg,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: palette.titleAccent }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700 }}>{value}</div>
      {helper ? <div style={{ marginTop: 2, color: palette.helper, fontSize: 12 }}>{helper}</div> : null}
    </div>
  );
}

function DecisionPill({ decision }: { decision: Decision }) {
  const palette: Record<Decision, { bg: string; fg: string; border: string }> = {
    approved: { bg: "rgba(16, 185, 129, 0.18)", fg: "#6ee7b7", border: "rgba(52, 211, 153, 0.5)" },
    review: { bg: "rgba(245, 158, 11, 0.18)", fg: "#fcd34d", border: "rgba(251, 191, 36, 0.5)" },
    rejected: { bg: "rgba(239, 68, 68, 0.18)", fg: "#fca5a5", border: "rgba(248, 113, 113, 0.5)" },
  };
  const style = palette[decision];
  return (
    <div
      style={{
        display: "inline-flex",
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.fg,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 12,
        fontWeight: 800,
        marginBottom: 12,
      }}
    >
      {decision}
    </div>
  );
}

function inputStyle(palette: { inputBorder: string; inputBg: string; inputText: string }): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${palette.inputBorder}`,
    background: palette.inputBg,
    color: palette.inputText,
    outline: "none",
  };
}

function warnTagStyle(isDark: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: isDark ? "1px solid rgba(248, 113, 113, 0.6)" : "1px solid rgba(220, 38, 38, 0.45)",
    background: isDark ? "rgba(153, 27, 27, 0.22)" : "rgba(254, 226, 226, 0.9)",
    color: isDark ? "#fecaca" : "#991b1b",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
  };
}

function okTagStyle(isDark: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: isDark ? "1px solid rgba(52, 211, 153, 0.6)" : "1px solid rgba(5, 150, 105, 0.45)",
    background: isDark ? "rgba(5, 150, 105, 0.22)" : "rgba(220, 252, 231, 0.9)",
    color: isDark ? "#a7f3d0" : "#065f46",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
  };
}

function infoTagStyle(isDark: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: isDark ? "1px solid rgba(125, 211, 252, 0.45)" : "1px solid rgba(8, 145, 178, 0.35)",
    background: isDark ? "rgba(8, 47, 73, 0.45)" : "rgba(224, 242, 254, 0.95)",
    color: isDark ? "#bae6fd" : "#0c4a6e",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
  };
}

function primaryButtonStyle(isDark: boolean): React.CSSProperties {
  return {
    marginTop: 16,
    width: "100%",
    padding: "13px 16px",
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
    color: "#ecfeff",
    background: isDark ? "linear-gradient(135deg, #0891b2 0%, #10b981 100%)" : "linear-gradient(135deg, #0f766e 0%, #0284c7 100%)",
    boxShadow: isDark ? "0 18px 30px rgba(8, 145, 178, 0.25)" : "0 18px 30px rgba(2, 132, 199, 0.18)",
  };
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined) {
    return "-";
  }
  return `INR ${Math.round(value)}`;
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Failed to read image"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}
