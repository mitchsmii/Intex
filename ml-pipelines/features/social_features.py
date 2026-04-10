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
    raw_df = posts_df.copy()

    pre_publication_features = [
        "platform",
        "post_type",
        "media_type",
        "day_of_week",
        "post_hour",
        "num_hashtags",
        "mentions_count",
        "caption_length",
        "has_call_to_action",
        "call_to_action_type",
        "content_topic",
        "sentiment_tone",
        "is_boosted",
        "boost_budget_php",
        "features_resident_story",
        "campaign_name",
    ]

    # Build a strict feature frame using only pre-publication fields.
    df = pd.DataFrame(index=raw_df.index)
    for col in pre_publication_features:
        if col in raw_df.columns:
            df[col] = raw_df[col]
        else:
            df[col] = "Unknown" if col in {"platform", "post_type", "media_type", "day_of_week", "call_to_action_type", "content_topic", "sentiment_tone", "campaign_name"} else 0

    df["engagement_rate"] = pd.to_numeric(raw_df.get("engagement_rate"), errors="coerce").fillna(0.0)
    df["made_donation_referral"] = (
        pd.to_numeric(raw_df.get("donation_referrals"), errors="coerce").fillna(0) > 0
    )

    categorical_cols = [
        "platform",
        "post_type",
        "media_type",
        "day_of_week",
        "call_to_action_type",
        "content_topic",
        "sentiment_tone",
        "campaign_name",
    ]
    for col in categorical_cols:
        df[col] = df[col].fillna("Unknown").astype(str)

    numeric_cols = [
        "post_hour",
        "num_hashtags",
        "mentions_count",
        "caption_length",
        "has_call_to_action",
        "is_boosted",
        "boost_budget_php",
        "features_resident_story",
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df = pd.get_dummies(df, columns=categorical_cols, prefix=categorical_cols)
    return df
