# Claude Code Prompt — Education Outcome Pipeline

Paste everything below the line into Claude Code.

---

## Task

Create a Jupyter notebook at `ml-pipelines/models/04_education_outcome/education_outcome.ipynb` that predicts whether a resident will complete their education program using only data available early in their stay. This is a **prospective** (forward-looking) binary classifier, NOT a concurrent one.

## Project context

Read the project README at `ml-pipelines/README.md` before starting — it documents the folder structure, shared utilities, data loader, and the required notebook section structure. Follow that structure exactly.

The notebook must match the section pattern used by the other three pipelines (see `01_donor_churn/donor_churn.ipynb` for the canonical template):

1. Problem Framing (markdown)
2. Data Loading (code)
3. Feature Engineering (code)
4. Exploration — distributions, correlations (code)
5. Train/Test Split (code)
6. Baseline Model — Logistic Regression (code)
7. Advanced Model — Random Forest (code)
8. Evaluation and Comparison (code)
9. Feature Importance (code)
10. Save Model (code)

Each section gets a markdown header cell followed by a code cell, just like the other notebooks.

## Data access

Load all tables through the existing loader module (NOT from CSVs):

```python
import sys, os
sys.path.insert(0, os.path.abspath('../..'))

from data.loader import (
    load_residents, load_education_records, load_health_wellbeing_records,
    load_process_recordings, load_intervention_plans, load_incident_reports,
    load_home_visitations, get_engine,
)
```

The `.env` file with `DATABASE_URL` is already in `ml-pipelines/`. The loader reads from Supabase Postgres.

## Target variable

Binary classification: **did the resident eventually reach `completion_status == 'Completed'`** in their education records?

- `education_records` has 534 rows across 60 residents (6–12 monthly records each)
- Columns: `education_record_id, resident_id, record_date, education_level, school_name, enrollment_status, attendance_rate, progress_percent, completion_status, notes`
- `completion_status` values: `NotStarted` (60), `InProgress` (424), `Completed` (50)
- Final status per resident: 26 completed, 34 still in-progress — reasonable class balance

Define the target per resident as: `completed = 1` if the resident's **last** `completion_status` (sorted by `record_date`) is `"Completed"`, else `0`.

## Prospective framing (critical)

This pipeline must be **genuinely prospective** — use only data available early in a resident's stay to predict their eventual outcome. This is the key differentiator from the resident_risk pipeline (which was concurrent).

