from __future__ import annotations

import uuid

import httpx

BASE_URL = "http://127.0.0.1:8010"


def submit_claim(client: httpx.Client, payload: dict) -> dict:
    response = client.post(f"{BASE_URL}/submit-claim", json=payload)
    data = response.json()
    print(
        "SUBMIT:",
        response.status_code,
        data.get("claim_id"),
        data.get("fraud_flags"),
    )
    return data


def main() -> None:
    patient_id = f"PAT-{uuid.uuid4().hex[:8].upper()}"
    member_id = f"ARK-{uuid.uuid4().hex[:6].upper()}"

    patient_payload = {
        "patient_id": patient_id,
        "full_name": "Spatial Temporal Demo",
        "date_of_birth": "1987-11-03",
        "gender": "female",
        "government_id": f"ID-{uuid.uuid4().hex[:8].upper()}",
        "scheme_id": "AB-ArK",
        "scheme_member_id": member_id,
        "phone_number": "9876500100",
        "address": "12 MG Road",
        "city": "Bengaluru",
        "state": "Karnataka",
    }

    with httpx.Client(timeout=20.0) as client:
        print("HEALTH:", client.get(f"{BASE_URL}/health").json())
        added = client.post(f"{BASE_URL}/add-patient", json=patient_payload)
        print(
            "ADD_PATIENT:",
            added.status_code,
            added.json().get("patient_id"),
        )

        base_claim = {
            "patient_id": patient_id,
            "hospital_id": "HOSP-2003",
            "scheme_id": "AB-ArK",
            "diagnosis": "Observation",
            "procedure": "Monitoring",
            "claim_amount": 16500,
            "document_text": "Synthetic claim for spatial-temporal test.",
            "supporting_documents": ["admission.pdf"],
        }

        submit_claim(
            client,
            {
                **base_claim,
                "claim_id": f"CLM-{uuid.uuid4().hex[:10].upper()}",
                "admission_date": "2026-04-10",
                "discharge_date": "2026-04-12",
            },
        )
        submit_claim(
            client,
            {
                **base_claim,
                "claim_id": f"CLM-{uuid.uuid4().hex[:10].upper()}",
                "admission_date": "2026-04-13",
                "discharge_date": "2026-04-15",
            },
        )
        submit_claim(
            client,
            {
                **base_claim,
                "claim_id": f"CLM-{uuid.uuid4().hex[:10].upper()}",
                "admission_date": "2026-04-16",
                "discharge_date": "2026-04-19",
            },
        )

        final_claim = submit_claim(
            client,
            {
                **base_claim,
                "claim_id": f"CLM-{uuid.uuid4().hex[:10].upper()}",
                "admission_date": "2026-04-18",
                "discharge_date": "2026-04-22",
            },
        )

        features_res = client.get(
            f"{BASE_URL}/claim-features/{final_claim['claim_id']}",
        )
        features = features_res.json()
        print("FEATURES_STATUS:", features_res.status_code)
        print(
            "SPATIAL_TEMPORAL:",
            {
                "distance_km": features["feature_summary"].get(
                    "patient_hospital_distance_km",
                ),
                "nearest_hospital_km": features["feature_summary"].get(
                    "nearest_hospital_distance_km",
                ),
                "claims_per_week": features["feature_summary"].get(
                    "claims_per_week",
                ),
                "claim_velocity": features.get("claim_velocity"),
                "overlap_flag": features.get("overlap_flag"),
                "flags": features.get("spatiotemporal_flags"),
            },
        )


if __name__ == "__main__":
    main()
