from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from backend.ai.data_access import load_products


def _guess_category(name: str) -> str:
    value = name.lower()
    if any(t in value for t in ["rice", "flour", "sugar", "wheat", "oil"]):
        return "Groceries"
    if any(t in value for t in ["soap", "shampoo", "toothpaste", "cleaner"]):
        return "Household"
    if any(t in value for t in ["battery", "charger", "usb", "cable"]):
        return "Electronics"
    return "General"


def categorize_products(db: Session, duplicate_threshold: float = 0.86) -> dict:
    products = load_products(db)
    categorized = []
    duplicates = []
    for product in products:
        categorized.append(
            {
                "product_id": product["id"],
                "product_name": product["name"],
                "suggested_category": _guess_category(product["name"]),
            }
        )
    for i, left in enumerate(products):
        for right in products[i + 1 :]:
            ratio = SequenceMatcher(None, left["name"].lower(), right["name"].lower()).ratio()
            if ratio >= duplicate_threshold:
                duplicates.append(
                    {
                        "left_product_id": left["id"],
                        "right_product_id": right["id"],
                        "left_name": left["name"],
                        "right_name": right["name"],
                        "similarity": round(ratio, 3),
                    }
                )
    return {"categorized": categorized, "duplicates": duplicates}

