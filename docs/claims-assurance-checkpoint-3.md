# Checkpoint 3: Rule-Based Fraud Engine

This checkpoint adds instant, deterministic fraud detection to the claims pipeline.

## Delivered
- Rule-based fraud engine that runs automatically during claim submission
- Fraud flags for:
  - claim before admission
  - duplicate claim on the same patient and same day
  - high-cost claims above threshold
- Fraud-aware claim response output

## Rules
- `claim_before_admission`: admission date is in the future relative to submission
- `duplicate_claim`: same patient already has a claim with the same admission date
- `high_cost`: claim amount exceeds the configured threshold

## Where the logic lives
- FastAPI app: [services/claims-service/src/claims_service/main.py](../services/claims-service/src/claims_service/main.py)
- High-cost threshold: `CLAIMS_HIGH_COST_THRESHOLD` (default `20000`)

## Demo message
Immediate fraud detection without ML.

## Smoke test
Run the claims service, then execute:

```bash
python test_fraud_api.py
```

The test will:
- submit a future-dated high-cost claim
- submit another claim for the same patient and day
- show the returned fraud flags
