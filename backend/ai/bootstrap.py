from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.models.sale import Sale


def ensure_ai_seed_data(db: Session) -> dict:
    product_count = db.query(Product).count()
    sale_count = db.query(Sale).count()
    created_products = 0
    created_sales = 0

    if product_count == 0:
        names = [
            "Rice",
            "Flour",
            "Sugar",
            "Cooking Oil",
            "Soap",
            "Shampoo",
            "Tea",
            "Salt",
            "Lentils",
            "Milk Powder",
        ]
        for idx, name in enumerate(names):
            db.add(Product(name=name, cost_price=120.0 + (idx * 5), stock=140 + idx * 10))
            created_products += 1
        db.commit()

    if sale_count == 0:
        products = db.query(Product).order_by(Product.id.asc()).limit(10).all()
        now = datetime.now(timezone.utc)
        for day_offset in range(30):
            dt = now - timedelta(days=(29 - day_offset))
            for idx, product in enumerate(products):
                qty = max(1, ((day_offset + idx) % 9) + 1)
                price = float(product.cost_price * 1.25)
                revenue = qty * price
                cost = qty * float(product.cost_price)
                db.add(
                    Sale(
                        product_id=product.id,
                        quantity=qty,
                        selling_price=price,
                        revenue=revenue,
                        cost=cost,
                        profit=revenue - cost,
                        created_at=dt,
                    )
                )
                created_sales += 1
        db.commit()

    return {
        "products_total": db.query(Product).count(),
        "sales_total": db.query(Sale).count(),
        "created_products": created_products,
        "created_sales": created_sales,
    }

