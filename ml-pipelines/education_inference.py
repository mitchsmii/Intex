# education_inference.py — Separate inference code path (Ch. 17 pattern)
# Load this module to generate predictions without re-running training.
# Feature engineering must exactly match build_education_features() logic.

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

_EMOTIONAL_ORDINAL = {
    "distressed": 0, "sad": 1, "anxious": 2, "neutral": 3,
    "calm": 4, "content": 5, "happy": 6,
}
_RISK_ORDINAL = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
_ED_LEVELS = ["Primary", "Secondary", "Vocational", "CollegePrep"]


def _safe_slope(values):
    """Linear slope via least squares, or 0.0 if fewer than 2 points."""
    vals = [v for v in values if v == v]  # drop NaN
    if len(vals) < 2:
        return 0.0
    x = list(range(len(vals)))
    n = len(vals)
    xbar = sum(x) / n
    ybar = sum(vals) / n
    denom = sum((xi - xbar) ** 2 for xi in x)
    if denom == 0:
        return 0.0
    return sum((xi - xbar) * (yi - ybar) for xi, yi in zip(x, vals)) / denom


def _naive_dt(series):
    """Parse datetimes to naive UTC wall time."""
    ts = pd.to_datetime(series, errors="coerce", utc=True)
    if getattr(ts.dtype, "tz", None) is not None:
        return ts.dt.tz_convert(None)
    return ts


