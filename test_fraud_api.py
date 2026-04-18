from __future__ import annotations

import uuid

import httpx

BASE_URL = "http://127.0.0.1:8010"


def main() -> None:
    patient_id = f"PAT-{uuid.uuid4().hex[:8].upper()}"
    admission_date = "2026-04-30"

    patient_payload = {
        "patient_id": patient_id,
        "full_name": "Fraud Demo Patient",
        "date_of_birth": "1986-01-20",
        "gender": "female",
        "government_id": f"ID-{uuid.uuid4().hex[:8].upper()}",
        "scheme_id": "AB-ArK",
        "scheme_member_id": f"ARK-{uuid.uuid4().hex[:6].upper()}",
        "phone_number": "9876512345",
        "address": "42 Scheme Road",
        "city": "Bengaluru",
        "state": "Karnataka",
    }

    high_cost_claim = {
        "patient_id": patient_id,
        "hospital_id": "HOSP-2001",
        "scheme_id": "AB-ArK",
        "diagnosis": "Elective procedure",
        "procedure": "Specialty surgery",
        "claim_amount": 25000,
        "admission_date": admission_date,
        "discharge_date": "2026-05-02",
        "document_text": "Synthetic note for a future-dated expensive claim.",
        "supporting_documents": ["admission_note.pdf", "bill.pdf"],
    }

    duplicate_claim = {
        "patient_id": patient_id,
        "hospital_id": "HOSP-2001",
        "scheme_id": "AB-ArK",
        "diagnosis": "Elective procedure",
        "procedure": "Specialty surgery",
        "claim_amount": 22000,
        "admission_date": admission_date,
        "discharge_date": "2026-05-02",
        "document_text": "Second claim on the same patient and same day.",
        "supporting_documents": ["admission_note.pdf", "bill-copy.pdf"],
    }

    with httpx.Client(timeout=20.0) as client:
        health = client.get(f"{BASE_URL}/health")
        print("HEALTH:", health.status_code, health.json())

        patient = client.post(f"{BASE_URL}/add-patient", json=patient_payload)
        print("ADD_PATIENT:", patient.status_code, patient.json())

        first = client.post(f"{BASE_URL}/submit-claim", json=high_cost_claim)
        print("FIRST_CLAIM:", first.status_code, first.json())

        second = client.post(f"{BASE_URL}/submit-claim", json=duplicate_claim)
        print("SECOND_CLAIM:", second.status_code, second.json())


if __name__ == "__main__":
    main()
