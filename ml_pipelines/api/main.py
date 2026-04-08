"""FastAPI inference service for ML pipeline models."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException

# Run locally from ml_pipelines/api with: uvicorn main:app --reload
app = FastAPI()


@app.get("/")
def root() -> dict[str, str]:
    """Root route for health checks and API identification."""
    return {"message": "Lighthouse ML API"}


BASE_DIR = Path(__file__).resolve().parent
SAVED_MODELS_DIR = (BASE_DIR / "saved_models").resolve()

DONOR_MODEL_PATH = SAVED_MODELS_DIR / "donor_churn_model.pkl"
DONOR_FEATURES_PATH = SAVED_MODELS_DIR / "donor_churn_features.pkl"
SOCIAL_MODEL_PATH = SAVED_MODELS_DIR / "social_engagement_classifier.pkl"
SOCIAL_FEATURES_PATH = SAVED_MODELS_DIR / "social_engagement_features.pkl"


def _load_artifact(path: Path) -> Any:
    """Load a joblib artifact from disk.

    Args:
        path: Absolute path to the artifact file.

    Returns:
        Any: Loaded artifact object.
    """
    if not path.exists():
        raise HTTPException(status_code=500, detail=f"Missing model artifact: {path.name}")
    return joblib.load(path)


def _to_bool(value: Any) -> bool:
    """Convert loose JSON inputs into booleans.

    Args:
        value: Input value from request payload.

    Returns:
        bool: Best-effort boolean conversion.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return False


def _align_features(payload: dict[str, Any], feature_names: list[str]) -> pd.DataFrame:
    """Align request payload to trained feature list.

    Args:
        payload: User-provided input data.
        feature_names: Ordered feature names used by the trained model.

    Returns:
        pd.DataFrame: Single-row aligned feature DataFrame.
    """
    row: dict[str, float] = {}
    for feature in feature_names:
        value = payload.get(feature, 0)
        if isinstance(value, bool):
            row[feature] = float(value)
        else:
            try:
                row[feature] = float(value)
            except (TypeError, ValueError):
                row[feature] = 0.0
    return pd.DataFrame([row], columns=feature_names)


def _predict_probability(model: Any, aligned_df: pd.DataFrame) -> float:
    """Get positive-class probability from a classifier model.

    Args:
        model: Trained classification model.
        aligned_df: Single-row model input.

    Returns:
        float: Probability for class 1.
    """
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(aligned_df)[0][1]
        return float(proba)

    pred = model.predict(aligned_df)[0]
    return float(pred)


@app.get("/health")
def health() -> dict[str, str]:
    """Health check endpoint.

    Returns:
        dict[str, str]: Service status.
    """
    return {"status": "ok"}


@app.post("/predict/donor-churn")
def predict_donor_churn(payload: dict[str, Any]) -> dict[str, Any]:
    """Predict donor lapse risk and probability.

    Args:
        payload: JSON payload with donor numeric fields and optional `acq_` booleans.

    Returns:
        dict[str, Any]: Predicted lapse label and probability.
    """
    required = [
        "total_donation_count",
        "total_amount",
        "avg_donation_amount",
        "days_since_first_donation",
        "donation_type_variety",
        "is_recurring_donor",
    ]
    missing = [k for k in required if k not in payload]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required fields: {missing}")

    donor_model = _load_artifact(DONOR_MODEL_PATH)
    donor_features = list(_load_artifact(DONOR_FEATURES_PATH))

    normalized_payload = dict(payload)
    normalized_payload["is_recurring_donor"] = _to_bool(payload.get("is_recurring_donor"))
    for key, value in list(payload.items()):
        if key.startswith("acq_"):
            normalized_payload[key] = _to_bool(value)

    aligned = _align_features(normalized_payload, donor_features)
    probability = _predict_probability(donor_model, aligned)
    is_lapsed = probability >= 0.5

    return {"is_lapsed": bool(is_lapsed), "probability": float(probability)}


@app.post("/predict/social-engagement")
def predict_social_engagement(payload: dict[str, Any]) -> dict[str, Any]:
    """Predict whether a planned post will generate donation referrals.

    Args:
        payload: JSON payload with pre-publication features and one-hot fields.

    Returns:
        dict[str, Any]: Predicted donation-generation label and probability.
    """
    required = [
        "post_hour",
        "caption_length",
        "num_hashtags",
        "mentions_count",
        "boost_budget_php",
        "is_boosted",
        "features_resident_story",
    ]
    missing = [k for k in required if k not in payload]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required fields: {missing}")

    social_model = _load_artifact(SOCIAL_MODEL_PATH)
    social_features = list(_load_artifact(SOCIAL_FEATURES_PATH))

    normalized_payload = dict(payload)
    normalized_payload["is_boosted"] = _to_bool(payload.get("is_boosted"))
    normalized_payload["features_resident_story"] = _to_bool(
        payload.get("features_resident_story")
    )
    if "has_call_to_action" in normalized_payload:
        normalized_payload["has_call_to_action"] = _to_bool(payload.get("has_call_to_action"))

    aligned = _align_features(normalized_payload, social_features)
    probability = _predict_probability(social_model, aligned)
    will_generate_donation = probability >= 0.5

    return {
        "will_generate_donation": bool(will_generate_donation),
        "probability": float(probability),
    }
