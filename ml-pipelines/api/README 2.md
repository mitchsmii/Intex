# ML Pipelines API

FastAPI service for serving donor churn and social engagement predictions.

## Quick Start

From this folder (`ml-pipelines/api`):

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

API will be available at:
- `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

## Endpoints

- `GET /health`
- `POST /predict/donor-churn`
- `POST /predict/social-engagement`

## Model Artifacts

This API expects model files in `saved_models/` (next to `main.py`):
- `donor_churn_model.pkl`
- `donor_churn_features.pkl`
- `social_engagement_classifier.pkl`
- `social_engagement_features.pkl`
