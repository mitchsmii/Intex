# ML Pipelines — Lighthouse Sanctuary

This folder contains all machine learning pipelines for the INTEX project. The infrastructure (database connection, data loading, feature engineering) is already built and tested. Your job is to open your assigned notebook and build the model.

---

## First Time Setup (Do This Once)

**1. Pull the branch**
```bash
git checkout ml-pipelines
git pull
```

**2. Install dependencies**
```bash
cd ml_pipelines
pip3 install -r requirements.txt
```

**3. Create your `.env` file**

Create a file called `.env` inside the `ml_pipelines/` folder. Get the DATABASE_URL value from Mikelle over Slack — do not commit this file.

```
DATABASE_URL=postgresql+psycopg2://[ask Mikelle for this]
```

**4. Verify your connection works**
```bash
python3 -c "from data.loader import get_engine; print(get_engine())"
```

You should see `Engine(postgresql+psycopg2://...)` printed. If you get an error, make sure your `.env` file is in the `ml_pipelines/` folder and the DATABASE_URL is correct.

---

## Folder Structure

```
ml_pipelines/
├── data/
│   └── loader.py              # Database connection + load functions (DO NOT EDIT)
├── features/
│   ├── donor_features.py      # Feature engineering for donor churn pipeline
│   ├── resident_features.py   # Feature engineering for resident risk pipeline
│   └── social_features.py     # Feature engineering for social media pipeline
├── models/
│   ├── 01_donor_churn/
│   │   └── donor_churn.ipynb  # Mikelle's pipeline
│   ├── 02_social_engagement/
│   │   └── social_engagement.ipynb  # Social media pipeline
│   └── 03_resident_risk/
│       └── resident_risk.ipynb      # Resident risk pipeline
├── saved_models/              # Trained .pkl model files go here
├── utils/
│   └── evaluation.py          # Shared evaluation + plotting functions
├── .env                       # Your local credentials (never commit this)
├── requirements.txt
└── README.md
```

---

## Pipeline Assignments

| Pipeline | Notebook | Owner | Target Variable | Key Tables |
|---|---|---|---|---|
| Donor Churn | `01_donor_churn/donor_churn.ipynb` | Mikelle | `is_lapsed` | supporters, donations |
| Social Media | `02_social_engagement/social_engagement.ipynb` | Teammate 2 | `made_donation_referral` | social_media_posts |
| Resident Risk | `03_resident_risk/resident_risk.ipynb` | Teammate 3 | `high_risk` | residents, health, education, process_recordings, intervention_plans |
| Education Outcome | `04_education_outcome/education_outcome.ipynb` | Will | `completed` | residents, education_records, health_wellbeing_records, process_recordings, incident_reports, home_visitations, intervention_plans |

---

## Starting Your Notebook

Every notebook must have this as the **very first cell** or imports will fail:

```python
import sys
import os
sys.path.insert(0, os.path.abspath('../..'))
```

This tells Python to look in `ml_pipelines/` when importing, which is where `data/`, `features/`, and `utils/` live.

---

## Loading Your Data

All tables are loaded the same way — call the function, get a DataFrame:

```python
from data.loader import load_supporters, load_donations
supporters_df = load_supporters()
donations_df = load_donations()
```

Available load functions:
- `load_supporters()`
- `load_donations()`
- `load_donation_allocations()`
- `load_residents()`
- `load_health_wellbeing_records()`
- `load_education_records()`
- `load_process_recordings()`
- `load_home_visitations()`
- `load_intervention_plans()`
- `load_incident_reports()`
- `load_social_media_posts()`
- `load_safehouse_monthly_metrics()`

---

## Building Features

Each pipeline has its own feature engineering function already built and tested:

**Donor Churn:**
```python
from features.donor_features import build_donor_features
df = build_donor_features(supporters_df, donations_df)
```

**Social Media:**
```python
from features.social_features import build_social_features
df = build_social_features(posts_df)
```

**Resident Risk:**
```python
from features.resident_features import build_resident_features
df = build_resident_features(residents_df, health_df, education_df, process_df, interventions_df)
```

---

## Evaluating Your Model

Use the shared evaluation functions — don't write your own confusion matrix:

```python
from utils.evaluation import evaluate_classifier, evaluate_regressor, plot_feature_importance

# For classification models
evaluate_classifier(y_test, y_pred, "My Model Name")

# For feature importance
plot_feature_importance(model, X_train.columns, top_n=15)
```

---

## Important Notes

**Resident Risk pipeline:** The target variable `high_risk` is imbalanced (6 True vs 54 False). Always use `class_weight='balanced'` in your model and focus on **recall** as your primary metric, not accuracy.

**Social Media pipeline:** The target variable `made_donation_referral` is 522 True vs 290 False (64% positive). Use precision and recall together, not just accuracy.

**Donor Churn pipeline:** Drop `days_since_last_donation` from X before modeling — it is used to define the target variable and will cause data leakage.

**Rule for `loader.py`:** This is shared infrastructure. If you need to add a new load function, tell the team first to avoid merge conflicts.

---

## Saving Your Model

At the end of your notebook, save your best model:

```python
import joblib
joblib.dump(model, '../../saved_models/your_model_name.pkl')
```

---

## Notebook Sections (Same for All Three Pipelines)

1. Problem Framing — define the business question, predictive vs explanatory goal, success metrics
2. Data Loading — load raw tables, print shapes
3. Feature Engineering — call build features function, print head and value counts
4. Exploration — plot distributions and relationships
5. Train/Test Split — stratified split, drop non-numeric columns, fillna
6. Baseline Model — Logistic Regression with class_weight='balanced'
7. Advanced Model — Random Forest or Gradient Boosting
8. Evaluation and Comparison — confusion matrix, precision, recall, F1
9. Feature Importance — which features matter most
10. Save Model — joblib.dump to saved_models/
