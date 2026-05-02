import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.main import app
from backend.routes.deps import get_current_user


class DummyUser:
    role = "owner"


class TestAiApiIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.dependency_overrides[get_current_user] = lambda: DummyUser()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides = {}

    @patch("backend.ai.prediction_service.predict_stock")
    def test_predict_endpoint(self, mock_predict):
        mock_predict.return_value = [{"product_id": 1, "future_demand": 10, "daily_demand": 1, "current_stock": 10}]
        res = self.client.post("/api/ai/predict", json={"horizon_days": 14})
        self.assertEqual(res.status_code, 200)
        self.assertIn("items", res.json())

    @patch("backend.ai.monitoring.detect_model_drift")
    def test_drift_endpoint(self, mock_drift):
        mock_drift.return_value = {"drift_alerts": [], "count": 0}
        res = self.client.get("/api/ai/drift")
        self.assertEqual(res.status_code, 200)
        self.assertIn("count", res.json())


if __name__ == "__main__":
    unittest.main()

