import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.product_add import ProductAddPayload
from backend.services import product_add_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/product-add", tags=["product-add"])


@router.post("", status_code=status.HTTP_201_CREATED)
def add_product_with_purchase(
    payload: ProductAddPayload,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    try:
        result = product_add_service.add_product_with_purchase(db, payload)
        return {
            "success": True,
            "data": result,
            "message": "Product added with purchase successfully",
        }
    except ValueError as exc:
        logger.error(f"Validation error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": str(exc)},
        ) from exc
    except Exception as exc:
        logger.error(f"Unexpected error adding product: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "error": "Failed to add product"},
        ) from exc
