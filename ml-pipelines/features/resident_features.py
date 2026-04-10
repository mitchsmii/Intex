"""Feature engineering for resident risk modeling."""

from __future__ import annotations

import pandas as pd


def build_resident_features(
    residents_df: pd.DataFrame,
    health_df: pd.DataFrame,
    education_df: pd.DataFrame,
    process_df: pd.DataFrame,
    intervention_df: pd.DataFrame,
) -> pd.DataFrame:
    """Build a resident-level training table for risk classification.

    Args:
        residents_df: Base resident records including risk labels and abuse flags.
        health_df: Health and wellbeing observations per resident.
        education_df: Education progress records per resident.
        process_df: Process/counseling session records per resident.
        intervention_df: Intervention plan records per resident.

    Returns:
        pd.DataFrame: Clean feature matrix plus target `high_risk`, ready for sklearn.
    """
    residents = residents_df.copy()
    health = health_df.copy()
    education = education_df.copy()
    process = process_df.copy()
    intervention = intervention_df.copy()

    health_agg = (
        health.groupby("resident_id", dropna=False)["general_health_score"]
        .mean()
        .rename("avg_health_score")
        .reset_index()
    )
    education_agg = (
        education.groupby("resident_id", dropna=False)["progress_percent"]
        .mean()
        .rename("avg_education_progress")
        .reset_index()
    )
    process_agg = (
        process.groupby("resident_id", dropna=False)["recording_id"]
        .count()
        .rename("total_counseling_sessions")
        .reset_index()
    )

    intervention["status"] = intervention.get("status", "").fillna("")
    active_mask = intervention["status"].eq("Active")
    intervention_agg = (
        intervention[active_mask]
        .groupby("resident_id", dropna=False)
        .size()
        .rename("active_intervention_plans")
        .reset_index()
    )

    model_df = (
        residents.merge(health_agg, on="resident_id", how="left")
        .merge(education_agg, on="resident_id", how="left")
        .merge(process_agg, on="resident_id", how="left")
        .merge(intervention_agg, on="resident_id", how="left")
    )

    model_df["date_of_admission"] = pd.to_datetime(
        model_df.get("date_of_admission"), errors="coerce"
    )
    today = pd.Timestamp.today().normalize()
    model_df["days_in_care"] = (today - model_df["date_of_admission"]).dt.days

    model_df["high_risk"] = model_df.get("current_risk_level", "").isin(["High", "Critical"])

    abuse_flag_columns = [col for col in model_df.columns if "abuse" in col.lower()]
    for col in abuse_flag_columns:
        model_df[col] = model_df[col].fillna(False).astype(bool)

    fill_defaults = {
        "avg_health_score": 0.0,
        "avg_education_progress": 0.0,
        "total_counseling_sessions": 0,
        "active_intervention_plans": 0,
        "days_in_care": -1,
    }
    for col, value in fill_defaults.items():
        if col in model_df.columns:
            model_df[col] = model_df[col].fillna(value)

    leakage_columns = ["resident_id", "current_risk_level", "date_of_admission"]
    existing_leakage_columns = [col for col in leakage_columns if col in model_df.columns]
    model_df = model_df.drop(columns=existing_leakage_columns)

    return model_df
