"""Feature engineering for reintegration readiness modeling."""

from __future__ import annotations

import pandas as pd


def build_reintegration_features(
    residents_df: pd.DataFrame,
    health_df: pd.DataFrame,
    education_df: pd.DataFrame,
    process_df: pd.DataFrame,
    intervention_df: pd.DataFrame,
    visitations_df: pd.DataFrame,
    incidents_df: pd.DataFrame,
) -> pd.DataFrame:
    """Build a resident-level training table for reintegration readiness classification.

    Target: `is_reintegration_ready` — True if the resident has an active reintegration
    plan (reintegration_status IS NOT NULL) or has been closed out (date_closed IS NOT NULL).

    Args:
        residents_df: Base resident records with reintegration status and risk labels.
        health_df: Health and wellbeing observations per resident.
        education_df: Education progress records per resident.
        process_df: Counseling session records per resident.
        intervention_df: Intervention plan records per resident.
        visitations_df: Home visitation records per resident.
        incidents_df: Incident report records per resident.

    Returns:
        pd.DataFrame: Feature matrix plus target `is_reintegration_ready`, ready for sklearn.
    """
    residents  = residents_df.copy()
    health     = health_df.copy()
    education  = education_df.copy()
    process    = process_df.copy()
    intervention = intervention_df.copy()
    visitations  = visitations_df.copy()
    incidents    = incidents_df.copy()

    today = pd.Timestamp.today().normalize()

    # ── Target variable ──────────────────────────────────────────────────────
    # A resident is "reintegration ready" if they have a reintegration plan
    # underway or have already been closed/discharged from the program.
    residents["is_reintegration_ready"] = (
        residents["reintegration_status"].notna() |
        residents["date_closed"].notna()
    )

    # ── Resident base features ───────────────────────────────────────────────
    residents["date_of_admission"] = pd.to_datetime(
        residents.get("date_of_admission"), errors="coerce"
    )
    residents["days_in_care"] = (today - residents["date_of_admission"]).dt.days

    # Risk improvement: started critical/high and improved to medium/low
    risk_order = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
    residents["initial_risk_score"] = (
        residents["initial_risk_level"].map(risk_order).fillna(3)
    )
    residents["current_risk_score"] = (
        residents["current_risk_level"].map(risk_order).fillna(3)
    )
    residents["risk_improved"] = (
        residents["current_risk_score"] < residents["initial_risk_score"]
    ).astype(int)

    # Abuse/case complexity — count how many sub-categories apply
    abuse_cols = [c for c in residents.columns if c.startswith("sub_cat_")]
    residents["abuse_complexity"] = (
        residents[abuse_cols].fillna(False).astype(bool).sum(axis=1)
    )

    # ── Health features ──────────────────────────────────────────────────────
    health_score_cols = [
        "general_health_score", "nutrition_score",
        "sleep_quality_score", "energy_level_score",
    ]
    for col in health_score_cols:
        if col in health.columns:
            health[col] = pd.to_numeric(health[col], errors="coerce")

    health_agg = (
        health.groupby("resident_id", dropna=False)
        .agg(
            avg_health_score=("general_health_score", "mean"),
            avg_nutrition_score=("nutrition_score", "mean"),
            avg_sleep_score=("sleep_quality_score", "mean"),
            avg_energy_score=("energy_level_score", "mean"),
            health_record_count=("health_record_id", "count"),
        )
        .reset_index()
    )

    # Health trend: is health score improving? (last 3 records vs first 3)
    health["record_date"] = pd.to_datetime(health.get("record_date"), errors="coerce")
    health_sorted = health.sort_values(["resident_id", "record_date"])

    def health_trend(group):
        scores = group["general_health_score"].dropna()
        if len(scores) < 2:
            return 0.0
        mid = len(scores) // 2
        return scores.iloc[mid:].mean() - scores.iloc[:mid].mean()

    health_trend_df = (
        health_sorted.groupby("resident_id")
        .apply(health_trend)
        .rename("health_trend")
        .reset_index()
    )

    # ── Education features ───────────────────────────────────────────────────
    education["progress_percent"] = pd.to_numeric(
        education.get("progress_percent"), errors="coerce"
    )
    education["attendance_rate"] = pd.to_numeric(
        education.get("attendance_rate"), errors="coerce"
    )

    education_agg = (
        education.groupby("resident_id", dropna=False)
        .agg(
            avg_education_progress=("progress_percent", "mean"),
            avg_attendance_rate=("attendance_rate", "mean"),
            education_record_count=("education_record_id", "count"),
        )
        .reset_index()
    )

    # ── Counseling session features ──────────────────────────────────────────
    if "progress_noted" in process.columns:
        process["progress_noted"] = process["progress_noted"].map(
            {True: 1, False: 0, "True": 1, "False": 0}
        ).fillna(0)
    if "concerns_flagged" in process.columns:
        process["concerns_flagged"] = process["concerns_flagged"].map(
            {True: 1, False: 0, "True": 1, "False": 0}
        ).fillna(0)

    process_agg = (
        process.groupby("resident_id", dropna=False)
        .agg(
            total_counseling_sessions=("recording_id", "count"),
            pct_sessions_with_progress=("progress_noted", "mean"),
            pct_sessions_with_concerns=("concerns_flagged", "mean"),
        )
        .reset_index()
    )

    # ── Intervention plan features ───────────────────────────────────────────
    intervention["status"] = intervention.get("status", pd.Series(dtype=str)).fillna("")

    intervention_agg = (
        intervention.groupby("resident_id", dropna=False)
        .agg(
            total_intervention_plans=("plan_id", "count"),
            completed_plans=(
                "status",
                lambda s: (s.str.lower() == "completed").sum()
            ),
            active_plans=(
                "status",
                lambda s: (s.str.lower() == "active").sum()
            ),
        )
        .reset_index()
    )
    intervention_agg["plan_completion_rate"] = (
        intervention_agg["completed_plans"] /
        intervention_agg["total_intervention_plans"].replace(0, 1)
    )

    # ── Home visitation features ─────────────────────────────────────────────
    cooperation_map = {"High": 3, "Moderate": 2, "Neutral": 1, "Low": 0}
    if "family_cooperation_level" in visitations.columns:
        visitations["cooperation_score"] = (
            visitations["family_cooperation_level"].map(cooperation_map).fillna(1)
        )
    else:
        visitations["cooperation_score"] = 1

    if "safety_concerns_noted" in visitations.columns:
        visitations["safety_concerns_noted"] = visitations["safety_concerns_noted"].map(
            {True: 1, False: 0, "True": 1, "False": 0}
        ).fillna(0)
    else:
        visitations["safety_concerns_noted"] = 0

    outcome_map = {"Favorable": 1, "Neutral": 0, "Unfavorable": -1}
    if "visit_outcome" in visitations.columns:
        visitations["outcome_score"] = (
            visitations["visit_outcome"].map(outcome_map).fillna(0)
        )
    else:
        visitations["outcome_score"] = 0

    visitations_agg = (
        visitations.groupby("resident_id", dropna=False)
        .agg(
            total_visitations=("visitation_id", "count"),
            avg_family_cooperation=("cooperation_score", "mean"),
            pct_safety_concerns=("safety_concerns_noted", "mean"),
            avg_visit_outcome=("outcome_score", "mean"),
        )
        .reset_index()
    )

    # ── Incident features ────────────────────────────────────────────────────
    severity_map = {"High": 3, "Medium": 2, "Low": 1}
    if "severity" in incidents.columns:
        incidents["severity_score"] = (
            incidents["severity"].map(severity_map).fillna(1)
        )
    else:
        incidents["severity_score"] = 1

    if "resolved" in incidents.columns:
        incidents["resolved"] = incidents["resolved"].map(
            {True: 1, False: 0, "True": 1, "False": 0}
        ).fillna(0)
    else:
        incidents["resolved"] = 1

    incidents["incident_date"] = pd.to_datetime(
        incidents.get("incident_date"), errors="coerce"
    )
    incidents["days_since_incident"] = (today - incidents["incident_date"]).dt.days

    incidents_agg = (
        incidents.groupby("resident_id", dropna=False)
        .agg(
            total_incidents=("incident_id", "count"),
            avg_incident_severity=("severity_score", "mean"),
            unresolved_incidents=("resolved", lambda s: (s == 0).sum()),
            days_since_last_incident=("days_since_incident", "min"),
        )
        .reset_index()
    )

    # ── Join everything ──────────────────────────────────────────────────────
    model_df = (
        residents
        .merge(health_agg,       on="resident_id", how="left")
        .merge(health_trend_df,  on="resident_id", how="left")
        .merge(education_agg,    on="resident_id", how="left")
        .merge(process_agg,      on="resident_id", how="left")
        .merge(intervention_agg, on="resident_id", how="left")
        .merge(visitations_agg,  on="resident_id", how="left")
        .merge(incidents_agg,    on="resident_id", how="left")
    )

    # ── Fill nulls ───────────────────────────────────────────────────────────
    fill_defaults = {
        "avg_health_score":             3.0,
        "avg_nutrition_score":          3.0,
        "avg_sleep_score":              3.0,
        "avg_energy_score":             3.0,
        "health_record_count":          0,
        "health_trend":                 0.0,
        "avg_education_progress":       0.0,
        "avg_attendance_rate":          0.0,
        "education_record_count":       0,
        "total_counseling_sessions":    0,
        "pct_sessions_with_progress":   0.0,
        "pct_sessions_with_concerns":   0.0,
        "total_intervention_plans":     0,
        "completed_plans":              0,
        "active_plans":                 0,
        "plan_completion_rate":         0.0,
        "total_visitations":            0,
        "avg_family_cooperation":       1.0,
        "pct_safety_concerns":          0.0,
        "avg_visit_outcome":            0.0,
        "total_incidents":              0,
        "avg_incident_severity":        1.0,
        "unresolved_incidents":         0,
        "days_since_last_incident":     999,
        "days_in_care":                 0,
        "risk_improved":                0,
        "abuse_complexity":             0,
    }
    for col, val in fill_defaults.items():
        if col in model_df.columns:
            model_df[col] = model_df[col].fillna(val)

    # ── Drop leakage columns ─────────────────────────────────────────────────
    # These would directly reveal the target or are identifiers
    drop_cols = [
        "resident_id", "case_control_no", "internal_code",
        "reintegration_status", "reintegration_type",
        "date_closed", "date_of_admission", "date_enrolled",
        "current_risk_level", "initial_risk_level",
        "initial_risk_score", "current_risk_score",
        "assigned_social_worker", "referring_agency_person",
        "created_at", "notes_restricted",
        "case_control_no", "date_colb_registered", "date_colb_obtained",
        "date_case_study_prepared", "initial_case_assessment",
    ]
    existing_drop = [c for c in drop_cols if c in model_df.columns]
    model_df = model_df.drop(columns=existing_drop)

    return model_df
