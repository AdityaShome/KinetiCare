# Checkpoint 4: Feature Engineering Layer

This checkpoint adds the data-preparation layer that most ML projects fail to ship correctly.

## Delivered
- Claim-level feature engineering for ML-ready inputs
- Hospital average claim cost
- Patient claim frequency over the last 30 days
- Deviation from normal cost
- Time since last claim
- Feature vector output per claim

## Feature vector
The feature vector is generated as:
- `hospital_avg_claim_cost`
- `patient_claim_frequency_30d`
- `cost_deviation_ratio`
- `days_since_last_claim`

## Where the logic lives
- FastAPI app: [services/claims-service/src/claims_service/main.py](../services/claims-service/src/claims_service/main.py)
- Feature endpoint: `GET /claim-features/{claim_id}`

## Demo message
We prepare feature vectors for every claim before ML scoring.

## Smoke test
Run the claims service, then execute:

```bash
python test_features_api.py
```

The test will:
- submit a claim
- fetch the claim feature vector by `claim_id`
- print the engineered values
