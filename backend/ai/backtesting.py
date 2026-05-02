from __future__ import annotations

import math
from datetime import datetime

import numpy as np

from backend.ai.feature_engineering import build_feature_matrix


def walk_forward_backtest(values: list[float], dates: list[datetime], model_builder, min_train: int = 60) -> dict:
    matrix = build_feature_matrix(values, dates)
    x = matrix["x"]
    y = matrix["y"]
    ds = matrix["ds"]
    if len(y) < max(min_train, 30):
        return {"mae": None, "rmse": None, "trend": []}
    errors = []
    trend = []
    for i in range(min_train, len(y)):
        x_train, y_train = x[:i], y[:i]
        x_test, y_test = x[i : i + 1], y[i : i + 1]
        model = model_builder()
        model.fit(x_train, y_train)
        pred = float(model.predict(x_test)[0])
        actual = float(y_test[0])
        errors.append((actual, pred))
        trend.append(
            {
                "date": ds[i].isoformat(),
                "actual": actual,
                "predicted": pred,
                "abs_error": abs(actual - pred),
            }
        )
    if not errors:
        return {"mae": None, "rmse": None, "trend": []}
    y_true = np.array([a for a, _ in errors], dtype=float)
    y_pred = np.array([b for _, b in errors], dtype=float)
    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(math.sqrt(np.mean((y_true - y_pred) ** 2)))
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "trend": trend[-180:]}

