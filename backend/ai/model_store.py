from __future__ import annotations

import json
import os
from datetime import datetime

from joblib import dump, load

MODELS_DIR = os.path.join(os.getcwd(), "models")
REGISTRY_FILE = os.path.join(MODELS_DIR, "registry.json")


def ensure_dirs() -> None:
    os.makedirs(MODELS_DIR, exist_ok=True)


def _load_registry() -> dict:
    ensure_dirs()
    if not os.path.exists(REGISTRY_FILE):
        return {"versions": [], "models": {}, "history": {}}
    with open(REGISTRY_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _save_registry(reg: dict) -> None:
    ensure_dirs()
    with open(REGISTRY_FILE, "w", encoding="utf-8") as fh:
        json.dump(reg, fh, indent=2)


def create_version() -> str:
    reg = _load_registry()
    version = datetime.utcnow().strftime("v%Y%m%d%H%M%S")
    reg["versions"].append(version)
    _save_registry(reg)
    return version


def save_product_model(product_id: int, model_obj, metadata: dict, version: str) -> str:
    reg = _load_registry()
    model_file = os.path.join(MODELS_DIR, f"product_{product_id}_{version}.joblib")
    dump(model_obj, model_file)
    previous = reg["models"].get(str(product_id))
    history = reg.setdefault("history", {}).setdefault(str(product_id), [])
    if previous:
        history.append(previous)
    reg["models"][str(product_id)] = {
        "model_path": model_file,
        "version": version,
        "metadata": {
            **metadata,
            "training_date": datetime.utcnow().isoformat(),
            "dataset_size": metadata.get("samples"),
            "metrics": {"mae": metadata.get("mae"), "rmse": metadata.get("rmse")},
        },
    }
    _save_registry(reg)
    return model_file


def load_product_model(product_id: int, version: str | None = None):
    reg = _load_registry()
    if version:
        item = next(
            (
                x
                for x in ([reg["models"].get(str(product_id))] + reg.get("history", {}).get(str(product_id), []))
                if x and x.get("version") == version
            ),
            None,
        )
    else:
        item = reg["models"].get(str(product_id))
    if not item:
        return None, None
    try:
        return load(item["model_path"]), item
    except Exception:
        return None, None


def rollback_product_model(product_id: int, target_version: str) -> dict:
    reg = _load_registry()
    product_key = str(product_id)
    candidates = [reg["models"].get(product_key)] + reg.get("history", {}).get(product_key, [])
    target = next((c for c in candidates if c and c.get("version") == target_version), None)
    if not target:
        return {"status": "not_found", "product_id": product_id, "target_version": target_version}
    current = reg["models"].get(product_key)
    history = reg.setdefault("history", {}).setdefault(product_key, [])
    if current and current.get("version") != target_version:
        history.append(current)
    reg["models"][product_key] = target
    reg["history"][product_key] = [h for h in history if h.get("version") != target_version]
    _save_registry(reg)
    return {"status": "rolled_back", "product_id": product_id, "version": target_version}


def model_registry_snapshot() -> dict:
    return _load_registry()

