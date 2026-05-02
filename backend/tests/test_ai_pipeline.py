import unittest
from datetime import datetime, timedelta
from unittest.mock import patch


class TestBacktesting(unittest.TestCase):
    def test_walk_forward_outputs_metrics(self):
        try:
            from backend.ai import backtesting
            from sklearn.ensemble import GradientBoostingRegressor
        except ModuleNotFoundError:
            self.skipTest("sklearn not installed")

        values = [10 + (i % 5) for i in range(120)]
        dates = [datetime(2025, 1, 1) + timedelta(days=i) for i in range(120)]

        out = backtesting.walk_forward_backtest(values, dates, lambda: GradientBoostingRegressor(random_state=42))
        self.assertIn("mae", out)
        self.assertIn("rmse", out)
        self.assertIsNotNone(out["mae"])


class TestMonitoring(unittest.TestCase):
    @patch("backend.ai.monitoring.load_product_model")
    @patch("backend.ai.monitoring.load_sales_by_product")
    def test_detect_model_drift(self, mock_sales, mock_model):
        from backend.ai import monitoring

        rows = []
        base = datetime(2025, 1, 1)
        for i in range(90):
            qty = 5 if i < 60 else 20
            rows.append({"quantity": qty, "created_at": base + timedelta(days=i), "product_id": 1})
        mock_sales.return_value = {1: rows}
        mock_model.return_value = (None, None)
        res = monitoring.detect_model_drift(None, psi_threshold=0.1)
        self.assertIn("drift_alerts", res)


if __name__ == "__main__":
    unittest.main()

