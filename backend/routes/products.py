import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.product import (
    ImportSummary,
    ProductAddStock,
    ProductCreate,
    ProductRead,
    ProductUpdate,
)
from backend.services import product_service
from backend.services.import_service import (
    generate_template_xlsx,
    import_products,
    preview_excel,
)

router = APIRouter(prefix="/products", tags=["products"])
logger = logging.getLogger("inventory-products")

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("", response_model=list[ProductRead])
def list_products(db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        return product_service.list_products(db)
    except Exception as exc:
        logger.error("list_products failed: %s", exc)
        return []


@router.get("/next-reference")
def next_product_reference(_=Depends(require_roles("owner", "staff"))):
    from datetime import date
    return {"reference_no": f"REF-{date.today().strftime('%Y%m%d')}-{id(_) % 10000:04d}"}


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), _=Depends(require_roles("owner", "staff"))):
    try:
        return product_service.create_product(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    try:
        product = product_service.update_product(db, product_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    ok = product_service.delete_product(db, product_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")


@router.post("/add-stock/{product_id}", response_model=ProductRead)
def add_stock(product_id: int, payload: ProductAddStock, db: Session = Depends(get_db), _=Depends(require_roles("owner"))):
    product = product_service.add_stock(db, product_id, payload)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


# ---------------------------------------------------------------------------
# Excel Import
# ---------------------------------------------------------------------------

@router.get("/import/template")
def download_template(_=Depends(require_roles("owner", "staff"))):
    """Download a sample Excel template for bulk product import."""
    try:
        xlsx_bytes = generate_template_xlsx()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=products_template.xlsx"},
    )


@router.post("/import/preview")
async def preview_import(
    file: UploadFile = File(...),
    _=Depends(require_roles("owner", "staff")),
):
    """Parse the uploaded Excel and return a preview without writing to DB."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        return preview_excel(content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/import", response_model=ImportSummary)
async def import_products_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner", "staff")),
):
    """UPSERT products from an Excel file. Returns detailed per-row results."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        return import_products(db, content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