def predict_education_outcome(resident_id: int, engine=None) -> dict:
    """
    Predict education completion likelihood for a single resident.

    Uses only data available within the first 3 education records
    (the same prospective window used during training).

    Args:
        resident_id: Integer resident ID from the residents table.
        engine: SQLAlchemy engine. If None, loads from project default.

    Returns:
        dict with keys:
            resident_id       (int)
            predicted_outcome (str: 'Completed' or 'Not Completed')
            confidence        (float: probability of completion)
            top_factors       (list of str: top 3 features by importance)
    """
    from data.loader import get_engine

    if engine is None:
        engine = get_engine()

    # Load model and metadata
    _base = Path(__file__).parent
    _model_path = _base / "../../saved_models/education_outcome_model.pkl"
    _meta_path  = _base / "../../saved_models/education_outcome_metadata.json"

    pipeline = joblib.load(_model_path)
    with open(_meta_path) as f:
        meta = json.load(f)

    input_features = meta["input_features"]

    def q(sql):
        return pd.read_sql(sql, engine)

    rid = int(resident_id)

    # ── Determine feature window cutoff ──────────────────────────
    edu_all = q(f"""
        SELECT * FROM education_records
        WHERE resident_id = {rid}
        ORDER BY record_date
    """)
    edu_all["record_date"] = _naive_dt(edu_all["record_date"])

    if edu_all.empty:
        return {
            "resident_id": rid,
            "predicted_outcome": "Insufficient data",
            "confidence": None,
            "top_factors": [],
            "note": "Resident has no education records.",
        }

    # Feature window = first 3 records; cutoff = date of last window record
    edu_window = edu_all.head(3)
    cutoff_date = edu_window["record_date"].max()

    # ── Education features from window ────────────────────────────
    row = {}
    row["early_attendance_mean"]  = edu_window["attendance_rate"].mean()
    row["early_attendance_slope"] = _safe_slope(
        edu_window.sort_values("record_date")["attendance_rate"].tolist()
    )
    row["early_progress_mean"]    = edu_window["progress_percent"].mean()
    row["early_progress_slope"]   = _safe_slope(
        edu_window.sort_values("record_date")["progress_percent"].tolist()
    )
    row["early_progress_max"]     = edu_window["progress_percent"].max()
    row["initial_progress"]       = edu_window.sort_values("record_date")["progress_percent"].iloc[0]

    # Education level one-hot (mode of window)
    if "education_level" in edu_window.columns and not edu_window["education_level"].mode().empty:
        lvl_mode = edu_window["education_level"].mode().iloc[0]
    else:
        lvl_mode = None
    for lvl in _ED_LEVELS:
        row[f"ed_level_{lvl.lower()}"] = int(lvl_mode == lvl) if lvl_mode else 0

    # ── Resident-level features ───────────────────────────────────
    res_row = q(f"SELECT * FROM residents WHERE resident_id = {rid}")
    if not res_row.empty:
        r = res_row.iloc[0]

        # Age
        try:
            row["age_upon_admission"] = float(str(r.get("age_upon_admission", "")).strip().split()[0])
        except (ValueError, IndexError):
            row["age_upon_admission"] = np.nan

        # Risk level
        row["initial_risk_level_enc"] = float(
            _RISK_ORDINAL.get(str(r.get("initial_risk_level", "")), np.nan)
        )

        # Boolean flags
        for col in [
            "is_pwd", "has_special_needs", "family_is_4ps", "family_solo_parent",
            "family_informal_settler", "sub_cat_trafficked", "sub_cat_physical_abuse",
            "sub_cat_sexual_abuse", "sub_cat_child_labor", "sub_cat_osaec",
        ]:
            row[col] = int(bool(r[col])) if col in r.index and not pd.isna(r[col]) else 0

        # case_cat_ one-hot: set the matching column if present in input_features
        if "case_category" in r.index and not pd.isna(r["case_category"]):
            cat_col = f"case_cat_{r['case_category']}"
            for f in input_features:
                if f.startswith("case_cat_"):
                    row[f] = int(f == cat_col)

        # days_in_care up to cutoff
        if "date_of_admission" in r.index:
            adm = _naive_dt(pd.Series([r["date_of_admission"]])).iloc[0]
            row["days_in_care"] = int((cutoff_date - adm).days) if pd.notna(adm) else np.nan

    # ── Health features (within window) ──────────────────────────
    health = q(f"""
        SELECT * FROM health_wellbeing_records
        WHERE resident_id = {rid}
    """)
    if not health.empty and "record_date" in health.columns:
        health["record_date"] = _naive_dt(health["record_date"])
        health = health[health["record_date"] <= cutoff_date]
    row["early_health_mean"]     = health["general_health_score"].mean() if len(health) > 0 else np.nan
    row["early_nutrition_mean"]  = health["nutrition_score"].mean()      if len(health) > 0 else np.nan
    row["early_sleep_mean"]      = health["sleep_quality_score"].mean()  if len(health) > 0 else np.nan

    # ── Process recording features (within window) ────────────────
    proc = q(f"""
        SELECT * FROM process_recordings
        WHERE resident_id = {rid}
    """)
    if not proc.empty and "session_date" in proc.columns:
        proc["session_date"] = _naive_dt(proc["session_date"])
        proc = proc[proc["session_date"] <= cutoff_date]

    if not proc.empty:
        proc = proc.copy()
        # Emotional improvement rate
        def _emo(val):
            return _EMOTIONAL_ORDINAL.get(str(val).strip().lower(), np.nan)
        if "emotional_state_observed" in proc.columns:
            proc["emo_start"] = proc["emotional_state_observed"].apply(_emo)
        else:
            proc["emo_start"] = np.nan
        if "emotional_state_end" in proc.columns:
            proc["emo_end"] = proc["emotional_state_end"].apply(_emo)
        else:
            proc["emo_end"] = np.nan
        proc["improved"] = (proc["emo_end"] > proc["emo_start"]).astype(float)
        concerns = proc["concerns_flagged"].fillna(False).astype(bool) if "concerns_flagged" in proc.columns else pd.Series([False]*len(proc))
        referrals = proc["referral_made"].fillna(False).astype(bool) if "referral_made" in proc.columns else pd.Series([False]*len(proc))

        row["early_sessions_count"]            = len(proc)
        row["early_concerns_flagged_rate"]     = float(concerns.mean())
        row["early_referral_rate"]             = float(referrals.mean())
        row["early_emotional_improvement_rate"] = float(proc["improved"].mean())
    else:
        row["early_sessions_count"]             = 0
        row["early_concerns_flagged_rate"]      = 0.0
        row["early_referral_rate"]              = 0.0
        row["early_emotional_improvement_rate"] = np.nan

    # ── Incident features (within window) ────────────────────────
    incidents = q(f"""
        SELECT * FROM incident_reports
        WHERE resident_id = {rid}
    """)
    if not incidents.empty and "incident_date" in incidents.columns:
        incidents["incident_date"] = _naive_dt(incidents["incident_date"])
        incidents = incidents[incidents["incident_date"] <= cutoff_date]
    row["early_incident_count"] = len(incidents)

    # ── Home visit features (within window) ──────────────────────
    home_visits = q(f"""
        SELECT * FROM home_visitations
        WHERE resident_id = {rid}
    """)
    if not home_visits.empty and "visit_date" in home_visits.columns:
        home_visits["visit_date"] = _naive_dt(home_visits["visit_date"])
        home_visits = home_visits[home_visits["visit_date"] <= cutoff_date]
    row["early_home_visit_count"] = len(home_visits)

    # ── Active intervention features (within window) ──────────────
    interventions = q(f"""
        SELECT * FROM intervention_plans
        WHERE resident_id = {rid}
    """)
    if not interventions.empty and "created_at" in interventions.columns:
        interventions["created_at"] = _naive_dt(interventions["created_at"])
        interventions = interventions[interventions["created_at"] <= cutoff_date]
    if not interventions.empty and "status" in interventions.columns:
        row["early_active_interventions"] = int(
            (interventions["status"] == "Active").sum()
        )
    else:
        row["early_active_interventions"] = 0

    # ── Align to full input feature list (imputer handles NaN) ───
    X_new = pd.DataFrame([row])
    for col in input_features:
        if col not in X_new.columns:
            X_new[col] = np.nan
    X_new = X_new[input_features].apply(pd.to_numeric, errors="coerce")

    # ── Run inference ─────────────────────────────────────────────
    prob       = float(pipeline.predict_proba(X_new)[0][1])
    prediction = "Completed" if prob >= 0.5 else "Not Completed"

    # Top factors from selector + model importances
    selector      = pipeline.named_steps["selector"]
    model_step    = pipeline.named_steps["model"]
    selected_mask = selector.get_support()
    selected_names = np.array(input_features)[selected_mask]

    if hasattr(model_step, "feature_importances_"):
        imp = pd.Series(model_step.feature_importances_, index=selected_names)
        top_factors = imp.sort_values(ascending=False).head(3).index.tolist()
    elif hasattr(model_step, "coef_"):
        imp = pd.Series(np.abs(model_step.coef_[0]), index=selected_names)
        top_factors = imp.sort_values(ascending=False).head(3).index.tolist()
    else:
        top_factors = list(selected_names[:3])

    return {
        "resident_id":       rid,
        "predicted_outcome": prediction,
        "confidence":        round(prob, 4),
        "top_factors":       top_factors,
    }
