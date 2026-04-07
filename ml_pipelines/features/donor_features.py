"""Feature engineering for donor churn modeling."""

from __future__ import annotations

import pandas as pd

from data.loader import get_engine


def build_donor_features(
    supporters_df: pd.DataFrame, donations_df: pd.DataFrame
) -> pd.DataFrame:
    """Build a donor-level training table for churn/lapse classification.

    Args:
        supporters_df: Supporter-level records from the supporters table.
        donations_df: Donation-level records from the donations table.

    Returns:
        pd.DataFrame: Clean feature matrix plus target `is_lapsed`, ready for sklearn.
    """
    _ = get_engine  # Keeps explicit absolute-import dependency on the data package.

    supporters = supporters_df.copy()
    donations = donations_df.copy()

    donations["donation_date"] = pd.to_datetime(donations.get("donation_date"), errors="coerce")
    donations["created_at"] = pd.to_datetime(donations.get("created_at"), errors="coerce")
    donations["estimated_value"] = pd.to_numeric(
        donations.get("estimated_value"), errors="coerce"
    ).fillna(0.0)
    donations["is_recurring"] = donations.get("is_recurring", False).fillna(False).astype(bool)

    reference_date = donations["donation_date"].max()
    if pd.isna(reference_date):
        reference_date = donations["created_at"].max()
    if pd.isna(reference_date):
        reference_date = pd.Timestamp.today().normalize()
    threshold = reference_date - pd.Timedelta(days=90)

    agg = (
        donations.groupby("supporter_id", dropna=False)
        .agg(
            total_donation_count=("supporter_id", "size"),
            total_amount=("estimated_value", "sum"),
            avg_donation_amount=("estimated_value", "mean"),
            first_donation_date=("created_at", "min"),
            is_recurring_donor=("is_recurring", "max"),
            donation_type_variety=("donation_type", "nunique"),
        )
        .reset_index()
    )

    last_donation = (
        donations.groupby("supporter_id")["donation_date"].max().reset_index()
    )
    last_donation.columns = ["supporter_id", "last_donation_date"]
    agg = agg.merge(last_donation, on="supporter_id", how="left")

    agg["first_donation_date"] = pd.to_datetime(agg["first_donation_date"], errors="coerce")
    agg["last_donation_date"] = pd.to_datetime(agg["last_donation_date"], errors="coerce")

    agg["days_since_first_donation"] = (reference_date - agg["first_donation_date"]).dt.days
    agg["days_since_last_donation"] = (reference_date - agg["last_donation_date"]).dt.days
    agg["days_since_first_donation"] = agg["days_since_first_donation"].fillna(999)
    agg["days_since_last_donation"] = agg["days_since_last_donation"].fillna(999)
    agg["is_lapsed"] = agg["last_donation_date"] < threshold
    agg["is_lapsed"] = agg["is_lapsed"].fillna(True)

    model_df = supporters.merge(agg, on="supporter_id", how="left")
    model_df["acquisition_channel"] = model_df.get("acquisition_channel", "Unknown").fillna(
        "Unknown"
    )
    model_df = pd.get_dummies(model_df, columns=["acquisition_channel"], prefix="acq")

    numeric_fill = {
        "total_donation_count": 0,
        "total_amount": 0.0,
        "avg_donation_amount": 0.0,
        "days_since_first_donation": -1,
        "days_since_last_donation": 9999,
        "donation_type_variety": 0,
    }
    for col, value in numeric_fill.items():
        if col in model_df.columns:
            model_df[col] = model_df[col].fillna(value)

    model_df["is_recurring_donor"] = model_df.get("is_recurring_donor", False).fillna(False)
    model_df["is_lapsed"] = model_df.get("is_lapsed", True).fillna(True)

    leakage_columns = [
        "supporter_id",
        "first_donation_date",
        "last_donation_date",
    ]
    existing_leakage_columns = [col for col in leakage_columns if col in model_df.columns]
    model_df = model_df.drop(columns=existing_leakage_columns)

    return model_df
