import json
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.ai.model_store import model_registry_snapshot


def run_tests() -> bool:
    suite = unittest.defaultTestLoader.discover("backend/tests", pattern="test_ai*.py")
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    return result.wasSuccessful()


def check_accuracy_threshold(max_mae: float = 50.0) -> bool:
    reg = model_registry_snapshot()
    models = reg.get("models", {})
    maes = []
    for item in models.values():
        meta = item.get("metadata", {})
        metrics = meta.get("metrics", {})
        mae = metrics.get("mae")
        if mae is not None:
            maes.append(float(mae))
    if not maes:
        print("No trained model metrics found; skipping MAE gate.")
        return True
    avg_mae = sum(maes) / len(maes)
    print(json.dumps({"avg_mae": avg_mae, "threshold": max_mae}))
    return avg_mae <= max_mae


if __name__ == "__main__":
    ok_tests = run_tests()
    ok_accuracy = check_accuracy_threshold()
    if not (ok_tests and ok_accuracy):
        sys.exit(1)
    sys.exit(0)

