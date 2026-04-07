"""Utilities for loading raw data from Supabase Postgres tables."""

from __future__ import annotations
from typing import Optional
import os

import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from dotenv import load_dotenv

load_dotenv()
CONNECTION_STRING = os.getenv("DATABASE_URL")

_ENGINE: Optional[Engine] = None


def get_engine() -> Engine:
    """Create and cache a SQLAlchemy engine for Supabase Postgres.

    Returns:
        Engine: A reusable SQLAlchemy engine connected to the configured database.
    """
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = create_engine(CONNECTION_STRING, future=True)
    return _ENGINE


def _load_table(table_name: str) -> pd.DataFrame:
    """Load a table into a pandas DataFrame and print row count.

    Args:
        table_name: Name of the database table to load.

    Returns:
        pd.DataFrame: Table contents as a DataFrame.
    """
    df = pd.read_sql_table(table_name, con=get_engine())
    print(f"Loaded '{table_name}' with {len(df):,} rows.")
    return df


def load_supporters() -> pd.DataFrame:
    """Load the supporters table.

    Returns:
        pd.DataFrame: Raw supporters records.
    """
    return _load_table("supporters")


def load_donations() -> pd.DataFrame:
    """Load the donations table.

    Returns:
        pd.DataFrame: Raw donations records.
    """
    return _load_table("donations")


def load_donation_allocations() -> pd.DataFrame:
    """Load the donation_allocations table.

    Returns:
        pd.DataFrame: Raw donation allocation records.
    """
    return _load_table("donation_allocations")


def load_residents() -> pd.DataFrame:
    """Load the residents table.

    Returns:
        pd.DataFrame: Raw resident records.
    """
    return _load_table("residents")


def load_health_wellbeing_records() -> pd.DataFrame:
    """Load the health_wellbeing_records table.

    Returns:
        pd.DataFrame: Raw health and wellbeing records.
    """
    return _load_table("health_wellbeing_records")


def load_education_records() -> pd.DataFrame:
    """Load the education_records table.

    Returns:
        pd.DataFrame: Raw education records.
    """
    return _load_table("education_records")


def load_process_recordings() -> pd.DataFrame:
    """Load the process_recordings table.

    Returns:
        pd.DataFrame: Raw counseling/process recordings.
    """
    return _load_table("process_recordings")


def load_home_visitations() -> pd.DataFrame:
    """Load the home_visitations table.

    Returns:
        pd.DataFrame: Raw home visitation records.
    """
    return _load_table("home_visitations")


def load_intervention_plans() -> pd.DataFrame:
    """Load the intervention_plans table.

    Returns:
        pd.DataFrame: Raw intervention plan records.
    """
    return _load_table("intervention_plans")


def load_incident_reports() -> pd.DataFrame:
    """Load the incident_reports table.

    Returns:
        pd.DataFrame: Raw incident report records.
    """
    return _load_table("incident_reports")


def load_social_media_posts() -> pd.DataFrame:
    """Load the social_media_posts table.

    Returns:
        pd.DataFrame: Raw social media post records.
    """
    return _load_table("social_media_posts")


def load_safehouse_monthly_metrics() -> pd.DataFrame:
    """Load the safehouse_monthly_metrics table.

    Returns:
        pd.DataFrame: Raw monthly safehouse metrics.
    """
    return _load_table("safehouse_monthly_metrics")
