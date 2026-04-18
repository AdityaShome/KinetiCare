from __future__ import annotations

import base64
import io
import sqlite3
import unittest

from PIL import Image

from claims_service import main


def _image_data_url() -> str:
    image = Image.new("RGB", (8, 8), color=(12, 80, 140))
    exif = Image.Exif()
    exif[271] = "Canon"
    exif[272] = "EOS"
    exif[36867] = "2026:04:17 10:11:12"

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


class MetadataAnalysisTests(unittest.TestCase):
    def test_extracts_timestamp_from_uploaded_image_exif(self) -> None:
        document = {
            "filename": "claim-photo.jpg",
            "data_url": _image_data_url(),
        }

        exif_document = main._extract_document_exif(document, 0)

        self.assertIsNotNone(exif_document)
        assert exif_document is not None
        self.assertEqual(exif_document["timestamp"], "2026-04-17T10:11:12+00:00")
        self.assertEqual(exif_document["camera_make"], "Canon")
        self.assertEqual(exif_document["camera_model"], "EOS")
        self.assertTrue(exif_document["has_exif"])

    def test_flags_device_reuse_and_location_mismatch(self) -> None:
        database = sqlite3.connect(":memory:")
        database.row_factory = sqlite3.Row
        database.executescript(main.DEFAULT_SCHEMA_SQL)

        now = "2026-04-17T00:00:00+00:00"

        database.execute(
            """
            INSERT INTO patients (
                patient_id, full_name, date_of_birth, gender, government_id,
                scheme_id, scheme_member_id, phone_number, address, city, state,
                eligibility_status, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "PAT-TEST-1",
                "Current Patient",
                "1990-01-01",
                "F",
                "GOV-1",
                "AB-ArK",
                "SCH-1",
                "9999999999",
                "12 MG Road",
                "Bengaluru",
                "Karnataka",
                "eligible",
                "{}",
                now,
                now,
            ),
        )
        database.execute(
            """
            INSERT INTO patients (
                patient_id, full_name, date_of_birth, gender, government_id,
                scheme_id, scheme_member_id, phone_number, address, city, state,
                eligibility_status, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "PAT-OTHER-1",
                "Other Patient",
                "1992-02-02",
                "M",
                "GOV-2",
                "AB-ArK",
                "SCH-2",
                "8888888888",
                "18 Anna Salai",
                "Chennai",
                "Tamil Nadu",
                "eligible",
                "{}",
                now,
                now,
            ),
        )
        database.execute(
            """
            INSERT INTO hospitals (
                hospital_id, name, scheme_partners, city, state,
                empanelment_status, specialties, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "HOSP-TEST-1",
                "City Care Hospital",
                '["AB-ArK"]',
                "Bengaluru",
                "Karnataka",
                "active",
                '["Cardiology"]',
                "{}",
                now,
                now,
            ),
        )

        previous_metadata = {
            "feature_engineering": {
                "metadata_analysis": {
                    "documents": [
                        {
                            "document": "previous-claim-photo.jpg",
                            "device_id": "DEVICE-42",
                        }
                    ]
                }
            }
        }
        database.execute(
            """
            INSERT INTO claims (
                claim_id, patient_id, hospital_id, scheme_id, diagnosis, procedure,
                claim_amount, admission_date, discharge_date, document_text,
                supporting_documents, metadata, status, risk_score, risk_band,
                fraud_flags, patient_name, hospital_name, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "CLM-EXISTING-1",
                "PAT-OTHER-1",
                "HOSP-TEST-1",
                "AB-ArK",
                "Diagnosis",
                "Procedure",
                4000.0,
                "2026-04-10",
                "2026-04-11",
                "seed",
                "[]",
                main._json_text(previous_metadata),
                "submitted",
                0.0,
                "low",
                "[]",
                "Other Patient",
                "City Care Hospital",
                now,
                now,
            ),
        )

        claim = {
            "claim_id": "CLM-CURRENT-1",
            "patient_id": "PAT-TEST-1",
            "hospital_id": "HOSP-TEST-1",
            "supporting_documents": [
                {
                    "filename": "evidence.jpg",
                    "data_url": _image_data_url(),
                    "device_id": "DEVICE-42",
                    "gps": {
                        "lat": 13.0827,
                        "lon": 80.2707,
                    },
                }
            ],
            "created_at": now,
        }

        original_threshold = main.METADATA_DEVICE_REUSE_PATIENT_THRESHOLD
        try:
            main.METADATA_DEVICE_REUSE_PATIENT_THRESHOLD = 2
            metadata_analysis = main._analyze_claim_metadata(database, claim)
        finally:
            main.METADATA_DEVICE_REUSE_PATIENT_THRESHOLD = original_threshold

        self.assertTrue(metadata_analysis["metadata_flag"])
        self.assertEqual(metadata_analysis["reason"], "device reused across 2 patients")
        self.assertEqual(
            metadata_analysis["signals"],
            ["device_reuse", "location_mismatch"],
        )
        self.assertEqual(metadata_analysis["reused_device_patient_count"], 2)
        self.assertGreater(metadata_analysis["location_mismatch_distance_km"], 250.0)


if __name__ == "__main__":
    unittest.main()
