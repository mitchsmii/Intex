# inference.py — Separate inference code path (Ch. 17 pattern)
# Load this module to generate predictions without re-running training.

def predict_risk(resident_id: int, engine=None) -> dict:
    """
    Predict risk level for a single resident using live database data.

    Args:
        resident_id: The resident's integer ID from the residents table.
        engine: Optional SQLAlchemy engine. If None, uses the project's
                default engine (credentials loaded from .env via data/loader.py).

    Returns:
        dict with keys:
            resident_id     (int)
            predicted_risk  (str: 'High' or 'Not High')
            confidence      (float: probability of high-risk class)
            top_factors     (list of str: top 3 features driving prediction)
    """
    import joblib
    import json
    import numpy as np
    import pandas as pd
    from pathlib import Path
    from data.loader import get_engine

    if engine is None:
        engine = get_engine()

    # ── Load metadata to know which input features the pipeline expects ──
    _meta_path = (
        Path(__file__).parent / '../../saved_models/resident_risk_metadata.json'
        if '__file__' in dir()
        else Path('../../saved_models/resident_risk_metadata.json')
    )
    with open(_meta_path) as f:
        meta = json.load(f)

    # 'input_features' = all features before the selector step
    input_features = meta['input_features']

    # ── Load the trained pipeline ────────────────────────────────
    _model_path = Path(_meta_path).parent / 'resident_risk_model.pkl'
    pipeline = joblib.load(_model_path)

    # ── Fetch live data for this resident ────────────────────────
    def q(sql):
        return pd.read_sql(sql, engine)

    rid = int(resident_id)
    res_row    = q(f"SELECT * FROM residents WHERE resident_id = {rid}")
    health_row = q(f"SELECT * FROM health_wellbeing_records WHERE resident_id = {rid}")
    edu_row    = q(f"SELECT * FROM education_records WHERE resident_id = {rid}")
    proc_row   = q(f"SELECT * FROM process_recordings WHERE resident_id = {rid}")
    hv_row     = q(f"SELECT * FROM home_visitations WHERE resident_id = {rid}")
    iv_row     = q(f"SELECT * FROM intervention_plans WHERE resident_id = {rid}")
    inc_row    = q(f"SELECT * FROM incident_reports WHERE resident_id = {rid}")

    if res_row.empty:
        return {'resident_id': resident_id,
                'error': f'Resident {resident_id} not found in database.'}

    # ── Build feature row using the same engineering logic ───────
    _RISK_ORD = {'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3}
    _SEV_MAP  = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
    _FAM_COOP = {'uncooperative': 0, 'poor': 1, 'low': 1, 'neutral': 2,
                 'moderate': 3, 'cooperative': 4, 'good': 4,
                 'high': 5, 'excellent': 5}
    _EMO_ORD  = {'distressed': 0, 'sad': 1, 'anxious': 2, 'neutral': 3,
                 'calm': 4, 'content': 5, 'happy': 6, 'improved': 7, 'better': 7}

    feat = {}
    r = res_row.iloc[0]

    # Demographics
    if 'age_upon_admission' in r:
        import re
        m = re.search(r'(\d+)', str(r['age_upon_admission']))
        feat['age_upon_admission'] = float(m.group(1)) if m else np.nan

    if 'date_of_admission' in r:
        adm = pd.to_datetime(r['date_of_admission'], errors='coerce')
        feat['days_in_care'] = (pd.Timestamp.today() - adm).days if pd.notna(adm) else np.nan

    if 'initial_risk_level' in r:
        feat['initial_risk_level_enc'] = _RISK_ORD.get(r['initial_risk_level'], np.nan)

    for col in ['is_pwd', 'has_special_needs', 'family_is_4ps', 'family_solo_parent',
                'family_informal_settler', 'sub_cat_trafficked', 'sub_cat_physical_abuse',
                'sub_cat_sexual_abuse', 'sub_cat_child_labor', 'sub_cat_osaec']:
        if col in r:
            feat[col] = int(bool(r[col]))

    # Health
    for sc in ['general_health_score', 'nutrition_score', 'sleep_quality_score']:
        if sc in health_row.columns:
            feat[f'avg_{sc}'] = health_row[sc].mean()

    # Sessions
    feat['total_sessions'] = len(proc_row)

    # Incidents
    feat['total_incidents'] = len(inc_row)
    if 'resolved' in inc_row.columns:
        feat['unresolved_incidents'] = int(
            (~inc_row['resolved'].fillna(True).astype(bool)).sum()
        )

    # Interventions
    if 'status' in iv_row.columns:
        feat['active_interventions'] = int(
            (iv_row['status'].str.lower() == 'active').sum()
        )

    # Home visits
    feat['total_home_visits'] = len(hv_row)

    # ── Align to full input feature list ─────────────────────────
    # The pipeline's selector step handles feature pruning internally.
    # We just need to provide all input features (with NaN for any missing).
    row_df = pd.DataFrame([feat])
    for f in input_features:
        if f not in row_df.columns:
            row_df[f] = np.nan
    X_infer = row_df[input_features].apply(pd.to_numeric, errors='coerce')

    # ── Run inference ────────────────────────────────────────────
    pred_proba = pipeline.predict_proba(X_infer)[0]
    pred_class = pipeline.predict(X_infer)[0]
    confidence = float(pred_proba[1])

    # Top factors: importances from the final model step (post-selection features)
    _selector_step = pipeline.named_steps['selector']
    _model_step    = pipeline.named_steps['model']
    _sel_mask      = _selector_step.get_support()
    _sel_features  = np.array(input_features)[_sel_mask].tolist()
    _importances   = _model_step.feature_importances_
    top_idx        = np.argsort(_importances)[-3:][::-1]
    top_factors    = [_sel_features[i] for i in top_idx]

    return {
        'resident_id':    resident_id,
        'predicted_risk': 'High' if pred_class == 1 else 'Not High',
        'confidence':     round(confidence, 4),
        'top_factors':    top_factors,
    }


print("predict_risk() function defined. Ready for inference.")
print("Signature: predict_risk(resident_id: int, engine=None) -> dict")