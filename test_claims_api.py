from __future__ import annotations

import uuid

import httpx

BASE_URL = "http://127.0.0.1:8010"


def main() -> None:
    patient_id = f"PAT-{uuid.uuid4().hex[:8].upper()}"
    claim_id = f"CLM-{uuid.uuid4().hex[:10].upper()}"

    patient_payload = {
        "patient_id": patient_id,
        "full_name": "Checkpoint Patient",
        "date_of_birth": "1988-04-11",
        "gender": "female",
        "government_id": f"ID-{uuid.uuid4().hex[:8].upper()}",
        "scheme_id": "AB-ArK",
        "scheme_member_id": f"ARK-{uuid.uuid4().hex[:6].upper()}",
        "phone_number": "9876500999",
        "address": "1 Demo Street",
        "city": "Bengaluru",
        "state": "Karnataka",
    }

    claim_payload = {
        "claim_id": claim_id,
        "patient_id": patient_id,
        "hospital_id": "HOSP-2001",
        "scheme_id": "AB-ArK",
        "diagnosis": "Post-operative observation",
        "procedure": "Ward stay and medication",
        "claim_amount": 15800,
        "admission_date": "2026-04-16",
        "discharge_date": "2026-04-17",
        "document_text": (
            "Synthetic discharge note and billing sheet match the claim."
        ),
        "supporting_documents": ["discharge_summary.pdf", "bill.pdf"],
    }

    with httpx.Client(timeout=20.0) as client:
        health = client.get(f"{BASE_URL}/health")
        print("HEALTH:", health.status_code, health.json())

        patient = client.post(f"{BASE_URL}/add-patient", json=patient_payload)
        print("ADD_PATIENT:", patient.status_code, patient.json())

        claim = client.post(f"{BASE_URL}/submit-claim", json=claim_payload)
        print("SUBMIT_CLAIM:", claim.status_code, claim.json())

        fetched = client.get(
            f"{BASE_URL}/get-claim",
            params={"claim_id": claim_id},
        )
        print("GET_CLAIM:", fetched.status_code, fetched.json())


if __name__ == "__main__":
    main()
