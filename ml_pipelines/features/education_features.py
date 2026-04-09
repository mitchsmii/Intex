"""Feature engineering for education outcome prediction (prospective pipeline)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import linregress


def _safe_slope(series: pd.Series) -> float:
    """Return the linear slope of a numeric series, or 0.0 if not enough data."""
    vals = series.dropna().values
    if len(vals) < 2:
        return 0.0
    try:
        slope, *_ = linregress(range(len(vals)), vals)
        return float(slope)
    except Exception:
        return 0.0


_EMOTIONAL_ORDINAL = {
    "distressed": 0,
    "sad": 1,
    "anxious": 2,
    "neutral": 3,
    "calm": 4,
    "content": 5,
    "happy": 6,
}

_RISK_ORDINAL = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}

_ED_LEVELS = ["Primary", "Secondary", "Vocational", "CollegePrep"]
_CASE_CATS = []  # populated dynamically


def _naive_utc_datetimes(series: pd.Series) -> pd.Series:
    """Parse as UTC, then drop timezone for safe arithmetic and comparisons.

    Postgres ``timestamptz`` often loads as ``datetime64[..., UTC]``; this
    normalizes to naive wall time. Windowing uses ``_rows_on_or_before_cutoff``
    so we never rely on ``DataFrame.query`` for datetime compares.
    """
    ts = pd.to_datetime(series, errors="coerce", utc=True)
    if getattr(ts.dtype, "tz", None) is not None:
        return ts.dt.tz_convert(None)
    return ts


def _rows_on_or_before_cutoff(
    events: pd.DataFrame,
    date_col: str,
    cutoff_dates: pd.DataFrame,
) -> pd.DataFrame:
    """Inner-merge ``events`` with cutoffs, keep rows where ``date_col <= cutoff_date``."""
    merged = events.merge(cutoff_dates, on="resident_id", how="inner", copy=False)
    if merged.empty:
        return merged
    t_evt = _naive_utc_datetimes(merged[date_col])
    t_cut = _naive_utc_datetimes(merged["cutoff_date"])
    return merged.loc[t_evt <= t_cut].copy()


def build_education_features(
    residents_df: pd.DataFrame,
    education_df: pd.DataFrame,
    health_df: pd.DataFrame,
    process_df: pd.DataFrame,
    intervention_df: pd.DataFrame,
    incident_df: pd.DataFrame,
    home_visit_df: pd.DataFrame,
    feature_window_months: int = 3,
) -> pd.DataFrame:
    """Build a resident-level feature matrix for prospective education outcome prediction.

    Uses only the first *feature_window_months* education records per resident as the
    feature window, then labels the target from the resident's final education record.
    This temporal split prevents data leakage.

    Args:
        residents_df: Base resident demographic and intake records.
        education_df: Monthly education progress records per resident.
        health_df: Health and wellbeing records per resident.
        process_df: Counseling / process recording records per resident.
        intervention_df: Intervention plan records per resident.
        incident_df: Incident report records per resident.
        home_visit_df: Home visitation records per resident.
        feature_window_months: Number of early education records to use as the
            feature window (default 3).

    Returns:
        pd.DataFrame: One row per resident.  All string/ID/date columns are
            dropped.  Target column ``completed`` is 1 if the resident's last
            education record has ``completion_status == "Completed"``, else 0.
    """
    residents = residents_df.copy()
    education = education_df.copy()
    health = health_df.copy()
    process = process_df.copy()
    intervention = intervention_df.copy()
    incidents = incident_df.copy()
    home_visits = home_visit_df.copy()

    # ── 0. Parse dates (naive UTC wall time — comparable across tables) ─────────
    education["record_date"] = _naive_utc_datetimes(education["record_date"])
    if "record_date" in health.columns:
        health["record_date"] = _naive_utc_datetimes(health["record_date"])
    else:
        health["record_date"] = pd.Series(pd.NaT, index=health.index, dtype="datetime64[ns]")
    if "session_date" in process.columns:
        process["session_date"] = _naive_utc_datetimes(process["session_date"])
    if "visit_date" in home_visits.columns:
        home_visits["visit_date"] = _naive_utc_datetimes(home_visits["visit_date"])
    if "incident_date" in incidents.columns:
        incidents["incident_date"] = _naive_utc_datetimes(incidents["incident_date"])
    if "created_at" in intervention.columns:
        intervention["created_at"] = _naive_utc_datetimes(intervention["created_at"])
    if "date_of_admission" in residents.columns:
        residents["date_of_admission"] = _naive_utc_datetimes(residents["date_of_admission"])
    else:
        residents["date_of_admission"] = pd.Series(
            pd.NaT, index=residents.index, dtype="datetime64[ns]"
        )

    # ── 1. Target variable ────────────────────────────────────────────────────
    # Last education record per resident (sorted by record_date).
    edu_sorted = education.sort_values("record_date")
    last_status = (
        edu_sorted.groupby("resident_id")["completion_status"]
        .last()
        .reset_index()
        .rename(columns={"completion_status": "last_completion_status"})
    )
    last_status["completed"] = (
        last_status["last_completion_status"] == "Completed"
    ).astype(int)

    # ── 2. Feature window cutoff date per resident ────────────────────────────
    # Use only the first N education records chronologically.
    edu_sorted["row_num"] = edu_sorted.groupby("resident_id").cumcount() + 1
    window_records = edu_sorted[edu_sorted["row_num"] <= feature_window_months]

    cutoff_dates = (
        window_records.groupby("resident_id")["record_date"]
        .max()
        .reset_index()
        .rename(columns={"record_date": "cutoff_date"})
    )
    cutoff_dates["cutoff_date"] = _naive_utc_datetimes(cutoff_dates["cutoff_date"])

    # ── 3. Early education features ───────────────────────────────────────────
    edu_win = window_records.copy()

    edu_agg = (
        edu_win.groupby("resident_id")
        .apply(
            lambda g: pd.Series(
                {
                    "early_attendance_mean": g["attendance_rate"].mean(),
                    "early_attendance_slope": _safe_slope(g.sort_values("record_date")["attendance_rate"]),
                    "early_progress_mean": g["progress_percent"].mean(),
                    "early_progress_slope": _safe_slope(g.sort_values("record_date")["progress_percent"]),
                    "early_progress_max": g["progress_percent"].max(),
                    "education_level_mode": g["education_level"].mode().iloc[0]
                    if not g["education_level"].mode().empty
                    else np.nan,
                    "initial_progress": g.sort_values("record_date")["progress_percent"].iloc[0]
                    if len(g) > 0
                    else np.nan,
                }
            ),
            include_groups=False,
        )
        .reset_index()
    )

    # One-hot encode education_level_mode
    for lvl in _ED_LEVELS:
        edu_agg[f"ed_level_{lvl.lower()}"] = (
            edu_agg["education_level_mode"] == lvl
        ).astype(int)
    edu_agg = edu_agg.drop(columns=["education_level_mode"])

    # ── 4. Resident demographics ──────────────────────────────────────────────
    res = residents.copy()

    # Age upon admission
    def _parse_age(val) -> float:
        if pd.isna(val):
            return np.nan
        try:
            return float(str(val).strip().split()[0])
        except (ValueError, IndexError):
            return np.nan

    res["age_upon_admission"] = res.get("age_upon_admission", pd.Series(dtype=float)).apply(
        _parse_age
    )

    res["initial_risk_level_enc"] = (
        res.get("initial_risk_level", pd.Series(dtype=str))
        .map(_RISK_ORDINAL)
        .astype(float)
    )

    # Boolean flags – coerce safely
    bool_cols = [
        "is_pwd",
        "has_special_needs",
        "family_is_4ps",
        "family_solo_parent",
        "family_informal_settler",
        "sub_cat_trafficked",
        "sub_cat_physical_abuse",
        "sub_cat_sexual_abuse",
        "sub_cat_child_labor",
        "sub_cat_osaec",
    ]
    for col in bool_cols:
        if col in res.columns:
            res[col] = res[col].fillna(False).astype(int)
        else:
            res[col] = 0

    # Case category one-hot (built dynamically)
    if "case_category" in res.columns:
        case_dummies = pd.get_dummies(res["case_category"], prefix="case_cat").astype(int)
        res = pd.concat([res, case_dummies], axis=1)

    res_cols = (
        ["resident_id", "date_of_admission", "age_upon_admission", "initial_risk_level_enc"]
        + bool_cols
        + [c for c in res.columns if c.startswith("case_cat_")]
    )
    res = res[[c for c in res_cols if c in res.columns]]

    # ── 5. Merge cutoff dates into residents to compute days_in_care ──────────
    res = res.merge(cutoff_dates, on="resident_id", how="left")
    res["days_in_care"] = (res["cutoff_date"] - res["date_of_admission"]).dt.days
    res = res.drop(columns=["date_of_admission", "cutoff_date"], errors="ignore")

    # ── 6. Early counseling features (within window) ──────────────────────────
    date_col_proc = "session_date" if "session_date" in process.columns else None
    if date_col_proc:
        proc_windowed = _rows_on_or_before_cutoff(process, date_col_proc, cutoff_dates)
    else:
        proc_windowed = process.copy()

    def _emotion_ord(val) -> float:
        return float(_EMOTIONAL_ORDINAL.get(str(val).strip().lower(), np.nan))

    if not proc_windowed.empty and "resident_id" in proc_windowed.columns:
        proc_windowed = proc_windowed.copy()
        if "emotional_state_observed" in proc_windowed.columns:
            proc_windowed["emo_start"] = proc_windowed["emotional_state_observed"].apply(
                _emotion_ord
            )
        else:
            proc_windowed["emo_start"] = np.nan
        if "emotional_state_end" in proc_windowed.columns:
            proc_windowed["emo_end"] = proc_windowed["emotional_state_end"].apply(
                _emotion_ord
            )
        else:
            proc_windowed["emo_end"] = np.nan

        proc_windowed["improved"] = (
            proc_windowed["emo_end"] > proc_windowed["emo_start"]
        ).astype(float)
        if "concerns_flagged" in proc_windowed.columns:
            proc_windowed["concerns_flagged"] = proc_windowed["concerns_flagged"].fillna(False).astype(bool)
        else:
            proc_windowed["concerns_flagged"] = False
        if "referral_made" in proc_windowed.columns:
            proc_windowed["referral_made"] = proc_windowed["referral_made"].fillna(False).astype(bool)
        else:
            proc_windowed["referral_made"] = False

        proc_agg = (
            proc_windowed.groupby("resident_id")
            .apply(
                lambda g: pd.Series(
                    {
                        "early_sessions_count": len(g),
                        "early_concerns_flagged_rate": g["concerns_flagged"].mean(),
                        "early_referral_rate": g["referral_made"].mean(),
                        "early_emotional_improvement_rate": g["improved"].mean(),
                    }
                ),
                include_groups=False,
            )
            .reset_index()
        )
    else:
        proc_agg = pd.DataFrame(
            columns=[
                "resident_id",
                "early_sessions_count",
                "early_concerns_flagged_rate",
                "early_referral_rate",
                "early_emotional_improvement_rate",
            ]
        )

    # ── 7. Early health features (within window) ──────────────────────────────
    health_date_col = "record_date" if "record_date" in health.columns else None
    if health_date_col:
        health_windowed = _rows_on_or_before_cutoff(health, health_date_col, cutoff_dates)
    else:
        health_windowed = health.copy()

    health_score_cols = {
        "general_health_score": "early_health_mean",
        "nutrition_score": "early_nutrition_mean",
        "sleep_quality_score": "early_sleep_mean",
    }
    if not health_windowed.empty and "resident_id" in health_windowed.columns:
        agg_spec = {
            new: (old, "mean")
            for old, new in health_score_cols.items()
            if old in health_windowed.columns
        }
        if agg_spec:
            health_agg = health_windowed.groupby("resident_id").agg(**agg_spec).reset_index()
        else:
            health_agg = pd.DataFrame(columns=["resident_id"])
    else:
        health_agg = pd.DataFrame(columns=["resident_id"])
    for col in health_score_cols.values():
        if col not in health_agg.columns:
            health_agg[col] = np.nan

    # ── 8. Early incident features ────────────────────────────────────────────
    inc_date_col = "incident_date" if "incident_date" in incidents.columns else None
    if inc_date_col and not incidents.empty:
        inc_windowed = _rows_on_or_before_cutoff(incidents, inc_date_col, cutoff_dates)
        inc_agg = (
            inc_windowed.groupby("resident_id")
            .size()
            .rename("early_incident_count")
            .reset_index()
        )
    else:
        inc_agg = pd.DataFrame(columns=["resident_id", "early_incident_count"])

    # ── 9. Early home visit features ──────────────────────────────────────────
    hv_date_col = "visit_date" if "visit_date" in home_visits.columns else None
    if hv_date_col and not home_visits.empty:
        hv_windowed = _rows_on_or_before_cutoff(home_visits, hv_date_col, cutoff_dates)
        hv_agg = (
            hv_windowed.groupby("resident_id")
            .size()
            .rename("early_home_visit_count")
            .reset_index()
        )
    else:
        hv_agg = pd.DataFrame(columns=["resident_id", "early_home_visit_count"])

    # ── 10. Early active interventions ────────────────────────────────────────
    iv_date_col = "created_at" if "created_at" in intervention.columns else None
    if iv_date_col and not intervention.empty:
        iv_windowed = _rows_on_or_before_cutoff(intervention, iv_date_col, cutoff_dates)
        if "status" in iv_windowed.columns:
            iv_active = iv_windowed[iv_windowed["status"] == "Active"]
        else:
            iv_active = iv_windowed
        iv_agg = (
            iv_active.groupby("resident_id")
            .size()
            .rename("early_active_interventions")
            .reset_index()
        )
    else:
        iv_agg = pd.DataFrame(columns=["resident_id", "early_active_interventions"])

    # ── 11. Merge everything into one feature matrix ──────────────────────────
    model_df = (
        last_status[["resident_id", "completed"]]
        .merge(edu_agg, on="resident_id", how="left")
        .merge(res, on="resident_id", how="left")
        .merge(proc_agg, on="resident_id", how="left")
        .merge(health_agg, on="resident_id", how="left")
        .merge(inc_agg, on="resident_id", how="left")
        .merge(hv_agg, on="resident_id", how="left")
        .merge(iv_agg, on="resident_id", how="left")
    )

    # Fill count-based features with 0 where no records exist in the window
    count_fill_zero = [
        "early_sessions_count",
        "early_incident_count",
        "early_home_visit_count",
        "early_active_interventions",
    ]
    for col in count_fill_zero:
        if col in model_df.columns:
            model_df[col] = model_df[col].fillna(0)

    # ── 12. Drop non-numeric columns, IDs, dates ──────────────────────────────
    model_df = model_df.set_index("resident_id")
    model_df = model_df.apply(pd.to_numeric, errors="coerce")
    # sklearn 1.6+ requires every feature name to be str (no np.str_ / quoted_name mix)
    model_df.columns = pd.Index([str(c) for c in model_df.columns])

    return model_df
