import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from backend.database import get_db
from backend.models.product import Product
from backend.models.pos_sale import PosSale, PosSaleItem, SaleReturn, SaleReturnItem
from backend.models.customer import Customer
from backend.routes.deps import require_roles
from backend.schemas.pos import (
    PosSaleCreate,
    PosSaleRead,
    SaleResponse,
    SaleReturnCreate,
    SaleReturnRead,
)
from backend.services import accounting_service
from backend.utils.activity import log_activity
from backend.utils.barcode import generate_barcode

logger = logging.getLogger("inventory-pos")
router = APIRouter(prefix="/pos", tags=["pos"])


# ---------------------------------------------------------------------------
# Barcode Endpoints
# ---------------------------------------------------------------------------

@router.post("/inventory/{item_id}/generate-barcode")
def generate_item_barcode(item_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    product = db.query(Product).filter(Product.id == item_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    code, image_path = generate_barcode(product.id, product.name)
    product.barcode_number = code
    product.barcode_image_path = image_path
    db.commit()
    db.refresh(product)
    return {
        "barcode_number": code,
        "barcode_image_url": f"/api/pos/inventory/{item_id}/barcode-image",
    }


@router.get("/inventory/{item_id}/barcode-image")
def get_barcode_image(item_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == item_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if not product.barcode_image_path or not Path(product.barcode_image_path).exists():
        code, image_path = generate_barcode(product.id, product.name)
        product.barcode_number = code
        product.barcode_image_path = image_path
        db.commit()
    return FileResponse(product.barcode_image_path, media_type="image/png")


@router.get("/inventory/barcode/{barcode_number}")
def lookup_by_barcode(barcode_number: str, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    product = db.query(Product).filter(Product.barcode_number == barcode_number).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found for this barcode")
    return {
        "id": product.id,
        "name": product.name,
        "selling_price": product.selling_price,
        "cost_price": product.cost_price,
        "stock": product.stock,
        "barcode_number": product.barcode_number,
        "sku": product.sku,
        "category": product.category,
        "out_of_stock": product.stock == 0,
    }


# ---------------------------------------------------------------------------
# POS Sale Endpoints
# ---------------------------------------------------------------------------

def _next_bill_number(db: Session) -> str:
    last = db.query(PosSale).order_by(PosSale.id.desc()).first()
    if last:
        try:
            num = int(last.bill_number.replace("INV-", "")) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f"INV-{num}"


@router.get("/sales/next-bill-number")
def next_bill_number(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return {"bill_number": _next_bill_number(db)}


@router.post("/sales", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_pos_sale(payload: PosSaleCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    # Validate items exist and have sufficient stock
    items_data = []
    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.item_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product id={item.item_id} not found")
        if product.stock < item.qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for '{product.name}': available {product.stock}, requested {item.qty}",
            )
        items_data.append({"product": product, "qty": item.qty})

    # Discount validation: discount cannot exceed total cost value
    total_cost = sum(p["product"].cost_price * p["qty"] for p in items_data)
    if payload.discount > total_cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discount ({payload.discount}) exceeds total cost value ({total_cost}). Max discount allowed is {total_cost}.",
        )

    if payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    bill_number = _next_bill_number(db)

    sale = PosSale(
        bill_number=bill_number,
        customer_id=payload.customer_id,
        subtotal=payload.subtotal,
        discount=payload.discount,
        total=payload.total,
        payment_method=payload.payment_method,
        cash_received=payload.cash_received,
        change_amount=payload.change_amount,
        status="completed",
    )
    db.add(sale)
    db.flush()

    acct_items = []
    for item_dict, item in zip(items_data, payload.items):
        db.add(PosSaleItem(
            sale_id=sale.id,
            item_id=item.item_id,
            item_name=item.item_name,
            qty=item.qty,
            unit_price=item.unit_price,
            total_price=item.total_price,
        ))
        # Reduce stock
        item_dict["product"].stock -= item.qty
        acct_items.append({
            "cost_price": item_dict["product"].cost_price,
            "qty": item.qty,
        })

    # Create double-entry journal entry for the POS sale
    accounting_service.record_pos_sale(
        db,
        sale_id=sale.id,
        bill_number=bill_number,
        total=payload.total,
        payment_method=payload.payment_method,
        items=acct_items,
    )

    db.commit()
    db.refresh(sale)

    log_activity(
        db, "sale",
        f"Sale completed — Bill #{sale.bill_number} — Rs. {sale.total:.2f}",
        reference_id=sale.id, reference_type="sale", amount=sale.total,
    )

    return SaleResponse(sale_id=sale.id, bill_number=bill_number, success=True)


@router.get("/sales", response_model=list[PosSaleRead])
def list_pos_sales(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return db.query(PosSale).order_by(PosSale.id.desc()).all()


@router.get("/sales/{sale_id}", response_model=PosSaleRead)
def get_pos_sale(sale_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    sale = db.query(PosSale).options(joinedload(PosSale.items), joinedload(PosSale.returns)).filter(PosSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    return sale


# ---------------------------------------------------------------------------
# Return / Refund Endpoints
# ---------------------------------------------------------------------------

@router.post("/sales/{sale_id}/return", response_model=SaleReturnRead, status_code=status.HTTP_201_CREATED)
def return_pos_sale(sale_id: int, payload: SaleReturnCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    sale = db.query(PosSale).options(joinedload(PosSale.items)).filter(PosSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    if sale.status == "returned":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sale already fully returned")

    total_refund = 0.0
    return_items = []

    for ri in payload.items:
        sale_item = next((si for si in sale.items if si.item_id == ri.item_id), None)
        if not sale_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Item id={ri.item_id} not found in sale")
        if ri.qty > sale_item.qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Return qty ({ri.qty}) exceeds sold qty ({sale_item.qty}) for '{sale_item.item_name}'",
            )

        refund_line_total = ri.qty * sale_item.unit_price
        total_refund += refund_line_total

        return_items.append({
            "item_id": ri.item_id,
            "item_name": sale_item.item_name,
            "qty": ri.qty,
            "unit_price": sale_item.unit_price,
            "total_price": refund_line_total,
        })

        # Restore stock
        product = db.query(Product).filter(Product.id == ri.item_id).first()
        product.stock += ri.qty
        return_items[-1]["cost_price"] = product.cost_price

    sale_return = SaleReturn(
        sale_id=sale.id,
        reason=payload.reason,
        total_refund=total_refund,
    )
    db.add(sale_return)
    db.flush()

    for ri in return_items:
        db.add(SaleReturnItem(
            return_id=sale_return.id,
            **{k: v for k, v in ri.items() if k != "cost_price"},
        ))

    # Update sale status
    all_returned = all(
        sum(ri.qty for ri in payload.items if ri.item_id == si.item_id) >= si.qty
        for si in sale.items
    )
    sale.status = "returned" if all_returned else "partial_return"

    # Create reverse journal entry for the return
    accounting_service.record_pos_return(
        db,
        sale_id=sale.id,
        return_id=sale_return.id,
        bill_number=sale.bill_number,
        total_refund=total_refund,
        original_payment_method=sale.payment_method,
        items=[{"cost_price": ri["cost_price"], "qty": ri["qty"]} for ri in return_items],
    )

    db.commit()
    db.refresh(sale_return)

    log_activity(
        db, "return",
        f"Return processed — Bill #{sale.bill_number} — Rs. {total_refund:.2f}",
        reference_id=sale.id, reference_type="sale", amount=total_refund,
    )

    return sale_return


@router.get("/sales/{sale_id}/returns", response_model=list[SaleReturnRead])
def list_sale_returns(sale_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    return db.query(SaleReturn).options(joinedload(SaleReturn.items)).filter(SaleReturn.sale_id == sale_id).all()


# ---------------------------------------------------------------------------
# Bulk Barcode Generation
# ---------------------------------------------------------------------------

@router.post("/inventory/bulk-generate-barcodes")
def bulk_generate_barcodes(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    products = db.query(Product).filter(Product.barcode_number.is_(None)).all()
    count = 0
    for product in products:
        code, image_path = generate_barcode(product.id, product.name)
        product.barcode_number = code
        product.barcode_image_path = image_path
        count += 1
    db.commit()
    return {"generated": count, "total_products": db.query(Product).count()}
