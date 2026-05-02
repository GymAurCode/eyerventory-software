<<<<<<< HEAD
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
=======
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import require_roles
from backend.schemas.product import (
<<<<<<< HEAD
    ImportSummary,
    ProductAddStock,
    ProductCreate,
    ProductRead,
    ProductUpdate,
=======
    BulkImportResult, ProductAddStock, ProductCreate, ProductRead, ProductUpdate,
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
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


<<<<<<< HEAD
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
=======
# ── Bulk import ───────────────────────────────────────────────────────────────

@router.get("/bulk-import/template")
def download_template(_=Depends(require_roles("owner"))):
    """Return a pre-filled .xlsx template for bulk product import."""
    try:
        data = product_service.generate_template_bytes()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return Response(
        content=data,
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": "attachment; filename=products_import_template.xlsx"},
    )


@router.post("/bulk-import", response_model=BulkImportResult)
async def bulk_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_roles("owner")),
):
    """
    Upload an .xlsx file to bulk-create or update products.
    - SKU match → UPDATE existing product
    - No SKU match → CREATE new product
    """
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .xlsx files are accepted. Please use the provided template.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024:  # 5 MB guard
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 5 MB).")

    try:
        result = product_service.bulk_import_products(db, file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("bulk_import failed: %s", exc)
        raise HTTPException(status_code=500, detail="Import failed due to a server error.") from exc

    return result
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
