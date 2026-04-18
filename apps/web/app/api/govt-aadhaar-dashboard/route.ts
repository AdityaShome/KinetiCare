import { NextResponse } from "next/server";

type AadhaarFraudRow = {
  aadhaar: string;
  citizenName: string;
  location: string;
  age: number;
  monthlyAppointments: number;
  dailyPeak: number;
  lastAppointmentAt: string;
  risk: "low" | "watch" | "high";
  suspiciousLabel: string;
  blocked: boolean;
};

const SAMPLE_ROWS: AadhaarFraudRow[] = [
  {
    aadhaar: "412367891254",
    citizenName: "Raghav Menon",
    location: "Chennai, Tamil Nadu",
    age: 46,
    monthlyAppointments: 187,
    dailyPeak: 52,
    lastAppointmentAt: "2026-04-17T10:30:00.000Z",
    risk: "high",
    suspiciousLabel: "Highly suspicious",
    blocked: false,
  },
  {
    aadhaar: "826451907632",
    citizenName: "Sushma Devi",
    location: "Patna, Bihar",
    age: 32,
    monthlyAppointments: 9,
    dailyPeak: 2,
    lastAppointmentAt: "2026-04-12T08:20:00.000Z",
    risk: "low",
    suspiciousLabel: "Normal usage",
    blocked: false,
  },
  {
    aadhaar: "509182734615",
    citizenName: "Harish Patel",
    location: "Ahmedabad, Gujarat",
    age: 57,
    monthlyAppointments: 74,
    dailyPeak: 18,
    lastAppointmentAt: "2026-04-16T13:10:00.000Z",
    risk: "watch",
    suspiciousLabel: "Needs manual review",
    blocked: false,
  },
  {
    aadhaar: "713640982541",
    citizenName: "Ananya Roy",
    location: "Kolkata, West Bengal",
    age: 21,
    monthlyAppointments: 5,
    dailyPeak: 1,
    lastAppointmentAt: "2026-04-09T15:00:00.000Z",
    risk: "low",
    suspiciousLabel: "Normal usage",
    blocked: false,
  },
  {
    aadhaar: "245190763824",
    citizenName: "Irfan Khan",
    location: "Lucknow, Uttar Pradesh",
    age: 39,
    monthlyAppointments: 163,
    dailyPeak: 48,
    lastAppointmentAt: "2026-04-17T09:40:00.000Z",
    risk: "high",
    suspiciousLabel: "Highly suspicious",
    blocked: false,
  },
];

const DASHBOARD_SQL = `SELECT
  a.aadhaar_number,
  p.full_name,
  p.location,
  p.age,
  COUNT(*) FILTER (
    WHERE appt.created_at >= NOW() - INTERVAL '30 days'
  ) AS monthly_appointments,
  MAX(daily_usage.daily_count) AS daily_peak,
  MAX(appt.created_at) AS last_appointment_at,
  CASE
    WHEN MAX(daily_usage.daily_count) >= 50 THEN 'high'
    WHEN COUNT(*) FILTER (
      WHERE appt.created_at >= NOW() - INTERVAL '30 days'
    ) >= 25 THEN 'watch'
    ELSE 'low'
  END AS risk_band
FROM appointments appt
JOIN aadhaar_registry a ON a.id = appt.aadhaar_id
JOIN patients p ON p.aadhaar_id = a.id
JOIN (
  SELECT
    aadhaar_id,
    DATE(created_at) AS appointment_day,
    COUNT(*) AS daily_count
  FROM appointments
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY aadhaar_id, DATE(created_at)
) daily_usage ON daily_usage.aadhaar_id = a.id
WHERE appt.created_at >= NOW() - INTERVAL '30 days'
GROUP BY a.aadhaar_number, p.full_name, p.location, p.age
ORDER BY daily_peak DESC, monthly_appointments DESC;`;

export async function GET() {
  const now = new Date().toISOString();
  return NextResponse.json({
    generatedAt: now,
    records: SAMPLE_ROWS,
    sql: DASHBOARD_SQL,
    policy: {
      privateAudience: "govt_employees_only",
      suspiciousThresholdDaily: 50,
      normalMonthlyRange: "2-10",
    },
  });
}
