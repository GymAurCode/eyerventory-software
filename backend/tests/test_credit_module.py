import unittest

from fastapi.testclient import TestClient

from backend.main import app
from backend.routes.deps import get_current_user


class DummyUser:
    role = "owner"
    id = 1


class TestCreditModule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.dependency_overrides[get_current_user] = lambda: DummyUser()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides = {}

    def test_credit_sale_and_payment_flow(self):
        customer = self.client.post("/api/customers", json={"name": "Credit Buyer", "phone": "123"}).json()
        product = self.client.post(
            "/api/products",
            json={"name": "Credit Product", "cost_price": 100, "stock": 30, "sku": "CRD-T1", "category": "General"},
        ).json()

        sale = self.client.post(
            "/api/sales",
            json={
                "product_id": product["id"],
                "customer_id": customer["id"],
                "quantity": 2,
                "selling_price": 150,
                "payment_type": "CREDIT",
                "paid_amount": 40,
            },
        )
        self.assertEqual(sale.status_code, 201)
        sales_payload = sale.json()
        self.assertEqual(sales_payload["payment_type"], "CREDIT")
        self.assertAlmostEqual(sales_payload["due_amount"], 260, places=2)

        credits = self.client.get("/api/credits", params={"party_type": "customer"})
        self.assertEqual(credits.status_code, 200)
        self.assertGreaterEqual(len(credits.json()), 1)
        credit_id = credits.json()[0]["id"]

        payment = self.client.post("/api/credits/payment", json={"credit_account_id": credit_id, "amount": 100, "method": "cash"})
        self.assertEqual(payment.status_code, 200)
        self.assertAlmostEqual(payment.json()["balance"], 160, places=2)
        self.assertEqual(payment.json()["status"], "partial")

        overpay = self.client.post("/api/credits/payment", json={"credit_account_id": credit_id, "amount": 1000, "method": "cash"})
        self.assertEqual(overpay.status_code, 400)

        ledger = self.client.get(f"/api/ledger/{customer['id']}", params={"party_type": "customer"})
        self.assertEqual(ledger.status_code, 200)
        self.assertGreaterEqual(len(ledger.json()), 2)


if __name__ == "__main__":
    unittest.main()