**Feature window:** Use only the **first 3 monthly education records** per resident as the feature window. Every resident has at least 6 records, so 3 is safe. For the other tables (health, counseling, incidents, home visits), filter records to only those dated within the same time window (i.e., on or before the resident's 3rd education record date).

This temporal cutoff is what prevents data leakage. Features must reflect what was knowable early, and the target reflects what happened later.

## Feature engineering

Create a feature engineering function at `ml-pipelines/features/education_features.py` following the pattern in `features/resident_features.py`. Signature:

```python
def build_education_features(
    residents_df, education_df, health_df, process_df,
    intervention_df, incident_df, home_visit_df,
    feature_window_months=3,
) -> pd.DataFrame:
```

Engineer these feature groups:

### 1. Early education features (from first 3 education records)
- `early_attendance_mean` — mean attendance_rate in the window
- `early_attendance_slope` — linear slope of attendance over the 3 records (improving/declining)
- `early_progress_mean` — mean progress_percent
- `early_progress_slope` — slope of progress_percent (learning velocity)
- `early_progress_max` — highest progress reached in the window
- `education_level_mode` — most common education_level (one-hot encode: Primary, Secondary, Vocational, CollegePrep)
- `initial_progress` — progress_percent from the very first record

### 2. Resident demographics (from residents table)
- `age_upon_admission` — parse the integer age from the string field
- `initial_risk_level_enc` — ordinal encode: Low=0, Medium=1, High=2, Critical=3
- `days_in_care` — days between `date_of_admission` and the end of the feature window (NOT today)
- Boolean flags: `is_pwd, has_special_needs, family_is_4ps, family_solo_parent, family_informal_settler`
- Abuse sub-category flags: `sub_cat_trafficked, sub_cat_physical_abuse, sub_cat_sexual_abuse, sub_cat_child_labor, sub_cat_osaec`
- `case_category` — one-hot encode

### 3. Early counseling features (from process_recordings within the window)
- `early_sessions_count` — number of counseling sessions
- `early_concerns_flagged_rate` — fraction of sessions with `concerns_flagged == True`
- `early_referral_rate` — fraction of sessions with `referral_made == True`
- `early_emotional_improvement_rate` — fraction of sessions where emotional_state_end > emotional_state_observed (use ordinal encoding: distressed=0, sad=1, anxious=2, neutral=3, calm=4, content=5, happy=6)

### 4. Early health features (from health_wellbeing_records within the window)
- `early_health_mean` — mean general_health_score
- `early_nutrition_mean` — mean nutrition_score
- `early_sleep_mean` — mean sleep_quality_score

### 5. Early incident and visit features
- `early_incident_count` — number of incident_reports within the window
- `early_home_visit_count` — number of home_visitations within the window
- `early_active_interventions` — count of intervention_plans with status='Active' created within the window

The function should return a clean DataFrame indexed by `resident_id` with all features plus the `completed` target column. Drop all string columns, IDs, and dates before returning.

## Pipeline design (leakage prevention)

Build the ML pipeline with **SelectFromModel embedded inside the sklearn Pipeline**, not fitted separately. This is important — the resident_risk notebook had a leakage bug from fitting feature selection on all data before CV, and we fixed it. This notebook should get it right from the start.

```python
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.feature_selection import SelectFromModel

def make_pipeline(model, selector_threshold='mean'):
    return Pipeline([
        ('imputer',  SimpleImputer(strategy='median')),
        ('scaler',   StandardScaler()),
        ('selector', SelectFromModel(
            RandomForestClassifier(n_estimators=100, class_weight='balanced',
                                   random_state=42, n_jobs=-1),
            threshold=selector_threshold)),
        ('model',    model),
    ])
```

Use `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` for all cross-validation. With 60 residents and ~43% positive rate, class balance is reasonable — still use `class_weight='balanced'` for safety. Primary metric: **weighted F1** (not recall, since classes are roughly balanced here).

## Models to train

1. **Baseline — Logistic Regression** with `class_weight='balanced'`, wrapped in the pipeline
2. **Advanced — Random Forest** with `class_weight='balanced'`, wrapped in the pipeline
3. **GridSearchCV** on Random Forest: tune `model__n_estimators`, `model__max_depth`, `model__min_samples_leaf`, `model__max_features`, and `selector__threshold`
4. Compare all models in a summary table

## Evaluation

- Use `cross_val_predict` for out-of-fold predictions (n=60 is too small for a holdout set)
- Use `classification_report` from sklearn and `evaluate_classifier` from `utils/evaluation.py`
- Plot confusion matrix with `ConfusionMatrixDisplay`
- Plot learning curves
- Plot feature importances (extract from the fitted pipeline's selector and model steps)

## Saving

Save to `ml-pipelines/saved_models/`:
- `education_outcome_model.pkl` — the full fitted pipeline
- `education_outcome_metadata.json` — training metadata including input features, selected features, CV metrics, best params, and `leakage_prevention: "prospective feature window + SelectFromModel inside pipeline"`

## Important constraints

- Do NOT use `.astype(float)` on the full feature matrix. Use `.apply(pd.to_numeric, errors='coerce')` instead, which safely handles stray strings.
- Do NOT pre-fill NaN before passing to GridSearchCV — the pipeline's imputer handles it.
- Do NOT fit feature selection outside the CV loop.
- The `notes` column in education_records is just `"Progress: {completion_status}"` — do not use it as a feature (it leaks the target).
- `enrollment_status` is always `"Enrolled"` — provides no signal, drop it.
- Make sure the temporal cutoff is enforced correctly: only features from the first 3 months, target from the full history.

## Update the README

Add a row to the Pipeline Assignments table in `ml-pipelines/README.md`:

| Education Outcome | `04_education_outcome/education_outcome.ipynb` | Will | `completed` | residents, education_records, health, process_recordings, incidents, home_visitations, intervention_plans |
