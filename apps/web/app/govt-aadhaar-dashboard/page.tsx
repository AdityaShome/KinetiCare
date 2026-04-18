"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Database, Lock, ShieldCheck } from "lucide-react";

type RiskBand = "low" | "watch" | "high";

type AadhaarFraudRow = {
  aadhaar: string;
  citizenName: string;
  location: string;
  age: number;
  monthlyAppointments: number;
  dailyPeak: number;
  lastAppointmentAt: string;
  risk: RiskBand;
  suspiciousLabel: string;
  blocked: boolean;
};

type DashboardPayload = {
  generatedAt: string;
  records: AadhaarFraudRow[];
  sql: string;
  policy: {
    privateAudience: string;
    suspiciousThresholdDaily: number;
    normalMonthlyRange: string;
  };
};

const SPECIAL_PASSWORD = "govt123";

const palette = {
  bg: "linear-gradient(180deg, #fff8fb 0%, #fffdf7 48%, #f8fafc 100%)",
  text: "#111827",
  subText: "#4b5563",
  card: "rgba(255,255,255,0.92)",
  border: "rgba(17,24,39,0.1)",
  accent: "#0c4a6e",
  success: "#047857",
  watch: "#b45309",
  danger: "#be123c",
  dangerSurface: "rgba(244, 114, 182, 0.14)",
};

