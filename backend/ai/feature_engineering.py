from __future__ import annotations

from datetime import datetime

import numpy as np


def build_feature_matrix(values: list[float], dates: list[datetime]) -> dict:
    if not values or not dates or len(values) != len(dates):
        return {"x": np.empty((0, len(feature_columns()))), "y": np.empty((0,)), "ds": []}
    rows = []
    target = []
    out_dates = []
    arr = [float(v) for v in values]
    for i in range(len(arr)):
        if i < 30:
            continue
        d = dates[i]
        day_of_year = d.timetuple().tm_yday
        prev7 = arr[i - 7 : i]
        prev14 = arr[i - 14 : i]
        rows.append(
            [
                float(i),
                float(arr[i - 1]),
                float(arr[i - 7]),
                float(arr[i - 14]),
                float(arr[i - 30]),
                float(np.mean(prev7)) if prev7 else 0.0,
                float(np.std(prev7)) if prev7 else 0.0,
                float(np.mean(prev14)) if prev14 else 0.0,
                float(np.std(prev14)) if prev14 else 0.0,
                float(d.weekday()),
                float(d.month),
                float(np.sin(2 * np.pi * day_of_year / 365.25)),
                float(np.cos(2 * np.pi * day_of_year / 365.25)),
                float(arr[i - 1] - arr[i - 8]),
            ]
        )
        target.append(float(arr[i]))
        out_dates.append(d)
    if not rows:
        return {"x": np.empty((0, len(feature_columns()))), "y": np.empty((0,)), "ds": []}
    return {"x": np.array(rows, dtype=float), "y": np.array(target, dtype=float), "ds": out_dates}


def feature_columns() -> list[str]:
    return [
        "time_index",
        "lag_1",
        "lag_7",
        "lag_14",
        "lag_30",
        "roll_mean_7",
        "roll_std_7",
        "roll_mean_14",
        "roll_std_14",
        "weekday",
        "month",
        "season_sin",
        "season_cos",
        "trend_7",
    ]

