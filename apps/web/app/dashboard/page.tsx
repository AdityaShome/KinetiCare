"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Assessment {
  patientId: string;
  source: string;
  createdAt: string;
  depression?: { depression_score?: number; risk_band?: string };
  ppg?: { hr_bpm?: number; sbp?: number; dbp?: number; risk_band?: string };
  kineticare?: { risk_band?: string; session_quality?: string };
  orchestrator?: { overall_risk_band?: string; analysis?: string };
}

const RISK_COLOR: Record<string, string> = {
  low: "#22C55E", medium: "#F59E0B", high: "#EF4444", unknown: "#9CA3AF",
};
const RISK_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3, unknown: 0 };

function riskColor(band?: string) { return RISK_COLOR[band ?? "unknown"] ?? "#9CA3AF"; }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.88)", borderRadius: 18, padding: "22px 24px", border: "1px solid rgba(15,76,92,0.1)", boxShadow: "0 4px 20px rgba(15,76,92,0.07)", flex: 1, minWidth: 160 }}>
      <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>{label}</p>
      <p style={{ fontSize: "2rem", fontWeight: 800, color: color ?? "#0A1628", margin: "0 0 4px", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: 0 }}>{sub}</p>}
    </div>
  );
}

// ─── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ band }: { band?: string }) {
  const c = riskColor(band);
  return (
    <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: "0.68rem", fontWeight: 700, background: `${c}18`, color: c, textTransform: "capitalize" }}>
      {band ?? "—"}
    </span>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const PATIENT_ID = "aditya-shome";

  useEffect(() => {
    fetch(`/api/patient-history?patientId=${PATIENT_ID}&limit=30&days=90`)
      .then((r) => r.json())
      .then((d) => {
        setAssessments((d.assessments ?? []).reverse()); // oldest→newest for charts
        setLoading(false);
      })
      .catch(() => { setError("Could not load history. Is MongoDB running?"); setLoading(false); });
  }, []);

  // ─── Derived chart data ──────────────────────────────────────────────────
  const chartData = assessments.map((a, i) => ({
    label: fmtDate(a.createdAt),
    index: i + 1,
    depressionScore: typeof a.depression?.depression_score === "number"
      ? Math.round(a.depression.depression_score * 100) : null,
    heartRate: a.ppg?.hr_bpm ?? null,
    sbp: a.ppg?.sbp ?? null,
    dbp: a.ppg?.dbp ?? null,
    depressionRisk: RISK_SCORE[a.depression?.risk_band ?? "unknown"],
    ppgRisk: RISK_SCORE[a.ppg?.risk_band ?? "unknown"],
    kineticareRisk: RISK_SCORE[a.kineticare?.risk_band ?? "unknown"],
  }));

  // ─── Stats ───────────────────────────────────────────────────────────────
  const total = assessments.length;
  const last  = assessments[assessments.length - 1];
  const avgDep = total
    ? Math.round(assessments.reduce((s, a) => s + (a.depression?.depression_score ?? 0), 0) / total * 100)
    : 0;
  const highRiskCount = assessments.filter(
    (a) => a.depression?.risk_band === "high" || a.ppg?.risk_band === "high" || a.kineticare?.risk_band === "high"
  ).length;

  // ─── Loading / error ─────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#f6fbff,#f8f4ff)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📊</div>
        <p style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>Loading health history…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#f6fbff,#f8f4ff)" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>⚠️</div>
        <p style={{ color: "#B91C1C", fontWeight: 600 }}>{error}</p>
        <p style={{ color: "#9CA3AF", fontSize: "0.8rem", marginTop: 8 }}>
          Start MongoDB: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>docker-compose -f infra/docker-compose.yml up -d</code>
        </p>
        <Link href="/" style={{ display: "inline-block", marginTop: 20, padding: "10px 24px", background: "#0F4C5C", color: "#fff", borderRadius: 99, textDecoration: "none", fontSize: "0.875rem" }}>← Back to Home</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#f6fbff 0%,#f8f4ff 60%,#fff8f0 100%)", fontFamily: "'Sora','Poppins',sans-serif", color: "#0A1628" }}>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.8)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(15,76,92,0.08)", padding: "0 48px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Link href="/" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0F4C5C", textDecoration: "none" }}>← KinetiCare</Link>
            <span style={{ color: "#E5E7EB" }}>|</span>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#0A1628" }}>Health Dashboard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>Patient: <strong style={{ color: "#0F4C5C" }}>Aditya Shome</strong></span>
            <Link href="/daily-checkup" style={{ padding: "8px 18px", background: "linear-gradient(130deg,#0f4c5c,#2579c7)", color: "#fff", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, textDecoration: "none" }}>
              + New Checkup
            </Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 48px 80px" }}>

        {/* No data state */}
        {total === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>📋</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 10 }}>No checkups yet</h2>
            <p style={{ color: "#9CA3AF", marginBottom: 24 }}>Complete your first daily checkup to start tracking your health trends.</p>
            <Link href="/daily-checkup" style={{ padding: "12px 28px", background: "linear-gradient(130deg,#0f4c5c,#2579c7)", color: "#fff", borderRadius: 99, fontSize: "0.9rem", fontWeight: 600, textDecoration: "none" }}>
              Start First Checkup
            </Link>
          </div>
        )}

        {total > 0 && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 6px", background: "linear-gradient(135deg,#0f4c5c,#2579c7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Health Trends
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#9CA3AF", margin: 0 }}>
                {total} checkup{total !== 1 ? "s" : ""} recorded · Last: {last ? `${fmtDate(last.createdAt)} at ${fmtTime(last.createdAt)}` : "—"}
              </p>
            </div>

            {/* Stat cards */}
            <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
              <StatCard label="Total Checkups" value={String(total)} sub="Last 90 days" />
              <StatCard label="Avg Depression Score" value={`${avgDep}%`} sub="Higher = more risk" color={avgDep > 60 ? "#EF4444" : avgDep > 35 ? "#F59E0B" : "#22C55E"} />
              <StatCard label="High Risk Sessions" value={String(highRiskCount)} sub={`${Math.round(highRiskCount / total * 100)}% of checkups`} color={highRiskCount > 0 ? "#EF4444" : "#22C55E"} />
              <StatCard
                label="Last Heart Rate"
                value={last?.ppg?.hr_bpm ? `${last.ppg.hr_bpm} bpm` : "—"}
                sub={last?.ppg?.sbp ? `BP ${last.ppg.sbp}/${last.ppg.dbp}` : "PPG not recorded"}
                color="#2563EB"
              />
              <StatCard
                label="Overall Risk (Latest)"
                value={(last?.orchestrator?.overall_risk_band ?? last?.depression?.risk_band ?? "—").toUpperCase()}
                color={riskColor(last?.orchestrator?.overall_risk_band ?? last?.depression?.risk_band)}
              />
            </div>

            {/* Charts grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>

              {/* Depression Score trend */}
              <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: "24px", border: "1px solid rgba(15,76,92,0.1)", boxShadow: "0 4px 20px rgba(15,76,92,0.06)" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0A1628", margin: "0 0 4px" }}>Depression Risk Score</h3>
                <p style={{ fontSize: "0.7rem", color: "#9CA3AF", margin: "0 0 20px" }}>0 = no risk · 100 = high risk</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, "Depression Score"]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.12)", fontSize: 12 }} />
                    <Area type="monotone" dataKey="depressionScore" stroke="#F59E0B" strokeWidth={2.5} fill="url(#depGrad)" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Heart Rate trend */}
              <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: "24px", border: "1px solid rgba(15,76,92,0.1)", boxShadow: "0 4px 20px rgba(15,76,92,0.06)" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0A1628", margin: "0 0 4px" }}>Heart Rate (BPM)</h3>
                <p style={{ fontSize: "0.7rem", color: "#9CA3AF", margin: "0 0 20px" }}>From PPG signal analysis</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <YAxis domain={[50, 120]} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <Tooltip formatter={(v: number) => [`${v} bpm`, "Heart Rate"]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.12)", fontSize: 12 }} />
                    <Area type="monotone" dataKey="heartRate" stroke="#EF4444" strokeWidth={2.5} fill="url(#hrGrad)" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Blood Pressure trend */}
              <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: "24px", border: "1px solid rgba(15,76,92,0.1)", boxShadow: "0 4px 20px rgba(15,76,92,0.06)" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0A1628", margin: "0 0 4px" }}>Blood Pressure (mmHg)</h3>
                <p style={{ fontSize: "0.7rem", color: "#9CA3AF", margin: "0 0 20px" }}>SBP (systolic) & DBP (diastolic)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <YAxis domain={[50, 170]} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.12)", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="sbp" stroke="#2563EB" strokeWidth={2.5} dot={false} name="Systolic" connectNulls />
                    <Line type="monotone" dataKey="dbp" stroke="#93C5FD" strokeWidth={2} dot={false} name="Diastolic" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Composite risk trend */}
              <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 20, padding: "24px", border: "1px solid rgba(15,76,92,0.1)", boxShadow: "0 4px 20px rgba(15,76,92,0.06)" }}>
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0A1628", margin: "0 0 4px" }}>Multi-Pillar Risk Levels</h3>
                <p style={{ fontSize: "0.7rem", color: "#9CA3AF", margin: "0 0 20px" }}>1 = Low · 2 = Medium · 3 = High</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <YAxis domain={[0, 3]} ticks={[1, 2, 3]} tickFormatter={(v) => ["", "Low", "Med", "High"][v] ?? ""} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.12)", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="depressionRisk" stroke="#F59E0B" strokeWidth={2} dot={false} name="Depression" connectNulls />
                    <Line type="monotone" dataKey="ppgRisk" stroke="#EF4444" strokeWidth={2} dot={false} name="Cardiovascular" connectNulls />
                    <Line type="monotone" dataKey="kineticareRisk" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Neuromotor" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent assessments table */}
            <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 20, border: "1px solid rgba(15,76,92,0.1)", boxShadow: "0 4px 20px rgba(15,76,92,0.06)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(15,76,92,0.08)" }}>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0, color: "#0A1628" }}>Recent Checkups</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(15,76,92,0.03)" }}>
                      {["Date & Time", "Source", "Depression", "PPG / Cardio", "Neuromotor", "Overall Risk"].map((h) => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...assessments].reverse().map((a, i) => (
                      <tr key={i} style={{ borderTop: "1px solid rgba(15,76,92,0.06)", transition: "background 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(15,76,92,0.02)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, color: "#0A1628" }}>{fmtDate(a.createdAt)}</div>
                          <div style={{ color: "#9CA3AF", fontSize: "0.68rem" }}>{fmtTime(a.createdAt)}</div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 9px", borderRadius: 99, fontSize: "0.66rem", fontWeight: 600, background: "rgba(15,76,92,0.08)", color: "#0F4C5C" }}>
                            {a.source}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <RiskBadge band={a.depression?.risk_band} />
                            {typeof a.depression?.depression_score === "number" && (
                              <span style={{ fontSize: "0.68rem", color: "#9CA3AF" }}>
                                {Math.round(a.depression.depression_score * 100)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <RiskBadge band={a.ppg?.risk_band} />
                            {a.ppg?.hr_bpm && <span style={{ fontSize: "0.68rem", color: "#9CA3AF" }}>{a.ppg.hr_bpm} bpm</span>}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <RiskBadge band={a.kineticare?.risk_band} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <RiskBadge band={a.orchestrator?.overall_risk_band} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
