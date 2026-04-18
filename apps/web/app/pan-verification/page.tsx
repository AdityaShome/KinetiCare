"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type ResidenceType = "urban" | "rural";
type PovertyDecision = "below" | "on" | "above";

type PovertyResult = {
  decision: PovertyDecision;
  decisionLabel: string;
  annualIncome: number;
  annualThreshold: number;
  perCapitaIncome: number;
  perCapitaThreshold: number;
  confidence: number;
  reasons: string[];
};

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function computeThreshold(residenceType: ResidenceType, householdSize: number): number {
  const base = residenceType === "urban" ? 165000 : 135000;
  const additionalMembers = Math.max(0, householdSize - 1);
  return base + additionalMembers * 28000;
}

function classifyPovertyLine(
  annualIncome: number,
  residenceType: ResidenceType,
  householdSize: number,
): PovertyResult {
  const annualThreshold = computeThreshold(residenceType, householdSize);
  const perCapitaIncome = annualIncome / Math.max(1, householdSize);
  const perCapitaThreshold = residenceType === "urban" ? 62000 : 52000;

  const annualGapRatio = (annualIncome - annualThreshold) / annualThreshold;
  const perCapitaGapRatio =
    (perCapitaIncome - perCapitaThreshold) / perCapitaThreshold;

  let decision: PovertyDecision = "above";
  let decisionLabel = "Above Poverty Line";
  const reasons: string[] = [];

  if (annualIncome < annualThreshold || perCapitaIncome < perCapitaThreshold) {
    decision = "below";
    decisionLabel = "Below Poverty Line";
  }

  if (
    Math.abs(annualGapRatio) <= 0.08 ||
    Math.abs(perCapitaGapRatio) <= 0.08
  ) {
    decision = "on";
    decisionLabel = "On Poverty Line";
  }

  if (annualIncome < annualThreshold) {
    reasons.push("Annual family income is below the adjusted threshold.");
  } else {
    reasons.push("Annual family income is above the adjusted threshold.");
  }

  if (perCapitaIncome < perCapitaThreshold) {
    reasons.push("Per-capita income indicates economic vulnerability.");
  } else {
    reasons.push("Per-capita income is above the risk threshold.");
  }

  reasons.push(
    `Threshold is adjusted for ${residenceType} household economics and size ${householdSize}.`,
  );

  const distance = Math.min(
    1,
    Math.abs(annualGapRatio) * 0.65 + Math.abs(perCapitaGapRatio) * 0.35,
  );
  const confidence = Number((0.6 + distance * 0.4).toFixed(2));

  return {
    decision,
    decisionLabel,
    annualIncome,
    annualThreshold,
    perCapitaIncome,
    perCapitaThreshold,
    confidence,
    reasons,
  };
}

function maskPan(pan: string): string {
  if (pan.length !== 10) {
    return pan;
  }
  return `${pan.slice(0, 3)}XX${pan.slice(5, 9)}${pan.slice(9)}`;
}

