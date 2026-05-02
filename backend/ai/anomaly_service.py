from __future__ import annotations

import re
from statistics import mean, pstdev

import numpy as np
from sqlalchemy.orm import Session

from backend.ai.data_preprocessing import PreprocessConfig, aggregate_sales
from backend.ai.data_access import load_products, load_sales_by_product
from backend.ai.observability import track_latency, log_event, log_error


def _zscore(series: list[float], value: float) -> float:
    if len(series) < 2:
        return 0.0
    m = mean(series)
    sd = pstdev(series)
    if sd == 0:
        return 0.0
    return (value - m) / sd


def _normalize_name(name: str) -> str:
    """Lowercase, strip punctuation/spaces for fuzzy comparison."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _detect_duplicates(products: list[dict]) -> list[dict]:
    """
    Detect duplicate or near-duplicate product entries.
    Exact normalized-name match = high severity.
    Prefix match (one name starts with another, len >= 4) = medium severity.
    """
    duplicates: list[dict] = []
    seen: dict[str, list[dict]] = {}

    for p in products:
        key = _normalize_name(p["name"])
        seen.setdefault(key, []).append(p)

    # Exact duplicates (same normalized name)
    for key, group in seen.items():
        if len(group) > 1:
            duplicates.append({
                "type": "duplicate_entry",
                "severity": "high",
                "product_names": [g["name"] for g in group],
                "product_ids": [g["id"] for g in group],
                "explanation": (
                    f"Exact duplicate detected: {len(group)} products share the same normalized name "
                    f"'{group[0]['name']}'. IDs: {[g['id'] for g in group]}."
                ),
            })

    # Fuzzy prefix duplicates (one normalized name is a prefix of another, min length 4)
    keys = list(seen.keys())
    reported_pairs: set[frozenset] = set()
    for i, k1 in enumerate(keys):
        for k2 in keys[i + 1:]:
            pair = frozenset([k1, k2])
            if pair in reported_pairs:
                continue
            short, long_ = (k1, k2) if len(k1) <= len(k2) else (k2, k1)
            if len(short) >= 4 and long_.startswith(short):
                reported_pairs.add(pair)
                g1 = seen[k1]
                g2 = seen[k2]
                all_products = g1 + g2
                duplicates.append({
                    "type": "similar_name",
                    "severity": "medium",
                    "product_names": [p["name"] for p in all_products],
                    "product_ids": [p["id"] for p in all_products],
                    "explanation": (
                        f"Similar product names detected: "
                        f"'{g1[0]['name']}' and '{g2[0]['name']}' may be the same item."
                    ),
                })

    return duplicates


def detect_anomalies(db: Session, threshold: float = 2.5) -> dict:
    """
    Detect sales anomalies and data integrity issues (duplicates, negative stock).
    Returns dict with data, insight, reasoning, confidence.
    """
    def _compute():
        with track_latency("anomaly_detection"):
            sales = load_sales_by_product(db)
            products_list = load_products(db)
            products = {p["id"]: p for p in products_list}

            anomalies: list[dict] = []

            # --- Data integrity: negative stock ---
            for p in products_list:
                if p.get("stock", 0) < 0:
                    log_error("invalid_stock_negative", product_id=p["id"], stock=p["stock"])
                    anomalies.append({
                        "product_id": p["id"],
                        "product_name": p["name"],
                        "anomaly_type": "negative_stock",
                        "severity": "high",
                        "z_score": 0.0,
                        "deviation_value": abs(p["stock"]),
                        "current_stock": p["stock"],
                        "explanation": (
                            f"Data integrity issue: '{p['name']}' has negative stock ({p['stock']}). "
                            "Stock cannot be negative."
                        ),
                        "confidence": 1.0,
                    })

            # --- Data integrity: duplicate products ---
            dup_issues = _detect_duplicates(products_list)
            for dup in dup_issues:
                anomalies.append({
                    "product_id": dup["product_ids"][0],
                    "product_name": dup["product_names"][0],
                    "anomaly_type": dup["type"],
                    "severity": dup["severity"],
                    "z_score": 0.0,
                    "deviation_value": 0.0,
                    "current_stock": None,
                    "duplicate_ids": dup["product_ids"],
                    "duplicate_names": dup["product_names"],
                    "explanation": dup["explanation"],
                    "confidence": 1.0,
                })

            # --- Sales anomaly detection ---
            if len(products) >= 3 and len(sales) >= 3:
                for product_id, rows in sales.items():
                    processed = aggregate_sales(rows, PreprocessConfig(aggregate="daily"))
                    quantities = [p["quantity"] for p in processed["series"]]

                    if len(quantities) < 7:
                        continue

                    baseline = quantities[:-1]
                    latest = quantities[-1]
                    z = _zscore(baseline, latest)
                    rolling_mean = float(np.mean(quantities[-8:-1])) if len(quantities) >= 8 else float(np.mean(baseline))
                    rolling_dev_ratio = ((latest - rolling_mean) / rolling_mean) if rolling_mean > 0 else 0.0
                    deviation_value = abs(latest - rolling_mean)

                    if rolling_mean <= 0 or abs(rolling_dev_ratio) < 0.1:
                        continue

                    if not (abs(z) >= threshold and deviation_value > rolling_mean * 0.2):
                        continue

                    anomaly_type = "sales_spike" if latest > rolling_mean else "sales_drop"
                    severity = "high" if abs(z) >= (threshold + 1) else "medium"
                    confidence = min(abs(z) / threshold, 1.0)
                    product_name = products.get(product_id, {}).get("name", f"Product #{product_id}")
                    current_stock = products.get(product_id, {}).get("stock", 0)

                    log_event("anomaly_detected", product_id=product_id, anomaly_type=anomaly_type,
                              z_score=round(z, 2))

                    anomalies.append({
                        "product_id": product_id,
                        "product_name": product_name,
                        "current_stock": current_stock,
                        "anomaly_type": anomaly_type,
                        "severity": severity,
                        "z_score": round(z, 2),
                        "deviation_value": round(deviation_value, 2),
                        "latest_quantity": round(latest, 2),
                        "baseline_avg": round(mean(baseline), 2),
                        "rolling_mean": round(rolling_mean, 2),
                        "deviation_ratio": round(rolling_dev_ratio, 3),
                        "confidence": round(confidence, 3),
                        "explanation": (
                            f"'{product_name}' shows {anomaly_type}. "
                            f"Latest demand ({latest:.2f}) deviates from rolling mean ({rolling_mean:.2f}) "
                            f"by {deviation_value:.2f} units ({abs(rolling_dev_ratio)*100:.1f}%). "
                            f"Z-score: {z:.2f}."
                        ),
                    })
            else:
                log_event("anomaly_insufficient_data",
                          product_count=len(products), sales_entries=len(sales))

            if not anomalies:
                return {
                    "data": [],
                    "insight": "No anomalies or data integrity issues detected",
                    "reasoning": "Sales patterns are stable and no duplicate/integrity issues found.",
                    "confidence": 1.0,
                }

            anomalies_sorted = sorted(
                anomalies,
                key=lambda x: ({"high": 0, "medium": 1, "low": 2}.get(x["severity"], 2), -abs(x.get("z_score", 0)))
            )

            high_count = sum(1 for a in anomalies_sorted if a["severity"] == "high")
            integrity_count = sum(1 for a in anomalies_sorted if a["anomaly_type"] in ("duplicate_entry", "similar_name", "negative_stock"))

            insight = (
                f"Detected {len(anomalies_sorted)} issue(s): "
                f"{high_count} high severity, {integrity_count} data integrity."
            )

            return {
                "data": anomalies_sorted,
                "insight": insight,
                "reasoning": f"Z-score threshold {threshold} on daily sales + duplicate/integrity checks.",
                "confidence": round(mean(a["confidence"] for a in anomalies_sorted), 3),
            }

    return _compute()
