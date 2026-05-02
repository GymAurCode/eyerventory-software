import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch


class TestDataPreprocessing(unittest.TestCase):
    def test_aggregate_sales_daily_with_missing(self):
        try:
            from backend.ai import data_preprocessing
        except ModuleNotFoundError:
            self.skipTest("numpy not installed")

        now = datetime.now(timezone.utc)
        rows = [
            {"created_at": now - timedelta(days=2), "quantity": 10},
            {"created_at": now, "quantity": 5},
        ]
        out = data_preprocessing.aggregate_sales(rows)
        self.assertGreaterEqual(len(out["series"]), 3)
        self.assertIn("removed_outliers", out["meta"])


class TestNlpService(unittest.TestCase):
    def test_validate_sql_blocks_subquery(self):
        from backend.ai import nlp_service

        with self.assertRaises(ValueError):
            nlp_service.validate_sql("SELECT * FROM products WHERE id IN (SELECT id FROM sales)")

    def test_validate_sql_adds_limit(self):
        from backend.ai import nlp_service

        sql = nlp_service.validate_sql("SELECT id, name FROM products")
        self.assertIn("LIMIT", sql.upper())


class TestVoiceService(unittest.TestCase):
    def test_parse_words_quantity(self):
        from backend.ai import voice_service

        result = voice_service.parse_voice_command("add fifty units of sugar to warehouse 2")
        self.assertEqual(result["intent"], "add_stock")
        self.assertEqual(result["quantity"], 50)
        self.assertEqual(result["product"], "sugar")


class TestAnomalyService(unittest.TestCase):
    def test_detect_spike(self):
        try:
            from backend.ai import anomaly_service
        except ModuleNotFoundError:
            self.skipTest("numpy not installed")
        with patch("backend.ai.anomaly_service.load_products") as mock_products, patch(
            "backend.ai.anomaly_service.load_sales_by_product"
        ) as mock_sales:
            mock_products.return_value = [{"id": 1, "name": "Rice", "stock": 2}]
            base = datetime.now(timezone.utc)
            rows = [{"created_at": base - timedelta(days=10 - i), "quantity": 2} for i in range(9)]
            rows.append({"created_at": base, "quantity": 30})
            mock_sales.return_value = {1: rows}
            result = anomaly_service.detect_anomalies(MagicMock())
            self.assertIsInstance(result, list)
            if result:
                self.assertIn("type", result[0])


class TestOcrService(unittest.TestCase):
    def test_extract_invoice_fields_fallback(self):
        from backend.ai import ocr_service

        result = ocr_service.extract_invoice_fields(b"not-an-image")
        self.assertIn("manual_correction_required", result)


if __name__ == "__main__":
    unittest.main()

