PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS patients (
    patient_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    gender TEXT NOT NULL,
    government_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    scheme_member_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    eligibility_status TEXT NOT NULL DEFAULT 'eligible',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hospitals (
    hospital_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scheme_partners TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    empanelment_status TEXT NOT NULL,
    specialties TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
    claim_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    hospital_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    procedure TEXT NOT NULL,
    claim_amount REAL NOT NULL,
    admission_date TEXT NOT NULL,
    discharge_date TEXT,
    document_text TEXT NOT NULL,
    supporting_documents TEXT NOT NULL DEFAULT '[]',
    metadata TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL,
    risk_score REAL NOT NULL,
    risk_band TEXT NOT NULL,
    fraud_flags TEXT NOT NULL DEFAULT '[]',
    patient_name TEXT,
    hospital_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id)
);

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_patient_created_at
    ON claims(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claims_hospital_created_at
    ON claims(hospital_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users(email);