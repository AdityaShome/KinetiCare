from __future__ import annotations

import uuid

import httpx

BASE_URL = "http://127.0.0.1:8010"


def main() -> None:
    approved_payload = {
        "patient_id": "PAT-1001",
        "full_name": "Ananya R.",
        "date_of_birth": "1985-06-14",
        "address": "12 MG Rd, Bengaluru",
        "government_id": "KA-ARK-1001",
        "scheme_member_id": "ARK-1001",
        "scheme_id": "AB-ArK",
        "city": "Bengaluru",
        "state": "Karnataka",
    }

    rejected_payload = {
        "patient_id": f"PAT-{uuid.uuid4().hex[:8].upper()}",
        "full_name": "Completely Different Person",
        "date_of_birth": "1970-01-01",
        "address": "999 Unknown Road",
        "government_id": "NO-MATCH-001",
        "scheme_member_id": "NO-MATCH-002",
        "scheme_id": "AB-ArK",
        "city": "Delhi",
        "state": "Delhi",
    }

    with httpx.Client(timeout=20.0) as client:
        health = client.get(f"{BASE_URL}/health")
        print("HEALTH:", health.status_code, health.json())

        approved = client.post(
            f"{BASE_URL}/verify-beneficiary",
            json=approved_payload,
        )
        print("APPROVED_CASE:", approved.status_code, approved.json())

        rejected = client.post(
            f"{BASE_URL}/verify-beneficiary",
            json=rejected_payload,
        )
        print("REJECTED_CASE:", rejected.status_code, rejected.json())


if __name__ == "__main__":
    main()
