# Checkpoint 1: Data + Basic System Skeleton

This checkpoint establishes the foundation for the claims assurance platform.

## Delivered
- Synthetic dataset for:
  - patients
  - hospitals
  - claims
- SQL-backed schema and storage
- FastAPI backend
- Core APIs:
  - `POST /add-patient`
  - `POST /submit-claim`
  - `GET /get-claim`
- Health check endpoint:
  - `GET /health`

## Where the data lives
- Seed files: `data/claims-assurance/seed/`
- Schema files: `data-contracts/json-schema/`
- SQL schema: `data-contracts/sql-schema/claims-assurance.sql`

## Backend service
- FastAPI app: [services/claims-service/src/claims_service/main.py](../services/claims-service/src/claims_service/main.py)
- Dev runner: `npm run dev:claims`

## SQL storage
- Uses `CLAIMS_SQLITE_PATH`
- Defaults to `data/claims-assurance/claims_assurance.sqlite3`

## Smoke test
Run the local service, then execute:

```bash
python test_claims_api.py
```

The test will:
- add a patient
- submit a claim
- fetch the same claim back by `claim_id`
