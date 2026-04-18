# Checkpoint 2: Beneficiary Verification Engine

This checkpoint adds probabilistic identity matching so the system can decide whether a beneficiary is valid before claim processing.

## Delivered
- Fuzzy beneficiary matching over the SQL patient master list
- Name similarity scoring
- Date of birth exact matching
- Address similarity scoring
- Confidence scoring logic
- Decision output:
  - `approved`
  - `review`
  - `rejected`
- Verification API:
  - `POST /verify-beneficiary`

## Matching signals
- Name similarity uses normalized string matching
- DOB is treated as a strong exact match signal
- Address is compared probabilistically to reduce identity mismatch
- Government ID and scheme member ID add strong confidence when present
- Optional city/state hints improve the score

## Where the data lives
- Beneficiary master records: `data/claims-assurance/seed/patients.json`
- SQL schema: `data-contracts/sql-schema/claims-assurance.sql`
- API contract schemas: `data-contracts/json-schema/beneficiary-verification-request.schema.json`, `data-contracts/json-schema/beneficiary-verification-response.schema.json`

## Backend service
- FastAPI app: [services/claims-service/src/claims_service/main.py](../services/claims-service/src/claims_service/main.py)
- Dev runner: `npm run dev:claims`

## Demo message
We reduce identity mismatch using probabilistic matching.

## Smoke test
Run the claims service, then execute:

```bash
python test_bve_api.py
```

The test will:
- verify a close match that should approve or review
- verify a clearly mismatched identity that should reject
