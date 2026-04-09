"""Evaluation helpers for classification and regression models."""

from __future__ import annotations

import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)


def evaluate_classifier(y_test, y_pred, model_name: str) -> None:
    """Print core metrics for a classification model.

    Args:
        y_test: Ground-truth labels.
        y_pred: Predicted labels from a classifier.
        model_name: Display name for the evaluated model.

    Returns:
        None: Metrics are printed to stdout.
    """
    print(f"\n=== Classification Evaluation: {model_name} ===")
    print(f"Accuracy : {accuracy_score(y_test, y_pred):.4f}")
    print(f"Precision: {precision_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"Recall   : {recall_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"F1 Score : {f1_score(y_test, y_pred, zero_division=0):.4f}")
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))


def evaluate_regressor(y_test, y_pred, model_name: str) -> None:
    """Print core metrics for a regression model.

    Args:
        y_test: Ground-truth numeric targets.
        y_pred: Predicted numeric values from a regressor.
        model_name: Display name for the evaluated model.

    Returns:
        None: Metrics are printed to stdout.
    """
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    print(f"\n=== Regression Evaluation: {model_name} ===")
    print(f"R^2 : {r2_score(y_test, y_pred):.4f}")
    print(f"MAE : {mean_absolute_error(y_test, y_pred):.4f}")
    print(f"RMSE: {rmse:.4f}")


def plot_feature_importance(model, feature_names, top_n: int = 15) -> None:
    """Plot a horizontal bar chart of top feature importances.

    Args:
        model: Trained model object with a `feature_importances_` attribute.
        feature_names: List-like names aligned with model feature order.
        top_n: Number of highest-importance features to visualize.

    Returns:
        None: Displays a matplotlib chart.
    """
    if not hasattr(model, "feature_importances_"):
        raise AttributeError("Model does not expose 'feature_importances_'.")

    importances = np.array(model.feature_importances_)
    feature_names = np.array(feature_names)

    top_n = min(top_n, len(importances))
    top_indices = np.argsort(importances)[-top_n:]

    plt.figure(figsize=(8, 6))
    plt.barh(feature_names[top_indices], importances[top_indices])
    plt.title(f"Top {top_n} Feature Importances")
    plt.xlabel("Importance")
    plt.tight_layout()
    plt.show()
