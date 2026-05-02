from __future__ import annotations

import math
import random
import threading
import uuid
import os
from datetime import datetime

import numpy as np
try:
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.linear_model import LinearRegression
except Exception:  # pragma: no cover - optional runtime dependency
    GradientBoostingRegressor = None
    LinearRegression = None

from backend.ai.backtesting import walk_forward_backtest
from backend.ai.data_access import load_sales_by_product
from backend.ai.data_preprocessing import PreprocessConfig, aggregate_sales
from backend.ai.data_validation import validate_sales_rows
from backend.ai.feature_engineering import build_feature_matrix, feature_columns
from backend.ai.model_store import create_version, save_product_model
from backend.ai.observability import log_error, log_event
from backend.database import SessionLocal

_jobs_lock = threading.Lock()
_jobs: dict[str, dict] = {}
SEED = 42
np.random.seed(SEED)
random.seed(SEED)


def _arima_candidates():
    out = []
    for p in [1, 2]:
        for d in [0, 1]:
            for q in [1, 2]:
                out.append((p, d, q))
    return out


def _train_arima(train_values: np.ndarray):
    try:
        from statsmodels.tsa.arima.model import ARIMA

        best = None
        best_aic = float("inf")
        for order in _arima_candidates():
            try:
                m = ARIMA(train_values, order=order).fit()
                if m.aic < best_aic:
                    best = m
                    best_aic = m.aic
            except Exception:
                continue
        return best
    except Exception:
        return None


def _prepare_frame(rows: list[dict]):
    cleaned = validate_sales_rows(rows, context="training")
    processed = aggregate_sales(cleaned, PreprocessConfig(aggregate="daily"))
    values = [float(item["quantity"]) for item in processed["series"]]
    dates = [datetime.fromisoformat(f"{item['date']}T00:00:00") for item in processed["series"]]
    matrix = build_feature_matrix(values, dates)
    return matrix, values, dates


def _score(y_true: np.ndarray, y_pred: np.ndarray) -> tuple[float, float]:
    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(math.sqrt(np.mean((y_true - y_pred) ** 2)))
    return mae, rmse


def _candidate_models():
    models = []
    if GradientBoostingRegressor is not None:
        models.append(("gradient_boosting", GradientBoostingRegressor(random_state=SEED)))
    if LinearRegression is not None:
        models.append(("linear_regression", LinearRegression()))
    try:
        from xgboost import XGBRegressor

        models.insert(
            0,
            (
                "xgboost",
                XGBRegressor(
                    n_estimators=180,
                    max_depth=5,
                    learning_rate=0.05,
                    subsample=0.9,
                    colsample_bytree=0.9,
                    random_state=SEED,
                ),
            ),
        )
    except Exception:
        pass
    try:
        from lightgbm import LGBMRegressor

        models.insert(0, ("lightgbm", LGBMRegressor(random_state=SEED, n_estimators=200)))
    except Exception:
        pass
    return models


def train_and_save() -> dict:
    with np.errstate(all="ignore"):
        with SessionLocal() as db:
            sales_map = load_sales_by_product(db)

        version = create_version()
        product_metrics: list[dict] = []
        trained_count = 0
        for product_id, rows in sales_map.items():
            try:
                matrix, values, dates = _prepare_frame(rows)
                x = matrix["x"]
                y = matrix["y"]
                if len(y) < 50:
                    continue
                cols = feature_columns()
                split_idx = max(int(len(y) * 0.8), 1)
                x_train, y_train = x[:split_idx], y[:split_idx]
                x_test, y_test = x[split_idx:], y[split_idx:]
                if len(x_test) < 5:
                    continue

                best_model = None
                best_name = "baseline"
                best_mae = float("inf")
                best_rmse = float("inf")
                for name, model in _candidate_models():
                    model.fit(x_train, y_train)
                    pred = np.maximum(model.predict(x_test), 0.0)
                    mae, rmse = _score(y_test, pred)
                    if mae < best_mae:
                        best_model = model
                        best_name = name
                        best_mae = mae
                        best_rmse = rmse
                if best_model is None:
                    raise RuntimeError("No ML model backend available. Install scikit-learn/xgboost/lightgbm.")

                arima_model = _train_arima(y_train)
                if arima_model is not None:
                    try:
                        arima_pred = np.maximum(arima_model.forecast(steps=len(y_test)), 0.0)
                        arima_mae, arima_rmse = _score(y_test, arima_pred)
                        if arima_mae < best_mae:
                            best_model = {"kind": "arima", "order": (2, 1, 2)}
                            best_name = "arima"
                            best_mae = arima_mae
                            best_rmse = arima_rmse
                    except Exception:
                        pass

                residual_std = float(np.std(np.array(y_test) - np.maximum(best_model.predict(x_test), 0.0))) if best_name != "arima" else float(np.std(y_test))
                if GradientBoostingRegressor is not None:
                    backtest = walk_forward_backtest(values, dates, lambda: GradientBoostingRegressor(random_state=SEED))
                else:
                    backtest = {"mae": None, "rmse": None, "trend": []}
                metadata = {
                    "algorithm": best_name,
                    "seed": SEED,
                    "trained_at": datetime.utcnow().isoformat(),
                    "mae": round(best_mae, 4),
                    "rmse": round(best_rmse, 4),
                    "residual_std": round(residual_std, 6),
                    "features": cols,
                    "samples": int(len(y)),
                    "backtest_mae": backtest.get("mae"),
                    "backtest_rmse": backtest.get("rmse"),
                    "accuracy_trend": backtest.get("trend", [])[-30:],
                }
                model_path = save_product_model(product_id, best_model, metadata, version)
                product_metrics.append({"product_id": product_id, "model_path": model_path, **metadata})
                trained_count += 1
            except Exception as exc:
                log_error("train_product_failed", product_id=product_id, error=str(exc))

        result = {
            "status": "trained",
            "version": version,
            "trained_products": trained_count,
            "metrics": product_metrics,
        }
        log_event("training_complete", version=version, trained_products=trained_count)
        return result


def run_training_job(job_id: str) -> None:
    with _jobs_lock:
        _jobs[job_id] = {"job_id": job_id, "status": "running", "started_at": datetime.utcnow().isoformat()}
    try:
        result = train_and_save()
        with _jobs_lock:
            _jobs[job_id] = {**_jobs[job_id], "status": "completed", "result": result, "finished_at": datetime.utcnow().isoformat()}
    except Exception as exc:
        with _jobs_lock:
            _jobs[job_id] = {
                **_jobs[job_id],
                "status": "failed",
                "error": str(exc),
                "finished_at": datetime.utcnow().isoformat(),
            }


def start_training_job() -> dict:
    job_id = str(uuid.uuid4())
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            from redis import Redis
            from rq import Queue

            q = Queue("ai_training", connection=Redis.from_url(redis_url))
            q.enqueue(run_training_job, job_id)
            return {"job_id": job_id, "status": "queued", "executor": "rq"}
        except Exception:
            pass
    thread = threading.Thread(target=run_training_job, args=(job_id,), daemon=True)
    thread.start()
    return {"job_id": job_id, "status": "queued"}


def get_job_status(job_id: str) -> dict:
    with _jobs_lock:
        return _jobs.get(job_id, {"job_id": job_id, "status": "not_found"})

