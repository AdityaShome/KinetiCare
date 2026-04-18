"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeIndianRupee, GraduationCap, MapPin, ShieldCheck } from "lucide-react";

type SchemeContext = {
  fullName: string;
  dob: string;
  annualIncome: number;
  residenceType: "urban" | "rural";
  householdSize: number;
  student: boolean;
  state: string;
  decisionLabel: string;
};

type SchemeCard = {
  name: string;
  tag: string;
  reason: string;
  benefit: string;
};

const BASE_SCHEMES: SchemeCard[] = [
  {
    name: "Ayushman Bharat",
    tag: "Health Cover",
    reason: "Income-sensitive health protection for vulnerable households.",
    benefit: "Hospitalization support and empanelled-care access.",
  },
  {
    name: "National Food Security Support",
    tag: "Essentials",
    reason: "Households under financial stress may qualify for subsidized essentials.",
    benefit: "Lower-cost grain and basic household support.",
  },
];

const RURAL_SCHEME: SchemeCard = {
  name: "Rural Livelihood Assistance",
  tag: "Rural",
  reason: "Rural applicants may qualify for village-linked livelihood and welfare support.",
  benefit: "Employment-linked and village welfare assistance.",
};

const URBAN_SCHEME: SchemeCard = {
  name: "Urban Social Protection",
  tag: "Urban",
  reason: "Urban low-income applicants may qualify for city-linked assistance schemes.",
  benefit: "Urban subsidy and municipal support programs.",
};

const STUDENT_SCHEME: SchemeCard = {
  name: "Student Continuity Grant",
  tag: "Student",
  reason: "Student status may unlock fee relief and scholarship continuity options.",
  benefit: "Education support, fee assistance, and scholarship continuity.",
};

export default function AvailSchemesPage() {
  const [context, setContext] = useState<SchemeContext | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("kinetiCare_schemeContext");
    if (!raw) {
      return;
    }
    try {
      setContext(JSON.parse(raw) as SchemeContext);
    } catch {
      setContext(null);
    }
  }, []);

  const age = useMemo(() => {
    if (!context?.dob) {
      return null;
    }
    const dob = new Date(context.dob);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    const birthdayPassed =
      now.getMonth() > dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
    if (!birthdayPassed) {
      years -= 1;
    }
    return years;
  }, [context]);

  const schemes = useMemo(() => {
    if (!context) {
      return [] as SchemeCard[];
    }

    const nextSchemes = [...BASE_SCHEMES];
    nextSchemes.push(context.residenceType === "rural" ? RURAL_SCHEME : URBAN_SCHEME);

    if (context.student || (age !== null && age <= 25)) {
      nextSchemes.push(STUDENT_SCHEME);
    }

    nextSchemes.push({
      name: `${context.state} State Benefit Desk`,
      tag: "Location",
      reason: `State-specific schemes may vary for ${context.state}.`,
      benefit: "Regional eligibility review and direct state program routing.",
    });

    return nextSchemes;
  }, [context, age]);

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #ecfeff 100%)", color: "#0f172a", padding: "40px 24px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 24 }}>
        <section style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 24, padding: 28, boxShadow: "0 20px 45px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(8,145,178,0.1)", color: "#0c4a6e", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                <ShieldCheck size={14} />
                Scheme Discovery
              </div>
              <h1 style={{ margin: "14px 0 8px", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.04 }}>Eligible Welfare Schemes</h1>
              <p style={{ margin: 0, maxWidth: 820, color: "#475569", lineHeight: 1.7 }}>
                Recommended schemes are listed using the poverty-line result, income level, location, age band, and student preference from the PAN verification desk.
              </p>
            </div>
            <Link href="/pan-verification" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.12)", color: "#0f172a", textDecoration: "none", fontWeight: 700 }}>
              <ArrowLeft size={16} />
              Back to PAN Verification
            </Link>
          </div>
        </section>

        {context ? (
          <>
            <section style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 24, padding: 24, boxShadow: "0 20px 45px rgba(15,23,42,0.06)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                <ContextCard icon={<BadgeIndianRupee size={18} />} label="Annual Income" value={`INR ${new Intl.NumberFormat("en-IN").format(context.annualIncome)}`} />
                <ContextCard icon={<MapPin size={18} />} label="Location" value={`${context.state} | ${context.residenceType}`} />
                <ContextCard icon={<GraduationCap size={18} />} label="Student Status" value={context.student ? "Student offer enabled" : "General applicant"} />
                <ContextCard icon={<ShieldCheck size={18} />} label="Decision" value={context.decisionLabel} />
              </div>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              {schemes.map((scheme) => (
                <article key={scheme.name} style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 22, padding: 22, boxShadow: "0 20px 45px rgba(15,23,42,0.06)" }}>
                  <div style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: "rgba(20,184,166,0.12)", color: "#0f766e", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {scheme.tag}
                  </div>
                  <h2 style={{ margin: "14px 0 8px", fontSize: 22 }}>{scheme.name}</h2>
                  <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>{scheme.reason}</p>
                  <div style={{ marginTop: 16, borderRadius: 14, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", padding: "12px 14px", color: "#0f172a", fontWeight: 600 }}>
                    Benefit: {scheme.benefit}
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : (
          <section style={{ background: "#fff", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 24, padding: 28, boxShadow: "0 20px 45px rgba(15,23,42,0.06)", color: "#475569", lineHeight: 1.7 }}>
            No scheme context was found. Start from the PAN verification page, complete the screening, and open this page from a below-poverty-line decision.
          </section>
        )}
      </div>
    </main>
  );
}

function ContextCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#f8fafc", padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0369a1", marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ color: "#0f172a", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
