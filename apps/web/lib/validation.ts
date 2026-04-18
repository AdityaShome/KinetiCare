import { z } from "zod";

export const runCheckSchema = z.object({
  journalText: z.string().min(1).max(10000),
  baselineMap: z.number().min(1).max(250),
  useCamera: z.boolean(),
  simulateSpoof: z.boolean(),
  audioFeatures: z.array(z.number()).optional(),
  videoFeatures: z.array(z.number()).optional(),
  dwellTimesMs: z.array(z.number()).min(8).optional(),
  flightTimesMs: z.array(z.number()).min(8).optional(),
  dwellTimes: z.array(z.number()).min(8).optional(),
  flightTimes: z.array(z.number()).min(8).optional(),
  imuAccelMagnitude: z.array(z.number()).min(64).optional(),
  ppgSignal: z.array(z.number()).min(50).optional(),
  ppgSamplingRateHz: z.number().positive().optional(),
  kineticareSamplingRateHz: z.number().positive().optional(),
  cameraMetrics: z.object({
    frame_quality_score: z.number().min(0).max(1),
    blur_score: z.number().min(0).max(1),
    face_tracking_confidence: z.number().min(0).max(1),
    spoof_probability: z.number().min(0).max(1),
    accepted_window_ratio: z.number().min(0).max(1),
    laplacian_variance: z.number().min(0),
    frequency_spoof_score: z.number().min(0).max(1),
  }).optional(),
  bloodImageBase64: z.string().min(100).optional(),
  nervousTapIntervalsMs: z.array(z.number()).min(10).optional(),
  nervousTapDistancesPx: z.array(z.number()).min(10).optional(),
  nervousTremorSignal: z.array(z.number()).min(64).optional(),
  nervousSamplingRateHz: z.number().positive().optional(),
  patientId: z.string().optional(),
});

export const prescriptionCreateSchema = z.object({
  patientId: z.string().min(1),
  clinicianId: z.string().min(1),
  medicationName: z.string().min(1).max(200),
  dosage: z.string().min(1).max(200),
  frequency: z.string().min(1).max(200),
  route: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  notes: z.string().max(3000).optional(),
  interactionWarnings: z.array(z.string()).default([]),
  status: z.enum(["active", "paused", "discontinued"]).default("active"),
});

export const monitoringScheduleSchema = z.object({
  patientId: z.string().min(1),
  timezone: z.string().min(1).max(100),
  checkTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)).min(1).max(6),
  isActive: z.boolean().default(true),
});

export const monitoringCheckinSchema = z.object({
  patientId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: z.enum(["scheduled", "completed", "missed", "escalated"]),
  source: z.enum(["daily-checkup", "manual"]),
  assessmentId: z.string().optional(),
  notes: z.string().max(3000).optional(),
});

export const claimsDocumentSchema = z.object({
  filename: z.string().min(1).max(260),
  mimeType: z.string().min(1).max(120),
  dataUrl: z.string().min(100),
  deviceId: z.string().min(1).max(120).optional(),
  timestamp: z.string().min(1).max(80).optional(),
  gps: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }).optional(),
});

export const claimsAssuranceSchema = z.object({
  patientId: z.string().min(1),
  hospitalId: z.string().min(1),
  schemeId: z.string().min(1),
  digilockerConsent: z.boolean().default(false),
  digilockerDocumentType: z.enum(["aadhaar", "abha", "insurance_card"]).default("aadhaar"),
  digilockerDocumentId: z.string().min(4).max(64).optional(),
  claimAmount: z.number().positive(),
  admissionDate: z.string().min(1),
  dischargeDate: z.string().min(1).optional(),
  typedName: z.string().min(1).max(200),
  typedDob: z.string().min(1).max(40),
  typedAddress: z.string().min(1).max(300),
  diagnosis: z.string().min(1).max(200).default("General inpatient review"),
  procedure: z.string().min(1).max(200).default("Document and fraud screening"),
  documentText: z.string().min(1).max(5000).default("Uploaded claim evidence and intake details."),
  supportingDocuments: z.array(claimsDocumentSchema).max(4).default([]),
});

export type RunCheckInput = z.infer<typeof runCheckSchema>;
export type PrescriptionCreateInput = z.infer<typeof prescriptionCreateSchema>;
export type MonitoringScheduleInput = z.infer<typeof monitoringScheduleSchema>;
export type MonitoringCheckinInput = z.infer<typeof monitoringCheckinSchema>;
export type ClaimsAssuranceInput = z.infer<typeof claimsAssuranceSchema>;
