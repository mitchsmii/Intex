"""Feature engineering for social media engagement and referral modeling."""

from __future__ import annotations

import pandas as pd


def build_social_features(posts_df: pd.DataFrame) -> pd.DataFrame:
    """Build a post-level modeling dataset for engagement and donation referral tasks.

    Args:
        posts_df: Raw social media post records.

    Returns:
        pd.DataFrame: Clean feature matrix with targets `engagement_rate` and
        `made_donation_referral`, ready for sklearn workflows.
    """
    df = posts_df.copy()

    categorical_cols = [
        "platform",
        "post_type",
        "media_type",
        "sentiment_tone",
        "content_topic",
        "call_to_action_type",
    ]
    for col in categorical_cols:
        if col not in df.columns:
            df[col] = "Unknown"
        df[col] = df[col].fillna("Unknown")

    numeric_cols = [
        "post_hour",
        "num_hashtags",
        "mentions_count",
        "caption_length",
        "is_boosted",
        "boost_budget_php",
    ]
    for col in numeric_cols:
        if col not in df.columns:
            df[col] = 0

    if "day_of_week" not in df.columns:
        df["day_of_week"] = "Unknown"

    weekend_labels = {"sat", "saturday", "sun", "sunday"}
    df["is_weekend"] = (
        df["day_of_week"]
        .astype(str)
        .str.strip()
        .str.lower()
        .isin(weekend_labels | {"5", "6"})
    )

    df["engagement_rate"] = pd.to_numeric(df.get("engagement_rate"), errors="coerce").fillna(0.0)
    df["made_donation_referral"] = (
        pd.to_numeric(df.get("donation_referrals"), errors="coerce").fillna(0) > 0
    )

    df = pd.get_dummies(df, columns=categorical_cols, prefix=categorical_cols)

    drop_columns = ["day_of_week", "donation_referrals"]
    existing_drop = [col for col in drop_columns if col in df.columns]
    df = df.drop(columns=existing_drop)

    return df
