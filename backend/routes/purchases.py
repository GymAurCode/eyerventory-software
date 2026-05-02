import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.purchase import PurchaseCreate, PurchaseItemRead, PurchaseRead
from backend.services import purchase_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/purchases", tags=["purchases"])


def _enrich(purchase) -> dict:
    """Attach supplier_name and product_name to the response."""
    try:
        data = {
            "id": purchase.id,
            "supplier_id": purchase.supplier_id,
            "supplier_name": purchase.supplier.name if purchase.supplier else None,
            "invoice_number": purchase.invoice_number,
            "purchase_date": purchase.purchase_date.isoformat() if purchase.purchase_date else None,
            "total_amount": float(purchase.total_amount) if purchase.total_amount is not None else 0.0,
            "discount": float(purchase.discount) if purchase.discount is not None else 0.0,
            "tax": float(purchase.tax) if purchase.tax is not None else 0.0,
            "final_amount": float(purchase.final_amount) if purchase.final_amount is not None else 0.0,
            "payment_type": purchase.payment_type,
            "notes": purchase.notes,
            "created_at": purchase.created_at.isoformat() if purchase.created_at else None,
            "items": [],
        }
        
        # Safely process items
        if hasattr(purchase, 'items') and purchase.items:
            for item in purchase.items:
                try:
                    item_data = {
                        "id": item.id,
                        "product_id": item.product_id,
                        "product_name": item.product.name if hasattr(item, 'product') and item.product else None,
                        "quantity": int(item.quantity) if item.quantity is not None else 0,
                        "purchase_price": float(item.purchase_price) if item.purchase_price is not None else 0.0,
                        "total_price": float(item.total_price) if item.total_price is not None else 0.0,
                    }
                    data["items"].append(item_data)
                except Exception as item_err:
                    logger.error(f"Error enriching purchase item {item.id}: {item_err}", exc_info=True)
                    # Add minimal item data to avoid complete failure
                    data["items"].append({
                        "id": item.id,
                        "product_id": item.product_id,
                        "product_name": None,
                        "quantity": item.quantity,
                        "purchase_price": item.purchase_price,
                        "total_price": item.total_price,
                    })
        
        return data
    except Exception as e:
        logger.error(f"Error enriching purchase {purchase.id}: {e}", exc_info=True)
        raise


@router.post("", status_code=status.HTTP_201_CREATED)
def create_purchase(
    payload: PurchaseCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    """Create a new purchase with items and accounting entries."""
    try:
        purchase = purchase_service.create_purchase(db, payload)
        return {
            "success": True,
            "data": _enrich(purchase),
            "message": "Purchase created successfully"
        }
    except ValueError as exc:
        logger.error(f"Validation error creating purchase: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail={"success": False, "error": str(exc)}
        ) from exc
    except Exception as exc:
        logger.error(f"Unexpected error creating purchase: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "error": "Failed to create purchase"}
        ) from exc


@router.get("")
def list_purchases(
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    """Get all purchases with supplier and product details."""
    try:
        purchases = purchase_service.list_purchases(db)
        
        if not purchases:
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "data": [],
                    "message": "No purchases found"
                }
            )
        
        enriched_purchases = []
        for purchase in purchases:
            try:
                enriched_purchases.append(_enrich(purchase))
            except Exception as enrich_err:
                logger.error(f"Failed to enrich purchase {purchase.id}: {enrich_err}", exc_info=True)
                # Continue with other purchases instead of failing completely
                continue
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": enriched_purchases,
                "message": "Purchases fetched successfully"
            }
        )
    except Exception as exc:
        logger.error(f"Error fetching purchases: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"Failed to fetch purchases: {str(exc)}"
            }
        )


@router.get("/{purchase_id}")
def get_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    """Get a single purchase by ID."""
    try:
        purchase = purchase_service.get_purchase(db, purchase_id)
        if not purchase:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": "Purchase not found"
                }
            )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": _enrich(purchase),
                "message": "Purchase fetched successfully"
            }
        )
    except Exception as exc:
        logger.error(f"Error fetching purchase {purchase_id}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"Failed to fetch purchase: {str(exc)}"
            }
        )


@router.delete("/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    """Delete a purchase and its items."""
    try:
        ok = purchase_service.delete_purchase(db, purchase_id)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail={"success": False, "error": "Purchase not found"}
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error deleting purchase {purchase_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"success": False, "error": "Failed to delete purchase"}
        ) from exc
