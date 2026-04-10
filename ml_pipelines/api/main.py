"""FastAPI inference service for ML pipeline models."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Run locally from ml_pipelines/api with: uvicorn main:app --reload
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CORS — allow the Vercel-hosted frontend (prod + preview deploys) and local dev.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


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
SOCIAL_REGRESSION_PATH = SAVED_MODELS_DIR / "social_engagement_regression.pkl"
RESIDENT_RISK_MODEL_PATH = SAVED_MODELS_DIR / "resident_risk_model.pkl"
RESIDENT_RISK_METADATA_PATH = SAVED_MODELS_DIR / "resident_risk_metadata.json"
EDUCATION_OUTCOME_MODEL_PATH = SAVED_MODELS_DIR / "education_outcome_model.pkl"
EDUCATION_OUTCOME_METADATA_PATH = SAVED_MODELS_DIR / "education_outcome_metadata.json"
REINTEGRATION_KMEANS_PATH = SAVED_MODELS_DIR / "reintegration_journey_kmeans.pkl"
REINTEGRATION_SCALER_PATH = SAVED_MODELS_DIR / "reintegration_journey_scaler.pkl"
REINTEGRATION_FEATURES_PATH = SAVED_MODELS_DIR / "reintegration_journey_features.pkl"
REINTEGRATION_CLUSTER_NAMES_PATH = SAVED_MODELS_DIR / "reintegration_journey_cluster_names.pkl"


def _load_feature_list_from_metadata(path: Path, key: str) -> list[str]:
    """Load an ordered feature name list from a metadata JSON file.

    Args:
        path: Path to the metadata JSON.
        key: Top-level key whose value is the feature list.

    Returns:
        list[str]: Ordered feature names.
    """
    if not path.exists():
        raise HTTPException(status_code=500, detail=f"Missing metadata file: {path.name}")
    with path.open("r", encoding="utf-8") as fh:
        meta = json.load(fh)
    features = meta.get(key)
    if not isinstance(features, list) or not features:
        raise HTTPException(
            status_code=500,
            detail=f"Metadata {path.name} missing feature list under '{key}'.",
        )
    return [str(f) for f in features]


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


def _extract_feature_importance(model: Any, feature_names: list[str]) -> list[dict[str, Any]]:
    """Extract global feature importance from a fitted classifier.

    Supports tree-based models (``feature_importances_``) and linear models
    (``coef_``). Returns features sorted by descending importance, normalized
    so the values sum to 1.

    If ``model`` is an sklearn ``Pipeline``, the final estimator is taken from
    ``named_steps['model']`` before reading importances or coefficients.

    Args:
        model: Trained classifier (or Pipeline whose last step exposes importances).
        feature_names: Ordered feature names used by the trained model.

    Returns:
        list[dict[str, Any]]: List of ``{"feature": str, "importance": float}``.
    """
    if hasattr(model, "named_steps"):
        model = model.named_steps.get("model", model)

    raw: np.ndarray | None = None
    if hasattr(model, "feature_importances_"):
        raw = np.asarray(model.feature_importances_, dtype=float)
    elif hasattr(model, "coef_"):
        coef = np.asarray(model.coef_, dtype=float)
        raw = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)

    if raw is None or raw.size == 0:
        raise HTTPException(
            status_code=501,
            detail="Model does not expose feature importances.",
        )

    if len(raw) != len(feature_names):
        raise HTTPException(
            status_code=500,
            detail="Feature importance length mismatch with feature names.",
        )

    total = float(raw.sum())
    if total > 0:
        raw = raw / total

    pairs = [
        {"feature": name, "importance": float(value)}
        for name, value in zip(feature_names, raw)
    ]
    pairs.sort(key=lambda item: item["importance"], reverse=True)
    return pairs


def _extract_pipeline_feature_importance(model: Any, feature_names: list[str]) -> list[dict[str, Any]]:
    """Extract feature importance for plain models or sklearn Pipelines.

    For pipeline models that include a selector step, this maps the final model's
    importances to only the selected feature names. The selector step is expected
    as ``selector`` or ``select`` (sklearn Pipeline step names vary).
    """
    if hasattr(model, "named_steps"):
        selector = model.named_steps.get("selector") or model.named_steps.get("select")
        inner_model = model.named_steps.get("model", model)

        selected_features = feature_names
        if selector is not None and hasattr(selector, "get_support"):
            support = selector.get_support()
            if len(support) != len(feature_names):
                raise HTTPException(
                    status_code=500,
                    detail="Selector mask length does not match feature list length.",
                )
            selected_features = [
                feature for feature, keep in zip(feature_names, support) if bool(keep)
            ]

        return _extract_feature_importance(inner_model, selected_features)

    return _extract_feature_importance(model, feature_names)


@app.get("/feature-importance/social-engagement")
def social_engagement_feature_importance() -> dict[str, Any]:
    """Return global feature importance for the social engagement donation classifier.

    Returns:
        dict[str, Any]: ``{"features": [{feature, importance}, ...]}``.
    """
    social_model = _load_artifact(SOCIAL_MODEL_PATH)
    social_features = list(_load_artifact(SOCIAL_FEATURES_PATH))
    return {"features": _extract_pipeline_feature_importance(social_model, social_features)}


@app.get("/feature-importance/resident-risk")
def resident_risk_feature_importance() -> dict[str, Any]:
    """Return global feature importance for the resident risk classifier.

    The model is a Pipeline with SelectFromModel; importances are extracted
    from the inner RF classifier and matched to the 15 selected features.

    Returns:
        dict[str, Any]: ``{"features": [{feature, importance}, ...]}``.
    """
    pipeline = _load_artifact(RESIDENT_RISK_MODEL_PATH)
    selected_features = _load_feature_list_from_metadata(
        RESIDENT_RISK_METADATA_PATH, "selected_features"
    )
    # Extract the RF classifier from the pipeline's last step
    clf = pipeline
    if hasattr(pipeline, "named_steps"):
        clf = pipeline.named_steps.get("model", pipeline)
    elif hasattr(pipeline, "steps"):
        clf = pipeline.steps[-1][1]
    return {"features": _extract_feature_importance(clf, selected_features)}


@app.get("/feature-importance/donor-churn")
def donor_churn_feature_importance() -> dict[str, Any]:
    """Return global feature importance for the donor churn model.

    Loads the full feature list from ``donor_churn_features.pkl`` and restricts
    to the columns kept by the pipeline's ``selector`` step (``get_support``).

    Returns:
        dict[str, Any]: ``{"features": [{feature, importance}, ...]}``.
    """
    pipeline = _load_artifact(DONOR_MODEL_PATH)
    donor_features = list(_load_artifact(DONOR_FEATURES_PATH))

    if not hasattr(pipeline, "named_steps"):
        return {"features": _extract_feature_importance(pipeline, donor_features)}

    selector = pipeline.named_steps.get("selector") or pipeline.named_steps.get("select")
    if selector is None:
        raise HTTPException(
            status_code=500,
            detail="Donor pipeline has no 'selector' (or legacy 'select') step.",
        )
    if not hasattr(selector, "get_support"):
        raise HTTPException(
            status_code=500,
            detail="Donor pipeline selector does not support get_support().",
        )
    support = selector.get_support()
    if len(support) != len(donor_features):
        raise HTTPException(
            status_code=500,
            detail="Selector mask length does not match donor_churn_features.pkl length.",
        )
    selected_features = [
        name for name, keep in zip(donor_features, support) if bool(keep)
    ]
    inner = pipeline.named_steps.get("model", pipeline)
    return {"features": _extract_feature_importance(inner, selected_features)}


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


@app.post("/predict/resident-risk")
def predict_resident_risk(payload: dict[str, Any]) -> dict[str, Any]:
    """Predict whether a resident is high-risk (High or Critical).

    Args:
        payload: JSON payload with resident case, health, and engagement features.

    Returns:
        dict[str, Any]: Predicted high-risk label and probability.
    """
    model = _load_artifact(RESIDENT_RISK_MODEL_PATH)
    features = _load_feature_list_from_metadata(
        RESIDENT_RISK_METADATA_PATH, "input_features"
    )

    aligned = _align_features(payload, features)
    probability = _predict_probability(model, aligned)
    # Threshold lowered to 0.30 (from 0.50) to improve recall for high-risk cases.
    # The model was trained on 62 residents with class imbalance — low recall (0.30)
    # means missing high-risk cases is the bigger risk in a child welfare context.
    is_high_risk = probability >= 0.30

    return {"is_high_risk": bool(is_high_risk), "probability": float(probability)}


@app.post("/predict/education-outcome")
def predict_education_outcome(payload: dict[str, Any]) -> dict[str, Any]:
    """Predict whether a resident will complete their education program.

    Args:
        payload: JSON payload with early-window education engagement features.

    Returns:
        dict[str, Any]: Predicted completion label and probability.
    """
    model = _load_artifact(EDUCATION_OUTCOME_MODEL_PATH)
    features = _load_feature_list_from_metadata(
        EDUCATION_OUTCOME_METADATA_PATH, "recommended_features"
    )

    aligned = _align_features(payload, features)
    probability = _predict_probability(model, aligned)
    will_complete = probability >= 0.5

    return {"will_complete": bool(will_complete), "probability": float(probability)}


@app.post("/predict/reintegration-journey")
def predict_reintegration_journey(payload: dict[str, Any]) -> dict[str, Any]:
    """Assign a resident to a journey cluster based on their features.

    Args:
        payload: JSON payload with resident feature values matching the 28
                 clustering features (e.g. days_in_care, avg_health_score, …).

    Returns:
        dict[str, Any]: cluster_id, cluster_name, and distances to each centroid.
    """
    kmeans = _load_artifact(REINTEGRATION_KMEANS_PATH)
    scaler = _load_artifact(REINTEGRATION_SCALER_PATH)
    feature_names: list[str] = _load_artifact(REINTEGRATION_FEATURES_PATH)
    cluster_name_map: dict[int, str] = _load_artifact(REINTEGRATION_CLUSTER_NAMES_PATH)

    aligned = _align_features(payload, feature_names)
    scaled = scaler.transform(aligned)

    cluster_id = int(kmeans.predict(scaled)[0])
    cluster_name = cluster_name_map.get(cluster_id, f"Cluster {cluster_id}")

    distances = kmeans.transform(scaled)[0]
    centroid_distances = {
        cluster_name_map.get(i, f"Cluster {i}"): float(d)
        for i, d in enumerate(distances)
    }

    return {
        "cluster_id": cluster_id,
        "cluster_name": cluster_name,
        "centroid_distances": centroid_distances,
    }


@app.get("/feature-importance/reintegration-journey")
def reintegration_journey_feature_importance() -> dict[str, Any]:
    """Return pseudo-importance for reintegration clustering features.

    Uses **max − min** of each dimension across K-means cluster centers (scaled
    space) as a proxy for how much that feature separates clusters.

    Returns:
        dict[str, Any]: ``{"features": [{"feature": str, "importance": float}, ...]}``
        sorted by descending importance.
    """
    kmeans = _load_artifact(REINTEGRATION_KMEANS_PATH)
    feature_names: list[str] = list(_load_artifact(REINTEGRATION_FEATURES_PATH))

    centroids = np.asarray(kmeans.cluster_centers_, dtype=float)
    if centroids.ndim != 2:
        raise HTTPException(status_code=500, detail="Invalid KMeans cluster_centers_ shape.")
    if centroids.shape[1] != len(feature_names):
        raise HTTPException(
            status_code=500,
            detail="Cluster center width does not match feature list length.",
        )

    # Feature spread: range of centroid coordinates per feature (differentiation signal)
    spread = centroids.max(axis=0) - centroids.min(axis=0)
    total = float(np.sum(spread))
    if total > 0:
        spread = spread / total

    pairs = [
        {"feature": str(name), "importance": float(v)}
        for name, v in zip(feature_names, spread)
    ]
    pairs.sort(key=lambda item: item["importance"], reverse=True)
    return {"features": pairs}
