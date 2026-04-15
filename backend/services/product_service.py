from sqlalchemy.orm import Session

from backend.models.product import Product
from backend.schemas.product import ProductAddStock, ProductCreate, ProductUpdate


def _validate_image(image_data: str | None, image_mime: str | None) -> str | None:
    if not image_data:
        return None
    mime = (image_mime or "").strip().lower()
    if mime not in {"image/jpeg", "image/jpg", "image/png"}:
        raise ValueError("Only JPG and PNG images are allowed")
    if not image_data.startswith("data:image/"):
        raise ValueError("Invalid image payload")
    return mime


def list_products(db: Session):
    return db.query(Product).order_by(Product.id.desc()).all()


def create_product(db: Session, payload: ProductCreate):
    mime = _validate_image(payload.image_data, payload.image_mime)
    product = Product(name=payload.name, cost_price=payload.cost_price, stock=payload.stock, image_data=payload.image_data, image_mime=mime)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product_id: int, payload: ProductUpdate):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None
    updates = payload.model_dump(exclude_none=True)
    if "image_data" in updates:
        updates["image_mime"] = _validate_image(updates.get("image_data"), updates.get("image_mime"))
    for key, value in updates.items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int) -> bool:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return False
    db.delete(product)
    db.commit()
    return True


def add_stock(db: Session, product_id: int, payload: ProductAddStock):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None
    product.stock += payload.quantity
    if payload.price is not None:
        product.cost_price = payload.price
    db.commit()
    db.refresh(product)
    return product
