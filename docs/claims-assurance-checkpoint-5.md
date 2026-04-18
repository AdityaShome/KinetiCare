# Checkpoint 5: Spatial & Temporal Features

This checkpoint adds space-time behavioral features so claims can be evaluated beyond static fields.

## Delivered
- Spatial features:
  - distance between patient and hospital
  - nearest-hospital distance (simulated via city coordinates)
- Temporal features:
  - claims per week
  - time since last claim
  - overlapping visits detection
- Output fields include:
  - `distance = <km>` via `patient_hospital_distance_km`
  - `claim_velocity = low|medium|high`
  - `overlap_flag = true|false`

## Impact signals
- `unnecessary_travel`
- `claim_burst`
- `overlapping_visits`
- `hospital_targeting`

## API
- Feature endpoint: `GET /claim-features/{claim_id}`

## Demo message
Detects unnecessary travel, claim bursts, and hospital targeting.

## Smoke test
Run the claims service, then execute:

```bash
python test_spatiotemporal_api.py
```

The test creates burst and overlap behavior and prints feature outputs.
