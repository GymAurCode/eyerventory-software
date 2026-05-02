from __future__ import annotations

import math

import numpy as np
from sqlalchemy.orm import Session

from backend.ai.data_access import load_sales_by_product
from backend.ai.model_store import load_product_model


def _psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    if len(expected) < bins or len(actual) < bins:
        return 0.0
    breaks = np.linspace(min(expected.min(), actual.min()), max(expected.max(), actual.max()), bins + 1)
    e_hist, _ = np.histogram(expected, bins=breaks)
    a_hist, _ = np.histogram(actual, bins=breaks)
    e_pct = np.clip(e_hist / max(e_hist.sum(), 1), 1e-6, 1)
    a_pct = np.clip(a_hist / max(a_hist.sum(), 1), 1e-6, 1)
    return float(np.sum((a_pct - e_pct) * np.log(a_pct / e_pct)))


def detect_model_drift(db: Session, psi_threshold: float = 0.2) -> dict:
    sales = load_sales_by_product(db)
    alerts = []
    for product_id, rows in sales.items():
        if len(rows) < 60:
            continue
        values = np.array([float(r["quantity"]) for r in rows], dtype=float)
        train_ref = values[:-30]
        recent = values[-30:]
        psi_value = _psi(train_ref, recent, bins=8)
        if psi_value >= psi_threshold:
            _, meta = load_product_model(product_id)
            alerts.append(
                {
                    "product_id": product_id,
                    "psi": round(psi_value, 4),
                    "threshold": psi_threshold,
                    "status": "drift_detected",
                    "model_version": (meta or {}).get("version"),
                    "reasoning": "Recent demand distribution deviates from training reference.",
                    "confidence": min(round(psi_value / max(psi_threshold, 1e-6), 3), 1.0),
                }
            )
    return {"drift_alerts": alerts, "count": len(alerts)}

