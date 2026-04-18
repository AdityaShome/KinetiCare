from __future__ import annotations

import uuid

import httpx

BASE_URL = "http://127.0.0.1:8010"


def main() -> None:
    patient_id = f"PAT-{uuid.uuid4().hex[:8].upper()}"
    claim_id = f"CLM-{uuid.uuid4().hex[:10].upper()}"

    patient_payload = {
        "patient_id": patient_id,
        "full_name": "Feature Demo Patient",
        "date_of_birth": "1984-08-09",
        "gender": "male",
        "government_id": f"ID-{uuid.uuid4().hex[:8].upper()}",
        "scheme_id": "AB-ArK",
        "scheme_member_id": f"ARK-{uuid.uuid4().hex[:6].upper()}",
        "phone_number": "9876598765",
        "address": "88 Demo Avenue",
        "city": "Bengaluru",
        "state": "Karnataka",
    }

    claim_payload = {
        "claim_id": claim_id,
        "patient_id": patient_id,
        "hospital_id": "HOSP-2001",
        "scheme_id": "AB-ArK",
        "diagnosis": "Routine observation",
        "procedure": "Short stay monitoring",
        "claim_amount": 12800,
        "admission_date": "2026-04-17",
        "discharge_date": "2026-04-18",
        "document_text": "Synthetic note for feature engineering demo.",
        "supporting_documents": ["admission.pdf", "bill.pdf"],
    }

    with httpx.Client(timeout=20.0) as client:
        health = client.get(f"{BASE_URL}/health")
        print("HEALTH:", health.status_code, health.json())

        patient = client.post(f"{BASE_URL}/add-patient", json=patient_payload)
        print("ADD_PATIENT:", patient.status_code, patient.json())

        claim = client.post(f"{BASE_URL}/submit-claim", json=claim_payload)
        print("SUBMIT_CLAIM:", claim.status_code, claim.json())

        features = client.get(f"{BASE_URL}/claim-features/{claim_id}")
        print("CLAIM_FEATURES:", features.status_code, features.json())


if __name__ == "__main__":
    main()