function maskAadhaar(value: string) {
  if (value.length !== 12) {
    return value;
  }
  return `${value.slice(0, 4)} XXXX ${value.slice(8)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function riskColor(risk: RiskBand) {
  if (risk === "high") {
    return palette.danger;
  }
  if (risk === "watch") {
    return palette.watch;
  }
  return palette.success;
}

export default function GovtAadhaarDashboardPage() {
  const [specialPassword, setSpecialPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<AadhaarFraudRow[]>([]);
  const [sql, setSql] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authorized) {
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/govt-aadhaar-dashboard");
        if (!response.ok) {
          throw new Error("Could not load dashboard data.");
        }
        const payload = (await response.json()) as DashboardPayload;
        if (!cancelled) {
          setRows(payload.records);
          setSql(payload.sql);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authorized]);

  const stats = useMemo(() => {
    const total = rows.length;
    const highRisk = rows.filter((row) => row.risk === "high").length;
    const blocked = rows.filter((row) => row.blocked).length;
    const peak = rows.reduce((max, row) => Math.max(max, row.dailyPeak), 0);
    return { total, highRisk, blocked, peak };
  }, [rows]);

  function handleAuthorize() {
    const allowed = specialPassword.trim() === SPECIAL_PASSWORD;
    setAuthorized(allowed);
    setError(allowed ? "" : "Special government password did not match.");
  }

  function toggleBlock(aadhaar: string) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.aadhaar === aadhaar ? { ...row, blocked: !row.blocked } : row,
      ),
    );
  }

  if (!authorized) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: palette.bg,
          color: palette.text,
          fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
        }}
      >
        <section
          style={{
            width: "min(560px, 100%)",
            background: palette.card,
            border: `1px solid ${palette.border}`,
            borderRadius: 28,
            boxShadow: "0 28px 70px rgba(17,24,39,0.12)",
            padding: 28,
            display: "grid",
            gap: 18,
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: 999,
                background: "rgba(12, 74, 110, 0.08)",
                color: palette.accent,
                width: "fit-content",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <Lock size={14} />
              Govt Employees Only
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3rem)", color: palette.accent }}>
              Aadhaar Appointment Fraud Dashboard
            </h1>
            <p style={{ margin: 0, color: palette.subText, lineHeight: 1.7 }}>
              This monitoring desk is private to government employees and surfaces Aadhaar-linked
              appointment spikes that look abnormal, such as 50 or more bookings in a single day.
            </p>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Special Access Password</span>
              <input
                type="password"
                value={specialPassword}
                onChange={(event) => setSpecialPassword(event.target.value)}
                placeholder="Enter special government password"
                style={inputStyle()}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleAuthorize}
              style={{
                border: "none",
                borderRadius: 14,
                padding: "12px 18px",
                background: "linear-gradient(120deg, #0c4a6e 0%, #0f766e 100%)",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Unlock Dashboard
            </button>
            <Link href="/" style={{ color: palette.accent, fontWeight: 700, textDecoration: "none" }}>
              Return to home
            </Link>
          </div>

          <div
            style={{
              borderRadius: 18,
              border: `1px dashed ${palette.border}`,
              background: "#fffdf7",
              padding: 14,
              color: palette.subText,
              lineHeight: 1.6,
            }}
          >
            Demo access for this prototype: special password <strong>{SPECIAL_PASSWORD}</strong>.
          </div>

          {error ? <p style={{ margin: 0, color: palette.danger, fontWeight: 700 }}>{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 20px 60px",
        background: palette.bg,
        color: palette.text,
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      }}
    >
      <section style={{ maxWidth: 1260, margin: "0 auto", display: "grid", gap: 18 }}>
        <header
          style={{
            background: palette.card,
            border: `1px solid ${palette.border}`,
            borderRadius: 28,
            boxShadow: "0 28px 70px rgba(17,24,39,0.08)",
            padding: 24,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "rgba(190, 18, 60, 0.08)",
                  color: palette.danger,
                  width: "fit-content",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <ShieldCheck size={14} />
                Private Govt Monitoring
              </div>
              <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3rem)", color: palette.accent }}>
                Aadhaar Appointment Surveillance Desk
              </h1>
              <p style={{ margin: 0, maxWidth: 880, color: palette.subText, lineHeight: 1.7 }}>
                High-frequency recent appointments linked to the same Aadhaar number are surfaced here.
                Anything near 50 bookings in one day is treated as highly suspicious, while typical activity
                around 2 to 10 appointments in a month remains normal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAuthorized(false)}
              style={{
                alignSelf: "flex-start",
                borderRadius: 14,
                border: `1px solid ${palette.border}`,
                background: "#fff",
                padding: "12px 16px",
                color: palette.text,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Lock Dashboard
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <StatCard label="Tracked Aadhaar IDs" value={String(stats.total)} color={palette.accent} />
            <StatCard label="Highly Suspicious" value={String(stats.highRisk)} color={palette.danger} />
            <StatCard label="Blocked IDs" value={String(stats.blocked)} color={palette.watch} />
            <StatCard label="Highest Daily Peak" value={`${stats.peak}`} sub="appointments/day" color={palette.danger} />
          </div>
        </header>

        <section
          style={{
            background: palette.card,
            border: `1px solid ${palette.border}`,
            borderRadius: 24,
            boxShadow: "0 28px 70px rgba(17,24,39,0.08)",
            padding: 20,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: palette.accent }}>
            <Database size={18} />
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Recent Aadhaar Activity</h2>
          </div>

          {loading ? (
            <p style={{ margin: 0, color: palette.subText }}>Loading dashboard data...</p>
          ) : error ? (
            <p style={{ margin: 0, color: palette.danger, fontWeight: 700 }}>{error}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 13 }}>
                    <th style={thStyle}>Aadhaar</th>
                    <th style={thStyle}>Citizen</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>Monthly</th>
                    <th style={thStyle}>Daily Peak</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Last Appointment</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isHigh = row.risk === "high";
                    const rowBackground = isHigh ? palette.dangerSurface : "#ffffff";

                    return (
                      <tr key={row.aadhaar}>
                        <td
                          style={{
                            ...tdStyle,
                            background: rowBackground,
                            borderTopLeftRadius: 18,
                            borderBottomLeftRadius: 18,
                            color: isHigh ? palette.danger : palette.text,
                            fontWeight: 800,
                          }}
                        >
                          {maskAadhaar(row.aadhaar)}
                        </td>
                        <td style={{ ...tdStyle, background: rowBackground }}>
                          <div style={{ fontWeight: 700 }}>{row.citizenName}</div>
                          <div style={{ fontSize: 13, color: palette.subText }}>Age {row.age}</div>
                        </td>
                        <td style={{ ...tdStyle, background: rowBackground }}>{row.location}</td>
                        <td style={{ ...tdStyle, background: rowBackground }}>{row.monthlyAppointments}</td>
                        <td style={{ ...tdStyle, background: rowBackground }}>{row.dailyPeak}</td>
                        <td style={{ ...tdStyle, background: rowBackground }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              borderRadius: 999,
                              padding: "6px 10px",
                              background: isHigh
                                ? "rgba(190, 18, 60, 0.12)"
                                : row.risk === "watch"
                                  ? "rgba(180, 83, 9, 0.12)"
                                  : "rgba(4, 120, 87, 0.12)",
                              color: riskColor(row.risk),
                              fontWeight: 800,
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            {isHigh ? <AlertTriangle size={14} /> : null}
                            {row.suspiciousLabel}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, background: rowBackground }}>{formatDate(row.lastAppointmentAt)}</td>
                        <td
                          style={{
                            ...tdStyle,
                            background: rowBackground,
                            borderTopRightRadius: 18,
                            borderBottomRightRadius: 18,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleBlock(row.aadhaar)}
                            style={{
                              border: "none",
                              borderRadius: 12,
                              padding: "10px 14px",
                              background: row.blocked ? "#111827" : isHigh ? "#be123c" : "#0c4a6e",
                              color: "#fff",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            {row.blocked ? "Unblock Aadhaar" : "Block Aadhaar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          style={{
            background: palette.card,
            border: `1px solid ${palette.border}`,
            borderRadius: 24,
            boxShadow: "0 28px 70px rgba(17,24,39,0.08)",
            padding: 20,
            display: "grid",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: palette.accent }}>SQL Query Behind This Dashboard</h2>
          <p style={{ margin: 0, color: palette.subText, lineHeight: 1.7 }}>
            This query groups recent appointments by Aadhaar, calculates the monthly count and highest
            single-day usage, and flags any number with unusually high traffic for government review.
          </p>
          <pre
            style={{
              margin: 0,
              overflowX: "auto",
              borderRadius: 18,
              background: "#0f172a",
              color: "#f8fafc",
              padding: 18,
              fontSize: 13,
              lineHeight: 1.65,
            }}
          >
            <code>{sql}</code>
          </pre>
        </section>
      </section>
    </main>
  );
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    borderRadius: 12,
    border: `1px solid ${palette.border}`,
    padding: "12px 14px",
    background: "#fff",
    outline: "none",
    fontSize: 14,
  };
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${palette.border}`,
        background: "#fff",
        padding: "18px 16px",
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#6b7280",
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, color }}>{value}</p>
      {sub ? <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>{sub}</p> : null}
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: "0 14px 6px",
  fontWeight: 800,
};

const tdStyle: CSSProperties = {
  padding: "16px 14px",
  borderTop: `1px solid ${palette.border}`,
  borderBottom: `1px solid ${palette.border}`,
  verticalAlign: "middle",
};