export default function PanVerificationPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("Ravi Kumar");
  const [dob, setDob] = useState("1993-02-15");
  const [pan, setPan] = useState("ABCDE1234F");
  const [annualIncome, setAnnualIncome] = useState(148000);
  const [householdSize, setHouseholdSize] = useState(4);
  const [residenceType, setResidenceType] = useState<ResidenceType>("urban");
  const [stateName, setStateName] = useState("Tamil Nadu");
  const [studentOffer, setStudentOffer] = useState(false);
  const [consent, setConsent] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationCountdown, setVerificationCountdown] = useState(15);
  const [panDocumentName, setPanDocumentName] = useState("");
  const [panDocumentUploaded, setPanDocumentUploaded] = useState(false);
  const [selfieVideoUrl, setSelfieVideoUrl] = useState("");
  const [selfieVideoRecorded, setSelfieVideoRecorded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState(10);
  const [cameraError, setCameraError] = useState("");
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const normalizedPan = pan.trim().toUpperCase();
  const panLooksValid = PAN_REGEX.test(normalizedPan);
  const evidenceReady = panDocumentUploaded && selfieVideoRecorded;

  const result = useMemo(
    () =>
      classifyPovertyLine(
        Math.max(0, annualIncome),
        residenceType,
        Math.max(1, householdSize),
      ),
    [annualIncome, residenceType, householdSize],
  );

  const palette = {
    bg: "radial-gradient(circle at 8% 10%, rgba(247, 197, 72, 0.2), transparent 28%), radial-gradient(circle at 90% 12%, rgba(19, 149, 129, 0.18), transparent 32%), linear-gradient(145deg, #fff9ef 0%, #ecfeff 48%, #f3f4f6 100%)",
    text: "#111827",
    subText: "#374151",
    card: "rgba(255, 255, 255, 0.78)",
    border: "rgba(17, 24, 39, 0.14)",
    success: "#047857",
    warning: "#b45309",
    danger: "#b91c1c",
    accent: "#0f766e",
    input: "rgba(255, 255, 255, 0.95)",
  };

  function handleAnalyze() {
    setVerifying(true);
    setSubmitted(false);
    setVerificationCountdown(15);

    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current);
    }

    verificationIntervalRef.current = setInterval(() => {
      setVerificationCountdown((current) => {
        if (current <= 1) {
          if (verificationIntervalRef.current) {
            clearInterval(verificationIntervalRef.current);
            verificationIntervalRef.current = null;
          }
          setVerifying(false);
          setSubmitted(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      stopMediaTracks();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (verificationIntervalRef.current) {
        clearInterval(verificationIntervalRef.current);
      }
    };
  }, []);

  function stopMediaTracks() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  async function handlePanDocumentUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setPanDocumentName(file.name);
    setPanDocumentUploaded(true);
  }

  async function handleSelfieCapture() {
    setCameraError("");
    setRecordingCountdown(10);
    setSelfieVideoRecorded(false);

    try {
      stopMediaTracks();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      mediaStreamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play();
      }

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setSelfieVideoUrl((previousUrl) => {
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          return url;
        });
        setSelfieVideoRecorded(true);
        setRecording(false);
        stopMediaTracks();
      };

      recorder.start();
      setRecording(true);

      countdownIntervalRef.current = setInterval(() => {
        setRecordingCountdown((current) => {
          if (current <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            mediaRecorderRef.current?.stop();
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } catch (error) {
      setCameraError(
        error instanceof Error ? error.message : "Unable to access the selfie camera.",
      );
      setRecording(false);
      stopMediaTracks();
    }
  }

  function decisionColor(decision: PovertyDecision): string {
    if (decision === "below") {
      return palette.danger;
    }
    if (decision === "on") {
      return palette.warning;
    }
    return palette.success;
  }

  function handleAvailSchemes() {
    const schemeContext = {
      fullName,
      dob,
      annualIncome: Math.max(0, annualIncome),
      residenceType,
      householdSize: Math.max(1, householdSize),
      student: studentOffer,
      state: stateName.trim() || "General",
      decisionLabel: result.decisionLabel,
    };

    localStorage.setItem("kinetiCare_schemeContext", JSON.stringify(schemeContext));
    router.push("/avail-schemes");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "36px 18px 60px",
        background: palette.bg,
        color: palette.text,
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      }}
    >
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header
          style={{
            display: "grid",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <p
            style={{
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              fontWeight: 700,
              fontSize: 12,
              color: palette.accent,
            }}
          >
            PAN + Poverty Screening
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(1.9rem, 4vw, 3rem)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: "#0c4a6e",
            }}
          >
            PAN Verification and Poverty-Line Decision Desk
          </h1>
          <p style={{ margin: 0, maxWidth: 760, color: palette.subText }}>
            This page validates PAN format and estimates whether a person is
            below, on, or above the poverty line from declared socio-economic
            details. It is a decision-support view for intake and benefits
            triage.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          <section
            style={{
              background: palette.card,
              border: `1px solid ${palette.border}`,
              borderRadius: 20,
              boxShadow: "0 10px 40px rgba(15, 23, 42, 0.08)",
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: "1.2rem" }}>
              Identity Input
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Full Name</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  style={inputStyle(palette.input, palette.border)}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Date of Birth</span>
                <input
                  type="date"
                  value={dob}
                  onChange={(event) => setDob(event.target.value)}
                  style={inputStyle(palette.input, palette.border)}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>PAN Number</span>
                <input
                  value={normalizedPan}
                  onChange={(event) =>
                    setPan(event.target.value.toUpperCase().replace(/\s+/g, ""))
                  }
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  style={inputStyle(palette.input, palette.border)}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: panLooksValid ? palette.success : palette.danger,
                    fontWeight: 600,
                  }}
                >
                  {panLooksValid
                    ? "PAN format looks valid"
                    : "PAN format must be 5 letters + 4 digits + 1 letter"}
                </span>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Upload PAN Card</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) => void handlePanDocumentUpload(event)}
                  style={inputStyle(palette.input, palette.border)}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: panDocumentUploaded ? palette.success : palette.warning,
                    fontWeight: 600,
                  }}
                >
                  {panDocumentUploaded
                    ? `PAN document uploaded: ${panDocumentName}`
                    : "Upload a PAN card image or PDF before verification"}
                </span>
              </label>

              <div
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(255, 255, 255, 0.72)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div>
                  <p style={{ margin: "0 0 6px", fontWeight: 700 }}>
                    10-Second Selfie Video
                  </p>
                  <p style={{ margin: 0, color: palette.subText, fontSize: 13 }}>
                    Capture a short selfie video for liveness and identity support.
                  </p>
                </div>
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  controls={!!selfieVideoUrl}
                  src={selfieVideoUrl || undefined}
                  style={{
                    width: "100%",
                    maxHeight: 260,
                    borderRadius: 12,
                    background: "#0f172a",
                    objectFit: "cover",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSelfieCapture()}
                  disabled={recording}
                  style={{
                    border: "none",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontWeight: 700,
                    cursor: recording ? "not-allowed" : "pointer",
                    background: recording ? "#9ca3af" : "linear-gradient(120deg, #0f766e 0%, #0284c7 100%)",
                    color: "#fff",
                  }}
                >
                  {recording ? `Recording... ${recordingCountdown}s` : selfieVideoRecorded ? "Retake 10-Second Selfie Video" : "Record 10-Second Selfie Video"}
                </button>
                <span
                  style={{
                    fontSize: 13,
                    color: selfieVideoRecorded ? palette.success : palette.warning,
                    fontWeight: 600,
                  }}
                >
                  {selfieVideoRecorded
                    ? "Selfie video captured successfully"
                    : "A 10-second selfie video is required before verification"}
                </span>
                {cameraError ? (
                  <span style={{ fontSize: 13, color: palette.danger, fontWeight: 600 }}>
                    {cameraError}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section
            style={{
              background: palette.card,
              border: `1px solid ${palette.border}`,
              borderRadius: 20,
              boxShadow: "0 10px 40px rgba(15, 23, 42, 0.08)",
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: "1.2rem" }}>
              Economic Input
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Annual Household Income (INR)</span>
                <input
                  type="number"
                  min={0}
                  value={annualIncome}
                  onChange={(event) =>
                    setAnnualIncome(Number(event.target.value || 0))
                  }
                  style={inputStyle(palette.input, palette.border)}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Household Size</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={householdSize}
                  onChange={(event) =>
                    setHouseholdSize(Number(event.target.value || 1))
                  }
                  style={inputStyle(palette.input, palette.border)}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>State / Location</span>
                <input
                  value={stateName}
                  onChange={(event) => setStateName(event.target.value)}
                  placeholder="Tamil Nadu"
                  style={inputStyle(palette.input, palette.border)}
                />
              </label>

              <fieldset
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                }}
              >
                <legend style={{ padding: "0 8px" }}>Residence Type</legend>
                <label style={{ marginRight: 12 }}>
                  <input
                    type="radio"
                    checked={residenceType === "urban"}
                    onChange={() => setResidenceType("urban")}
                  />
                  {" "}
                  Urban
                </label>
                <label>
                  <input
                    type="radio"
                    checked={residenceType === "rural"}
                    onChange={() => setResidenceType("rural")}
                  />
                  {" "}
                  Rural
                </label>
              </fieldset>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={studentOffer}
                  onChange={(event) => setStudentOffer(event.target.checked)}
                />
                Applicant is a student or wants student-linked scheme options
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                I confirm citizen consent for PAN and socio-economic screening
              </label>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!consent || !panLooksValid || !fullName || !dob || !evidenceReady}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 16px",
                  fontWeight: 700,
                  cursor:
                    consent && panLooksValid && !!fullName && !!dob && evidenceReady
                      ? "pointer"
                      : "not-allowed",
                  background:
                    consent && panLooksValid && !!fullName && !!dob && evidenceReady
                      ? "linear-gradient(120deg, #0f766e 0%, #0284c7 100%)"
                      : "#9ca3af",
                  color: "#fff",
                }}
              >
                {verifying ? `Verifying... ${verificationCountdown}s` : "Verify PAN and Classify Poverty-Line Status"}
              </button>
              {!evidenceReady ? (
                <span style={{ fontSize: 13, color: palette.warning, fontWeight: 600 }}>
                  Upload PAN card and record a 10-second selfie video to continue.
                </span>
              ) : null}
              {verifying ? (
                <span style={{ fontSize: 13, color: palette.accent, fontWeight: 600 }}>
                  PAN verification and poverty-line screening are running. Decision output will appear after 15 seconds.
                </span>
              ) : null}
            </div>
          </section>
        </div>

        <section
          style={{
            marginTop: 16,
            background: palette.card,
            border: `1px solid ${palette.border}`,
            borderRadius: 20,
            boxShadow: "0 10px 40px rgba(15, 23, 42, 0.08)",
            padding: 20,
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: 12,
              fontSize: "1.2rem",
              color: "#0c4a6e",
            }}
          >
            Decision Output
          </h2>

          {!submitted ? (
            <p style={{ margin: 0, color: palette.subText }}>
              {verifying
                ? `Verification in progress. Decision output unlocks in ${verificationCountdown} seconds.`
                : "Submit the form to generate PAN verification state and poverty-line decision."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(255, 255, 255, 0.65)",
                }}
              >
                <p style={{ margin: "0 0 6px", fontWeight: 700 }}>
                  PAN Verification
                </p>
                <p style={{ margin: 0, color: palette.subText }}>
                  {panLooksValid ? "Verified Format" : "Invalid Format"} for
                  PAN {maskPan(normalizedPan)}
                </p>
                <p style={{ margin: "8px 0 0", color: palette.subText }}>
                  Evidence: {panDocumentUploaded ? "PAN uploaded" : "PAN missing"} | {selfieVideoRecorded ? "Selfie video complete" : "Selfie video missing"}
                </p>
              </div>

              <div
                style={{
                  border: `1px solid ${decisionColor(result.decision)}`,
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(255, 255, 255, 0.65)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontWeight: 800,
                    color: decisionColor(result.decision),
                    fontSize: "1.15rem",
                  }}
                >
                  {result.decisionLabel}
                </p>
                <p style={{ margin: "6px 0 0", color: palette.subText }}>
                  Confidence Score: {(result.confidence * 100).toFixed(0)}%
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <MetricCard
                  label="Annual Income"
                  value={`INR ${formatNumber(result.annualIncome)}`}
                />
                <MetricCard
                  label="Adjusted Annual Threshold"
                  value={`INR ${formatNumber(result.annualThreshold)}`}
                />
                <MetricCard
                  label="Per-Capita Income"
                  value={`INR ${formatNumber(Math.round(result.perCapitaIncome))}`}
                />
                <MetricCard
                  label="Per-Capita Threshold"
                  value={`INR ${formatNumber(result.perCapitaThreshold)}`}
                />
              </div>

              <div
                style={{
                  border: `1px dashed ${palette.border}`,
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
                  Decision Reasons
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, color: palette.subText }}>
                  {result.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>

              {result.decision === "below" ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    borderRadius: 14,
                    border: `1px solid ${palette.border}`,
                    background: "rgba(15, 118, 110, 0.08)",
                    padding: 14,
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <p style={{ margin: 0, fontWeight: 800, color: palette.accent }}>
                      Eligible to explore welfare schemes
                    </p>
                    <p style={{ margin: 0, color: palette.subText }}>
                      We&apos;ll shortlist schemes using income, {stateName.trim() || "location"}, age band, residence type, and student preference.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAvailSchemes}
                    style={{
                      border: "none",
                      borderRadius: 12,
                      padding: "12px 16px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: "linear-gradient(120deg, #0f766e 0%, #0284c7 100%)",
                      color: "#fff",
                    }}
                  >
                    Avail Schemes
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function inputStyle(background: string, borderColor: string): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: 10,
    border: `1px solid ${borderColor}`,
    padding: "10px 12px",
    background,
    outline: "none",
    fontSize: 14,
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(17, 24, 39, 0.14)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255, 255, 255, 0.7)",
      }}
    >
      <p style={{ margin: "0 0 4px", fontSize: 12, color: "#4b5563" }}>{label}</p>
      <p style={{ margin: 0, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
